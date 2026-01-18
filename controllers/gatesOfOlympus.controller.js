/**
 * Gates of Olympus Game Controller
 * Reuses Sweet Bonanza logic but can be customized for Gates of Olympus specific features
 * Currently uses same RTP model but can be extended with Gates of Olympus specific mechanics
 */

const sweetBonanzaController = require('./sweetBonanza.controller');

// Gates of Olympus uses the same game logic as Sweet Bonanza
// but can be customized in the future for Gates of Olympus specific features
// (e.g., different RTP, different symbols, different win mechanics)

module.exports = {
  playGame: sweetBonanzaController.playGame,
  getGameHistory: sweetBonanzaController.getGameHistory,
  getStats: sweetBonanzaController.getStats
};
