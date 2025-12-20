/**
 * RapidAPI Service
 * Handles integration with RapidAPI for sports data and game logic
 * Production-ready with environment-based configuration
 */

const axios = require('axios');

class RapidAPIService {
  constructor() {
    // RapidAPI configuration from environment variables
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.baseURL = process.env.RAPIDAPI_BASE_URL || 'https://api-football-v1.p.rapidapi.com/v3';
    this.host = process.env.RAPIDAPI_HOST || 'api-football-v1.p.rapidapi.com';
    
    // Rate limiting configuration
    this.rateLimitDelay = parseInt(process.env.RAPIDAPI_RATE_LIMIT_DELAY || '1000'); // ms between requests
    
    // Create axios instance with default headers
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: parseInt(process.env.RAPIDAPI_TIMEOUT || '30000'), // 30 seconds default
      headers: {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': this.host,
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for rate limiting
    this.client.interceptors.request.use(
      async (config) => {
        // Add delay between requests to respect rate limits
        if (this.lastRequestTime) {
          const timeSinceLastRequest = Date.now() - this.lastRequestTime;
          if (timeSinceLastRequest < this.rateLimitDelay) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
            );
          }
        }
        this.lastRequestTime = Date.now();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // API returned error response
          console.error('RapidAPI Error:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            url: error.config?.url,
          });
        } else if (error.request) {
          // Request made but no response received
          console.error('RapidAPI Network Error:', error.message);
        } else {
          // Error in request setup
          console.error('RapidAPI Request Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if RapidAPI is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Get fixtures (matches) from RapidAPI
   * @param {Object} params - Query parameters
   * @param {string} params.league - League ID
   * @param {string} params.season - Season year (e.g., '2024')
   * @param {string} params.date - Date in YYYY-MM-DD format
   * @param {string} params.team - Team ID
   * @param {string} params.status - Match status (NS, LIVE, FT, etc.)
   * @param {number} params.page - Page number
   * @returns {Promise<Object>} Fixtures data
   */
  async getFixtures(params = {}) {
    if (!this.isConfigured()) {
      throw new Error('RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.');
    }

    try {
      const response = await this.client.get('/fixtures', { params });
      return {
        success: true,
        data: response.data,
        fixtures: response.data?.response || [],
      };
    } catch (error) {
      console.error('Error fetching fixtures from RapidAPI:', error.message);
      throw error;
    }
  }

  /**
   * Get fixture by ID
   * @param {number} fixtureId - RapidAPI fixture ID
   * @returns {Promise<Object>} Fixture data
   */
  async getFixtureById(fixtureId) {
    if (!this.isConfigured()) {
      throw new Error('RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.');
    }

    try {
      const response = await this.client.get(`/fixtures`, {
        params: { id: fixtureId },
      });
      return {
        success: true,
        data: response.data,
        fixture: response.data?.response?.[0] || null,
      };
    } catch (error) {
      console.error(`Error fetching fixture ${fixtureId} from RapidAPI:`, error.message);
      throw error;
    }
  }

  /**
   * Get live fixtures (matches in progress)
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Live fixtures data
   */
  async getLiveFixtures(params = {}) {
    if (!this.isConfigured()) {
      throw new Error('RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.');
    }

    try {
      const response = await this.client.get('/fixtures', {
        params: { ...params, live: 'all' },
      });
      return {
        success: true,
        data: response.data,
        fixtures: response.data?.response || [],
      };
    } catch (error) {
      console.error('Error fetching live fixtures from RapidAPI:', error.message);
      throw error;
    }
  }

  /**
   * Get odds for fixtures
   * @param {Object} params - Query parameters
   * @param {number} params.fixture - Fixture ID
   * @param {string} params.bookmaker - Bookmaker ID
   * @param {string} params.bet - Bet type ID
   * @returns {Promise<Object>} Odds data
   */
  async getOdds(params = {}) {
    if (!this.isConfigured()) {
      throw new Error('RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.');
    }

    try {
      const response = await this.client.get('/odds', { params });
      return {
        success: true,
        data: response.data,
        odds: response.data?.response || [],
      };
    } catch (error) {
      console.error('Error fetching odds from RapidAPI:', error.message);
      throw error;
    }
  }

  /**
   * Get leagues
   * @param {Object} params - Query parameters
   * @param {string} params.country - Country code
   * @param {string} params.season - Season year
   * @param {string} params.type - League type
   * @returns {Promise<Object>} Leagues data
   */
  async getLeagues(params = {}) {
    if (!this.isConfigured()) {
      throw new Error('RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.');
    }

    try {
      const response = await this.client.get('/leagues', { params });
      return {
        success: true,
        data: response.data,
        leagues: response.data?.response || [],
      };
    } catch (error) {
      console.error('Error fetching leagues from RapidAPI:', error.message);
      throw error;
    }
  }

  /**
   * Get teams
   * @param {Object} params - Query parameters
   * @param {string} params.league - League ID
   * @param {string} params.season - Season year
   * @param {string} params.search - Search term
   * @returns {Promise<Object>} Teams data
   */
  async getTeams(params = {}) {
    if (!this.isConfigured()) {
      throw new Error('RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.');
    }

    try {
      const response = await this.client.get('/teams', { params });
      return {
        success: true,
        data: response.data,
        teams: response.data?.response || [],
      };
    } catch (error) {
      console.error('Error fetching teams from RapidAPI:', error.message);
      throw error;
    }
  }

  /**
   * Transform RapidAPI fixture to our Match model format
   * @param {Object} fixture - RapidAPI fixture object
   * @param {Object} odds - Optional odds data
   * @returns {Object} Transformed match object
   */
  transformFixtureToMatch(fixture, odds = null) {
    const { fixture: fixtureData, teams, league, goals } = fixture;

    // Determine match status
    let status = 'upcoming';
    if (fixtureData.status.short === 'FT' || fixtureData.status.short === 'AET' || fixtureData.status.short === 'PEN') {
      status = 'finished';
    } else if (fixtureData.status.short === 'LIVE' || fixtureData.status.short === 'HT' || fixtureData.status.short === '1H' || fixtureData.status.short === '2H') {
      status = 'live';
    } else if (fixtureData.status.short === 'CANC' || fixtureData.status.short === 'SUSP' || fixtureData.status.short === 'INT') {
      status = 'cancelled';
    }

    // Build markets from odds if available
    const markets = [];
    if (odds && odds.bookmakers && odds.bookmakers.length > 0) {
      const bookmaker = odds.bookmakers[0];
      
      // Match Winner (1X2) market
      const matchWinnerBet = bookmaker.bets?.find(bet => bet.id === 1); // 1 = Match Winner
      if (matchWinnerBet) {
        markets.push({
          type: '1X2',
          name: 'Match Winner',
          selections: matchWinnerBet.values.map(value => ({
            name: value.value === 'Home' ? 'Team A Win' : value.value === 'Away' ? 'Team B Win' : 'Draw',
            odds: parseFloat(value.odd) || 1.0,
          })),
        });
      }

      // Over/Under market
      const overUnderBet = bookmaker.bets?.find(bet => bet.id === 5); // 5 = Goals Over/Under
      if (overUnderBet) {
        overUnderBet.values.forEach(value => {
          const threshold = value.value.replace('Over ', '').replace('Under ', '');
          markets.push({
            type: 'over_under',
            name: `Over/Under ${threshold}`,
            selections: [
              {
                name: `Over ${threshold}`,
                odds: parseFloat(value.odd) || 1.0,
                value: threshold,
              },
              {
                name: `Under ${threshold}`,
                odds: parseFloat(value.odd) || 1.0,
                value: threshold,
              },
            ],
          });
        });
      }

      // Both Teams Score market
      const bothTeamsScoreBet = bookmaker.bets?.find(bet => bet.id === 8); // 8 = Both Teams Score
      if (bothTeamsScoreBet) {
        markets.push({
          type: 'both_teams_score',
          name: 'Both Teams Score',
          selections: bothTeamsScoreBet.values.map(value => ({
            name: value.value === 'Yes' ? 'Yes' : 'No',
            odds: parseFloat(value.odd) || 1.0,
          })),
        });
      }
    } else {
      // Default markets if no odds available
      markets.push({
        type: '1X2',
        name: 'Match Winner',
        selections: [
          { name: 'Team A Win', odds: 2.0 },
          { name: 'Draw', odds: 3.0 },
          { name: 'Team B Win', odds: 2.0 },
        ],
      });
    }

    return {
      rapidapiFixtureId: fixtureData.id,
      rapidapiLeagueId: league.id,
      league: league.name,
      category: league.type || 'Football',
      matchName: `${teams.home.name} vs ${teams.away.name}`,
      teamA: teams.home.name,
      teamB: teams.away.name,
      matchDate: new Date(fixtureData.date),
      matchTime: new Date(fixtureData.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      markets,
      status,
      result: {
        teamAScore: goals?.home || null,
        teamBScore: goals?.away || null,
        winner: goals?.home > goals?.away ? 'teamA' : goals?.away > goals?.home ? 'teamB' : goals?.home === goals?.away ? 'draw' : null,
        isSettled: status === 'finished' && goals?.home !== null && goals?.away !== null,
        settledAt: status === 'finished' ? new Date() : null,
      },
    };
  }
}

// Export singleton instance
module.exports = new RapidAPIService();

