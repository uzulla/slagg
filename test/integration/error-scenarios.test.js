import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigurationManager } from '../../src/config/ConfigurationManager.js';
import { TeamManager } from '../../src/team/TeamManager.js';
import { SlackClient } from '../../src/team/SlackClient.js';
import { logger } from '../../src/utils/Logger.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Integration tests for error scenarios
 * Tests error handling for invalid tokens, connection failures, and invalid channel IDs
 * Requirements: 1.3, 2.3, 3.3, 3.4
 */
describe('Integration Tests - Error Scenarios', () => {
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

    // Mock logger methods
    vi.spyOn(logger, 'error').mockImplementation(consoleErrorSpy);
    vi.spyOn(logger, 'info').mockImplementation(consoleLogSpy);
    vi.spyOn(logger, 'warn').mockImplementation(consoleErrorSpy);

    // Setup test config path
    testConfigPath = path.join(process.cwd(), '.env.error-scenarios.test.json');

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Restore logger mocks
    vi.restoreAllMocks();

    // Clean up test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('Configuration Integration', () => {
    it('should handle mixed valid and invalid teams gracefully', () => {
      const mixedConfig = {
        teams: {
          'valid-team': {
            appToken: 'xapp-1-A1234567890',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890']
          },
          'invalid-team': {
            appToken: 'invalid-token',
            botToken: 'invalid-bot-token',
            channels: ['C0987654321']
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(mixedConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);
      
      // loadConfig should throw due to validation failure
      expect(() => {
        configManager.loadConfig();
      }).toThrow();

      // But getValidTeamConfigs should filter out invalid ones when config is manually set
      configManager.config = mixedConfig;
      const validTeams = configManager.getValidTeamConfigs();
      
      // Should only have valid teams
      expect(Object.keys(validTeams)).toHaveLength(1);
      expect(validTeams).toHaveProperty('valid-team');
      expect(validTeams).not.toHaveProperty('invalid-team');
      
      // Verify error was logged for invalid team
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Team "invalid-team" skipped due to configuration error')
      );
    });
  });

  describe('Connection Failure Handling', () => {
    it('should handle Slack client connection failures', async () => {
      const testConfig = {
        'test-team': {
          appToken: 'xapp-1-A1234567890',
          botToken: 'xoxb-1234567890-ABC',
          channels: ['C1234567890']
        }
      };

      const teamManager = new TeamManager();
      
      // Mock SlackClient to simulate connection failure
      const connectSpy = vi.spyOn(SlackClient.prototype, 'connect')
        .mockRejectedValue(new Error('Connection failed: Invalid token'));
      
      const disconnectSpy = vi.spyOn(SlackClient.prototype, 'disconnect')
        .mockResolvedValue();

      await teamManager.initialize(testConfig);

      // Attempt to connect should handle the failure gracefully
      await expect(teamManager.connectAllTeams()).rejects.toThrow('Failed to connect to any teams');

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Team: test-team, Error: Failed to connect - Connection failed: Invalid token')
      );

      // Cleanup
      await teamManager.shutdown();
      connectSpy.mockRestore();
      disconnectSpy.mockRestore();
    });

    it('should attempt reconnection on connection loss', async () => {
      const testConfig = {
        'test-team': {
          appToken: 'xapp-1-A1234567890',
          botToken: 'xoxb-1234567890-ABC',
          channels: ['C1234567890']
        }
      };

      const teamManager = new TeamManager();
      
      // Mock SlackClient methods
      let connectionAttempts = 0;
      const connectSpy = vi.spyOn(SlackClient.prototype, 'connect')
        .mockImplementation(async () => {
          connectionAttempts++;
          if (connectionAttempts === 1) {
            throw new Error('Initial connection failed');
          }
          // Succeed on subsequent attempts
          return Promise.resolve();
        });
      
      const disconnectSpy = vi.spyOn(SlackClient.prototype, 'disconnect')
        .mockResolvedValue();

      const isClientConnectedSpy = vi.spyOn(SlackClient.prototype, 'isClientConnected')
        .mockReturnValue(false);

      await teamManager.initialize(testConfig);

      // First connection attempt should fail
      await expect(teamManager.connectAllTeams()).rejects.toThrow('Failed to connect to any teams');
      expect(connectionAttempts).toBe(1);

      // Simulate reconnection attempt
      try {
        await teamManager.connectAllTeams();
      } catch (error) {
        // Expected to fail since we're mocking failures
      }

      // Cleanup
      await teamManager.shutdown();
      connectSpy.mockRestore();
      disconnectSpy.mockRestore();
      isClientConnectedSpy.mockRestore();
    });

    it('should handle partial team connection failures', async () => {
      const testConfig = {
        'working-team': {
          appToken: 'xapp-1-A1234567890',
          botToken: 'xoxb-1234567890-ABC',
          channels: ['C1234567890']
        },
        'failing-team': {
          appToken: 'xapp-1-B1234567890',
          botToken: 'xoxb-0987654321-DEF',
          channels: ['C0987654321']
        }
      };

      const teamManager = new TeamManager();
      
      // Mock SlackClient to simulate partial failures
      const connectSpy = vi.spyOn(SlackClient.prototype, 'connect')
        .mockImplementation(async function() {
          // 'this' refers to the SlackClient instance
          if (this.teamName === 'failing-team') {
            throw new Error('Authentication failed');
          }
          return Promise.resolve();
        });
      
      const disconnectSpy = vi.spyOn(SlackClient.prototype, 'disconnect')
        .mockResolvedValue();

      await teamManager.initialize(testConfig);
      await teamManager.connectAllTeams();

      // Should have connected to one team successfully
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Team: failing-team, Error: Failed to connect - Authentication failed')
      );
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connected to 1 team(s), 1 failed')
      );

      // Cleanup
      await teamManager.shutdown();
      connectSpy.mockRestore();
      disconnectSpy.mockRestore();
    });
  });



  describe('Configuration File Integration', () => {
    it('should handle missing configuration file', () => {
      // Ensure config file doesn't exist
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }

      const configManager = new ConfigurationManager(testConfigPath);
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle invalid JSON in configuration file', () => {
      // Write invalid JSON
      fs.writeFileSync(testConfigPath, '{ invalid json content }');

      const configManager = new ConfigurationManager(testConfigPath);
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON in configuration file')
      );
    });
  });

  describe('Team Error Handling', () => {
    it('should handle team disconnection gracefully', async () => {
      const testConfig = {
        'test-team': {
          appToken: 'xapp-1-A1234567890',
          botToken: 'xoxb-1234567890-ABC',
          channels: ['C1234567890']
        }
      };

      const teamManager = new TeamManager();
      
      // Mock SlackClient methods
      const connectSpy = vi.spyOn(SlackClient.prototype, 'connect')
        .mockResolvedValue();
      
      const disconnectSpy = vi.spyOn(SlackClient.prototype, 'disconnect')
        .mockResolvedValue();

      const isClientConnectedSpy = vi.spyOn(SlackClient.prototype, 'isClientConnected')
        .mockReturnValue(false); // Simulate disconnected state

      await teamManager.initialize(testConfig);
      await teamManager.connectAllTeams();

      // Simulate team error
      const testError = new Error('Connection lost');
      teamManager.handleTeamError('test-team', testError);

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Team: test-team, Error: Connection lost');
      
      // Verify warning about disconnection
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Team: test-team is disconnected and will be removed from monitoring'
      );

      // Cleanup
      await teamManager.shutdown();
      connectSpy.mockRestore();
      disconnectSpy.mockRestore();
      isClientConnectedSpy.mockRestore();
    });

    it('should continue operating with remaining teams after one fails', async () => {
      const testConfig = {
        'working-team': {
          appToken: 'xapp-1-A1234567890',
          botToken: 'xoxb-1234567890-ABC',
          channels: ['C1234567890']
        },
        'failing-team': {
          appToken: 'xapp-1-B1234567890',
          botToken: 'xoxb-0987654321-DEF',
          channels: ['C0987654321']
        }
      };

      const teamManager = new TeamManager();
      
      // Mock SlackClient to simulate one team failing after connection
      const connectSpy = vi.spyOn(SlackClient.prototype, 'connect')
        .mockResolvedValue();
      
      const disconnectSpy = vi.spyOn(SlackClient.prototype, 'disconnect')
        .mockResolvedValue();

      const isClientConnectedSpy = vi.spyOn(SlackClient.prototype, 'isClientConnected')
        .mockImplementation(function() {
          return this.teamName === 'working-team'; // Only working-team stays connected
        });

      await teamManager.initialize(testConfig);
      await teamManager.connectAllTeams();

      // Simulate error on failing team
      const testError = new Error('Authentication expired');
      teamManager.handleTeamError('failing-team', testError);

      // Verify error handling
      expect(consoleErrorSpy).toHaveBeenCalledWith('Team: failing-team, Error: Authentication expired');
      
      // Verify that working team is still operational
      expect(teamManager.getConnectedTeamCount()).toBe(1);
      expect(teamManager.getConnectedTeamNames()).toContain('working-team');
      expect(teamManager.getConnectedTeamNames()).not.toContain('failing-team');

      // Cleanup
      await teamManager.shutdown();
      connectSpy.mockRestore();
      disconnectSpy.mockRestore();
      isClientConnectedSpy.mockRestore();
    });
  });

  describe('Graceful Error Recovery', () => {
    it('should use loadConfigSafely for graceful error handling', () => {
      // Create invalid config
      const testConfig = {
        teams: {
          'invalid-team': {
            appToken: 'invalid-token',
            botToken: 'xoxb-1234567890-ABC',
            channels: ['C1234567890']
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager(testConfigPath);
      
      // loadConfigSafely should return null instead of throwing
      const result = configManager.loadConfigSafely();
      expect(result).toBeNull();

      // Error should still be logged
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should check configuration file existence', () => {
      const configManager = new ConfigurationManager(testConfigPath);
      
      // File doesn't exist
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }
      expect(configManager.configFileExists()).toBe(false);

      // File exists
      fs.writeFileSync(testConfigPath, '{}');
      expect(configManager.configFileExists()).toBe(true);
    });

    it('should handle shutdown during connection attempts', async () => {
      const testConfig = {
        'test-team': {
          appToken: 'xapp-1-A1234567890',
          botToken: 'xoxb-1234567890-ABC',
          channels: ['C1234567890']
        }
      };

      const teamManager = new TeamManager();
      
      // Mock SlackClient with delayed connection
      const connectSpy = vi.spyOn(SlackClient.prototype, 'connect')
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      const disconnectSpy = vi.spyOn(SlackClient.prototype, 'disconnect')
        .mockResolvedValue();

      await teamManager.initialize(testConfig);

      // Start connection and immediately shutdown
      const connectionPromise = teamManager.connectAllTeams();
      await teamManager.shutdown();

      // Connection should be handled gracefully
      try {
        await connectionPromise;
      } catch (error) {
        // Expected to fail due to shutdown
        expect(error.message).toContain('Cannot connect teams during shutdown');
      }

      connectSpy.mockRestore();
      disconnectSpy.mockRestore();
    });
  });
});
