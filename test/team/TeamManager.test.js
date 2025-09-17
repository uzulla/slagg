import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamManager } from '../../src/team/TeamManager.js';

// Mock SlackClient
vi.mock('../../src/team/SlackClient.js', () => ({
  SlackClient: vi.fn(),
}));

// Mock the logger
vi.mock('../../src/utils/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TeamManager', () => {
  let teamManager;
  let mockSlackClient;
  let mockMessageProcessor;
  const testTeamsConfig = {
    team1: {
      appToken: 'xapp-1-app-token1',
      botToken: 'xoxb-bot-token1',
      channels: ['C1111111111', 'C2222222222'],
    },
    team2: {
      appToken: 'xapp-1-app-token2',
      botToken: 'xoxb-bot-token2',
      channels: ['C3333333333'],
    },
  };

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock SlackClient
    mockSlackClient = {
      setMessageCallback: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isClientConnected: vi.fn().mockReturnValue(true),
    };

    // Mock message processor
    mockMessageProcessor = {
      processMessage: vi.fn().mockResolvedValue(undefined),
    };

    // Mock SlackClient constructor
    const { SlackClient } = await import('../../src/team/SlackClient.js');
    SlackClient.mockImplementation(() => mockSlackClient);

    teamManager = new TeamManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create TeamManager with initial state', () => {
      expect(teamManager.teams.size).toBe(0);
      expect(teamManager.clients.size).toBe(0);
      expect(teamManager.messageProcessor).toBeNull();
      expect(teamManager.isInitialized).toBe(false);
      expect(teamManager.isShuttingDown).toBe(false);
    });
  });

  describe('setMessageProcessor', () => {
    it('should set message processor', () => {
      teamManager.setMessageProcessor(mockMessageProcessor);
      expect(teamManager.messageProcessor).toBe(mockMessageProcessor);
    });

    it('should throw error for invalid message processor', () => {
      expect(() => teamManager.setMessageProcessor({})).toThrow(
        'Message processor must implement processMessage method'
      );
    });

    it('should throw error for null message processor', () => {
      expect(() => teamManager.setMessageProcessor(null)).toThrow(
        'Message processor must implement processMessage method'
      );
    });
  });

  describe('initialize', () => {
    it('should initialize with valid teams configuration', async () => {
      await teamManager.initialize(testTeamsConfig);

      expect(teamManager.isInitialized).toBe(true);
      expect(teamManager.teams.size).toBe(2);
      expect(teamManager.teams.has('team1')).toBe(true);
      expect(teamManager.teams.has('team2')).toBe(true);

      const team1Config = teamManager.teams.get('team1');
      expect(team1Config.name).toBe('team1');
      expect(team1Config.appToken).toBe('xapp-1-app-token1');
      expect(team1Config.botToken).toBe('xoxb-bot-token1');
      expect(team1Config.channelIds).toEqual(['C1111111111', 'C2222222222']);
    });

    it('should throw error for team with missing appToken', async () => {
      const invalidConfig = {
        team1: {
          botToken: 'xoxb-bot-token1',
          channels: ['C1111111111'],
        },
      };

      await expect(teamManager.initialize(invalidConfig)).rejects.toThrow(
        'Team team1: appToken is required and must be a string'
      );
    });

    it('should throw error for team with missing botToken', async () => {
      const invalidConfig = {
        team1: {
          appToken: 'xapp-1-app-token1',
          channels: ['C1111111111'],
        },
      };

      await expect(teamManager.initialize(invalidConfig)).rejects.toThrow(
        'Team team1: botToken is required and must be a string'
      );
    });

    it('should throw error for team with invalid appToken type', async () => {
      const invalidConfig = {
        team1: {
          appToken: 123,
          botToken: 'xoxb-bot-token1',
          channels: ['C1111111111'],
        },
      };

      await expect(teamManager.initialize(invalidConfig)).rejects.toThrow(
        'Team team1: appToken is required and must be a string'
      );
    });

    it('should throw error for team with invalid botToken type', async () => {
      const invalidConfig = {
        team1: {
          appToken: 'xapp-1-app-token1',
          botToken: 123,
          channels: ['C1111111111'],
        },
      };

      await expect(teamManager.initialize(invalidConfig)).rejects.toThrow(
        'Team team1: botToken is required and must be a string'
      );
    });

    it('should throw error if already initialized', async () => {
      await teamManager.initialize(testTeamsConfig);

      await expect(teamManager.initialize(testTeamsConfig)).rejects.toThrow(
        'TeamManager is already initialized'
      );
    });

    it('should throw error for missing teams configuration', async () => {
      await expect(teamManager.initialize(null)).rejects.toThrow('Teams configuration is required');
    });

    it('should throw error for empty teams configuration', async () => {
      await expect(teamManager.initialize({})).rejects.toThrow(
        'At least one team configuration is required'
      );
    });

    it('should throw error for team with missing channels', async () => {
      const invalidConfig = {
        team1: {
          appToken: 'xapp-1-app-token1',
          botToken: 'xoxb-bot-token1',
        },
      };

      await expect(teamManager.initialize(invalidConfig)).rejects.toThrow(
        'Team team1: Channels must be a non-empty array'
      );
    });

    it('should throw error for team with empty channels array', async () => {
      const invalidConfig = {
        team1: {
          appToken: 'xapp-1-app-token1',
          botToken: 'xoxb-bot-token1',
          channels: [],
        },
      };

      await expect(teamManager.initialize(invalidConfig)).rejects.toThrow(
        'Team team1: Channels must be a non-empty array'
      );
    });
  });

  describe('connectAllTeams', () => {
    beforeEach(async () => {
      await teamManager.initialize(testTeamsConfig);
    });

    it('should connect to all teams successfully', async () => {
      await teamManager.connectAllTeams();

      expect(teamManager.clients.size).toBe(2);
      expect(mockSlackClient.connect).toHaveBeenCalledTimes(2);
    });

    it('should set up message callback when message processor is available', async () => {
      teamManager.setMessageProcessor(mockMessageProcessor);

      await teamManager.connectAllTeams();

      expect(mockSlackClient.setMessageCallback).toHaveBeenCalledTimes(2);
      expect(mockSlackClient.setMessageCallback).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new TeamManager();

      await expect(uninitializedManager.connectAllTeams()).rejects.toThrow(
        'TeamManager must be initialized before connecting'
      );
    });

    it('should throw error if shutting down', async () => {
      teamManager.isShuttingDown = true;

      await expect(teamManager.connectAllTeams()).rejects.toThrow(
        'Cannot connect teams during shutdown'
      );
    });

    it('should handle partial connection failures', async () => {
      // Make one connection fail
      let callCount = 0;
      mockSlackClient.connect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Connection failed'));
        }
        return Promise.resolve();
      });

      await teamManager.connectAllTeams();

      expect(teamManager.clients.size).toBe(1); // Only one successful connection
    });

    it('should throw error if all connections fail', async () => {
      mockSlackClient.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(teamManager.connectAllTeams()).rejects.toThrow('Failed to connect to any teams');
    });
  });

  describe('handleTeamError', () => {
    beforeEach(async () => {
      await teamManager.initialize(testTeamsConfig);
      await teamManager.connectAllTeams();
    });

    it('should log team error', async () => {
      const error = new Error('Test error');
      teamManager.handleTeamError('team1', error);

      const { logger } = await import('../../src/utils/Logger.js');
      expect(logger.error).toHaveBeenCalledWith('Team: team1, Error: Test error');
    });

    it('should remove disconnected team', () => {
      mockSlackClient.isClientConnected.mockReturnValue(false);
      const error = new Error('Connection lost');

      teamManager.handleTeamError('team1', error);

      expect(teamManager.clients.has('team1')).toBe(false);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await teamManager.initialize(testTeamsConfig);
      await teamManager.connectAllTeams();
    });

    it('should shutdown all teams gracefully', async () => {
      await teamManager.shutdown();

      expect(mockSlackClient.disconnect).toHaveBeenCalledTimes(2);
      expect(teamManager.clients.size).toBe(0);
      expect(teamManager.teams.size).toBe(0);
      expect(teamManager.messageProcessor).toBeNull();
      expect(teamManager.isInitialized).toBe(false);
      expect(teamManager.isShuttingDown).toBe(false);
    });

    it('should handle disconnect errors gracefully', async () => {
      mockSlackClient.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      await teamManager.shutdown();

      expect(teamManager.clients.size).toBe(0);
      expect(teamManager.teams.size).toBe(0);
    });

    it('should not shutdown twice', async () => {
      await teamManager.shutdown();

      // Reset mock call counts
      mockSlackClient.disconnect.mockClear();

      await teamManager.shutdown();

      expect(mockSlackClient.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('getter methods', () => {
    beforeEach(async () => {
      await teamManager.initialize(testTeamsConfig);
      await teamManager.connectAllTeams();
    });

    it('should return connected team count', () => {
      expect(teamManager.getConnectedTeamCount()).toBe(2);

      // Mock one team as disconnected
      let callCount = 0;
      mockSlackClient.isClientConnected.mockImplementation(() => {
        callCount++;
        return callCount === 1; // First call returns true, second returns false
      });

      expect(teamManager.getConnectedTeamCount()).toBe(1);
    });

    it('should return total team count', () => {
      expect(teamManager.getTotalTeamCount()).toBe(2);
    });

    it('should return connected team names', () => {
      const connectedTeams = teamManager.getConnectedTeamNames();
      expect(connectedTeams).toEqual(['team1', 'team2']);

      // Mock one team as disconnected
      let callCount = 0;
      mockSlackClient.isClientConnected.mockImplementation(() => {
        callCount++;
        return callCount === 1; // First call returns true, second returns false
      });

      const partiallyConnectedTeams = teamManager.getConnectedTeamNames();
      expect(partiallyConnectedTeams).toEqual(['team1']);
    });

    it('should return all team names', () => {
      const allTeams = teamManager.getAllTeamNames();
      expect(allTeams).toEqual(['team1', 'team2']);
    });

    it('should return initialization status', () => {
      expect(teamManager.isManagerInitialized()).toBe(true);
    });

    it('should return shutdown status', () => {
      expect(teamManager.isManagerShuttingDown()).toBe(false);

      teamManager.isShuttingDown = true;
      expect(teamManager.isManagerShuttingDown()).toBe(true);
    });
  });

  describe('message processing integration', () => {
    beforeEach(async () => {
      teamManager.setMessageProcessor(mockMessageProcessor);
      await teamManager.initialize(testTeamsConfig);
      await teamManager.connectAllTeams();
    });

    it('should process messages through message processor', async () => {
      // Get the message callback that was set on the SlackClient
      const messageCallback = mockSlackClient.setMessageCallback.mock.calls[0][0];

      const testMessage = {
        team: 'team1',
        channel: 'general',
        user: 'testuser',
        text: 'Hello world',
        timestamp: '1234567890.123456',
      };

      await messageCallback(testMessage);

      expect(mockMessageProcessor.processMessage).toHaveBeenCalledWith(testMessage);
    });

    it('should handle message processing errors', async () => {
      mockMessageProcessor.processMessage.mockRejectedValue(new Error('Processing failed'));

      // Get the message callback that was set on the SlackClient
      const messageCallback = mockSlackClient.setMessageCallback.mock.calls[0][0];

      const testMessage = {
        team: 'team1',
        channel: 'general',
        user: 'testuser',
        text: 'Hello world',
        timestamp: '1234567890.123456',
      };

      // Should not throw error, but should log it
      await messageCallback(testMessage);

      const { logger } = await import('../../src/utils/Logger.js');
      expect(logger.error).toHaveBeenCalledWith(
        'Team: team1, Error processing message: Processing failed'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty teams after initialization', async () => {
      await teamManager.initialize(testTeamsConfig);

      // Manually clear teams to simulate edge case
      teamManager.teams.clear();

      // Should throw error when no teams to connect to
      await expect(teamManager.connectAllTeams()).rejects.toThrow('Failed to connect to any teams');

      expect(teamManager.clients.size).toBe(0);
    });

    it('should handle team removal during operation', async () => {
      await teamManager.initialize(testTeamsConfig);
      await teamManager.connectAllTeams();

      // Simulate team removal
      teamManager._removeTeam('team1');

      expect(teamManager.clients.has('team1')).toBe(false);
      expect(teamManager.teams.get('team1').client).toBeNull();
    });
  });
});
