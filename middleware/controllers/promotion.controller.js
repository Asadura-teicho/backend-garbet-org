/**
 * User Promotion Controller
 * Handles user-facing promotion operations
 */

const Promotion = require('../models/Promotion.model');
const PromotionClaim = require('../models/PromotionClaim.model');
const User = require('../models/User.model');
const Bonus = require('../models/Bonus.model');
const { createNotification } = require('../utils/notificationHelper');
const mongoose = require('mongoose');

// -------------------------------------------
// @desc    Get active promotions
// @route   GET /api/promotions
// @access  Public/Private
// -------------------------------------------
exports.getActivePromotions = async (req, res) => {
  try {
    const { type, featured, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;

    const now = new Date();
    const query = {
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    // Filter by type
    if (type && type !== 'all') {
      query.type = type;
    }

    // Filter featured promotions
    if (featured === 'true') {
      query.isFeatured = true;
    }

    const promotions = await Promotion.find(query)
      .sort({ priority: -1, isFeatured: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Promotion.countDocuments(query);

    // If user is authenticated, add claim status
    let promotionsWithStatus = promotions;
    if (userId) {
      const userClaims = await PromotionClaim.find({
        user: userId,
        promotion: { $in: promotions.map((p) => p._id) },
      });

      const claimsMap = new Map(
        userClaims.map((claim) => [claim.promotion.toString(), claim])
      );

      promotionsWithStatus = promotions.map((promotion) => {
        const claim = claimsMap.get(promotion._id.toString());
        const promotionObj = promotion.toObject();

        // Check if user is eligible
        const isEligible = checkUserEligibility(promotion, userId);

        // Check if user has already claimed
        const hasClaimed = !!claim;
        const canClaim = isEligible && !hasClaimed && checkPromotionLimits(promotion);

        return {
          ...promotionObj,
          isEligible,
          hasClaimed,
          canClaim,
          claimStatus: claim?.status || null,
          claimId: claim?._id || null,
        };
      });
    }

    res.json({
      promotions: promotionsWithStatus,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get promotion by ID
// @route   GET /api/promotions/:id
// @access  Public/Private
// -------------------------------------------
exports.getPromotionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const promotion = await Promotion.findById(id);

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    // Check if promotion is active
    const now = new Date();
    const isActive =
      promotion.status === 'active' &&
      promotion.startDate <= now &&
      promotion.endDate >= now;

    const promotionObj = promotion.toObject();

    // If user is authenticated, add claim status
    if (userId) {
      const claim = await PromotionClaim.findOne({
        user: userId,
        promotion: id,
      });

      const isEligible = checkUserEligibility(promotion, userId);
      const hasClaimed = !!claim;
      const canClaim = isEligible && !hasClaimed && checkPromotionLimits(promotion);

      promotionObj.isEligible = isEligible;
      promotionObj.hasClaimed = hasClaimed;
      promotionObj.canClaim = canClaim && isActive;
      promotionObj.claimStatus = claim?.status || null;
      promotionObj.claimId = claim?._id || null;
    }

    promotionObj.isActive = isActive;

    res.json(promotionObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Claim promotion
// @route   POST /api/promotions/:id/claim
// @access  Private
// -------------------------------------------
exports.claimPromotion = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get promotion
    const promotion = await Promotion.findById(id).session(session);
    if (!promotion) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Promotion not found' });
    }

    // Check if promotion is active
    const now = new Date();
    if (
      promotion.status !== 'active' ||
      promotion.startDate > now ||
      promotion.endDate < now
    ) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Promotion is not currently active' });
    }

    // Check user eligibility
    const isEligible = checkUserEligibility(promotion, userId);
    if (!isEligible) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'You are not eligible for this promotion' });
    }

    // Check if user has already claimed
    const existingClaim = await PromotionClaim.findOne({
      user: userId,
      promotion: id,
    }).session(session);

    if (existingClaim) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'You have already claimed this promotion' });
    }

    // Check promotion limits
    if (!checkPromotionLimits(promotion)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Promotion has reached its usage limit' });
    }

    // Check user's claim count for this promotion
    const userClaimCount = await PromotionClaim.countDocuments({
      user: userId,
      promotion: id,
    }).session(session);

    if (userClaimCount >= promotion.maxUsesPerUser) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `You have reached the maximum claim limit (${promotion.maxUsesPerUser}) for this promotion`,
      });
    }

    // Get user
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate bonus amount (for future use, promotions might require deposit)
    let bonusAmount = 0;
    if (promotion.bonusAmount > 0) {
      bonusAmount = promotion.bonusAmount;
    }

    // Create promotion claim
    const claim = await PromotionClaim.create(
      [
        {
          user: userId,
          promotion: id,
          status: 'claimed',
          bonusAmount,
          expiresAt: promotion.endDate,
        },
      ],
      { session }
    );

    // Update promotion usage counters
    promotion.totalUses += 1;
    promotion.totalBonusGiven += bonusAmount;
    await promotion.save({ session });

    // If bonus amount > 0, create bonus record (for future implementation)
    let bonusId = null;
    if (bonusAmount > 0) {
      // This would create a bonus record if needed
      // For now, we'll just track the claim
    }

    await session.commitTransaction();

    // Create notification
    createNotification({
      userId,
      type: 'bonus_awarded',
      title: 'Promotion Claimed',
      message: `You have successfully claimed the promotion: ${promotion.title}`,
      link: '/promotions',
      metadata: { promotionId: id, claimId: claim[0]._id, bonusAmount },
    }).catch((err) => console.error('Notification creation error:', err));

    res.status(201).json({
      message: 'Promotion claimed successfully',
      claim: claim[0],
      promotion: {
        id: promotion._id,
        title: promotion.title,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already claimed this promotion' });
    }
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Get user's claimed promotions
// @route   GET /api/promotions/my
// @access  Private
// -------------------------------------------
exports.getMyPromotions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { user: userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const claims = await PromotionClaim.find(query)
      .populate('promotion', 'title type description bannerImage startDate endDate')
      .populate('bonusId', 'amount status')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await PromotionClaim.countDocuments(query);

    res.json({
      claims,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get promotion claim status
// @route   GET /api/promotions/:id/status
// @access  Private
// -------------------------------------------
exports.getPromotionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const promotion = await Promotion.findById(id);
    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    const claim = await PromotionClaim.findOne({
      user: userId,
      promotion: id,
    }).populate('bonusId', 'amount status');

    const now = new Date();
    const isActive =
      promotion.status === 'active' &&
      promotion.startDate <= now &&
      promotion.endDate >= now;

    const isEligible = checkUserEligibility(promotion, userId);
    const hasClaimed = !!claim;
    const canClaim = isEligible && !hasClaimed && checkPromotionLimits(promotion) && isActive;

    res.json({
      promotion: {
        id: promotion._id,
        title: promotion.title,
        isActive,
      },
      isEligible,
      hasClaimed,
      canClaim,
      claim: claim
        ? {
            id: claim._id,
            status: claim.status,
            claimedAt: claim.claimedAt,
            expiresAt: claim.expiresAt,
            bonusAmount: claim.bonusAmount,
            bonus: claim.bonusId,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// Helper Functions
// -------------------------------------------

/**
 * Check if user is eligible for promotion
 */
function checkUserEligibility(promotion, userId) {
  // Check if user is in excluded list
  if (
    promotion.excludedUsers &&
    promotion.excludedUsers.some((id) => id.toString() === userId.toString())
  ) {
    return false;
  }

  // Check if promotion has eligible users list
  if (promotion.eligibleUsers && promotion.eligibleUsers.length > 0) {
    return promotion.eligibleUsers.some((id) => id.toString() === userId.toString());
  }

  // If no restrictions, user is eligible
  return true;
}

/**
 * Check if promotion has reached its usage limits
 */
function checkPromotionLimits(promotion) {
  // Check max uses
  if (promotion.maxUses !== null && promotion.totalUses >= promotion.maxUses) {
    return false;
  }

  return true;
}
