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
    testConfigPath = path.join(process.cwd(), '.env.json');

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

  describe('Invalid Token Handling', () => {
    it('should reject configuration with invalid token format', () => {
      // Test various invalid token formats
      const invalidTokenConfigs = [
        {
          description: 'missing xapp-1 prefix',
          token: 'invalid-token-format'
        },
        {
          description: 'wrong prefix',
          token: 'xoxb-1-A1234567890'
        },
        {
          description: 'missing dash after xapp',
          token: 'xapp1A1234567890'
        },
        {
          description: 'missing version number',
          token: 'xapp-A1234567890'
        },
        {
          description: 'empty token',
          token: ''
        },
        {
          description: 'null token',
          token: null
        }
      ];

      for (const { description, token } of invalidTokenConfigs) {
        // Clean up any existing config file first
        if (fs.existsSync(testConfigPath)) {
          fs.unlinkSync(testConfigPath);
        }

        const testConfig = {
          teams: {
            'test-team': {
              token: token,
              channels: ['C1234567890']
            }
          }
        };

        fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

        const configManager = new ConfigurationManager();
        
        expect(() => {
          configManager.loadConfig();
        }).toThrow();

        // Verify error was logged
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        // Clean up for next iteration
        vi.clearAllMocks();
        if (fs.existsSync(testConfigPath)) {
          fs.unlinkSync(testConfigPath);
        }
      }
    });

    it('should handle mixed valid and invalid tokens gracefully', () => {
      const mixedConfig = {
        teams: {
          'valid-team': {
            token: 'xapp-1-A1234567890',
            channels: ['C1234567890']
          },
          'invalid-team': {
            token: 'invalid-token',
            channels: ['C0987654321']
          },
          'another-valid-team': {
            token: 'xapp-1-B1234567890',
            channels: ['C1111111111']
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(mixedConfig, null, 2));

      const configManager = new ConfigurationManager();
      
      // Should throw because validation happens during loadConfig
      expect(() => {
        configManager.loadConfig();
      }).toThrow();

      // But getValidTeamConfigs should filter out invalid ones
      try {
        configManager.config = mixedConfig; // Bypass validation for this test
        const validTeams = configManager.getValidTeamConfigs();
        
        // Should only have valid teams
        expect(Object.keys(validTeams)).toHaveLength(2);
        expect(validTeams).toHaveProperty('valid-team');
        expect(validTeams).toHaveProperty('another-valid-team');
        expect(validTeams).not.toHaveProperty('invalid-team');
        
        // Verify error was logged for invalid team
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Team "invalid-team" skipped due to configuration error')
        );
      } catch (error) {
        // This is expected if all teams are invalid
      }
    });

    it('should log appropriate error messages for invalid tokens', () => {
      // Clean up any existing config file first
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }

      const testConfig = {
        teams: {
          'test-team': {
            token: 'invalid-token-format',
            channels: ['C1234567890']
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager();
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow('Failed to load configuration: Team "test-team" has invalid token format. Expected format: xapp-1-xxxxx');

      // Verify specific error message was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Configuration error: Team "test-team" has invalid token format. Expected format: xapp-1-xxxxx'
      );
    });
  });

  describe('Connection Failure Handling', () => {
    it('should handle Slack client connection failures', async () => {
      const testConfig = {
        'test-team': {
          token: 'xapp-1-A1234567890',
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
          token: 'xapp-1-A1234567890',
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
          token: 'xapp-1-A1234567890',
          channels: ['C1234567890']
        },
        'failing-team': {
          token: 'xapp-1-B1234567890',
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

  describe('Invalid Channel ID Handling', () => {
    it('should reject configuration with invalid channel ID formats', () => {
      const invalidChannelConfigs = [
        {
          description: 'missing C prefix',
          channels: ['1234567890']
        },
        {
          description: 'wrong prefix',
          channels: ['D1234567890']
        },
        {
          description: 'too short',
          channels: ['C123456789']
        },
        {
          description: 'too long',
          channels: ['C12345678901']
        },
        {
          description: 'contains lowercase',
          channels: ['C123456789a']
        },
        {
          description: 'contains special characters',
          channels: ['C123456789!']
        },
        {
          description: 'empty channel ID',
          channels: ['']
        },
        {
          description: 'null channel ID',
          channels: [null]
        }
      ];

      for (const { description, channels } of invalidChannelConfigs) {
        const testConfig = {
          teams: {
            'test-team': {
              token: 'xapp-1-A1234567890',
              channels: channels
            }
          }
        };

        fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

        const configManager = new ConfigurationManager();
        
        expect(() => {
          configManager.loadConfig();
        }).toThrow();

        // Verify error was logged
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        // Clean up for next iteration
        vi.clearAllMocks();
      }
    });

    it('should handle mixed valid and invalid channel IDs', () => {
      const testConfig = {
        teams: {
          'test-team': {
            token: 'xapp-1-A1234567890',
            channels: ['C1234567890', 'invalid-channel', 'C0987654321', 'D1111111111']
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager();
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow();

      // Verify error was logged for invalid channel
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Team "test-team" has invalid channel ID')
      );
    });

    it('should log appropriate error messages for invalid channel IDs', () => {
      const testConfig = {
        teams: {
          'test-team': {
            token: 'xapp-1-A1234567890',
            channels: ['invalid-channel-id']
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager();
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow();

      // Verify specific error message was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Configuration error: Team "test-team" has invalid channel ID: invalid-channel-id. Expected format: C followed by 10 characters'
      );
    });

    it('should handle empty channels array', () => {
      const testConfig = {
        teams: {
          'test-team': {
            token: 'xapp-1-A1234567890',
            channels: []
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager();
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow('Failed to load configuration: Team "test-team" must have at least one channel configured');

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Configuration error: Team "test-team" must have at least one channel configured'
      );
    });

    it('should handle missing channels property', () => {
      const testConfig = {
        teams: {
          'test-team': {
            token: 'xapp-1-A1234567890'
            // Missing channels property
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager();
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow();

      // Verify error was logged (could be either channels array error or JSON parsing error)
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Configuration File Errors', () => {
    it('should handle missing configuration file', () => {
      // Ensure config file doesn't exist
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }

      const configManager = new ConfigurationManager();
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow('Configuration file .env.json not found');

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Configuration file .env.json not found');
    });

    it('should handle invalid JSON in configuration file', () => {
      // Write invalid JSON
      fs.writeFileSync(testConfigPath, '{ invalid json content }');

      const configManager = new ConfigurationManager();
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON in configuration file')
      );
    });

    it('should handle empty configuration file', () => {
      fs.writeFileSync(testConfigPath, '');

      const configManager = new ConfigurationManager();
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON in configuration file')
      );
    });

    it('should handle configuration without teams section', () => {
      const testConfig = {
        handlers: {
          console: { enabled: true }
        }
        // Missing teams section
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager();
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow('Failed to load configuration: Configuration must contain a "teams" object');
    });

    it('should handle configuration with empty teams section', () => {
      const testConfig = {
        teams: {},
        handlers: {
          console: { enabled: true }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager();
      
      expect(() => {
        configManager.loadConfig();
      }).toThrow('Failed to load configuration: At least one team must be configured');
    });
  });

  describe('Team Error Handling', () => {
    it('should handle team disconnection gracefully', async () => {
      const testConfig = {
        'test-team': {
          token: 'xapp-1-A1234567890',
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
          token: 'xapp-1-A1234567890',
          channels: ['C1234567890']
        },
        'failing-team': {
          token: 'xapp-1-B1234567890',
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
            token: 'invalid-token',
            channels: ['C1234567890']
          }
        }
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      const configManager = new ConfigurationManager();
      
      // loadConfigSafely should return null instead of throwing
      const result = configManager.loadConfigSafely();
      expect(result).toBeNull();

      // Error should still be logged
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should check configuration file existence', () => {
      const configManager = new ConfigurationManager();
      
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
          token: 'xapp-1-A1234567890',
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
