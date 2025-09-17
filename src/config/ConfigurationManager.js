import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Configuration Manager for Slack Aggregator CLI
 * Handles loading and validation of .env.json configuration file
 */
export class ConfigurationManager {
  constructor() {
    this.config = null;
    this.configPath = '.env.json';
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
        throw new Error(`Configuration file ${this.configPath} not found`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw new Error(`Failed to load configuration: ${error.message}`);
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
      throw new Error(`Team "${teamName}" configuration must be an object`);
    }

    // Validate token
    if (!teamConfig.token || typeof teamConfig.token !== 'string') {
      throw new Error(`Team "${teamName}" must have a valid token string`);
    }

    // Validate token format (Slack App-Level Token format)
    if (!this.isValidSlackToken(teamConfig.token)) {
      throw new Error(`Team "${teamName}" has invalid token format. Expected format: xapp-1-xxxxx`);
    }

    // Validate channels
    if (!teamConfig.channels || !Array.isArray(teamConfig.channels)) {
      throw new Error(`Team "${teamName}" must have a "channels" array`);
    }

    if (teamConfig.channels.length === 0) {
      throw new Error(`Team "${teamName}" must have at least one channel configured`);
    }

    // Validate channel ID format
    for (const channelId of teamConfig.channels) {
      if (!this.isValidChannelId(channelId)) {
        throw new Error(
          `Team "${teamName}" has invalid channel ID: ${channelId}. Expected format: C followed by 10 characters`
        );
      }
    }
  }

  /**
   * Validate Slack token format
   * @param {string} token - Token to validate
   * @returns {boolean} True if token format is valid
   */
  isValidSlackToken(token) {
    // Slack App-Level Token format: xapp-1-xxxxx
    return /^xapp-1-[A-Za-z0-9]+$/.test(token);
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
   * Get token for a specific team
   * @param {string} teamName - Name of the team
   * @returns {string} Token for the team
   * @throws {Error} If team is not found or configuration is not loaded
   */
  getTeamToken(teamName) {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    const teamConfig = this.config.teams[teamName];
    if (!teamConfig) {
      throw new Error(`Team "${teamName}" not found in configuration`);
    }

    return teamConfig.token;
  }
}
