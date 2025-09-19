import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import chalk from 'chalk';
import { ConfigurationManager } from '../../src/config/ConfigurationManager.js';
import HighlightConfig from '../../src/config/HighlightConfig.js';
import { MessageProcessor } from '../../src/message/MessageProcessor.js';
import { ConsoleOutputHandler } from '../../src/message/handlers/ConsoleOutputHandler.js';
import { logger } from '../../src/utils/Logger.js';

/**
 * Integration tests for highlight feature
 * Tests the complete flow from configuration loading to highlighted message output
 * Requirements: 2.2, 2.5
 */
describe('Integration Tests - Highlight Feature', () => {
  let originalConsoleLog;
  let originalConsoleError;
  let consoleLogSpy;
  let consoleErrorSpy;
  let testConfigPath;

  // Helper function to check if running in CI environment
  const isCI = () => {
    return !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.CONTINUOUS_INTEGRATION);
  };

  beforeEach(() => {
    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    consoleLogSpy = vi.fn();
    consoleErrorSpy = vi.fn();
    console.log = consoleLogSpy;
    console.error = consoleErrorSpy;

    // Mock logger methods
    vi.spyOn(logger, 'error').mockImplementation(consoleErrorSpy);
    vi.spyOn(logger, 'info').mockImplementation(consoleLogSpy);
    vi.spyOn(logger, 'warn').mockImplementation(consoleErrorSpy);

    // Setup test config path
    testConfigPath = path.join(process.cwd(), '.env.highlight-feature.test.json');

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

  describe('Configuration to Highlight Output Flow', () => {
    it('should load highlight configuration and apply highlighting to matching messages', async () => {
      // Create test configuration with highlight keywords
      const testConfig = {
        teams: {
          'test-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: {
          console: {
            enabled: true,
          },
        },
        highlight: {
          keywords: ['/php/i', '/error/i', '/(uzulla|uzura)/i'],
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      // Test configuration loading
      const configManager = new ConfigurationManager(testConfigPath);
      const config = configManager.loadConfig();
      const highlightConfig = configManager.getHighlightConfig();

      expect(highlightConfig).toBeInstanceOf(HighlightConfig);
      expect(highlightConfig.getKeywords()).toHaveLength(3);
      expect(highlightConfig.getKeywords()).toEqual(['/php/i', '/error/i', '/(uzulla|uzura)/i']);

      // Test message processor setup with highlight
      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true, highlightConfig);
      messageProcessor.registerHandler(consoleHandler);

      // Test messages - some should match, some shouldn't
      const matchingMessage = {
        team: 'test-team',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'testuser',
        text: 'PHP error occurred in the application',
        timestamp: '1234567890.123456',
        formattedTime: new Date('2023-01-01T12:00:00Z'),
      };

      const nonMatchingMessage = {
        team: 'test-team',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'testuser',
        text: 'Hello world!',
        timestamp: '1234567891.123456',
        formattedTime: new Date('2023-01-01T12:00:01Z'),
      };

      // Process messages
      await messageProcessor.processMessage(matchingMessage);
      await messageProcessor.processMessage(nonMatchingMessage);

      // Verify console output - first message should be highlighted (red/bold), second should be normal
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);

      // Check that the first call contains ANSI color codes (indicating highlighting)
      const firstCall = consoleLogSpy.mock.calls[0][0];
      if (!isCI()) {
        expect(firstCall).toContain('\u001b['); // ANSI escape sequence for colors
      }
      expect(firstCall).toContain('test-team/general/testuser > PHP error occurred in the application');

      // Check that the second call doesn't contain ANSI color codes
      const secondCall = consoleLogSpy.mock.calls[1][0];
      if (!isCI()) {
        expect(secondCall).not.toContain('\u001b['); // No ANSI escape sequences
      }
      expect(secondCall).toBe('test-team/general/testuser > Hello world!');
    });

    it('should handle multiple keyword matching correctly', async () => {
      const testConfig = {
        teams: {
          'test-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
        highlight: {
          keywords: ['/php/i', '/error/i', '/warning/i'],
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);
      configManager.loadConfig();
      const highlightConfig = configManager.getHighlightConfig();

      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true, highlightConfig);
      messageProcessor.registerHandler(consoleHandler);

      // Message that matches multiple keywords
      const multiMatchMessage = {
        team: 'test-team',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'testuser',
        text: 'PHP error and warning detected',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      await messageProcessor.processMessage(multiMatchMessage);

      // Should be highlighted even with multiple matches
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0];
      if (!isCI()) {
        expect(output).toContain('\u001b['); // Should contain ANSI color codes
      }
      expect(output).toContain('PHP error and warning detected');
    });

    it('should work with case-insensitive regex patterns', async () => {
      const testConfig = {
        teams: {
          'test-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
        highlight: {
          keywords: ['/PHP/i', '/ERROR/i'], // Uppercase patterns with case-insensitive flag
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);
      configManager.loadConfig();
      const highlightConfig = configManager.getHighlightConfig();

      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true, highlightConfig);
      messageProcessor.registerHandler(consoleHandler);

      // Test lowercase text matching uppercase pattern
      const lowercaseMessage = {
        team: 'test-team',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'testuser',
        text: 'php error in lowercase',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      await messageProcessor.processMessage(lowercaseMessage);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0];
      if (!isCI()) {
        expect(output).toContain('\u001b['); // Should be highlighted
      }
    });

    it('should handle complex regex patterns correctly', async () => {
      const testConfig = {
        teams: {
          'test-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
        highlight: {
          keywords: ['/(uzulla|uzura)/i', '/@\\w+/', '/\\d{4}-\\d{2}-\\d{2}/'],
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);
      configManager.loadConfig();
      const highlightConfig = configManager.getHighlightConfig();

      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true, highlightConfig);
      messageProcessor.registerHandler(consoleHandler);

      const testMessages = [
        {
          team: 'test-team',
          channel: 'general',
          channelId: 'C1234567890',
          user: 'testuser',
          text: 'Hello uzulla, how are you?', // Should match /(uzulla|uzura)/i
          timestamp: '1234567890.123456',
          formattedTime: new Date(),
        },
        {
          team: 'test-team',
          channel: 'general',
          channelId: 'C1234567890',
          user: 'testuser',
          text: 'Meeting on 2023-12-25', // Should match /\\d{4}-\\d{2}-\\d{2}/
          timestamp: '1234567891.123456',
          formattedTime: new Date(),
        },
        {
          team: 'test-team',
          channel: 'general',
          channelId: 'C1234567890',
          user: 'testuser',
          text: 'No special patterns here',
          timestamp: '1234567892.123456',
          formattedTime: new Date(),
        },
      ];

      for (const message of testMessages) {
        await messageProcessor.processMessage(message);
      }

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);

      // First two messages should be highlighted
      const firstOutput = consoleLogSpy.mock.calls[0][0];
      const secondOutput = consoleLogSpy.mock.calls[1][0];
      const thirdOutput = consoleLogSpy.mock.calls[2][0];

      if (!isCI()) {
        expect(firstOutput).toContain('\u001b['); // Highlighted
        expect(secondOutput).toContain('\u001b['); // Highlighted
        expect(thirdOutput).not.toContain('\u001b['); // Not highlighted
      }
    });
  });

  describe('Configuration Without Highlight Section', () => {
    it('should work normally when highlight section is missing', async () => {
      const testConfig = {
        teams: {
          'test-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
        // No highlight section
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);
      configManager.loadConfig();
      const highlightConfig = configManager.getHighlightConfig();

      // Should return empty HighlightConfig
      expect(highlightConfig).toBeInstanceOf(HighlightConfig);
      expect(highlightConfig.getKeywords()).toHaveLength(0);

      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true, highlightConfig);
      messageProcessor.registerHandler(consoleHandler);

      const testMessage = {
        team: 'test-team',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'testuser',
        text: 'This should not be highlighted',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      await messageProcessor.processMessage(testMessage);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).not.toContain('\u001b['); // Should not be highlighted
      expect(output).toBe('test-team/general/testuser > This should not be highlighted');
    });

    it('should work normally when highlight keywords array is empty', async () => {
      const testConfig = {
        teams: {
          'test-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
        highlight: {
          keywords: [], // Empty array
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);
      configManager.loadConfig();
      const highlightConfig = configManager.getHighlightConfig();

      expect(highlightConfig.getKeywords()).toHaveLength(0);

      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true, highlightConfig);
      messageProcessor.registerHandler(consoleHandler);

      const testMessage = {
        team: 'test-team',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'testuser',
        text: 'This should not be highlighted either',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      await messageProcessor.processMessage(testMessage);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).not.toContain('\u001b['); // Should not be highlighted
    });
  });

  describe('Error Cases Integration', () => {
    it('should handle invalid regex patterns in configuration', () => {
      const testConfig = {
        teams: {
          'test-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
        highlight: {
          keywords: ['/valid/i', '/[invalid/i', '/another-valid/'], // One invalid regex
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);

      // Should throw error during configuration validation
      expect(() => {
        configManager.loadConfig();
      }).toThrow();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid regex pattern in highlight.keywords[1]')
      );
    });

    it('should handle non-array keywords configuration', () => {
      const testConfig = {
        teams: {
          'test-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
        highlight: {
          keywords: 'not-an-array', // Invalid type
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);

      expect(() => {
        configManager.loadConfig();
      }).toThrow('Configuration "highlight.keywords" must be an array');
    });

    it('should handle non-string keyword values', () => {
      const testConfig = {
        teams: {
          'test-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
        highlight: {
          keywords: ['/valid/i', 123, '/another-valid/'], // Non-string value
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);

      expect(() => {
        configManager.loadConfig();
      }).toThrow('Configuration "highlight.keywords[1]" must be a string');
    });

    it('should handle highlight processing errors gracefully', async () => {
      const testConfig = {
        teams: {
          'test-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
        highlight: {
          keywords: ['/test/i'],
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);
      configManager.loadConfig();
      const highlightConfig = configManager.getHighlightConfig();

      // Mock the matchesAny method to throw an error
      vi.spyOn(highlightConfig, 'matchesAny').mockImplementation(() => {
        throw new Error('Regex processing error');
      });

      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true, highlightConfig);
      messageProcessor.registerHandler(consoleHandler);

      const testMessage = {
        team: 'test-team',
        channel: 'general',
        channelId: 'C1234567890',
        user: 'testuser',
        text: 'This should fallback to normal output',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      // Should not throw error, should fallback to normal output
      await messageProcessor.processMessage(testMessage);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).not.toContain('\u001b['); // Should not be highlighted due to error
      expect(output).toBe('test-team/general/testuser > This should fallback to normal output');
    });
  });

  describe('End-to-End Highlight Integration', () => {
    it('should demonstrate complete highlight flow with multiple teams and messages', async () => {
      const testConfig = {
        teams: {
          'dev-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1111111111', 'C2222222222'],
          },
          'ops-team': {
            appToken: 'xapp-1-B1234567890',
            botToken: 'xoxb-0987654321-DEF',
            channels: ['C3333333333'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
        highlight: {
          keywords: ['/error/i', '/critical/i', '/php/i', '/@\\w+/'],
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);
      const config = configManager.loadConfig();
      const highlightConfig = configManager.getHighlightConfig();

      expect(highlightConfig.getKeywords()).toHaveLength(4);

      const messageProcessor = new MessageProcessor();
      const consoleHandler = new ConsoleOutputHandler(true, highlightConfig);
      messageProcessor.registerHandler(consoleHandler);

      const testMessages = [
        {
          team: 'dev-team',
          channel: 'general',
          channelId: 'C1111111111',
          user: 'alice',
          text: 'PHP error in production!', // Should be highlighted (error + php)
          timestamp: '1234567890.123456',
          formattedTime: new Date('2023-01-01T09:00:00Z'),
        },
        {
          team: 'ops-team',
          channel: 'alerts',
          channelId: 'C3333333333',
          user: 'bob',
          text: 'System running normally', // Should not be highlighted
          timestamp: '1234567891.123456',
          formattedTime: new Date('2023-01-01T09:00:01Z'),
        },
        {
          team: 'dev-team',
          channel: 'code-review',
          channelId: 'C2222222222',
          user: 'charlie',
          text: 'Critical bug found @alice', // Should be highlighted (critical + @alice)
          timestamp: '1234567892.123456',
          formattedTime: new Date('2023-01-01T09:00:02Z'),
        },
        {
          team: 'ops-team',
          channel: 'alerts',
          channelId: 'C3333333333',
          user: 'diana',
          text: 'Deployment completed successfully', // Should not be highlighted
          timestamp: '1234567893.123456',
          formattedTime: new Date('2023-01-01T09:00:03Z'),
        },
      ];

      // Process all messages
      for (const message of testMessages) {
        await messageProcessor.processMessage(message);
      }

      expect(consoleLogSpy).toHaveBeenCalledTimes(4);

      // Check highlighting results
      const outputs = consoleLogSpy.mock.calls.map((call) => call[0]);

      // Verify message content (always check)
      expect(outputs[0]).toContain('dev-team/general/alice > PHP error in production!');
      expect(outputs[1]).toBe('ops-team/alerts/bob > System running normally');
      expect(outputs[2]).toContain('dev-team/code-review/charlie > Critical bug found @alice');
      expect(outputs[3]).toBe('ops-team/alerts/diana > Deployment completed successfully');

      // Check highlighting only in non-CI environments
      if (!isCI()) {
        // First message should be highlighted (PHP error)
        expect(outputs[0]).toContain('\u001b[');

        // Second message should not be highlighted
        expect(outputs[1]).not.toContain('\u001b[');

        // Third message should be highlighted (critical + @alice)
        expect(outputs[2]).toContain('\u001b[');

        // Fourth message should not be highlighted
        expect(outputs[3]).not.toContain('\u001b[');
      }
    });
  });
});
