import { logger } from '../utils/Logger.js';
import { SlackClient } from './SlackClient.js';

/**
 * TeamManager handles multiple Slack team connections and coordination
 * Manages initialization, connection lifecycle, and error handling for all teams
 */
export class TeamManager {
  constructor() {
    this.teams = new Map(); // Map of team name to team configuration
    this.clients = new Map(); // Map of team name to SlackClient instance
    this.messageProcessor = null;
    this.isInitialized = false;
    this.isShuttingDown = false;
  }

  /**
   * Set the message processor for handling received messages
   * @param {MessageProcessor} messageProcessor - The message processor instance
   */
  setMessageProcessor(messageProcessor) {
    if (!messageProcessor || typeof messageProcessor.processMessage !== 'function') {
      throw new Error('Message processor must implement processMessage method');
    }
    this.messageProcessor = messageProcessor;
  }

  /**
   * Initialize teams from configuration
   * @param {Object} teamsConfig - Configuration object with team settings
   * @returns {Promise<void>}
   */
  async initialize(teamsConfig) {
    if (this.isInitialized) {
      throw new Error('TeamManager is already initialized');
    }

    if (!teamsConfig || typeof teamsConfig !== 'object') {
      throw new Error('Teams configuration is required');
    }

    const teamNames = Object.keys(teamsConfig);
    if (teamNames.length === 0) {
      throw new Error('At least one team configuration is required');
    }

    // Validate and store team configurations
    for (const [teamName, config] of Object.entries(teamsConfig)) {
      // Validate appToken and botToken (new format only)
      if (!config.appToken || typeof config.appToken !== 'string') {
        throw new Error(`Team ${teamName}: appToken is required and must be a string`);
      }
      if (!config.botToken || typeof config.botToken !== 'string') {
        throw new Error(`Team ${teamName}: botToken is required and must be a string`);
      }

      if (!Array.isArray(config.channels) || config.channels.length === 0) {
        throw new Error(`Team ${teamName}: Channels must be a non-empty array`);
      }

      this.teams.set(teamName, {
        name: teamName,
        appToken: config.appToken,
        botToken: config.botToken,
        channelIds: [...config.channels], // Create a copy
        client: null,
      });
    }

    this.isInitialized = true;
    logger.info(`Initialized ${this.teams.size} team(s)`);
  }

  /**
   * Connect to all configured teams
   * @returns {Promise<void>}
   */
  async connectAllTeams() {
    if (!this.isInitialized) {
      throw new Error('TeamManager must be initialized before connecting');
    }

    if (this.isShuttingDown) {
      throw new Error('Cannot connect teams during shutdown');
    }

    logger.info('Connecting to teams...');

    const connectionPromises = [];

    for (const [teamName, teamConfig] of this.teams.entries()) {
      const connectionPromise = this._connectTeam(teamName, teamConfig);
      connectionPromises.push(connectionPromise);
    }

    // Wait for all connections to complete (or fail)
    const results = await Promise.allSettled(connectionPromises);

    // Count successful connections
    let successfulConnections = 0;
    let failedConnections = 0;

    results.forEach((result, index) => {
      const teamName = Array.from(this.teams.keys())[index];
      if (result.status === 'fulfilled') {
        successfulConnections++;
      } else {
        failedConnections++;
        logger.error(`Team: ${teamName}, Error: Failed to connect - ${result.reason.message}`);
      }
    });

    if (successfulConnections === 0) {
      throw new Error('Failed to connect to any teams');
    }

    logger.info(`Connected to ${successfulConnections} team(s), ${failedConnections} failed`);

    if (successfulConnections > 0) {
      logger.info('All teams connected. Monitoring started.');
    }
  }

  /**
   * Handle team-specific errors
   * @param {string} teamName - Name of the team with error
   * @param {Error} error - The error that occurred
   */
  handleTeamError(teamName, error) {
    logger.error(`Team: ${teamName}, Error: ${error.message}`);

    const client = this.clients.get(teamName);
    if (client && !client.isClientConnected()) {
      // Team is disconnected, attempt to remove it from active monitoring
      logger.warn(`Team: ${teamName} is disconnected and will be removed from monitoring`);
      this._removeTeam(teamName);
    }
  }

  /**
   * Shutdown all team connections gracefully
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return; // Already shutting down
    }

    this.isShuttingDown = true;
    logger.info('Shutting down...');

    const disconnectionPromises = [];

    for (const [teamName, client] of this.clients.entries()) {
      if (client) {
        const disconnectionPromise = client.disconnect().catch((error) => {
          logger.warn(`Team: ${teamName}, Warning during disconnect: ${error.message}`);
        });
        disconnectionPromises.push(disconnectionPromise);
      }
    }

    // Wait for all disconnections to complete
    await Promise.allSettled(disconnectionPromises);

    // Clear all data
    this.clients.clear();
    this.teams.clear();
    this.messageProcessor = null;
    this.isInitialized = false;
    this.isShuttingDown = false;

    logger.info('All connections closed.');
  }

  /**
   * Get the number of connected teams
   * @returns {number}
   */
  getConnectedTeamCount() {
    let connectedCount = 0;
    for (const client of this.clients.values()) {
      if (client?.isClientConnected()) {
        connectedCount++;
      }
    }
    return connectedCount;
  }

  /**
   * Get the total number of configured teams
   * @returns {number}
   */
  getTotalTeamCount() {
    return this.teams.size;
  }

  /**
   * Get list of connected team names
   * @returns {string[]}
   */
  getConnectedTeamNames() {
    const connectedTeams = [];
    for (const [teamName, client] of this.clients.entries()) {
      if (client?.isClientConnected()) {
        connectedTeams.push(teamName);
      }
    }
    return connectedTeams;
  }

  /**
   * Get list of all configured team names
   * @returns {string[]}
   */
  getAllTeamNames() {
    return Array.from(this.teams.keys());
  }

  /**
   * Check if the manager is initialized
   * @returns {boolean}
   */
  isManagerInitialized() {
    return this.isInitialized;
  }

  /**
   * Check if the manager is shutting down
   * @returns {boolean}
   */
  isManagerShuttingDown() {
    return this.isShuttingDown;
  }

  /**
   * Connect to a single team
   * @private
   * @param {string} teamName - Name of the team
   * @param {Object} teamConfig - Team configuration
   * @returns {Promise<void>}
   */
  async _connectTeam(teamName, teamConfig) {
    try {
      // Both tokens are already validated during initialization

      // Create SlackClient instance
      const client = new SlackClient(
        teamConfig.appToken,
        teamConfig.botToken,
        teamName,
        teamConfig.channelIds
      );

      // Set up message callback if message processor is available
      if (this.messageProcessor) {
        client.setMessageCallback(async (message) => {
          try {
            await this.messageProcessor.processMessage(message);
          } catch (error) {
            logger.error(`Team: ${teamName}, Error processing message: ${error.message}`);
          }
        });
      }

      // Store client reference
      this.clients.set(teamName, client);
      teamConfig.client = client;

      // Connect to Slack
      await client.connect();
    } catch (error) {
      // Remove failed client from storage
      this.clients.delete(teamName);
      if (this.teams.has(teamName)) {
        this.teams.get(teamName).client = null;
      }
      throw error;
    }
  }

  /**
   * Remove a team from active monitoring
   * @private
   * @param {string} teamName - Name of the team to remove
   */
  _removeTeam(teamName) {
    const client = this.clients.get(teamName);
    if (client) {
      // Attempt to disconnect gracefully
      client.disconnect().catch((error) => {
        logger.warn(`Team: ${teamName}, Warning during cleanup disconnect: ${error.message}`);
      });
    }

    this.clients.delete(teamName);

    if (this.teams.has(teamName)) {
      this.teams.get(teamName).client = null;
    }
  }
}
