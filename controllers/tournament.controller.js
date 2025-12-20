/**
 * Tournament Controller
 * Handles tournament operations
 */

const Tournament = require('../models/Tournament.model');
const TournamentParticipant = require('../models/TournamentParticipant.model');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const { createNotification } = require('../utils/notificationHelper');
const mongoose = require('mongoose');

// -------------------------------------------
// @desc    Get active tournaments
// @route   GET /api/tournaments
// @access  Public/Private
// -------------------------------------------
exports.getTournaments = async (req, res) => {
  try {
    const {
      status,
      gameType,
      featured,
      page = 1,
      limit = 20,
      search,
    } = req.query;
    const userId = req.user?.id;

    const query = {};

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    } else {
      // Default: show active and upcoming
      query.status = { $in: ['active', 'upcoming'] };
    }

    // Filter by game type
    if (gameType && gameType !== 'all') {
      query.gameType = gameType;
    }

    // Filter featured
    if (featured === 'true') {
      query.isFeatured = true;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const tournaments = await Tournament.find(query)
      .sort({ priority: -1, isFeatured: -1, startDate: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Tournament.countDocuments(query);

    // If user is authenticated, add participation status
    let tournamentsWithStatus = tournaments;
    if (userId) {
      const userParticipations = await TournamentParticipant.find({
        user: userId,
        tournament: { $in: tournaments.map((t) => t._id) },
      });

      const participationMap = new Map(
        userParticipations.map((p) => [p.tournament.toString(), p])
      );

      tournamentsWithStatus = tournaments.map((tournament) => {
        const participation = participationMap.get(tournament._id.toString());
        const tournamentObj = tournament.toObject();

        const isRegistered = !!participation;
        const canJoin = checkCanJoin(tournament, userId, isRegistered);

        return {
          ...tournamentObj,
          isRegistered,
          canJoin,
          participation: participation
            ? {
                status: participation.status,
                rank: participation.rank,
                score: participation.score,
                points: participation.points,
              }
            : null,
        };
      });
    }

    res.json({
      tournaments: tournamentsWithStatus,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get tournament by ID
// @route   GET /api/tournaments/:id
// @access  Public/Private
// -------------------------------------------
exports.getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const tournamentObj = tournament.toObject();

    // If user is authenticated, add participation status
    if (userId) {
      const participation = await TournamentParticipant.findOne({
        user: userId,
        tournament: id,
      });

      const isRegistered = !!participation;
      const canJoin = checkCanJoin(tournament, userId, isRegistered);

      tournamentObj.isRegistered = isRegistered;
      tournamentObj.canJoin = canJoin;
      tournamentObj.participation = participation
        ? {
            status: participation.status,
            rank: participation.rank,
            score: participation.score,
            points: participation.points,
            winnings: participation.winnings,
            turnover: participation.turnover,
          }
        : null;
    }

    res.json(tournamentObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Join tournament
// @route   POST /api/tournaments/:id/join
// @access  Private
// -------------------------------------------
exports.joinTournament = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get tournament
    const tournament = await Tournament.findById(id).session(session);
    if (!tournament) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Check if user can join
    const canJoin = checkCanJoin(tournament, userId, false);
    if (!canJoin.allowed) {
      await session.abortTransaction();
      return res.status(400).json({ message: canJoin.reason });
    }

    // Check if already registered
    const existing = await TournamentParticipant.findOne({
      user: userId,
      tournament: id,
    }).session(session);

    if (existing) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'You are already registered for this tournament' });
    }

    // Get user
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Check entry fee
    if (tournament.entryFee > 0) {
      if ((user.balance || 0) < tournament.entryFee) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient balance. Entry fee is ₺${tournament.entryFee}`,
        });
      }

      // Deduct entry fee
      user.balance = (user.balance || 0) - tournament.entryFee;
      await user.save({ session });

      // Create transaction
      await Transaction.create(
        [
          {
            user: userId,
            type: 'tournament_entry',
            amount: tournament.entryFee,
            status: 'completed',
            description: `Tournament entry fee: ${tournament.name}`,
            metadata: {
              tournamentId: tournament._id,
            },
          },
        ],
        { session }
      );
    }

    // Create participant
    const participant = await TournamentParticipant.create(
      [
        {
          tournament: id,
          user: userId,
          status: tournament.status === 'active' ? 'active' : 'registered',
          startedAt: tournament.status === 'active' ? new Date() : null,
        },
      ],
      { session }
    );

    // Update tournament participant count
    tournament.totalParticipants += 1;
    await tournament.save({ session });

    await session.commitTransaction();

    // Create notification
    createNotification({
      userId,
      type: 'promotion',
      title: 'Tournament Registration',
      message: `You have successfully joined the tournament: ${tournament.name}`,
      link: `/tournaments/${id}`,
      metadata: { tournamentId: id, participantId: participant[0]._id },
    }).catch((err) => console.error('Notification creation error:', err));

    res.status(201).json({
      message: 'Successfully joined tournament',
      participant: participant[0],
      tournament: {
        id: tournament._id,
        name: tournament.name,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You are already registered for this tournament' });
    }
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Get user's tournaments
// @route   GET /api/tournaments/my
// @access  Private
// -------------------------------------------
exports.getMyTournaments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { user: userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const participations = await TournamentParticipant.find(query)
      .populate('tournament', 'name gameType status startDate endDate prizePool bannerImage')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await TournamentParticipant.countDocuments(query);

    res.json({
      participations,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get tournament leaderboard
// @route   GET /api/tournaments/:id/leaderboard
// @access  Public/Private
// -------------------------------------------
exports.getLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.id;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Determine sort field based on scoring type
    let sortField = 'score';
    if (tournament.scoringType === 'winnings') {
      sortField = 'winnings';
    } else if (tournament.scoringType === 'turnover') {
      sortField = 'turnover';
    } else if (tournament.scoringType === 'points') {
      sortField = 'points';
    }

    const participants = await TournamentParticipant.find({
      tournament: id,
      status: { $in: ['active', 'completed'] },
    })
      .populate('user', 'username email firstName lastName')
      .sort({ [sortField]: -1, createdAt: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Calculate ranks
    const allParticipants = await TournamentParticipant.find({
      tournament: id,
      status: { $in: ['active', 'completed'] },
    })
      .sort({ [sortField]: -1, createdAt: 1 })
      .select('_id user');

    const rankMap = new Map();
    allParticipants.forEach((p, index) => {
      rankMap.set(p._id.toString(), index + 1);
    });

    const leaderboard = participants.map((participant) => {
      const rank = rankMap.get(participant._id.toString());
      return {
        rank,
        user: participant.user,
        score: participant.score,
        points: participant.points,
        winnings: participant.winnings,
        turnover: participant.turnover,
        status: participant.status,
        isCurrentUser: userId && participant.user._id.toString() === userId.toString(),
      };
    });

    const total = await TournamentParticipant.countDocuments({
      tournament: id,
      status: { $in: ['active', 'completed'] },
    });

    // Get user's rank if authenticated
    let userRank = null;
    if (userId) {
      const userParticipant = await TournamentParticipant.findOne({
        tournament: id,
        user: userId,
        status: { $in: ['active', 'completed'] },
      });

      if (userParticipant) {
        userRank = rankMap.get(userParticipant._id.toString());
      }
    }

    res.json({
      leaderboard,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      userRank,
      tournament: {
        id: tournament._id,
        name: tournament.name,
        scoringType: tournament.scoringType,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get tournament standings
// @route   GET /api/tournaments/:id/standings
// @access  Public/Private
// -------------------------------------------
exports.getStandings = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Determine sort field
    let sortField = 'score';
    if (tournament.scoringType === 'winnings') {
      sortField = 'winnings';
    } else if (tournament.scoringType === 'turnover') {
      sortField = 'turnover';
    } else if (tournament.scoringType === 'points') {
      sortField = 'points';
    }

    const participants = await TournamentParticipant.find({
      tournament: id,
      status: { $in: ['active', 'completed'] },
    })
      .populate('user', 'username email firstName lastName')
      .sort({ [sortField]: -1, createdAt: 1 });

    // Calculate ranks and prizes
    const standings = participants.map((participant, index) => {
      const rank = index + 1;
      const prizeInfo = tournament.prizeDistribution.find((p) => p.rank === rank);

      return {
        rank,
        user: participant.user,
        score: participant.score,
        points: participant.points,
        winnings: participant.winnings,
        turnover: participant.turnover,
        prize: prizeInfo ? prizeInfo.prize : 0,
        prizePercentage: prizeInfo ? prizeInfo.percentage : 0,
        status: participant.status,
        isCurrentUser: userId && participant.user._id.toString() === userId.toString(),
      };
    });

    // Get user's standing if authenticated
    let userStanding = null;
    if (userId) {
      const userParticipant = await TournamentParticipant.findOne({
        tournament: id,
        user: userId,
      }).populate('user', 'username email firstName lastName');

      if (userParticipant) {
        const userRank = standings.findIndex(
          (s) => s.user._id.toString() === userId.toString()
        );
        if (userRank !== -1) {
          userStanding = standings[userRank];
        } else {
          // User is registered but not in standings (disqualified, etc.)
          userStanding = {
            rank: null,
            user: userParticipant.user,
            score: userParticipant.score,
            points: userParticipant.points,
            winnings: userParticipant.winnings,
            turnover: userParticipant.turnover,
            prize: 0,
            status: userParticipant.status,
            isCurrentUser: true,
          };
        }
      }
    }

    res.json({
      standings,
      userStanding,
      tournament: {
        id: tournament._id,
        name: tournament.name,
        prizePool: tournament.prizePool,
        prizeDistribution: tournament.prizeDistribution,
        scoringType: tournament.scoringType,
        status: tournament.status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// Helper Functions
// -------------------------------------------

/**
 * Check if user can join tournament
 */
function checkCanJoin(tournament, userId, isRegistered) {
  if (isRegistered) {
    return { allowed: false, reason: 'You are already registered for this tournament' };
  }

  const now = new Date();

  // Check status
  if (tournament.status === 'finished' || tournament.status === 'cancelled') {
    return { allowed: false, reason: 'Tournament is not accepting new participants' };
  }

  // Check registration dates
  if (tournament.registrationStartDate && tournament.registrationStartDate > now) {
    return { allowed: false, reason: 'Registration has not started yet' };
  }

  if (tournament.registrationEndDate && tournament.registrationEndDate < now) {
    return { allowed: false, reason: 'Registration has ended' };
  }

  // Check max players
  if (tournament.maxPlayers && tournament.totalParticipants >= tournament.maxPlayers) {
    return { allowed: false, reason: 'Tournament is full' };
  }

  // Check eligibility
  if (tournament.excludedUsers && tournament.excludedUsers.some((id) => id.toString() === userId.toString())) {
    return { allowed: false, reason: 'You are not eligible for this tournament' };
  }

  if (tournament.eligibleUsers && tournament.eligibleUsers.length > 0) {
    if (!tournament.eligibleUsers.some((id) => id.toString() === userId.toString())) {
      return { allowed: false, reason: 'You are not eligible for this tournament' };
    }
  }

  return { allowed: true };
}
