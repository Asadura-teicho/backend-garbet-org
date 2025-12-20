/**
 * Admin Tournament Controller
 * Handles tournament management operations for admins
 */

const Tournament = require('../../models/Tournament.model');
const TournamentParticipant = require('../../models/TournamentParticipant.model');
const { AppError, asyncHandler } = require('../../middleware/error.middleware');

// -------------------------------------------
// @desc    Get all tournaments (admin)
// @route   GET /api/admin/tournaments
// @access  Private/Admin
// -------------------------------------------
exports.getTournaments = asyncHandler(async (req, res) => {
  const {
    status,
    gameType,
    featured,
    page = 1,
    limit = 20,
    search,
  } = req.query;

  const query = {};

  // Filter by status
  if (status && status !== 'all') {
    query.status = status;
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

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;

  const tournaments = await Tournament.find(query)
    .sort({ priority: -1, isFeatured: -1, startDate: 1 })
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum)
    .lean();

  const total = await Tournament.countDocuments(query);

  res.json({
    tournaments,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    total,
  });
});

// -------------------------------------------
// @desc    Get tournament by ID (admin)
// @route   GET /api/admin/tournaments/:id
// @access  Private/Admin
// -------------------------------------------
exports.getTournamentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const tournament = await Tournament.findById(id).lean();

  if (!tournament) {
    throw new AppError('Tournament not found', 404);
  }

  // Get participant count
  const participantCount = await TournamentParticipant.countDocuments({
    tournament: id,
  });

  res.json({
    ...tournament,
    participantCount,
  });
});

// -------------------------------------------
// @desc    Create tournament (admin)
// @route   POST /api/admin/tournaments
// @access  Private/Admin
// -------------------------------------------
exports.createTournament = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    gameType,
    status = 'upcoming',
    startDate,
    endDate,
    registrationStartDate,
    registrationEndDate,
    prizePool,
    prizeDistribution,
    entryFee = 0,
    minPlayers = 1,
    maxPlayers,
    scoringType = 'points',
    scoringRules,
    bannerImage,
    termsAndConditions,
    isFeatured = false,
    priority = 0,
    eligibleUsers,
    excludedUsers,
  } = req.body;

  // Validation
  if (!name || !gameType || !startDate || !endDate || !prizePool) {
    throw new AppError('Missing required fields: name, gameType, startDate, endDate, prizePool', 400);
  }

  if (new Date(startDate) >= new Date(endDate)) {
    throw new AppError('End date must be after start date', 400);
  }

  if (prizePool < 0) {
    throw new AppError('Prize pool must be non-negative', 400);
  }

  if (entryFee < 0) {
    throw new AppError('Entry fee must be non-negative', 400);
  }

  const tournament = await Tournament.create({
    name,
    description,
    gameType,
    status,
    startDate,
    endDate,
    registrationStartDate: registrationStartDate || startDate,
    registrationEndDate: registrationEndDate || endDate,
    prizePool,
    prizeDistribution: prizeDistribution || [],
    entryFee,
    minPlayers,
    maxPlayers: maxPlayers || null,
    scoringType,
    scoringRules: scoringRules || {},
    bannerImage,
    termsAndConditions,
    isFeatured,
    priority,
    eligibleUsers: eligibleUsers || [],
    excludedUsers: excludedUsers || [],
    createdBy: req.user.id,
  });

  res.status(201).json({
    tournament,
    message: 'Tournament created successfully',
  });
});

// -------------------------------------------
// @desc    Update tournament (admin)
// @route   PUT /api/admin/tournaments/:id
// @access  Private/Admin
// -------------------------------------------
exports.updateTournament = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const tournament = await Tournament.findById(id);

  if (!tournament) {
    throw new AppError('Tournament not found', 404);
  }

  // Validation
  if (updateData.startDate && updateData.endDate) {
    if (new Date(updateData.startDate) >= new Date(updateData.endDate)) {
      throw new AppError('End date must be after start date', 400);
    }
  }

  if (updateData.prizePool !== undefined && updateData.prizePool < 0) {
    throw new AppError('Prize pool must be non-negative', 400);
  }

  if (updateData.entryFee !== undefined && updateData.entryFee < 0) {
    throw new AppError('Entry fee must be non-negative', 400);
  }

  // Update tournament
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) {
      tournament[key] = updateData[key];
    }
  });

  await tournament.save();

  res.json({
    tournament,
    message: 'Tournament updated successfully',
  });
});

// -------------------------------------------
// @desc    Delete tournament (admin)
// @route   DELETE /api/admin/tournaments/:id
// @access  Private/Admin
// -------------------------------------------
exports.deleteTournament = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const tournament = await Tournament.findById(id);

  if (!tournament) {
    throw new AppError('Tournament not found', 404);
  }

  // Check if tournament has participants
  const participantCount = await TournamentParticipant.countDocuments({
    tournament: id,
  });

  if (participantCount > 0) {
    throw new AppError('Cannot delete tournament with participants. Cancel it instead.', 400);
  }

  await Tournament.findByIdAndDelete(id);

  res.json({
    message: 'Tournament deleted successfully',
  });
});

// -------------------------------------------
// @desc    Get tournament participants (admin)
// @route   GET /api/admin/tournaments/:id/participants
// @access  Private/Admin
// -------------------------------------------
exports.getTournamentParticipants = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;

  const tournament = await Tournament.findById(id);

  if (!tournament) {
    throw new AppError('Tournament not found', 404);
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 50;

  const participants = await TournamentParticipant.find({ tournament: id })
    .populate('user', 'username email')
    .sort({ rank: 1, score: -1 })
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum)
    .lean();

  const total = await TournamentParticipant.countDocuments({ tournament: id });

  res.json({
    participants,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    total,
  });
});

