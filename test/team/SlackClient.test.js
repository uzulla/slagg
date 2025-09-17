import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackClient } from '../../src/team/SlackClient.js';
import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';

// Mock the Slack SDK modules
vi.mock('@slack/socket-mode', () => ({
  SocketModeClient: vi.fn()
}));

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn()
}));

// Mock the logger
vi.mock('../../src/utils/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('SlackClient', () => {
  let mockSocketModeClient;
  let mockWebClient;
  let slackClient;
  const testToken = 'xapp-1-test-token';
  const testTeamName = 'test-team';
  const testChannelIds = ['C1234567890', 'C0987654321'];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockSocketModeClient = {
      start: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn()
    };

    mockWebClient = {
      conversations: {
        info: vi.fn()
      },
      users: {
        info: vi.fn()
      }
    };

    // Mock the constructors
    SocketModeClient.mockImplementation(() => mockSocketModeClient);
    WebClient.mockImplementation(() => mockWebClient);

    slackClient = new SlackClient(testToken, testTeamName, testChannelIds);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create SlackClient with valid parameters', () => {
      expect(slackClient.token).toBe(testToken);
      expect(slackClient.teamName).toBe(testTeamName);
      expect(slackClient.channelIds).toEqual(testChannelIds);
      expect(slackClient.isConnected).toBe(false);
      expect(slackClient.isConnecting).toBe(false);
    });

    it('should throw error for missing token', () => {
      expect(() => new SlackClient('', testTeamName, testChannelIds))
        .toThrow('Token is required and must be a string');
    });

    it('should throw error for invalid token type', () => {
      expect(() => new SlackClient(123, testTeamName, testChannelIds))
        .toThrow('Token is required and must be a string');
    });

    it('should throw error for missing team name', () => {
      expect(() => new SlackClient(testToken, '', testChannelIds))
        .toThrow('Team name is required and must be a string');
    });

    it('should throw error for invalid team name type', () => {
      expect(() => new SlackClient(testToken, 123, testChannelIds))
        .toThrow('Team name is required and must be a string');
    });

    it('should throw error for empty channel IDs', () => {
      expect(() => new SlackClient(testToken, testTeamName, []))
        .toThrow('Channel IDs must be a non-empty array');
    });

    it('should throw error for invalid channel IDs type', () => {
      expect(() => new SlackClient(testToken, testTeamName, 'not-array'))
        .toThrow('Channel IDs must be a non-empty array');
    });
  });

  describe('setMessageCallback', () => {
    it('should set message callback function', () => {
      const callback = vi.fn();
      slackClient.setMessageCallback(callback);
      expect(slackClient.messageCallback).toBe(callback);
    });

    it('should throw error for non-function callback', () => {
      expect(() => slackClient.setMessageCallback('not-function'))
        .toThrow('Message callback must be a function');
    });
  });

  describe('connect', () => {
    beforeEach(() => {
      // Mock successful channel info responses
      mockWebClient.conversations.info.mockResolvedValue({
        ok: true,
        channel: { name: 'general' }
      });
    });

    it('should connect successfully', async () => {
      await slackClient.connect();

      expect(mockSocketModeClient.start).toHaveBeenCalledOnce();
      expect(mockSocketModeClient.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSocketModeClient.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockSocketModeClient.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockSocketModeClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(slackClient.isConnected).toBe(true);
      expect(slackClient.isConnecting).toBe(false);
    });

    it('should not connect if already connecting', async () => {
      slackClient.isConnecting = true;
      await slackClient.connect();
      expect(mockSocketModeClient.start).not.toHaveBeenCalled();
    });

    it('should not connect if already connected', async () => {
      slackClient.isConnected = true;
      await slackClient.connect();
      expect(mockSocketModeClient.start).not.toHaveBeenCalled();
    });

    it('should handle connection error and schedule reconnect', async () => {
      const error = new Error('Connection failed');
      mockSocketModeClient.start.mockRejectedValue(error);

      // Mock setTimeout to avoid actual delays in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn();

      try {
        await slackClient.connect();
      } catch (e) {
        expect(e).toBe(error);
      }

      expect(slackClient.isConnected).toBe(false);
      expect(slackClient.isConnecting).toBe(false);

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('subscribeToChannels', () => {
    it('should subscribe to valid channels', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      testClient.webClient = mockWebClient;
      
      mockWebClient.conversations.info
        .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } })
        .mockResolvedValueOnce({ ok: true, channel: { name: 'random' } });

      await testClient.subscribeToChannels();

      expect(mockWebClient.conversations.info).toHaveBeenCalledTimes(2);
      expect(testClient.channelNames.get('C1234567890')).toBe('general');
      expect(testClient.channelNames.get('C0987654321')).toBe('random');
    });

    it('should skip invalid channels', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      testClient.webClient = mockWebClient;
      
      mockWebClient.conversations.info
        .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } })
        .mockResolvedValueOnce({ ok: false });

      await testClient.subscribeToChannels();

      expect(testClient.channelIds).toEqual(['C1234567890']);
      expect(testClient.channelNames.get('C1234567890')).toBe('general');
    });

    it('should handle channel access errors', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      testClient.webClient = mockWebClient;
      
      mockWebClient.conversations.info
        .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } })
        .mockRejectedValueOnce(new Error('Access denied'));

      await testClient.subscribeToChannels();

      expect(testClient.channelIds).toEqual(['C1234567890']);
    });

    it('should throw error if no valid channels', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      testClient.webClient = mockWebClient;
      
      mockWebClient.conversations.info.mockResolvedValue({ ok: false });

      await expect(testClient.subscribeToChannels())
        .rejects.toThrow('No valid channels available for subscription');
    });

    it('should throw error if web client not initialized', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      testClient.webClient = null;

      await expect(testClient.subscribeToChannels())
        .rejects.toThrow('Web client not initialized');
    });
  });

  describe('handleMessage', () => {
    let testClient;
    
    beforeEach(() => {
      testClient = new SlackClient(testToken, testTeamName, ['C1234567890']);
      testClient.webClient = mockWebClient;
      testClient.channelNames.set('C1234567890', 'general');
    });

    it('should process valid message', async () => {
      const mockCallback = vi.fn();
      testClient.setMessageCallback(mockCallback);

      mockWebClient.users.info.mockResolvedValue({
        ok: true,
        user: { display_name: 'Test User' }
      });

      const event = {
        channel: 'C1234567890',
        user: 'U1234567890',
        text: 'Hello world',
        ts: '1234567890.123456'
      };

      await testClient.handleMessage(event);

      expect(mockCallback).toHaveBeenCalledWith({
        team: testTeamName,
        channel: 'general',
        channelId: 'C1234567890',
        user: 'Test User',
        text: 'Hello world',
        timestamp: '1234567890.123456',
        formattedTime: expect.any(Date)
      });
    });

    it('should skip messages from non-subscribed channels', async () => {
      const mockCallback = vi.fn();
      testClient.setMessageCallback(mockCallback);

      const event = {
        channel: 'C9999999999',
        user: 'U1234567890',
        text: 'Hello world',
        ts: '1234567890.123456'
      };

      await testClient.handleMessage(event);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should skip bot messages', async () => {
      const mockCallback = vi.fn();
      testClient.setMessageCallback(mockCallback);

      const event = {
        channel: 'C1234567890',
        bot_id: 'B1234567890',
        text: 'Bot message',
        ts: '1234567890.123456'
      };

      await testClient.handleMessage(event);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should skip messages with subtypes', async () => {
      const mockCallback = vi.fn();
      testClient.setMessageCallback(mockCallback);

      const event = {
        channel: 'C1234567890',
        user: 'U1234567890',
        text: 'Message edited',
        subtype: 'message_changed',
        ts: '1234567890.123456'
      };

      await testClient.handleMessage(event);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle user info fetch error', async () => {
      const mockCallback = vi.fn();
      testClient.setMessageCallback(mockCallback);

      mockWebClient.users.info.mockRejectedValue(new Error('User not found'));

      const event = {
        channel: 'C1234567890',
        user: 'U1234567890',
        text: 'Hello world',
        ts: '1234567890.123456'
      };

      await testClient.handleMessage(event);

      expect(mockCallback).toHaveBeenCalledWith({
        team: testTeamName,
        channel: 'general',
        channelId: 'C1234567890',
        user: 'U1234567890',
        text: 'Hello world',
        timestamp: '1234567890.123456',
        formattedTime: expect.any(Date)
      });
    });
  });

  describe('reconnect', () => {
    it('should not reconnect if already connecting', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      testClient.isConnecting = true;
      const connectSpy = vi.spyOn(testClient, 'connect');

      await testClient.reconnect();

      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should not reconnect if already connected', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      testClient.isConnected = true;
      const connectSpy = vi.spyOn(testClient, 'connect');

      await testClient.reconnect();

      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should not reconnect if max attempts reached', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      testClient.reconnectAttempts = testClient.maxReconnectAttempts;
      const connectSpy = vi.spyOn(testClient, 'connect');

      await testClient.reconnect();

      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should increment reconnect attempts', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      const connectSpy = vi.spyOn(testClient, 'connect').mockResolvedValue();

      await testClient.reconnect();

      expect(testClient.reconnectAttempts).toBe(1);
      expect(connectSpy).toHaveBeenCalledOnce();
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      testClient.socketModeClient = mockSocketModeClient;
      testClient.webClient = mockWebClient;
      testClient.isConnected = true;

      await testClient.disconnect();

      expect(mockSocketModeClient.disconnect).toHaveBeenCalledOnce();
      expect(testClient.isConnected).toBe(false);
      expect(testClient.isConnecting).toBe(false);
      expect(testClient.socketModeClient).toBeNull();
      expect(testClient.webClient).toBeNull();
    });

    it('should handle disconnect error gracefully', async () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      testClient.socketModeClient = mockSocketModeClient;
      testClient.webClient = mockWebClient;
      testClient.isConnected = true;
      
      mockSocketModeClient.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      await testClient.disconnect();

      expect(testClient.isConnected).toBe(false);
      expect(testClient.socketModeClient).toBeNull();
    });
  });

  describe('getter methods', () => {
    it('should return connection status', () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      expect(testClient.isClientConnected()).toBe(false);
      
      testClient.isConnected = true;
      expect(testClient.isClientConnected()).toBe(true);
    });

    it('should return team name', () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      expect(testClient.getTeamName()).toBe(testTeamName);
    });

    it('should return channel IDs copy', () => {
      const testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      const channelIds = testClient.getChannelIds();
      expect(channelIds).toEqual(testChannelIds);
      expect(channelIds).not.toBe(testClient.channelIds); // Should be a copy
    });
  });

  describe('event handling', () => {
    let testClient;
    
    beforeEach(async () => {
      testClient = new SlackClient(testToken, testTeamName, [...testChannelIds]);
      mockWebClient.conversations.info.mockResolvedValue({
        ok: true,
        channel: { name: 'general' }
      });
      
      await testClient.connect();
    });

    it('should set up event listeners on connect', () => {
      expect(mockSocketModeClient.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSocketModeClient.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockSocketModeClient.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockSocketModeClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle connected event', () => {
      // Get the connected event handler
      const connectedHandler = mockSocketModeClient.on.mock.calls
        .find(call => call[0] === 'connected')[1];

      testClient.isConnected = false;
      testClient.reconnectAttempts = 3;

      connectedHandler();

      expect(testClient.isConnected).toBe(true);
      expect(testClient.reconnectAttempts).toBe(0);
    });

    it('should handle disconnected event', () => {
      // Mock setTimeout to avoid actual delays in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn();

      // Get the disconnected event handler
      const disconnectedHandler = mockSocketModeClient.on.mock.calls
        .find(call => call[0] === 'disconnected')[1];

      testClient.isConnected = true;
      testClient.isConnecting = false;

      disconnectedHandler();

      expect(testClient.isConnected).toBe(false);
      expect(global.setTimeout).toHaveBeenCalled();

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('should handle error event', () => {
      // Mock setTimeout to avoid actual delays in tests
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn();

      // Get the error event handler
      const errorHandler = mockSocketModeClient.on.mock.calls
        .find(call => call[0] === 'error')[1];

      testClient.isConnected = true;
      testClient.isConnecting = false;

      const error = new Error('Socket error');
      errorHandler(error);

      expect(testClient.isConnected).toBe(false);
      expect(global.setTimeout).toHaveBeenCalled();

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });
});
