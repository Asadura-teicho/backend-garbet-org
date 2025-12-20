/**
 * Admin Game Round Management Controller
 * Handles game round operations (start, crash, view rounds)
 */

const gameRoundService = require('../../services/gameRound.service');
const { logAdminAction, getIpAddress, getUserAgent } = require('../../utils/adminLogger');

// -------------------------------------------
// @desc    Start a new game round
// @route   POST /api/admin/game-rounds/start
// @access  Private (Admin only)
// -------------------------------------------
exports.startRound = async (req, res) => {
  try {
    const adminId = req.user.id;

    const gameRound = await gameRoundService.startRound(adminId);

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'start_game_round',
      targetType: 'game_round',
      targetId: gameRound._id,
      description: `Started game round #${gameRound.roundNumber}`,
      metadata: {
        roundNumber: gameRound.roundNumber,
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.json({
      message: `Round #${gameRound.roundNumber} started successfully`,
      round: gameRound,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Crash the current active round
// @route   POST /api/admin/game-rounds/crash
// @access  Private (Admin only)
// -------------------------------------------
exports.crashRound = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { multiplier } = req.body; // Optional multiplier at crash

    const gameRound = await gameRoundService.crashRound(adminId, multiplier);

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'crash_game_round',
      targetType: 'game_round',
      targetId: gameRound._id,
      description: `Crashed game round #${gameRound.roundNumber} at multiplier ${gameRound.multiplier}`,
      metadata: {
        roundNumber: gameRound.roundNumber,
        multiplier: gameRound.multiplier,
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.json({
      message: `Round #${gameRound.roundNumber} crashed at multiplier ${gameRound.multiplier}`,
      round: gameRound,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get current active round
// @route   GET /api/admin/game-rounds/current
// @access  Private (Admin only)
// -------------------------------------------
exports.getCurrentRound = async (req, res) => {
  try {
    const gameRound = await gameRoundService.getCurrentRound();

    if (!gameRound) {
      return res.json({
        message: 'No active round',
        round: null,
      });
    }

    // Get statistics for the round
    const statistics = await gameRoundService.getRoundStatistics(gameRound._id);

    res.json({
      round: gameRound,
      statistics,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get round statistics
// @route   GET /api/admin/game-rounds/:id/statistics
// @access  Private (Admin only)
// -------------------------------------------
exports.getRoundStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    const statistics = await gameRoundService.getRoundStatistics(id);

    res.json({
      statistics,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get recent rounds with pagination
// @route   GET /api/admin/game-rounds
// @access  Private (Admin only)
// -------------------------------------------
exports.getRecentRounds = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
    } = req.query;

    const result = await gameRoundService.getRecentRounds({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });

    res.json({
      rounds: result.rounds,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      total: result.total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get round details with all bets
// @route   GET /api/admin/game-rounds/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.getRoundDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const GameRound = require('../../models/GameRound.model');
    const BetRound = require('../../models/BetRound.model');

    const gameRound = await GameRound.findById(id)
      .populate('createdBy', 'username email firstName lastName')
      .populate('crashedBy', 'username email firstName lastName');

    if (!gameRound) {
      return res.status(404).json({ message: 'Round not found' });
    }

    // Get all bets for this round
    const bets = await BetRound.find({ gameRound: id })
      .populate('user', 'username email firstName lastName')
      .sort({ createdAt: -1 });

    // Get statistics
    const statistics = await gameRoundService.getRoundStatistics(id);

    res.json({
      round: gameRound,
      bets,
      statistics,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Complete a round manually (optional)
// @route   POST /api/admin/game-rounds/:id/complete
// @access  Private (Admin only)
// -------------------------------------------
exports.completeRound = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const gameRound = await gameRoundService.completeRound(id);

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'complete_game_round',
      targetType: 'game_round',
      targetId: gameRound._id,
      description: `Completed game round #${gameRound.roundNumber}`,
      metadata: {
        roundNumber: gameRound.roundNumber,
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.json({
      message: `Round #${gameRound.roundNumber} completed successfully`,
      round: gameRound,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


