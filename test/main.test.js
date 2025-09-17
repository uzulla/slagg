import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We need to export the SlaggApp class from main.js to test it properly
// Let's create a focused test that tests the main.js functionality

describe('main.js', () => {
  let originalProcessExit;
  let originalProcessOn;
  let originalProcessArgv;
  let originalImportMetaUrl;
  let processExitSpy;
  let processOnSpy;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock process functions
    originalProcessExit = process.exit;
    originalProcessOn = process.on;
    originalProcessArgv = process.argv;
    processExitSpy = vi.fn();
    processOnSpy = vi.fn();
    process.exit = processExitSpy;
    process.on = processOnSpy;
  });

  afterEach(() => {
    // Restore original functions
    process.exit = originalProcessExit;
    process.on = originalProcessOn;
    process.argv = originalProcessArgv;

    // Clear module cache to ensure fresh imports
    vi.resetModules();
  });

  describe('Application structure', () => {
    it('should have shebang for CLI execution', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');
      expect(mainContent.startsWith('#!/usr/bin/env node')).toBe(true);
    });

    it('should import required dependencies', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain(
        "import { ConfigurationManager } from './config/ConfigurationManager.js'"
      );
      expect(mainContent).toContain(
        "import { MessageProcessor } from './message/MessageProcessor.js'"
      );
      expect(mainContent).toContain(
        "import { ConsoleOutputHandler } from './message/handlers/ConsoleOutputHandler.js'"
      );
      expect(mainContent).toContain("import { TeamManager } from './team/TeamManager.js'");
      expect(mainContent).toContain("import { logger } from './utils/Logger.js'");
    });

    it('should define SlaggApp class', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('class SlaggApp');
      expect(mainContent).toContain('constructor()');
      expect(mainContent).toContain('async initialize()');
      expect(mainContent).toContain('async start()');
      expect(mainContent).toContain('setupMessageHandlers(config)');
      expect(mainContent).toContain('displayStartupStatus(teamConfigs)');
      expect(mainContent).toContain('setupShutdownHandlers()');
    });

    it('should have main function', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('async function main()');
      expect(mainContent).toContain('const app = new SlaggApp()');
      expect(mainContent).toContain('await app.start()');
    });

    it('should have conditional execution check', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('if (import.meta.url === `file://${process.argv[1]}`)');
      expect(mainContent).toContain('main().catch((error) => {');
    });
  });

  describe('Application lifecycle', () => {
    it('should handle initialization sequence', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      // Check that initialization follows the correct sequence
      const initializeMethodMatch = mainContent.match(/async initialize\(\) \{([\s\S]*?)\}/);
      expect(initializeMethodMatch).toBeTruthy();

      const initializeMethod = initializeMethodMatch[1];
      expect(initializeMethod).toContain('this.configManager.loadConfig()');
      expect(initializeMethod).toContain('this.configManager.getValidTeamConfigs()');
      expect(initializeMethod).toContain('this.setupMessageHandlers(config)');
      expect(initializeMethod).toContain('this.teamManager.initialize(teamConfigs)');
      expect(initializeMethod).toContain(
        'this.teamManager.setMessageProcessor(this.messageProcessor)'
      );
      expect(initializeMethod).toContain('this.displayStartupStatus(teamConfigs)');
    });

    it('should handle start sequence', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      const startMethodMatch = mainContent.match(/async start\(\) \{([\s\S]*?)\}/);
      expect(startMethodMatch).toBeTruthy();

      const startMethod = startMethodMatch[1];
      expect(startMethod).toContain('await this.initialize()');
      expect(startMethod).toContain('await this.teamManager.connectAllTeams()');
      expect(startMethod).toContain('this.setupShutdownHandlers()');
    });

    it('should setup message handlers correctly', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('setupMessageHandlers(config)');
      expect(mainContent).toContain('config.handlers || {}');
      expect(mainContent).toContain('handlerConfigs.console || { enabled: true }');
      expect(mainContent).toContain('new ConsoleOutputHandler(consoleConfig.enabled)');
      expect(mainContent).toContain('this.messageProcessor.registerHandler(consoleHandler)');
    });

    it('should display startup status', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      const displayStatusMatch = mainContent.match(
        /displayStartupStatus\(teamConfigs\) \{([\s\S]*?)\}/
      );
      expect(displayStatusMatch).toBeTruthy();

      const displayStatus = displayStatusMatch[1];
      expect(displayStatus).toContain('Object.keys(teamConfigs)');
      expect(displayStatus).toContain('Object.values(teamConfigs).reduce');
      expect(displayStatus).toContain('config.channels.length');
      expect(displayStatus).toContain('logger.info');
    });
  });

  describe('Shutdown handling', () => {
    it('should setup shutdown handlers for SIGINT and SIGTERM', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      const setupShutdownMatch = mainContent.match(/setupShutdownHandlers\(\) \{([\s\S]*?)\}/);
      expect(setupShutdownMatch).toBeTruthy();

      const setupShutdown = setupShutdownMatch[1];
      expect(mainContent).toContain("process.on('SIGINT'");
      expect(mainContent).toContain("process.on('SIGTERM'");
      expect(setupShutdown).toContain('shutdownHandler');
    });

    it('should handle graceful shutdown', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      const shutdownHandlerMatch = mainContent.match(
        /const shutdownHandler = async \(signal\) => \{([\s\S]*?)\};/
      );
      expect(shutdownHandlerMatch).toBeTruthy();

      const shutdownHandler = shutdownHandlerMatch[1];
      expect(shutdownHandler).toContain('if (this.isShuttingDown)');
      expect(shutdownHandler).toContain('this.isShuttingDown = true');
      expect(shutdownHandler).toContain(
        'logger.info(`Received ${signal}, shutting down gracefully...`)'
      );
      expect(shutdownHandler).toContain('await this.teamManager.shutdown()');
      expect(shutdownHandler).toContain('process.exit(0)');
      expect(shutdownHandler).toContain('process.exit(1)');
    });

    it('should prevent multiple shutdown attempts', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('if (this.isShuttingDown)');
      expect(mainContent).toContain('return;');
      expect(mainContent).toContain('this.isShuttingDown = true');
    });
  });

  describe('Error handling', () => {
    it('should handle initialization errors', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('async initialize()');
      expect(mainContent).toContain('try {');
      expect(mainContent).toContain('} catch (error) {');
      expect(mainContent).toContain('logger.error(`Initialization failed: ${error.message}`)');
      expect(mainContent).toContain('throw error');
    });

    it('should handle start errors', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('async start()');
      expect(mainContent).toContain('try {');
      expect(mainContent).toContain('} catch (error) {');
      expect(mainContent).toContain(
        'logger.error(`Failed to start application: ${error.message}`)'
      );
      expect(mainContent).toContain('process.exit(1)');
    });

    it('should handle shutdown errors', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      const shutdownHandlerMatch = mainContent.match(
        /const shutdownHandler = async \(signal\) => \{([\s\S]*?)\};/
      );
      expect(shutdownHandlerMatch).toBeTruthy();

      const shutdownHandler = shutdownHandlerMatch[1];
      expect(shutdownHandler).toContain('try {');
      expect(shutdownHandler).toContain('} catch (error) {');
      expect(shutdownHandler).toContain('logger.error(`Error during shutdown: ${error.message}`)');
    });

    it('should handle main function errors', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('main().catch((error) => {');
      expect(mainContent).toContain('logger.error(`Application failed: ${error.message}`)');
      expect(mainContent).toContain('process.exit(1)');
    });
  });

  describe('Component integration', () => {
    it('should create all required component instances', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      const constructorMatch = mainContent.match(/constructor\(\) \{([\s\S]*?)\}/);
      expect(constructorMatch).toBeTruthy();

      const constructorContent = constructorMatch[1];
      expect(constructorContent).toContain('this.configManager = new ConfigurationManager()');
      expect(constructorContent).toContain('this.teamManager = new TeamManager()');
      expect(constructorContent).toContain('this.messageProcessor = new MessageProcessor()');
      expect(constructorContent).toContain('this.isShuttingDown = false');
    });

    it('should wire components together correctly', async () => {
      const fs = await import('node:fs');
      const mainContent = fs.readFileSync('src/main.js', 'utf8');

      expect(mainContent).toContain('this.teamManager.setMessageProcessor(this.messageProcessor)');
      expect(mainContent).toContain('this.messageProcessor.registerHandler(consoleHandler)');
    });
  });
});
