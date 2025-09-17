import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ConfigurationManager } from '../../src/config/ConfigurationManager.js';

// Mock fs module
vi.mock('node:fs');

describe('ConfigurationManager', () => {
  let configManager;
  let mockReadFileSync;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    mockReadFileSync = vi.mocked(readFileSync);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should load valid configuration successfully', () => {
      const validConfig = {
        teams: {
          mycompany: {
            token: 'xapp-1-A123456789',
            channels: ['C1234567890', 'C0987654321']
          }
        },
        handlers: {
          console: { enabled: true }
        }
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      const result = configManager.loadConfig();

      expect(mockReadFileSync).toHaveBeenCalledWith('.env.json', 'utf8');
      expect(result).toEqual(validConfig);
      expect(configManager.config).toEqual(validConfig);
    });

    it('should throw error when configuration file does not exist', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => configManager.loadConfig()).toThrow('Configuration file .env.json not found');
    });

    it('should throw error when configuration file contains invalid JSON', () => {
      mockReadFileSync.mockReturnValue('{ invalid json }');

      expect(() => configManager.loadConfig()).toThrow('Invalid JSON in configuration file');
    });

    it('should throw error for other file system errors', () => {
      const error = new Error('Permission denied');
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      expect(() => configManager.loadConfig()).toThrow('Failed to load configuration: Permission denied');
    });
  });

  describe('validateConfig', () => {
    it('should throw error when config is not loaded', () => {
      expect(() => configManager.validateConfig()).toThrow('Configuration not loaded');
    });

    it('should throw error when teams section is missing', () => {
      configManager.config = { handlers: {} };

      expect(() => configManager.validateConfig()).toThrow('Configuration must contain a "teams" object');
    });

    it('should throw error when teams section is not an object', () => {
      configManager.config = { teams: 'invalid' };

      expect(() => configManager.validateConfig()).toThrow('Configuration must contain a "teams" object');
    });

    it('should throw error when no teams are configured', () => {
      configManager.config = { teams: {} };

      expect(() => configManager.validateConfig()).toThrow('At least one team must be configured');
    });

    it('should throw error when handlers section is not an object', () => {
      configManager.config = {
        teams: {
          mycompany: {
            token: 'xapp-1-A123456789',
            channels: ['C1234567890']
          }
        },
        handlers: 'invalid'
      };

      expect(() => configManager.validateConfig()).toThrow('Configuration "handlers" must be an object');
    });

    it('should validate successfully with valid configuration', () => {
      configManager.config = {
        teams: {
          mycompany: {
            token: 'xapp-1-A123456789',
            channels: ['C1234567890', 'C0987654321']
          }
        },
        handlers: {
          console: { enabled: true }
        }
      };

      expect(() => configManager.validateConfig()).not.toThrow();
    });

    it('should validate successfully without handlers section', () => {
      configManager.config = {
        teams: {
          mycompany: {
            token: 'xapp-1-A123456789',
            channels: ['C1234567890']
          }
        }
      };

      expect(() => configManager.validateConfig()).not.toThrow();
    });
  });

  describe('validateTeamConfig', () => {
    it('should throw error when team config is not an object', () => {
      expect(() => configManager.validateTeamConfig('test', 'invalid')).toThrow('Team "test" configuration must be an object');
    });

    it('should throw error when token is missing', () => {
      expect(() => configManager.validateTeamConfig('test', { channels: [] })).toThrow('Team "test" must have a valid token string');
    });

    it('should throw error when token is not a string', () => {
      expect(() => configManager.validateTeamConfig('test', { token: 123, channels: [] })).toThrow('Team "test" must have a valid token string');
    });

    it('should throw error when token format is invalid', () => {
      expect(() => configManager.validateTeamConfig('test', { token: 'invalid-token', channels: [] })).toThrow('Team "test" has invalid token format');
    });

    it('should throw error when channels is missing', () => {
      expect(() => configManager.validateTeamConfig('test', { token: 'xapp-1-A123456789' })).toThrow('Team "test" must have a "channels" array');
    });

    it('should throw error when channels is not an array', () => {
      expect(() => configManager.validateTeamConfig('test', { token: 'xapp-1-A123456789', channels: 'invalid' })).toThrow('Team "test" must have a "channels" array');
    });

    it('should throw error when channels array is empty', () => {
      expect(() => configManager.validateTeamConfig('test', { token: 'xapp-1-A123456789', channels: [] })).toThrow('Team "test" must have at least one channel configured');
    });

    it('should throw error when channel ID format is invalid', () => {
      expect(() => configManager.validateTeamConfig('test', { 
        token: 'xapp-1-A123456789', 
        channels: ['invalid-channel'] 
      })).toThrow('Team "test" has invalid channel ID: invalid-channel');
    });

    it('should validate successfully with valid team config', () => {
      expect(() => configManager.validateTeamConfig('test', {
        token: 'xapp-1-A123456789',
        channels: ['C1234567890', 'C0987654321']
      })).not.toThrow();
    });
  });

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
      expect(() => configManager.getTeamConfigs()).toThrow('Configuration not loaded. Call loadConfig() first.');
    });

    it('should return team configurations when loaded', () => {
      const teams = {
        mycompany: {
          token: 'xapp-1-A123456789',
          channels: ['C1234567890']
        }
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
            channels: ['C1234567890', 'C0987654321']
          }
        }
      };
    });

    it('should throw error when configuration is not loaded', () => {
      configManager.config = null;
      expect(() => configManager.getChannelIds('mycompany')).toThrow('Configuration not loaded. Call loadConfig() first.');
    });

    it('should throw error when team is not found', () => {
      expect(() => configManager.getChannelIds('nonexistent')).toThrow('Team "nonexistent" not found in configuration');
    });

    it('should return channel IDs for existing team', () => {
      expect(configManager.getChannelIds('mycompany')).toEqual(['C1234567890', 'C0987654321']);
    });
  });

  describe('getHandlerConfigs', () => {
    it('should throw error when configuration is not loaded', () => {
      expect(() => configManager.getHandlerConfigs()).toThrow('Configuration not loaded. Call loadConfig() first.');
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

  describe('getTeamToken', () => {
    beforeEach(() => {
      configManager.config = {
        teams: {
          mycompany: {
            token: 'xapp-1-A123456789',
            channels: ['C1234567890']
          }
        }
      };
    });

    it('should throw error when configuration is not loaded', () => {
      configManager.config = null;
      expect(() => configManager.getTeamToken('mycompany')).toThrow('Configuration not loaded. Call loadConfig() first.');
    });

    it('should throw error when team is not found', () => {
      expect(() => configManager.getTeamToken('nonexistent')).toThrow('Team "nonexistent" not found in configuration');
    });

    it('should return token for existing team', () => {
      expect(configManager.getTeamToken('mycompany')).toBe('xapp-1-A123456789');
    });
  });
});
