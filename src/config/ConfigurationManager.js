import { readFileSync } from 'node:fs';
import { logger } from '../utils/Logger.js';

/**
 * Configuration Manager for Slack Aggregator CLI
 * Handles loading and validation of .env.json configuration file
 */
export class ConfigurationManager {
  constructor(configPath = '.env.json') {
    this.config = null;
    this.configPath = configPath;
  }

  /**
   * Load configuration from .env.json file
   * @returns {Object} Loaded configuration object
   * @throws {Error} If configuration file cannot be read or parsed
   */
  loadConfig() {
    try {
      const configData = readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      this.validateConfig();
      return this.config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        const errorMessage = `Configuration file ${this.configPath} not found`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      if (error instanceof SyntaxError) {
        const errorMessage = `Invalid JSON in configuration file: ${error.message}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      const errorMessage = `Failed to load configuration: ${error.message}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Validate configuration structure and token formats
   * @throws {Error} If configuration is invalid
   */
  validateConfig() {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    // Validate teams section
    if (!this.config.teams || typeof this.config.teams !== 'object') {
      throw new Error('Configuration must contain a "teams" object');
    }

    const teamNames = Object.keys(this.config.teams);
    if (teamNames.length === 0) {
      throw new Error('At least one team must be configured');
    }

    // Validate each team configuration
    for (const [teamName, teamConfig] of Object.entries(this.config.teams)) {
      this.validateTeamConfig(teamName, teamConfig);
    }

    // Validate handlers section (optional)
    if (this.config.handlers && typeof this.config.handlers !== 'object') {
      throw new Error('Configuration "handlers" must be an object');
    }
  }

  /**
   * Validate individual team configuration
   * @param {string} teamName - Name of the team
   * @param {Object} teamConfig - Team configuration object
   * @throws {Error} If team configuration is invalid
   */
  validateTeamConfig(teamName, teamConfig) {
    if (!teamConfig || typeof teamConfig !== 'object') {
      const errorMessage = `Team "${teamName}" configuration must be an object`;
      logger.error(`Configuration error: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Validate appToken and botToken (new format only)
    if (!teamConfig.appToken || typeof teamConfig.appToken !== 'string') {
      const errorMessage = `Team "${teamName}" must have a valid appToken string`;
      logger.error(`Configuration error: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    if (!teamConfig.botToken || typeof teamConfig.botToken !== 'string') {
      const errorMessage = `Team "${teamName}" must have a valid botToken string`;
      logger.error(`Configuration error: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Validate App-Level Token format
    if (!this.isValidSlackAppToken(teamConfig.appToken)) {
      const errorMessage = `Team "${teamName}" has invalid appToken format. Expected format: xapp-1-xxxxx`;
      logger.error(`Configuration error: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Validate Bot Token format
    if (!this.isValidSlackBotToken(teamConfig.botToken)) {
      const errorMessage = `Team "${teamName}" has invalid botToken format. Expected format: xoxb-xxxxx`;
      logger.error(`Configuration error: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Validate channels
    if (!teamConfig.channels || !Array.isArray(teamConfig.channels)) {
      const errorMessage = `Team "${teamName}" must have a "channels" array`;
      logger.error(`Configuration error: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    if (teamConfig.channels.length === 0) {
      const errorMessage = `Team "${teamName}" must have at least one channel configured`;
      logger.error(`Configuration error: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Validate channel ID format
    for (const channelId of teamConfig.channels) {
      if (!this.isValidChannelId(channelId)) {
        const errorMessage = `Team "${teamName}" has invalid channel ID: ${channelId}. Expected format: C followed by 10 characters`;
        logger.error(`Configuration error: ${errorMessage}`);
        throw new Error(errorMessage);
      }
    }
  }

  /**
   * Validate Slack App-Level token format
   * @param {string} token - Token to validate
   * @returns {boolean} True if token format is valid
   */
  isValidSlackAppToken(token) {
    // Slack App-Level Token format: xapp-1-xxxxx (can contain hyphens)
    return /^xapp-1-[A-Za-z0-9\-]+$/.test(token);
  }

  /**
   * Validate Slack Bot token format
   * @param {string} token - Token to validate
   * @returns {boolean} True if token format is valid
   */
  isValidSlackBotToken(token) {
    // Slack Bot Token format: xoxb-xxxxx (can contain hyphens)
    return /^xoxb-[A-Za-z0-9\-]+$/.test(token);
  }

  /**
   * Validate Slack channel ID format
   * @param {string} channelId - Channel ID to validate
   * @returns {boolean} True if channel ID format is valid
   */
  isValidChannelId(channelId) {
    // Slack channel ID format: C followed by 10 alphanumeric characters
    return /^C[A-Z0-9]{10}$/.test(channelId);
  }

  /**
   * Get all team configurations
   * @returns {Object} Object containing all team configurations
   * @throws {Error} If configuration is not loaded
   */
  getTeamConfigs() {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config.teams;
  }

  /**
   * Get channel IDs for a specific team
   * @param {string} teamName - Name of the team
   * @returns {string[]} Array of channel IDs for the team
   * @throws {Error} If team is not found or configuration is not loaded
   */
  getChannelIds(teamName) {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    const teamConfig = this.config.teams[teamName];
    if (!teamConfig) {
      throw new Error(`Team "${teamName}" not found in configuration`);
    }

    return teamConfig.channels;
  }

  /**
   * Get handler configurations
   * @returns {Object} Handler configurations or empty object if not configured
   */
  getHandlerConfigs() {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config.handlers || {};
  }

  /**
   * Get tokens for a specific team
   * @param {string} teamName - Name of the team
   * @returns {Object} Object containing appToken and botToken for the team
   * @throws {Error} If team is not found or configuration is not loaded
   */
  getTeamTokens(teamName) {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    const teamConfig = this.config.teams[teamName];
    if (!teamConfig) {
      throw new Error(`Team "${teamName}" not found in configuration`);
    }

    return {
      appToken: teamConfig.appToken,
      botToken: teamConfig.botToken,
    };
  }

  /**
   * Get app token for a specific team
   * @param {string} teamName - Name of the team
   * @returns {string} App-Level token for the team
   * @throws {Error} If team is not found or configuration is not loaded
   */
  getTeamToken(teamName) {
    const tokens = this.getTeamTokens(teamName);
    return tokens.appToken;
  }

  /**
   * Validate teams and filter out invalid ones
   * @returns {Object} Object containing only valid team configurations
   */
  getValidTeamConfigs() {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    const validTeams = {};
    const teamConfigs = this.config.teams;

    for (const [teamName, teamConfig] of Object.entries(teamConfigs)) {
      try {
        this.validateTeamConfig(teamName, teamConfig);
        validTeams[teamName] = teamConfig;
      } catch (error) {
        logger.error(`Team "${teamName}" skipped due to configuration error: ${error.message}`);
        // Continue processing other teams instead of throwing
      }
    }

    if (Object.keys(validTeams).length === 0) {
      const errorMessage = 'No valid team configurations found';
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    return validTeams;
  }

  /**
   * Check if configuration file exists
   * @returns {boolean} True if configuration file exists
   */
  configFileExists() {
    try {
      readFileSync(this.configPath, 'utf8');
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      // For other errors (permissions, etc.), we still consider the file as "existing"
      // but with access issues that will be handled in loadConfig()
      return true;
    }
  }

  /**
   * Load configuration with graceful error handling
   * @returns {Object|null} Loaded configuration object or null if failed
   */
  loadConfigSafely() {
    try {
      return this.loadConfig();
    } catch (error) {
      // Error already logged in loadConfig()
      logger.error(`Failed to load configuration safely: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate Slack App-Level token format
   * @param {string} token - Token to validate
   * @returns {boolean} True if token format is valid
   */
  isValidSlackToken(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }
    // Slack App-Level token format: xapp-1- followed by alphanumeric characters
    return /^xapp-1-[A-Za-z0-9]+$/.test(token);
  }
}
