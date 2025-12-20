/**
 * RapidAPI Controller
 * Handles RapidAPI integration endpoints for syncing matches and game data
 */

const rapidapiService = require('../services/rapidapi.service');
const Match = require('../models/Match.model');
const User = require('../models/User.model');
const { logAdminAction, getIpAddress, getUserAgent } = require('../utils/adminLogger');

// -------------------------------------------
// @desc    Sync matches from RapidAPI
// @route   POST /api/rapidapi/sync-matches
// @access  Private (Admin only)
// -------------------------------------------
exports.syncMatches = async (req, res) => {
  try {
    if (!rapidapiService.isConfigured()) {
      return res.status(400).json({
        message: 'RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.',
      });
    }

    const { league, season, date, status, limit = 50 } = req.body;
    const adminId = req.user.id;

    // Build query parameters
    const params = {};
    if (league) params.league = league;
    if (season) params.season = season;
    if (date) params.date = date;
    if (status) params.status = status;
    params.last = limit; // Limit number of fixtures

    // Fetch fixtures from RapidAPI
    const result = await rapidapiService.getFixtures(params);

    if (!result.success || !result.fixtures || result.fixtures.length === 0) {
      return res.json({
        message: 'No fixtures found',
        synced: 0,
        skipped: 0,
        errors: 0,
      });
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const errorsList = [];

    // Process each fixture
    for (const fixtureData of result.fixtures) {
      try {
        // Check if match already exists by RapidAPI fixture ID
        const existingMatch = await Match.findOne({
          rapidapiFixtureId: fixtureData.fixture.id,
        });

        if (existingMatch) {
          // Update existing match if it's not settled
          if (!existingMatch.result.isSettled) {
            const transformed = rapidapiService.transformFixtureToMatch(fixtureData);
            
            // Update match data
            existingMatch.status = transformed.status;
            existingMatch.matchDate = transformed.matchDate;
            existingMatch.matchTime = transformed.matchTime;
            
            // Update result if available
            if (transformed.result.teamAScore !== null && transformed.result.teamBScore !== null) {
              existingMatch.result.teamAScore = transformed.result.teamAScore;
              existingMatch.result.teamBScore = transformed.result.teamBScore;
              existingMatch.result.winner = transformed.result.winner;
              existingMatch.result.isSettled = transformed.result.isSettled;
              if (transformed.result.settledAt) {
                existingMatch.result.settledAt = transformed.result.settledAt;
              }
            }

            await existingMatch.save();
            synced++;
          } else {
            skipped++;
          }
        } else {
          // Create new match
          const transformed = rapidapiService.transformFixtureToMatch(fixtureData);
          
          // Get admin user for createdBy
          const adminUser = await User.findById(adminId);
          if (!adminUser) {
            errors++;
            errorsList.push(`Admin user not found for fixture ${fixtureData.fixture.id}`);
            continue;
          }

          const newMatch = await Match.create({
            ...transformed,
            createdBy: adminId,
          });

          synced++;
        }
      } catch (error) {
        errors++;
        errorsList.push(`Error processing fixture ${fixtureData.fixture.id}: ${error.message}`);
        console.error(`Error syncing fixture ${fixtureData.fixture.id}:`, error);
      }
    }

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'sync_rapidapi_matches',
      targetType: 'match',
      targetId: null,
      description: `Synced ${synced} matches from RapidAPI`,
      metadata: {
        synced,
        skipped,
        errors,
        params,
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.json({
      message: 'Matches synced successfully',
      synced,
      skipped,
      errors,
      total: result.fixtures.length,
      errorsList: errors > 0 ? errorsList : undefined,
    });
  } catch (error) {
    console.error('Error syncing matches from RapidAPI:', error);
    res.status(500).json({
      message: error.message || 'Error syncing matches from RapidAPI',
    });
  }
};

// -------------------------------------------
// @desc    Get live matches from RapidAPI
// @route   GET /api/rapidapi/live-matches
// @access  Private (Admin only)
// -------------------------------------------
exports.getLiveMatches = async (req, res) => {
  try {
    if (!rapidapiService.isConfigured()) {
      return res.status(400).json({
        message: 'RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.',
      });
    }

    const { league, date } = req.query;

    const params = {};
    if (league) params.league = league;
    if (date) params.date = date;

    const result = await rapidapiService.getLiveFixtures(params);

    res.json({
      success: true,
      matches: result.fixtures.map(fixture => 
        rapidapiService.transformFixtureToMatch(fixture)
      ),
      total: result.fixtures.length,
    });
  } catch (error) {
    console.error('Error fetching live matches from RapidAPI:', error);
    res.status(500).json({
      message: error.message || 'Error fetching live matches from RapidAPI',
    });
  }
};

// -------------------------------------------
// @desc    Sync odds for a specific match
// @route   POST /api/rapidapi/sync-odds/:matchId
// @access  Private (Admin only)
// -------------------------------------------
exports.syncOdds = async (req, res) => {
  try {
    if (!rapidapiService.isConfigured()) {
      return res.status(400).json({
        message: 'RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.',
      });
    }

    const { matchId } = req.params;
    const adminId = req.user.id;

    // Find match
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    if (!match.rapidapiFixtureId) {
      return res.status(400).json({
        message: 'Match does not have a RapidAPI fixture ID',
      });
    }

    // Fetch odds from RapidAPI
    const oddsResult = await rapidapiService.getOdds({
      fixture: match.rapidapiFixtureId,
    });

    if (!oddsResult.success || !oddsResult.odds || oddsResult.odds.length === 0) {
      return res.json({
        message: 'No odds found for this match',
        updated: false,
      });
    }

    // Transform fixture with odds
    const fixtureData = {
      fixture: { id: match.rapidapiFixtureId },
      teams: { home: { name: match.teamA }, away: { name: match.teamB } },
      league: { id: match.rapidapiLeagueId, name: match.league },
      goals: { home: match.result.teamAScore, away: match.result.teamBScore },
    };

    const transformed = rapidapiService.transformFixtureToMatch(
      fixtureData,
      oddsResult.odds[0]
    );

    // Update match markets
    match.markets = transformed.markets;
    await match.save();

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'sync_rapidapi_odds',
      targetType: 'match',
      targetId: match._id,
      description: `Synced odds for match ${match.matchName}`,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.json({
      message: 'Odds synced successfully',
      match: await Match.findById(matchId),
    });
  } catch (error) {
    console.error('Error syncing odds from RapidAPI:', error);
    res.status(500).json({
      message: error.message || 'Error syncing odds from RapidAPI',
    });
  }
};

// -------------------------------------------
// @desc    Get leagues from RapidAPI
// @route   GET /api/rapidapi/leagues
// @access  Private (Admin only)
// -------------------------------------------
exports.getLeagues = async (req, res) => {
  try {
    if (!rapidapiService.isConfigured()) {
      return res.status(400).json({
        message: 'RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.',
      });
    }

    const { country, season, type } = req.query;

    const params = {};
    if (country) params.country = country;
    if (season) params.season = season;
    if (type) params.type = type;

    const result = await rapidapiService.getLeagues(params);

    res.json({
      success: true,
      leagues: result.leagues,
      total: result.leagues.length,
    });
  } catch (error) {
    console.error('Error fetching leagues from RapidAPI:', error);
    res.status(500).json({
      message: error.message || 'Error fetching leagues from RapidAPI',
    });
  }
};

// -------------------------------------------
// @desc    Get teams from RapidAPI
// @route   GET /api/rapidapi/teams
// @access  Private (Admin only)
// -------------------------------------------
exports.getTeams = async (req, res) => {
  try {
    if (!rapidapiService.isConfigured()) {
      return res.status(400).json({
        message: 'RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.',
      });
    }

    const { league, season, search } = req.query;

    const params = {};
    if (league) params.league = league;
    if (season) params.season = season;
    if (search) params.search = search;

    const result = await rapidapiService.getTeams(params);

    res.json({
      success: true,
      teams: result.teams,
      total: result.teams.length,
    });
  } catch (error) {
    console.error('Error fetching teams from RapidAPI:', error);
    res.status(500).json({
      message: error.message || 'Error fetching teams from RapidAPI',
    });
  }
};

// -------------------------------------------
// @desc    Check RapidAPI configuration status
// @route   GET /api/rapidapi/status
// @access  Private (Admin only)
// -------------------------------------------
exports.getStatus = async (req, res) => {
  try {
    const isConfigured = rapidapiService.isConfigured();
    
    res.json({
      configured: isConfigured,
      baseURL: isConfigured ? rapidapiService.baseURL : null,
      host: isConfigured ? rapidapiService.host : null,
      message: isConfigured
        ? 'RapidAPI is configured and ready to use'
        : 'RapidAPI is not configured. Please set RAPIDAPI_KEY in environment variables.',
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || 'Error checking RapidAPI status',
    });
  }
};

