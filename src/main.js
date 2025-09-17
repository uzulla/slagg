#!/usr/bin/env node

import { ConfigurationManager } from './config/ConfigurationManager.js';
import { MessageProcessor } from './message/MessageProcessor.js';
import { ConsoleOutputHandler } from './message/handlers/ConsoleOutputHandler.js';
import { TeamManager } from './team/TeamManager.js';
import { logger } from './utils/Logger.js';

/**
 * Slagg CLI Application
 * Main entry point for the Slack Aggregator CLI tool
 */
class SlaggApp {
  constructor() {
    this.configManager = new ConfigurationManager();
    this.teamManager = new TeamManager();
    this.messageProcessor = new MessageProcessor();
    this.isShuttingDown = false;
  }

  /**
   * Initialize the application
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Load configuration
      const config = this.configManager.loadConfig();

      // Get valid team configurations
      const teamConfigs = this.configManager.getValidTeamConfigs();

      // Initialize message processor with handlers
      this.setupMessageHandlers(config);

      // Initialize team manager
      await this.teamManager.initialize(teamConfigs);
      this.teamManager.setMessageProcessor(this.messageProcessor);

      // Display startup status
      this.displayStartupStatus(teamConfigs);
    } catch (error) {
      logger.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start the application
   * @returns {Promise<void>}
   */
  async start() {
    try {
      await this.initialize();
      await this.teamManager.connectAllTeams();

      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();
    } catch (error) {
      logger.error(`Failed to start application: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Setup message handlers based on configuration
   * @param {Object} config - Application configuration
   */
  setupMessageHandlers(config) {
    const handlerConfigs = config.handlers || {};

    // Setup console output handler (default enabled)
    const consoleConfig = handlerConfigs.console || { enabled: true };
    const consoleHandler = new ConsoleOutputHandler(consoleConfig.enabled);
    this.messageProcessor.registerHandler(consoleHandler);
  }

  /**
   * Display startup status information
   * @param {Object} teamConfigs - Team configurations
   */
  displayStartupStatus(teamConfigs) {
    const teamNames = Object.keys(teamConfigs);
    const totalChannels = Object.values(teamConfigs).reduce(
      (sum, config) => sum + config.channels.length,
      0
    );

    logger.info(
      `Loaded configuration for ${teamNames.length} team(s) with ${totalChannels} channel(s)`
    );
  }

  /**
   * Setup graceful shutdown handlers for SIGINT and SIGTERM
   */
  setupShutdownHandlers() {
    const shutdownHandler = async (signal) => {
      if (this.isShuttingDown) {
        return;
      }

      this.isShuttingDown = true;
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await this.teamManager.shutdown();
        process.exit(0);
      } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  }
}

/**
 * Main function to run the application
 */
async function main() {
  const app = new SlaggApp();
  await app.start();
}

// Run the application if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error(`Application failed: ${error.message}`);
    process.exit(1);
  });
}
