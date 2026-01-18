const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['banner', 'news', 'faq', 'static_page'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    content: {
      type: String,
      default: '',
    },
    excerpt: {
      type: String,
      default: '',
    },
    // For banners
    image: {
      type: String,
      default: null,
    },
    link: {
      type: String,
      default: null,
    },
    // For news
    author: {
      type: String,
      default: null,
    },
    featuredImage: {
      type: String,
      default: null,
    },
    // For FAQs
    category: {
      type: String,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    // Status
    status: {
      type: String,
      enum: ['published', 'draft', 'archived'],
      default: 'draft',
    },
    // SEO
    metaTitle: {
      type: String,
      default: null,
    },
    metaDescription: {
      type: String,
      default: null,
    },
    // Dates
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
contentSchema.index({ type: 1, status: 1 });
contentSchema.index({ type: 1, createdAt: -1 });
contentSchema.index({ title: 'text', content: 'text' });

// Generate slug from title before saving
contentSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Content', contentSchema);

