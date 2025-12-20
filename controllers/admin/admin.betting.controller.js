/**
 * Admin Betting Management Controller
 * Handles betting operations
 */

const Bet = require('../../models/Bet.model');
const User = require('../../models/User.model');
const Transaction = require('../../models/Transaction.model');
const mongoose = require('mongoose');
const { logAdminAction, getIpAddress, getUserAgent } = require('../../utils/adminLogger');
const { createNotification } = require('../../utils/notificationHelper');

// -------------------------------------------
// @desc    Get all bets with pagination and filters (Admin)
// @route   GET /api/admin/bets
// @access  Private (Admin only)
// -------------------------------------------
exports.getBets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      startDate,
      endDate,
      userId,
      matchId,
    } = req.query;

    const query = {};

    // User filter
    if (userId) {
      query.user = userId;
    }

    // Match filter
    if (matchId) {
      query.match = matchId;
    }

    // Status filter
    if (status && status !== 'Status') {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Search filter (user username/email or bet ID)
    let betsQuery = Bet.find(query)
      .populate('user', 'username email firstName lastName')
      .populate('match', 'teamA teamB league category matchDate matchName status result')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const bets = await betsQuery;

    // Filter by search if provided (after population)
    let filteredBets = bets;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredBets = bets.filter(
        (bet) =>
          bet.user?.username?.toLowerCase().includes(searchLower) ||
          bet.user?.email?.toLowerCase().includes(searchLower) ||
          bet._id.toString().toLowerCase().includes(searchLower) ||
          bet.match?.teamA?.toLowerCase().includes(searchLower) ||
          bet.match?.teamB?.toLowerCase().includes(searchLower) ||
          bet.match?.matchName?.toLowerCase().includes(searchLower) ||
          bet.marketName?.toLowerCase().includes(searchLower) ||
          bet.selection?.toLowerCase().includes(searchLower)
      );
    }

    const total = await Bet.countDocuments(query);

    res.json({
      bets: filteredBets,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Settle a single bet (Admin)
// @route   PUT /api/admin/bets/:id/settle
// @access  Private (Admin only)
// -------------------------------------------
exports.settleBet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { status, winAmount } = req.body;
    const adminId = req.user.id;

    if (!['won', 'lost', 'cancelled', 'refunded'].includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid status. Must be: won, lost, cancelled, or refunded' });
    }

    const bet = await Bet.findById(id).populate('user').session(session);
    if (!bet) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Bet not found' });
    }

    if (bet.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Only pending bets can be settled' });
    }

    const oldStatus = bet.status;
    bet.status = status;
    bet.settledAt = new Date();

    // Handle won bets - credit user balance
    if (status === 'won') {
      const finalWinAmount = winAmount || bet.potentialWin;
      bet.winAmount = finalWinAmount;

      if (bet.user) {
        bet.user.balance += finalWinAmount;
        bet.user.totalWinnings = (bet.user.totalWinnings || 0) + finalWinAmount;
        await bet.user.save({ session });

        // Create win transaction
        const winTransaction = await Transaction.create(
          [
            {
              user: bet.user._id,
              type: 'win',
              amount: finalWinAmount,
              status: 'completed',
              paymentMethod: 'internal',
              description: `Bet Win - ${bet.marketName || 'Bet Settlement'}`,
              transactionId: `WIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              metadata: {
                betId: bet._id,
              },
            },
          ],
          { session }
        );

        bet.winTransaction = winTransaction[0]._id;
      }
    }

    // Handle refunded/cancelled bets - refund stake
    if (status === 'refunded' || status === 'cancelled') {
      if (bet.user) {
        bet.user.balance += bet.stake;
        await bet.user.save({ session });

        // Create refund transaction
        const refundTransaction = await Transaction.create(
          [
            {
              user: bet.user._id,
              type: 'refund',
              amount: bet.stake,
              status: 'completed',
              paymentMethod: 'internal',
              description: `Bet ${status === 'refunded' ? 'Refund' : 'Cancellation'} - ${bet.marketName || 'Bet Settlement'}`,
              transactionId: `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              metadata: {
                betId: bet._id,
              },
            },
          ],
          { session }
        );
      }
    }

    await bet.save({ session });
    await session.commitTransaction();

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'settle_bet',
      targetType: 'bet',
      targetId: bet._id,
      description: `Settled bet from ${oldStatus} to ${status}`,
      before: { status: oldStatus },
      after: { status, winAmount: bet.winAmount, settledAt: bet.settledAt },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    // Create notification for bet settlement (async, don't wait)
    if (bet.user && (status === 'won' || status === 'lost')) {
      createNotification({
        userId: bet.user._id,
        type: status === 'won' ? 'bet_won' : 'bet_lost',
        title: status === 'won' ? 'Bet Won!' : 'Bet Lost',
        message: status === 'won' 
          ? `Congratulations! You won ₺${bet.winAmount} on your bet.`
          : `Your bet has been settled as lost.`,
        link: '/dashboard',
        metadata: { betId: bet._id, winAmount: bet.winAmount, stake: bet.stake },
      }).catch((err) => console.error('Notification creation error:', err));
    }

    res.json({
      message: 'Bet settled successfully',
      bet: await Bet.findById(id).populate('user', 'username email'),
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Bulk settle bets (Admin)
// @route   PUT /api/admin/bets/bulk-settle
// @access  Private (Admin only)
// -------------------------------------------
exports.bulkSettleBets = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { betIds, status, winAmounts } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(betIds) || betIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Bet IDs array is required' });
    }

    if (!['won', 'lost', 'cancelled', 'refunded'].includes(status)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid status. Must be: won, lost, cancelled, or refunded' });
    }

    const bets = await Bet.find({ _id: { $in: betIds }, status: 'pending' })
      .populate('user')
      .session(session);

    if (bets.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No pending bets found to settle' });
    }

    let settledCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    let cancelledCount = 0;
    let refundedCount = 0;
    let totalWinAmount = 0;

    for (let i = 0; i < bets.length; i++) {
      const bet = bets[i];
      const finalWinAmount = winAmounts && winAmounts[i] ? winAmounts[i] : bet.potentialWin;

      bet.status = status;
      bet.settledAt = new Date();

      if (status === 'won') {
        bet.winAmount = finalWinAmount;
        wonCount++;
        totalWinAmount += finalWinAmount;

        if (bet.user) {
          bet.user.balance += finalWinAmount;
          bet.user.totalWinnings = (bet.user.totalWinnings || 0) + finalWinAmount;
          await bet.user.save({ session });

          const winTransaction = await Transaction.create(
            [
              {
                user: bet.user._id,
                type: 'win',
                amount: finalWinAmount,
                status: 'completed',
                paymentMethod: 'internal',
                description: `Bet Win - ${bet.marketName || 'Bulk Settlement'}`,
                transactionId: `WIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                metadata: { betId: bet._id },
              },
            ],
            { session }
          );

          bet.winTransaction = winTransaction[0]._id;
        }
      } else if (status === 'lost') {
        lostCount++;
      } else if (status === 'cancelled') {
        cancelledCount++;
        if (bet.user) {
          bet.user.balance += bet.stake;
          await bet.user.save({ session });

          await Transaction.create(
            [
              {
                user: bet.user._id,
                type: 'refund',
                amount: bet.stake,
                status: 'completed',
                paymentMethod: 'internal',
                description: `Bet Cancellation - ${bet.marketName || 'Bulk Settlement'}`,
                transactionId: `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                metadata: { betId: bet._id },
              },
            ],
            { session }
          );
        }
      } else if (status === 'refunded') {
        refundedCount++;
        if (bet.user) {
          bet.user.balance += bet.stake;
          await bet.user.save({ session });

          await Transaction.create(
            [
              {
                user: bet.user._id,
                type: 'refund',
                amount: bet.stake,
                status: 'completed',
                paymentMethod: 'internal',
                description: `Bet Refund - ${bet.marketName || 'Bulk Settlement'}`,
                transactionId: `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                metadata: { betId: bet._id },
              },
            ],
            { session }
          );
        }
      }

      await bet.save({ session });
      settledCount++;
    }

    await session.commitTransaction();

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'bulk_settle_bets',
      targetType: 'bet',
      targetId: null,
      description: `Bulk settled ${settledCount} bets to status: ${status}`,
      metadata: {
        betIds,
        status,
        settledCount,
        wonCount,
        lostCount,
        cancelledCount,
        refundedCount,
        totalWinAmount,
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    // Create notifications for bet settlements (async, don't wait)
    if (status === 'won' || status === 'lost') {
      const notificationPromises = bets
        .filter(bet => bet.user && (status === 'won' || status === 'lost'))
        .map(bet => 
          createNotification({
            userId: bet.user._id,
            type: status === 'won' ? 'bet_won' : 'bet_lost',
            title: status === 'won' ? 'Bet Won!' : 'Bet Lost',
            message: status === 'won' 
              ? `Congratulations! You won ₺${bet.winAmount || bet.potentialWin} on your bet.`
              : `Your bet has been settled as lost.`,
            link: '/dashboard',
            metadata: { betId: bet._id, winAmount: bet.winAmount, stake: bet.stake },
          })
        );
      
      Promise.all(notificationPromises).catch((err) => 
        console.error('Bulk notification creation error:', err)
      );
    }

    res.json({
      message: `Successfully settled ${settledCount} bets`,
      settlement: {
        total: settledCount,
        won: wonCount,
        lost: lostCount,
        cancelled: cancelledCount,
        refunded: refundedCount,
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
// @desc    Export bets to CSV (Admin)
// @route   GET /api/admin/bets/export
// @access  Private (Admin only)
// -------------------------------------------
exports.exportBets = async (req, res) => {
  try {
    const {
      search,
      status,
      startDate,
      endDate,
      userId,
      matchId,
    } = req.query;

    const query = {};

    if (userId) {
      query.user = userId;
    }

    if (matchId) {
      query.match = matchId;
    }

    if (status && status !== 'Status') {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get all bets matching the query (no pagination for export)
    let bets = await Bet.find(query)
      .populate('user', 'username email firstName lastName')
      .populate('match', 'teamA teamB league category matchDate matchName status result')
      .sort({ createdAt: -1 });

    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      bets = bets.filter(
        (bet) =>
          bet.user?.username?.toLowerCase().includes(searchLower) ||
          bet.user?.email?.toLowerCase().includes(searchLower) ||
          bet._id.toString().toLowerCase().includes(searchLower) ||
          bet.match?.teamA?.toLowerCase().includes(searchLower) ||
          bet.match?.teamB?.toLowerCase().includes(searchLower) ||
          bet.match?.matchName?.toLowerCase().includes(searchLower) ||
          bet.marketName?.toLowerCase().includes(searchLower) ||
          bet.selection?.toLowerCase().includes(searchLower)
      );
    }

    // Convert to CSV format
    const csvRows = [];
    
    // CSV Header
    csvRows.push([
      'Bet ID',
      'User',
      'Email',
      'Match',
      'Market Type',
      'Market Name',
      'Selection',
      'Odds',
      'Stake',
      'Potential Win',
      'Win Amount',
      'Status',
      'Created At',
      'Settled At',
    ].join(','));

    // CSV Data
    bets.forEach(bet => {
      csvRows.push([
        bet._id || '',
        bet.user?.username || '',
        bet.user?.email || '',
        bet.match ? `${bet.match.teamA} vs ${bet.match.teamB}` : '',
        bet.marketType || '',
        bet.marketName || '',
        bet.selection || '',
        bet.odds || 0,
        bet.stake || 0,
        bet.potentialWin || 0,
        bet.winAmount || 0,
        bet.status || '',
        bet.createdAt ? bet.createdAt.toISOString() : '',
        bet.settledAt ? bet.settledAt.toISOString() : '',
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
    });

    const csvContent = csvRows.join('\n');

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bets-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

