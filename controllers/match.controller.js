const Match = require('../models/Match.model');
const Bet = require('../models/Bet.model');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const { updateBonusTurnover, calculateLossBonus } = require('./bonus.controller');
const mongoose = require('mongoose');

// -------------------------------------------
// @desc    Get all matches
// @route   GET /api/matches
// @access  Private
// -------------------------------------------
exports.getMatches = async (req, res) => {
  try {
    const { status, league, category, startDate, endDate, limit = 50, page = 1 } = req.query;

    const query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // League filter
    if (league) {
      query.league = league;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Date range filter
    if (startDate || endDate) {
      query.matchDate = {};
      if (startDate) {
        query.matchDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.matchDate.$lte = new Date(endDate);
      }
    }

    const matches = await Match.find(query)
      .populate('createdBy', 'username')
      .populate('result.settledBy', 'username')
      .sort({ matchDate: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Match.countDocuments(query);

    res.json({
      matches,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get match by ID
// @route   GET /api/matches/:id
// @access  Private
// -------------------------------------------
exports.getMatchById = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('createdBy', 'username')
      .populate('result.settledBy', 'username');

    if (!match) {
      return res.status(404).json({ message: 'Maç bulunamadı' });
    }

    // Get bet count for this match
    const betCount = await Bet.countDocuments({ match: match._id });
    const totalStakes = await Bet.aggregate([
      { $match: { match: match._id } },
      { $group: { _id: null, total: { $sum: '$stake' } } },
    ]);

    res.json({
      match,
      stats: {
        betCount,
        totalStakes: totalStakes[0]?.total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Create match (Admin only)
// @route   POST /api/matches
// @access  Private (Admin only)
// -------------------------------------------
exports.createMatch = async (req, res) => {
  try {
    const {
      league,
      category,
      matchName,
      teamA,
      teamB,
      matchDate,
      matchTime,
      markets,
      bonusType,
    } = req.body;

    // Validate required fields
    if (!league || !matchName || !teamA || !teamB || !matchDate) {
      return res.status(400).json({
        message: 'Lütfen tüm gerekli alanları doldurun (league, matchName, teamA, teamB, matchDate)',
      });
    }

    // Validate markets
    if (!markets || !Array.isArray(markets) || markets.length === 0) {
      return res.status(400).json({
        message: 'En az bir market (bahis seçeneği) eklemelisiniz',
      });
    }

    // Validate each market
    for (const market of markets) {
      if (!market.type || !market.name || !market.selections || !Array.isArray(market.selections)) {
        return res.status(400).json({
          message: 'Her market için type, name ve selections gerekli',
        });
      }

      if (market.selections.length === 0) {
        return res.status(400).json({
          message: 'Her market için en az bir selection (seçenek) gerekli',
        });
      }

      for (const selection of market.selections) {
        if (!selection.name || !selection.odds || selection.odds < 1.0) {
          return res.status(400).json({
            message: 'Her selection için name ve geçerli odds (>= 1.0) gerekli',
          });
        }
      }
    }

    // Create match
    const match = await Match.create({
      league,
      category,
      matchName,
      teamA,
      teamB,
      matchDate: new Date(matchDate),
      matchTime,
      markets,
      bonusType: bonusType || null,
      status: 'upcoming',
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: 'Maç başarıyla oluşturuldu',
      match,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Update match (Admin only)
// @route   PUT /api/matches/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow updating if match is finished or has bets
    const match = await Match.findById(id);
    if (!match) {
      return res.status(404).json({ message: 'Maç bulunamadı' });
    }

    if (match.status === 'finished' || match.result.isSettled) {
      return res.status(400).json({
        message: 'Settled maçlar güncellenemez',
      });
    }

    // Check if match has bets
    const betCount = await Bet.countDocuments({ match: id });
    if (betCount > 0 && (updateData.markets || updateData.matchDate)) {
      return res.status(400).json({
        message: 'Bahis alınmış maçların markets ve tarihi güncellenemez',
      });
    }

    // Update match
    const updatedMatch = await Match.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('createdBy', 'username');

    res.json({
      message: 'Maç güncellendi',
      match: updatedMatch,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Enter match result and settle bets (Admin only)
// @route   POST /api/matches/:id/result
// @access  Private (Admin only)
// -------------------------------------------
exports.enterMatchResult = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { teamAScore, teamBScore } = req.body;

    // Validate scores
    if (
      teamAScore === undefined ||
      teamBScore === undefined ||
      teamAScore < 0 ||
      teamBScore < 0
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Geçerli skorlar giriniz (teamAScore, teamBScore >= 0)',
      });
    }

    // Find match
    const match = await Match.findById(id).session(session);
    if (!match) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Maç bulunamadı' });
    }

    if (match.result.isSettled) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Bu maç zaten settle edilmiş' });
    }

    // Determine winner
    let winner = null;
    if (teamAScore > teamBScore) {
      winner = 'teamA';
    } else if (teamBScore > teamAScore) {
      winner = 'teamB';
    } else {
      winner = 'draw';
    }

    // Update match result
    match.result.teamAScore = teamAScore;
    match.result.teamBScore = teamBScore;
    match.result.winner = winner;
    match.result.isSettled = true;
    match.result.settledAt = new Date();
    match.result.settledBy = req.user.id;
    match.status = 'finished';
    await match.save({ session });

    // Get all pending bets for this match
    const bets = await Bet.find({ match: id, status: 'pending' }).session(session);

    let settledCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    let totalWinAmount = 0;

    // Settle each bet
    for (const bet of bets) {
      let isWin = false;

      // Determine if bet won based on market type
      if (bet.marketType === '1X2') {
        if (bet.selection === 'Team A Win' && winner === 'teamA') {
          isWin = true;
        } else if (bet.selection === 'Team B Win' && winner === 'teamB') {
          isWin = true;
        } else if (bet.selection === 'Draw' && winner === 'draw') {
          isWin = true;
        }
      } else if (bet.marketType === 'over_under') {
        // Extract value from selection (e.g., "Over 2.5" -> 2.5)
        const totalGoals = teamAScore + teamBScore;
        const valueMatch = bet.selection.match(/(\d+\.?\d*)/);
        if (valueMatch) {
          const threshold = parseFloat(valueMatch[1]);
          if (bet.selection.toLowerCase().includes('over') && totalGoals > threshold) {
            isWin = true;
          } else if (bet.selection.toLowerCase().includes('under') && totalGoals < threshold) {
            isWin = true;
          }
        }
      } else if (bet.marketType === 'both_teams_score') {
        const bothScored = teamAScore > 0 && teamBScore > 0;
        if (
          (bet.selection.toLowerCase().includes('yes') && bothScored) ||
          (bet.selection.toLowerCase().includes('no') && !bothScored)
        ) {
          isWin = true;
        }
      }
      // Add more market types as needed

      // Update bet status
      if (isWin) {
        bet.status = 'won';
        bet.winAmount = bet.potentialWin;
        bet.settledAt = new Date();
        wonCount++;
        totalWinAmount += bet.winAmount;

        // Get user and credit winnings
        const user = await User.findById(bet.user).session(session);
        if (user) {
          user.balance += bet.winAmount;
          user.totalWinnings += bet.winAmount;
          await user.save({ session });

          // Create win transaction
          const winTransaction = await Transaction.create(
            [
              {
                user: user._id,
                type: 'win',
                amount: bet.winAmount,
                status: 'completed',
                paymentMethod: 'internal',
                description: `Maç Bahis Kazancı - ${match.matchName}`,
                transactionId: `WIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                metadata: {
                  betId: bet._id,
                  matchId: match._id,
                },
              },
            ],
            { session }
          );

          bet.winTransaction = winTransaction[0]._id;
        }
      } else {
        bet.status = 'lost';
        bet.settledAt = new Date();
        lostCount++;
      }

      await bet.save({ session });
      settledCount++;
    }

    await session.commitTransaction();

    // Check if match has loss bonus enabled and calculate loss bonuses for users who lost
    // This runs after transaction commit to avoid blocking
    if (match.bonusType === 'loss_bonus') {
      // Get unique users who placed bets on this match
      const uniqueUserIds = [...new Set(bets.map((bet) => bet.user.toString()))];

      // Calculate loss bonus for each user (async, don't wait)
      uniqueUserIds.forEach(async (userId) => {
        try {
          await calculateLossBonus(userId, 'daily');
        } catch (error) {
          console.error(`Error calculating loss bonus for user ${userId}:`, error);
        }
      });
    }

    res.json({
      message: 'Maç sonucu girildi ve bahisler settle edildi',
      match: {
        id: match._id,
        result: match.result,
      },
      settlement: {
        totalBets: settledCount,
        won: wonCount,
        lost: lostCount,
        totalWinAmount,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Place bet on match
// @route   POST /api/matches/:id/bet
// @access  Private
// -------------------------------------------
exports.placeBet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { marketType, marketName, selection, stake, useBonusBalance } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!marketType || !marketName || !selection || !stake || stake <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Lütfen tüm gerekli alanları doldurun (marketType, marketName, selection, stake)',
      });
    }

    // Find match
    const match = await Match.findById(id).session(session);
    if (!match) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Maç bulunamadı' });
    }

    // Check if match is still open for betting
    if (match.status !== 'upcoming' && match.status !== 'live') {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Bu maç için bahis alınmıyor',
      });
    }

    if (match.result.isSettled) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Bu maç zaten settle edilmiş',
      });
    }

    // Find the market and selection to get odds
    const market = match.markets.find(
      (m) => m.type === marketType && m.name === marketName
    );
    if (!market) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Market bulunamadı' });
    }

    const marketSelection = market.selections.find((s) => s.name === selection);
    if (!marketSelection) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Seçim bulunamadı' });
    }

    const odds = marketSelection.odds;
    const potentialWin = stake * odds;

    // Get user
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Check if user is banned or self-excluded
    if (user.status === 'banned' || user.status === 'self_excluded') {
      await session.abortTransaction();
      return res.status(403).json({
        message: 'Hesabınız bahis yapamaz durumda',
      });
    }

    // Calculate balance usage
    let usedBonusBalance = 0;
    let usedMainBalance = stake;

    if (useBonusBalance && user.bonusBalance > 0) {
      if (user.bonusBalance >= stake) {
        usedBonusBalance = stake;
        usedMainBalance = 0;
      } else {
        usedBonusBalance = user.bonusBalance;
        usedMainBalance = stake - user.bonusBalance;
      }
    }

    // Check if user has enough balance
    if (user.balance < usedMainBalance || user.bonusBalance < usedBonusBalance) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Yetersiz bakiye',
        availableBalance: user.balance,
        availableBonusBalance: user.bonusBalance,
      });
    }

    // Deduct balances
    user.balance -= usedMainBalance;
    user.bonusBalance -= usedBonusBalance;
    await user.save({ session });

    // Create bet
    const bet = await Bet.create(
      [
        {
          user: userId,
          match: id,
          marketType,
          marketName,
          selection,
          odds,
          stake,
          potentialWin,
          usedBonusBalance,
          usedMainBalance,
          status: 'pending',
        },
      ],
      { session }
    );

    // Create transaction
    const transaction = await Transaction.create(
      [
        {
          user: userId,
          type: 'bet',
          amount: stake,
          status: 'completed',
          paymentMethod: 'internal',
          description: `Maç Bahisi - ${match.matchName} (${selection})`,
          transactionId: `BET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          metadata: {
            betId: bet[0]._id,
            matchId: match._id,
            marketType,
            selection,
            odds,
          },
        },
      ],
      { session }
    );

    bet[0].transaction = transaction[0]._id;
    await bet[0].save({ session });

    // Update bonus turnover if bonus balance was used
    if (usedBonusBalance > 0) {
      await updateBonusTurnover(userId, stake, usedBonusBalance, session);
    }

    await session.commitTransaction();

    res.status(201).json({
      message: 'Bahis başarıyla oluşturuldu',
      bet: {
        id: bet[0]._id,
        match: match.matchName,
        selection,
        odds,
        stake,
        potentialWin,
        status: bet[0].status,
      },
      newBalance: user.balance,
      newBonusBalance: user.bonusBalance,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Get user's bets
// @route   GET /api/matches/bets/my
// @access  Private
// -------------------------------------------
exports.getMyBets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, matchId, limit = 50, page = 1 } = req.query;

    const query = { user: userId };
    if (status) query.status = status;
    if (matchId) query.match = matchId;

    const bets = await Bet.find(query)
      .populate('match', 'matchName teamA teamB matchDate status result')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bet.countDocuments(query);

    res.json({
      bets,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

