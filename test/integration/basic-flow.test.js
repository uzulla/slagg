import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigurationManager } from '../../src/config/ConfigurationManager.js';
import { MessageProcessor } from '../../src/message/MessageProcessor.js';
import { ConsoleOutputHandler } from '../../src/message/handlers/ConsoleOutputHandler.js';
import { TeamManager } from '../../src/team/TeamManager.js';
import { SlackClient } from '../../src/team/SlackClient.js';
import { logger } from '../../src/utils/Logger.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Integration tests for basic application flow
 * Tests the complete flow from configuration loading to message output
 * Requirements: 1.1-1.4, 2.1-2.4, 4.1-4.4
 */
describe('Integration Tests - Basic Flow', () => {
  let originalConsoleLog;
  let originalConsoleError;
  let consoleLogSpy;
  let consoleErrorSpy;
  let testConfigPath;

  beforeEach(() => {
    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    consoleLogSpy = vi.fn();
    consoleErrorSpy = vi.fn();
    console.log = consoleLogSpy;
    console.error = consoleErrorSpy;

    // Setup test config path
    testConfigPath = path.join(process.cwd(), '.env.json');

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Restore all mocks
    vi.restoreAllMocks();

    // Clean up test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('Configuration to Output Flow', () => {
    it('should load configuration and setup message processing pipeline', () => {
      // Create test configuration
      const testConfig = {
        teams: {
          'test-team': {
            token: 'xapp-1-A1234567890',
            channels: ['C1234567890', 'C0987654321']
          }
        },
        handlers: {
          console: {
            enabled: true
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      // Test configuration loading
      const configManager = new ConfigurationManager();
      const config = configManager.loadConfig();

      expect(config).toEqual(testConfig);
      expect(config.teams['test-team'].token).toBe('xapp-1-A1234567890');
      expect(config.teams['test-team'].channels).toHaveLength(2);

      // Test team configuration extraction
      const teamConfigs = configManager.getValidTeamConfigs();
      expect(teamConfigs).toHaveProperty('test-team');
      expect(teamConfigs['test-team'].channels).toEqual(['C1234567890', 'C0987654321']);

      // Test message processor setup
      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true);
      messageProcessor.registerHandler(consoleHandler);

      expect(messageProcessor.getHandlerCount()).toBe(1);
      expect(messageProcessor.getHandler('ConsoleOutputHandler').getName()).toBe('ConsoleOutputHandler');
    });

    it('should process messages through the complete pipeline', async () => {
      // Setup message processor with console handler
      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true);
      messageProcessor.registerHandler(consoleHandler);

      // Create test message
      const testMessage = {
        team: 'test-team',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'testuser',
        text: 'Hello world!',
        timestamp: '1234567890.123456',
        formattedTime: new Date('2023-01-01T12:00:00Z')
      };

      // Process message
      await messageProcessor.processMessage(testMessage);

      // Verify console output
      expect(consoleLogSpy).toHaveBeenCalledWith('test-team/general/testuser > Hello world!');
    });

    it('should handle multiple messages with correct timestamp sorting', async () => {
      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true);
      messageProcessor.registerHandler(consoleHandler);

      // Create messages with different timestamps
      const message1 = {
        team: 'team1',
        channel: 'general',
        channelId: 'C1111111111',
        user: 'user1',
        text: 'First message',
        timestamp: '1234567890.123456',
        formattedTime: new Date('2023-01-01T12:00:00Z')
      };

      const message2 = {
        team: 'team2',
        channel: 'random',
        channelId: 'C2222222222',
        user: 'user2',
        text: 'Second message',
        timestamp: '1234567891.123456',
        formattedTime: new Date('2023-01-01T12:00:01Z')
      };

      const message3 = {
        team: 'team1',
        channel: 'general',
        channelId: 'C1111111111',
        user: 'user3',
        text: 'Third message',
        timestamp: '1234567889.123456',
        formattedTime: new Date('2023-01-01T11:59:59Z')
      };

      // Process messages in random order
      await messageProcessor.processMessage(message2);
      await messageProcessor.processMessage(message1);
      await messageProcessor.processMessage(message3);

      // Verify messages are output in timestamp order
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, 'team2/random/user2 > Second message');
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, 'team1/general/user1 > First message');
      expect(consoleLogSpy).toHaveBeenNthCalledWith(3, 'team1/general/user3 > Third message');
    });
  });

  describe('Multiple Team Connection Flow', () => {
    it('should handle multiple team configurations', () => {
      // Create multi-team configuration
      const testConfig = {
        teams: {
          'company-team': {
            token: 'xapp-1-A1234567890',
            channels: ['C1111111111', 'C2222222222']
          },
          'client-team': {
            token: 'xapp-1-B1234567890',
            channels: ['C3333333333']
          },
          'opensource-team': {
            token: 'xapp-1-C1234567890',
            channels: ['C4444444444', 'C5555555555', 'C6666666666']
          }
        },
        handlers: {
          console: { enabled: true }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager();
      const config = configManager.loadConfig();
      const teamConfigs = configManager.getValidTeamConfigs();

      // Verify all teams are loaded
      expect(Object.keys(teamConfigs)).toHaveLength(3);
      expect(teamConfigs).toHaveProperty('company-team');
      expect(teamConfigs).toHaveProperty('client-team');
      expect(teamConfigs).toHaveProperty('opensource-team');

      // Verify channel counts
      expect(teamConfigs['company-team'].channels).toHaveLength(2);
      expect(teamConfigs['client-team'].channels).toHaveLength(1);
      expect(teamConfigs['opensource-team'].channels).toHaveLength(3);

      // Verify total channel count calculation
      const totalChannels = Object.values(teamConfigs).reduce(
        (sum, config) => sum + config.channels.length,
        0
      );
      expect(totalChannels).toBe(6);
    });

    it('should create team manager with multiple teams', async () => {
      const testConfig = {
        'team1': {
          token: 'xapp-1-A1234567890',
          channels: ['C1111111111']
        },
        'team2': {
          token: 'xapp-1-B1234567890',
          channels: ['C2222222222']
        }
      };

      const teamManager = new TeamManager();
      const messageProcessor = new MessageProcessor();

      // Mock SlackClient to avoid actual connections
      vi.spyOn(SlackClient.prototype, 'connect').mockResolvedValue();
      vi.spyOn(SlackClient.prototype, 'disconnect').mockResolvedValue();

      await teamManager.initialize(testConfig);
      teamManager.setMessageProcessor(messageProcessor);

      // Verify teams are initialized
      expect(teamManager.teams.has('team1')).toBe(true);
      expect(teamManager.teams.has('team2')).toBe(true);
      expect(teamManager.teams.size).toBe(2);
    });
  });

  describe('Message Format Verification', () => {
    it('should format messages correctly according to specification', async () => {
      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true);
      messageProcessor.registerHandler(consoleHandler);

      // Test basic message format
      const basicMessage = {
        team: 'mycompany',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'john.doe',
        text: 'Hello everyone!',
        timestamp: '1234567890.123456',
        formattedTime: new Date()
      };

      await messageProcessor.processMessage(basicMessage);
      expect(consoleLogSpy).toHaveBeenCalledWith('mycompany/general/john.doe > Hello everyone!');

      // Test message with special characters
      const specialMessage = {
        team: 'client-team',
        channel: 'project-alpha',
        channelId: 'C0987654321',
        user: 'jane_smith',
        text: 'Check this out: https://example.com/path?param=value&other=123',
        timestamp: '1234567891.123456',
        formattedTime: new Date()
      };

      await messageProcessor.processMessage(specialMessage);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'client-team/project-alpha/jane_smith > Check this out: https://example.com/path?param=value&other=123'
      );
    });

    it('should handle multiline messages by replacing newlines with spaces', async () => {
      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true);
      messageProcessor.registerHandler(consoleHandler);

      const multilineMessage = {
        team: 'dev-team',
        channel: 'code-review',
        channelId: 'C1111111111',
        user: 'developer',
        text: 'This is a multiline message\nwith several lines\nof content',
        timestamp: '1234567890.123456',
        formattedTime: new Date()
      };

      await messageProcessor.processMessage(multilineMessage);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'dev-team/code-review/developer > This is a multiline message with several lines of content'
      );
    });

    it('should handle empty and whitespace-only messages', async () => {
      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true);
      messageProcessor.registerHandler(consoleHandler);

      // Empty message
      const emptyMessage = {
        team: 'test-team',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'testuser',
        text: '',
        timestamp: '1234567890.123456',
        formattedTime: new Date()
      };

      await messageProcessor.processMessage(emptyMessage);
      expect(consoleLogSpy).toHaveBeenCalledWith('test-team/general/testuser > ');

      // Whitespace-only message
      const whitespaceMessage = {
        team: 'test-team',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'testuser',
        text: '   \t\n   ',
        timestamp: '1234567891.123456',
        formattedTime: new Date()
      };

      await messageProcessor.processMessage(whitespaceMessage);
      expect(consoleLogSpy).toHaveBeenCalledWith('test-team/general/testuser > ');
    });
  });

  describe('Handler Configuration Integration', () => {
    it('should respect handler enabled/disabled configuration', () => {
      // Test with console handler disabled
      const disabledConfig = {
        teams: {
          'test-team': {
            token: 'xapp-1-A1234567890',
            channels: ['C1234567890']
          }
        },
        handlers: {
          console: {
            enabled: false
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(disabledConfig, null, 2));

      const configManager = new ConfigurationManager();
      const config = configManager.loadConfig();
      const messageProcessor = new MessageProcessor();

      // Setup handler based on configuration
      const handlerConfigs = config.handlers || {};
      const consoleConfig = handlerConfigs.console || { enabled: true };
      const consoleHandler = new ConsoleOutputHandler(consoleConfig.enabled);
      messageProcessor.registerHandler(consoleHandler);

      expect(consoleHandler.isEnabled()).toBe(false);
    });

    it('should default to enabled console handler when no configuration provided', () => {
      const minimalConfig = {
        teams: {
          'test-team': {
            token: 'xapp-1-A1234567890',
            channels: ['C1234567890']
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(minimalConfig, null, 2));

      const configManager = new ConfigurationManager();
      const config = configManager.loadConfig();
      const messageProcessor = new MessageProcessor();

      // Setup handler with default configuration
      const handlerConfigs = config.handlers || {};
      const consoleConfig = handlerConfigs.console || { enabled: true };
      const consoleHandler = new ConsoleOutputHandler(consoleConfig.enabled);
      messageProcessor.registerHandler(consoleHandler);

      expect(consoleHandler.isEnabled()).toBe(true);
    });
  });

  describe('End-to-End Integration', () => {
    it('should demonstrate complete application flow without actual Slack connections', async () => {
      // Create comprehensive test configuration
      const testConfig = {
        teams: {
          'company': {
            token: 'xapp-1-A1234567890',
            channels: ['C1111111111', 'C2222222222']
          },
          'client': {
            token: 'xapp-1-B1234567890',
            channels: ['C3333333333']
          }
        },
        handlers: {
          console: {
            enabled: true
          },
          notification: {
            enabled: false
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      // Step 1: Load configuration
      const configManager = new ConfigurationManager();
      const config = configManager.loadConfig();
      const teamConfigs = configManager.getValidTeamConfigs();

      expect(Object.keys(teamConfigs)).toHaveLength(2);

      // Step 2: Setup message processing
      const messageProcessor = new MessageProcessor();
      const handlerConfigs = config.handlers || {};
      const consoleConfig = handlerConfigs.console || { enabled: true };
      const consoleHandler = new ConsoleOutputHandler(consoleConfig.enabled);
      messageProcessor.registerHandler(consoleHandler);

      // Step 3: Initialize team manager (mocked)
      const teamManager = new TeamManager();
      vi.spyOn(SlackClient.prototype, 'connect').mockResolvedValue();
      vi.spyOn(SlackClient.prototype, 'disconnect').mockResolvedValue();

      await teamManager.initialize(teamConfigs);
      teamManager.setMessageProcessor(messageProcessor);

      // Step 4: Simulate message processing
      const testMessages = [
        {
          team: 'company',
          channel: 'general',
          channelId: 'C1111111111',
          user: 'alice',
          text: 'Good morning team!',
          timestamp: '1234567890.123456',
          formattedTime: new Date('2023-01-01T09:00:00Z')
        },
        {
          team: 'client',
          channel: 'project',
          channelId: 'C3333333333',
          user: 'bob',
          text: 'Project update: Phase 1 complete',
          timestamp: '1234567891.123456',
          formattedTime: new Date('2023-01-01T09:00:01Z')
        },
        {
          team: 'company',
          channel: 'dev',
          channelId: 'C2222222222',
          user: 'charlie',
          text: 'Code review needed for PR #123',
          timestamp: '1234567892.123456',
          formattedTime: new Date('2023-01-01T09:00:02Z')
        }
      ];

      // Process messages
      for (const message of testMessages) {
        await messageProcessor.processMessage(message);
      }

      // Verify output
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, 'company/general/alice > Good morning team!');
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, 'client/project/bob > Project update: Phase 1 complete');
      expect(consoleLogSpy).toHaveBeenNthCalledWith(3, 'company/dev/charlie > Code review needed for PR #123');

      // Step 5: Cleanup
      await teamManager.shutdown();
    });
  });
});
