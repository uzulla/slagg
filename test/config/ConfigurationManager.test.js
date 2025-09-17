import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationManager } from '../../src/config/ConfigurationManager.js';
import { logger } from '../../src/utils/Logger.js';

// Mock fs module and logger
vi.mock('node:fs');
vi.mock('../../src/utils/Logger.js');

describe('ConfigurationManager', () => {
  let configManager;
  let mockReadFileSync;
  let mockLogger;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    mockReadFileSync = vi.mocked(readFileSync);
    mockLogger = vi.mocked(logger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should load valid configuration successfully', () => {
      const validConfig = {
        teams: {
          mycompany: {
            appToken: 'xapp-1-A123456789',
            botToken: 'xoxb-123456789-ABC',
            channels: ['C1234567890', 'C0987654321'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      const result = configManager.loadConfig();

      expect(mockReadFileSync).toHaveBeenCalledWith('.env.json', 'utf8');
      expect(result).toEqual(validConfig);
      expect(configManager.config).toEqual(validConfig);
    });

    it('should throw error and log when configuration file does not exist', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => configManager.loadConfig()).toThrow('Configuration file .env.json not found');
      expect(mockLogger.error).toHaveBeenCalledWith('Configuration file .env.json not found');
    });

    it('should throw error and log when configuration file contains invalid JSON', () => {
      mockReadFileSync.mockReturnValue('{ invalid json }');

      expect(() => configManager.loadConfig()).toThrow('Invalid JSON in configuration file');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON in configuration file')
      );
    });

    it('should throw error and log for other file system errors', () => {
      const error = new Error('Permission denied');
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => configManager.loadConfig()).toThrow(
        'Failed to load configuration: Permission denied'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load configuration: Permission denied'
      );
    });
  });

  describe('validateConfig', () => {
    it('should throw error when config is not loaded', () => {
      expect(() => configManager.validateConfig()).toThrow('Configuration not loaded');
    });

    it('should throw error when teams section is missing', () => {
      configManager.config = { handlers: {} };

      expect(() => configManager.validateConfig()).toThrow(
        'Configuration must contain a "teams" object'
      );
    });

    it('should throw error when teams section is not an object', () => {
      configManager.config = { teams: 'invalid' };

      expect(() => configManager.validateConfig()).toThrow(
        'Configuration must contain a "teams" object'
      );
    });

    it('should throw error when no teams are configured', () => {
      configManager.config = { teams: {} };

      expect(() => configManager.validateConfig()).toThrow('At least one team must be configured');
    });

    it('should throw error when handlers section is not an object', () => {
      configManager.config = {
        teams: {
          mycompany: {
            appToken: 'xapp-1-A123456789',
            botToken: 'xoxb-123456789-ABC',
            channels: ['C1234567890'],
          },
        },
        handlers: 'invalid',
      };

      expect(() => configManager.validateConfig()).toThrow(
        'Configuration "handlers" must be an object'
      );
    });

    it('should validate successfully with valid configuration', () => {
      configManager.config = {
        teams: {
          mycompany: {
            appToken: 'xapp-1-A123456789',
            botToken: 'xoxb-123456789-ABC',
            channels: ['C1234567890', 'C0987654321'],
          },
        },
        handlers: {
          console: { enabled: true },
        },
      };

      expect(() => configManager.validateConfig()).not.toThrow();
    });

    it('should validate successfully without handlers section', () => {
      configManager.config = {
        teams: {
          mycompany: {
            appToken: 'xapp-1-A123456789',
            botToken: 'xoxb-123456789-ABC',
            channels: ['C1234567890'],
          },
        },
      };

      expect(() => configManager.validateConfig()).not.toThrow();
    });
  });

  describe('validateTeamConfig', () => {
    it('should throw error and log when team config is not an object', () => {
      expect(() => configManager.validateTeamConfig('test', 'invalid')).toThrow(
        'Team "test" configuration must be an object'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" configuration must be an object'
      );
    });

    it('should throw error and log when appToken is missing', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          botToken: 'xoxb-123456789',
          channels: ['C1234567890'],
        })
      ).toThrow('Team "test" must have a valid appToken string');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" must have a valid appToken string'
      );
    });

    it('should throw error and log when botToken is missing', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          appToken: 'xapp-1-A123456789',
          channels: ['C1234567890'],
        })
      ).toThrow('Team "test" must have a valid botToken string');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" must have a valid botToken string'
      );
    });

    it('should throw error and log when appToken is not a string', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          appToken: 123,
          botToken: 'xoxb-123456789',
          channels: ['C1234567890'],
        })
      ).toThrow('Team "test" must have a valid appToken string');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" must have a valid appToken string'
      );
    });

    it('should throw error and log when botToken is not a string', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          appToken: 'xapp-1-A123456789',
          botToken: 123,
          channels: ['C1234567890'],
        })
      ).toThrow('Team "test" must have a valid botToken string');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" must have a valid botToken string'
      );
    });

    it('should throw error and log when appToken format is invalid', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          appToken: 'invalid-token',
          botToken: 'xoxb-123456789',
          channels: ['C1234567890'],
        })
      ).toThrow('Team "test" has invalid appToken format');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" has invalid appToken format. Expected format: xapp-1-xxxxx'
      );
    });

    it('should throw error and log when botToken format is invalid', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          appToken: 'xapp-1-A123456789',
          botToken: 'invalid-token',
          channels: ['C1234567890'],
        })
      ).toThrow('Team "test" has invalid botToken format');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" has invalid botToken format. Expected format: xoxb-xxxxx'
      );
    });

    it('should validate successfully with valid team config', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          appToken: 'xapp-1-A123456789',
          botToken: 'xoxb-123456789-ABC',
          channels: ['C1234567890', 'C0987654321'],
        })
      ).not.toThrow();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw error and log when channels is missing', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          appToken: 'xapp-1-A123456789',
          botToken: 'xoxb-123456789-ABC',
        })
      ).toThrow('Team "test" must have a "channels" array');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" must have a "channels" array'
      );
    });

    it('should throw error and log when channels is not an array', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          appToken: 'xapp-1-A123456789',
          botToken: 'xoxb-123456789-ABC',
          channels: 'invalid',
        })
      ).toThrow('Team "test" must have a "channels" array');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" must have a "channels" array'
      );
    });

    it('should throw error and log when channels array is empty', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          appToken: 'xapp-1-A123456789',
          botToken: 'xoxb-123456789-ABC',
          channels: [],
        })
      ).toThrow('Team "test" must have at least one channel configured');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" must have at least one channel configured'
      );
    });

    it('should throw error and log when channel ID format is invalid', () => {
      expect(() =>
        configManager.validateTeamConfig('test', {
          appToken: 'xapp-1-A123456789',
          botToken: 'xoxb-123456789-ABC',
          channels: ['invalid-channel'],
        })
      ).toThrow('Team "test" has invalid channel ID: invalid-channel');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Configuration error: Team "test" has invalid channel ID: invalid-channel. Expected format: C followed by 10 characters'
      );
    });
  });

  describe('Token validation methods', () => {
    describe('isValidSlackToken', () => {
      it('should return true for valid Slack App-Level token', () => {
        expect(configManager.isValidSlackToken('xapp-1-A123456789')).toBe(true);
        expect(configManager.isValidSlackToken('xapp-1-ABC123XYZ789')).toBe(true);
      });

      it('should return false for invalid token formats', () => {
        expect(configManager.isValidSlackToken('xoxb-123456789')).toBe(false);
        expect(configManager.isValidSlackToken('invalid-token')).toBe(false);
        expect(configManager.isValidSlackToken('xapp-2-A123456789')).toBe(false);
        expect(configManager.isValidSlackToken('xapp-1-')).toBe(false);
        expect(configManager.isValidSlackToken('')).toBe(false);
        expect(configManager.isValidSlackToken(null)).toBe(false);
        expect(configManager.isValidSlackToken(undefined)).toBe(false);
      });
    });

    describe('isValidSlackAppToken', () => {
      it('should return true for valid Slack App-Level tokens', () => {
        expect(configManager.isValidSlackAppToken('xapp-1-A123456789')).toBe(true);
        expect(configManager.isValidSlackAppToken('xapp-1-ABC123XYZ789')).toBe(true);
        expect(configManager.isValidSlackAppToken('xapp-1-A123-B456-C789')).toBe(true); // with hyphens
      });

      it('should return false for invalid App-Level token formats', () => {
        expect(configManager.isValidSlackAppToken('xoxb-123456789')).toBe(false);
        expect(configManager.isValidSlackAppToken('xapp-2-A123456789')).toBe(false);
        expect(configManager.isValidSlackAppToken('xapp-1-')).toBe(false);
        expect(configManager.isValidSlackAppToken('invalid-token')).toBe(false);
        expect(configManager.isValidSlackAppToken('')).toBe(false);
        expect(configManager.isValidSlackAppToken(null)).toBe(false);
        expect(configManager.isValidSlackAppToken(undefined)).toBe(false);
      });
    });

    describe('isValidSlackBotToken', () => {
      it('should return true for valid Slack Bot tokens', () => {
        expect(configManager.isValidSlackBotToken('xoxb-123456789')).toBe(true);
        expect(configManager.isValidSlackBotToken('xoxb-ABC123XYZ789')).toBe(true);
        expect(configManager.isValidSlackBotToken('xoxb-123-456-789')).toBe(true); // with hyphens
      });

      it('should return false for invalid Bot token formats', () => {
        expect(configManager.isValidSlackBotToken('xapp-1-A123456789')).toBe(false);
        expect(configManager.isValidSlackBotToken('xoxb-')).toBe(false);
        expect(configManager.isValidSlackBotToken('invalid-token')).toBe(false);
        expect(configManager.isValidSlackBotToken('')).toBe(false);
        expect(configManager.isValidSlackBotToken(null)).toBe(false);
        expect(configManager.isValidSlackBotToken(undefined)).toBe(false);
      });
    });
  });

  describe('isValidChannelId', () => {
    it('should return true for valid channel IDs', () => {
      expect(configManager.isValidChannelId('C1234567890')).toBe(true);
      expect(configManager.isValidChannelId('CABCDEFGHIJ')).toBe(true);
    });

    it('should return false for invalid channel IDs', () => {
      expect(configManager.isValidChannelId('C123456789')).toBe(false); // too short
      expect(configManager.isValidChannelId('C12345678901')).toBe(false); // too long
      expect(configManager.isValidChannelId('D1234567890')).toBe(false); // wrong prefix
      expect(configManager.isValidChannelId('c1234567890')).toBe(false); // lowercase
      expect(configManager.isValidChannelId('1234567890')).toBe(false); // no prefix
      expect(configManager.isValidChannelId('')).toBe(false);
    });
  });

  describe('getTeamConfigs', () => {
    it('should throw error when configuration is not loaded', () => {
      expect(() => configManager.getTeamConfigs()).toThrow(
        'Configuration not loaded. Call loadConfig() first.'
      );
    });

    it('should return team configurations when loaded', () => {
      const teams = {
        mycompany: {
          token: 'xapp-1-A123456789',
          channels: ['C1234567890'],
        },
      };
      configManager.config = { teams };

      expect(configManager.getTeamConfigs()).toEqual(teams);
    });
  });

  describe('getChannelIds', () => {
    beforeEach(() => {
      configManager.config = {
        teams: {
          mycompany: {
            token: 'xapp-1-A123456789',
            channels: ['C1234567890', 'C0987654321'],
          },
        },
      };
    });

    it('should throw error when configuration is not loaded', () => {
      configManager.config = null;
      expect(() => configManager.getChannelIds('mycompany')).toThrow(
        'Configuration not loaded. Call loadConfig() first.'
      );
    });

    it('should throw error when team is not found', () => {
      expect(() => configManager.getChannelIds('nonexistent')).toThrow(
        'Team "nonexistent" not found in configuration'
      );
    });

    it('should return channel IDs for existing team', () => {
      expect(configManager.getChannelIds('mycompany')).toEqual(['C1234567890', 'C0987654321']);
    });
  });

  describe('getHandlerConfigs', () => {
    it('should throw error when configuration is not loaded', () => {
      expect(() => configManager.getHandlerConfigs()).toThrow(
        'Configuration not loaded. Call loadConfig() first.'
      );
    });

    it('should return handler configurations when present', () => {
      const handlers = { console: { enabled: true } };
      configManager.config = { teams: {}, handlers };

      expect(configManager.getHandlerConfigs()).toEqual(handlers);
    });

    it('should return empty object when handlers not configured', () => {
      configManager.config = { teams: {} };

      expect(configManager.getHandlerConfigs()).toEqual({});
    });
  });

  describe('getTeamTokens', () => {
    it('should throw error when configuration is not loaded', () => {
      configManager.config = null;
      expect(() => configManager.getTeamTokens('mycompany')).toThrow(
        'Configuration not loaded. Call loadConfig() first.'
      );
    });

    it('should throw error when team is not found', () => {
      configManager.config = { teams: {} };
      expect(() => configManager.getTeamTokens('nonexistent')).toThrow(
        'Team "nonexistent" not found in configuration'
      );
    });

    it('should return tokens for existing team', () => {
      configManager.config = {
        teams: {
          mycompany: {
            appToken: 'xapp-1-A123456789',
            botToken: 'xoxb-123456789-ABC',
            channels: ['C1234567890'],
          },
        },
      };

      const result = configManager.getTeamTokens('mycompany');
      expect(result).toEqual({
        appToken: 'xapp-1-A123456789',
        botToken: 'xoxb-123456789-ABC',
      });
    });
  });

  describe('getTeamToken', () => {
    beforeEach(() => {
      configManager.config = {
        teams: {
          mycompany: {
            appToken: 'xapp-1-A123456789',
            botToken: 'xoxb-123456789-ABC',
            channels: ['C1234567890'],
          },
        },
      };
    });

    it('should throw error when configuration is not loaded', () => {
      configManager.config = null;
      expect(() => configManager.getTeamToken('mycompany')).toThrow(
        'Configuration not loaded. Call loadConfig() first.'
      );
    });

    it('should throw error when team is not found', () => {
      expect(() => configManager.getTeamToken('nonexistent')).toThrow(
        'Team "nonexistent" not found in configuration'
      );
    });

    it('should return app token for existing team', () => {
      expect(configManager.getTeamToken('mycompany')).toBe('xapp-1-A123456789');
    });
  });

  describe('getValidTeamConfigs', () => {
    it('should throw error when configuration is not loaded', () => {
      expect(() => configManager.getValidTeamConfigs()).toThrow(
        'Configuration not loaded. Call loadConfig() first.'
      );
    });

    it('should return valid team configurations and skip invalid ones', () => {
      configManager.config = {
        teams: {
          validTeam: {
            appToken: 'xapp-1-A123456789',
            botToken: 'xoxb-123456789-ABC',
            channels: ['C1234567890'],
          },
          anotherValidTeam: {
            appToken: 'xapp-1-B987654321',
            botToken: 'xoxb-987654321-XYZ',
            channels: ['C0987654321'],
          },
          invalidTeam: {
            appToken: 'invalid-token',
            botToken: 'xoxb-123456789-ABC',
            channels: ['C1234567890'],
          },
          invalidTeamBot: {
            appToken: 'xapp-1-C111111111',
            botToken: 'invalid-bot-token',
            channels: ['C1111111111'],
          },
        },
      };

      const result = configManager.getValidTeamConfigs();

      expect(result).toEqual({
        validTeam: {
          appToken: 'xapp-1-A123456789',
          botToken: 'xoxb-123456789-ABC',
          channels: ['C1234567890'],
        },
        anotherValidTeam: {
          appToken: 'xapp-1-B987654321',
          botToken: 'xoxb-987654321-XYZ',
          channels: ['C0987654321'],
        },
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Team "invalidTeam" skipped due to configuration error: Team "invalidTeam" has invalid appToken format. Expected format: xapp-1-xxxxx'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Team "invalidTeamBot" skipped due to configuration error: Team "invalidTeamBot" has invalid botToken format. Expected format: xoxb-xxxxx'
      );
    });

    it('should throw error when no valid teams found', () => {
      configManager.config = {
        teams: {
          invalidTeam1: {
            token: 'invalid-token',
            channels: ['C1234567890'],
          },
          invalidTeam2: {
            token: 'another-invalid',
            channels: ['C0987654321'],
          },
        },
      };

      expect(() => configManager.getValidTeamConfigs()).toThrow(
        'No valid team configurations found'
      );
      expect(mockLogger.error).toHaveBeenCalledWith('No valid team configurations found');
    });
  });

  describe('configFileExists', () => {
    it('should return true when configuration file exists', () => {
      mockReadFileSync.mockReturnValue('{"teams": {}}');

      expect(configManager.configFileExists()).toBe(true);
    });

    it('should return false when configuration file does not exist', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      expect(configManager.configFileExists()).toBe(false);
    });

    it('should return true for other file system errors', () => {
      const error = new Error('Permission denied');
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      expect(configManager.configFileExists()).toBe(true);
    });
  });

  describe('loadConfigSafely', () => {
    it('should return configuration when loading succeeds', () => {
      const validConfig = {
        teams: {
          mycompany: {
            appToken: 'xapp-1-A123456789',
            botToken: 'xoxb-123456789-ABC',
            channels: ['C1234567890'],
          },
        },
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      const result = configManager.loadConfigSafely();

      expect(result).toEqual(validConfig);
    });

    it('should return null when loading fails', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      const result = configManager.loadConfigSafely();

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Configuration file .env.json not found');
    });
  });

  describe('Error Handling Scenarios', () => {
    describe('Invalid Token Detection', () => {
      it('should detect and log missing appToken', () => {
        expect(() =>
          configManager.validateTeamConfig('test', {
            botToken: 'xoxb-123456789',
            channels: ['C1234567890'],
          })
        ).toThrow('Team "test" must have a valid appToken string');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Configuration error: Team "test" must have a valid appToken string'
        );
      });

      it('should detect and log missing botToken', () => {
        expect(() =>
          configManager.validateTeamConfig('test', {
            appToken: 'xapp-1-A123456789',
            channels: ['C1234567890'],
          })
        ).toThrow('Team "test" must have a valid botToken string');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Configuration error: Team "test" must have a valid botToken string'
        );
      });

      it('should detect and log various invalid token formats', () => {
        const invalidConfigs = [
          {
            config: {
              appToken: 'invalid-app',
              botToken: 'xoxb-123456789',
              channels: ['C1234567890'],
            },
            expectedError: 'has invalid appToken format',
          },
          {
            config: {
              appToken: 'xapp-1-A123456789',
              botToken: 'invalid-bot',
              channels: ['C1234567890'],
            },
            expectedError: 'has invalid botToken format',
          },
          {
            config: {
              appToken: 'xapp-2-A123456789',
              botToken: 'xoxb-123456789',
              channels: ['C1234567890'],
            },
            expectedError: 'has invalid appToken format',
          },
          {
            config: {
              appToken: 'xapp-1-A123456789',
              botToken: 'xoxp-123456789',
              channels: ['C1234567890'],
            },
            expectedError: 'has invalid botToken format',
          },
        ];

        invalidConfigs.forEach(({ config, expectedError }, index) => {
          const teamName = `team${index}`;
          expect(() => configManager.validateTeamConfig(teamName, config)).toThrow(
            `Team "${teamName}" ${expectedError}`
          );

          if (expectedError === 'has invalid appToken format') {
            expect(mockLogger.error).toHaveBeenCalledWith(
              `Configuration error: Team "${teamName}" has invalid appToken format. Expected format: xapp-1-xxxxx`
            );
          } else if (expectedError === 'has invalid botToken format') {
            expect(mockLogger.error).toHaveBeenCalledWith(
              `Configuration error: Team "${teamName}" has invalid botToken format. Expected format: xoxb-xxxxx`
            );
          }
        });
      });
    });

    describe('Configuration File Error Scenarios', () => {
      it('should handle missing configuration file gracefully', () => {
        const error = new Error('File not found');
        error.code = 'ENOENT';
        mockReadFileSync.mockImplementation(() => {
          throw error;
        });

        expect(() => configManager.loadConfig()).toThrow('Configuration file .env.json not found');
        expect(mockLogger.error).toHaveBeenCalledWith('Configuration file .env.json not found');
      });

      it('should handle permission errors', () => {
        const error = new Error('Permission denied');
        error.code = 'EACCES';
        mockReadFileSync.mockImplementation(() => {
          throw error;
        });

        expect(() => configManager.loadConfig()).toThrow(
          'Failed to load configuration: Permission denied'
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to load configuration: Permission denied'
        );
      });

      it('should handle corrupted JSON files', () => {
        mockReadFileSync.mockReturnValue(
          '{ "teams": { "test": { "token": "xapp-1-A123456789", "channels": [}'
        );

        expect(() => configManager.loadConfig()).toThrow('Invalid JSON in configuration file');
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Invalid JSON in configuration file')
        );
      });
    });
  });
});
