/**
 * Public Content Controller
 * Handles public content operations (FAQs, Help, Pages)
 */

const Content = require('../models/Content.model');
const { AppError, asyncHandler } = require('../middleware/error.middleware');

// -------------------------------------------
// @desc    Get all content pages
// @route   GET /api/content/pages
// @access  Public
// -------------------------------------------
exports.getContentPages = asyncHandler(async (req, res) => {
  const { type, category, page = 1, limit = 20 } = req.query;

  const query = {
    status: 'published',
  };

  // Filter by type
  if (type && type !== 'all') {
    query.type = type;
  }

  // Filter by category
  if (category && category !== 'all') {
    query.category = category;
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;

  const content = await Content.find(query)
    .sort({ order: 1, publishedAt: -1 })
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum)
    .select('-__v')
    .lean();

  const total = await Content.countDocuments(query);

  res.json({
    pages: content,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    total,
  });
});

// -------------------------------------------
// @desc    Get content by slug
// @route   GET /api/content/:slug
// @access  Public
// -------------------------------------------
exports.getContentBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const content = await Content.findOne({
    slug,
    status: 'published',
  }).select('-__v').lean();

  if (!content) {
    throw new AppError('Content not found', 404);
  }

  res.json({ content });
});

// -------------------------------------------
// @desc    Get FAQ content
// @route   GET /api/content/faq
// @access  Public
// -------------------------------------------
exports.getFAQContent = asyncHandler(async (req, res) => {
  const { category, limit = 50 } = req.query;

  const query = {
    type: 'faq',
    status: 'published',
  };

  // Filter by category if provided
  if (category && category !== 'all') {
    query.category = category;
  }

  const limitNum = parseInt(limit, 10) || 50;

  const faqs = await Content.find(query)
    .sort({ order: 1, publishedAt: -1 })
    .limit(limitNum)
    .select('title content category order slug')
    .select('-__v')
    .lean();

  res.json({
    faqs,
    total: faqs.length,
  });
});

// -------------------------------------------
// @desc    Get help content
// @route   GET /api/content/help
// @access  Public
// -------------------------------------------
exports.getHelpContent = asyncHandler(async (req, res) => {
  const { category, page = 1, limit = 20 } = req.query;

  const query = {
    type: { $in: ['help', 'guide', 'tutorial'] },
    status: 'published',
  };

  // Filter by category if provided
  if (category && category !== 'all') {
    query.category = category;
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;

  const helpContent = await Content.find(query)
    .sort({ order: 1, publishedAt: -1 })
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum)
    .select('-__v')
    .lean();

  const total = await Content.countDocuments(query);

  res.json({
    help: helpContent,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    total,
  });
});
