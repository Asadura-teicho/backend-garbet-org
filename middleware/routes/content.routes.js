const express = require('express');
const router = express.Router();
const {
  getContentPages,
  getContentBySlug,
  getFAQContent,
  getHelpContent,
} = require('../controllers/content.controller');

// All routes are public
router.get('/pages', getContentPages);
router.get('/faq', getFAQContent);
router.get('/help', getHelpContent);
router.get('/:slug', getContentBySlug);

module.exports = router;
