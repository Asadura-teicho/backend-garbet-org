/**
 * Admin Game Catalog Controller
 * Handles game catalog management (CRUD operations)
 */

const GameCatalog = require('../../models/GameCatalog.model');
const { logAdminAction, getIpAddress, getUserAgent } = require('../../utils/adminLogger');

// -------------------------------------------
// @desc    Get all games (with filters and pagination)
// @route   GET /api/admin/games
// @access  Private (Admin only)
// -------------------------------------------
exports.getGames = async (req, res) => {
  try {
    const {
      search,
      gameType,
      provider,
      status,
      limit = 20,
      page = 1,
    } = req.query;

    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { gameId: { $regex: search, $options: 'i' } },
        { provider: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Game type filter
    if (gameType && gameType !== 'all') {
      query.gameType = gameType;
    }

    // Provider filter
    if (provider && provider !== 'all') {
      query.provider = provider;
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    const games = await GameCatalog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await GameCatalog.countDocuments(query);

    res.json({
      games,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get game by ID
// @route   GET /api/admin/games/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.getGameById = async (req, res) => {
  try {
    const game = await GameCatalog.findById(req.params.id);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Create new game
// @route   POST /api/admin/games
// @access  Private (Admin only)
// -------------------------------------------
exports.createGame = async (req, res) => {
  try {
    const adminId = req.user.id;
    const {
      name,
      provider,
      gameType,
      gameId,
      thumbnail,
      status,
      description,
      minBet,
      maxBet,
      rtp,
      features,
      tags,
      isNew,
      isFeatured,
      isHot,
    } = req.body;

    // Validate required fields
    if (!name || !provider || !gameType || !gameId) {
      return res.status(400).json({
        message: 'Name, provider, gameType, and gameId are required',
      });
    }

    // Check if gameId already exists
    const existingGame = await GameCatalog.findOne({ gameId });
    if (existingGame) {
      return res.status(400).json({
        message: 'Game with this gameId already exists',
      });
    }

    // Create game
    const game = await GameCatalog.create({
      name,
      provider,
      gameType,
      gameId,
      thumbnail: thumbnail || null,
      status: status || 'active',
      description: description || '',
      minBet: minBet || 0,
      maxBet: maxBet || null,
      rtp: rtp || null,
      features: features || [],
      tags: tags || [],
      isNew: isNew || false,
      isFeatured: isFeatured || false,
      isHot: isHot || false,
    });

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'game_created',
      targetType: 'game_catalog',
      targetId: game._id,
      description: `Game "${name}" created`,
      after: game.toObject(),
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.status(201).json({
      message: 'Game created successfully',
      game,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Game with this gameId already exists',
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Update game
// @route   PUT /api/admin/games/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.updateGame = async (req, res) => {
  try {
    const adminId = req.user.id;
    const gameId = req.params.id;

    const game = await GameCatalog.findById(gameId);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    const before = { ...game.toObject() };

    // Update fields
    const allowedFields = [
      'name',
      'provider',
      'gameType',
      'gameId',
      'thumbnail',
      'status',
      'description',
      'minBet',
      'maxBet',
      'rtp',
      'features',
      'tags',
      'isNew',
      'isFeatured',
      'isHot',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        game[field] = req.body[field];
      }
    });

    await game.save();
    const after = { ...game.toObject() };

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'game_updated',
      targetType: 'game_catalog',
      targetId: game._id,
      description: `Game "${game.name}" updated`,
      before,
      after,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
      metadata: { updatedFields: Object.keys(req.body) },
    });

    res.json({
      message: 'Game updated successfully',
      game,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Game with this gameId already exists',
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Delete game
// @route   DELETE /api/admin/games/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.deleteGame = async (req, res) => {
  try {
    const adminId = req.user.id;
    const gameId = req.params.id;

    const game = await GameCatalog.findById(gameId);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    const before = { ...game.toObject() };

    await GameCatalog.findByIdAndDelete(gameId);

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'game_deleted',
      targetType: 'game_catalog',
      targetId: gameId,
      description: `Game "${game.name}" deleted`,
      before,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.json({
      message: 'Game deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get game providers list
// @route   GET /api/admin/games/providers
// @access  Private (Admin only)
// -------------------------------------------
exports.getProviders = async (req, res) => {
  try {
    const providers = await GameCatalog.distinct('provider');
    res.json({
      providers: providers.sort(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
