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
  const testAppToken = 'xapp-1-test-app-token';
  const testBotToken = 'xoxb-test-bot-token';
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
    SocketModeClient.mockImplementation((options) => {
      expect(options).toHaveProperty('appToken');
      return mockSocketModeClient;
    });
    WebClient.mockImplementation((token) => {
      expect(typeof token).toBe('string');
      return mockWebClient;
    });

    slackClient = new SlackClient(testAppToken, testBotToken, testTeamName, testChannelIds);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create SlackClient with valid parameters', () => {
      expect(slackClient.appToken).toBe(testAppToken);
      expect(slackClient.botToken).toBe(testBotToken);
      expect(slackClient.teamName).toBe(testTeamName);
      expect(slackClient.channelIds).toEqual(testChannelIds);
      expect(slackClient.isConnected).toBe(false);
      expect(slackClient.isConnecting).toBe(false);
      expect(slackClient.isInvalidated).toBe(false);
    });

    it('should throw error for missing app token', () => {
      expect(() => new SlackClient('', testBotToken, testTeamName, testChannelIds))
        .toThrow('App token is required and must be a string');
    });

    it('should throw error for invalid app token type', () => {
      expect(() => new SlackClient(123, testBotToken, testTeamName, testChannelIds))
        .toThrow('App token is required and must be a string');
    });

    it('should throw error for missing bot token', () => {
      expect(() => new SlackClient(testAppToken, '', testTeamName, testChannelIds))
        .toThrow('Bot token is required and must be a string');
    });

    it('should throw error for invalid bot token type', () => {
      expect(() => new SlackClient(testAppToken, 123, testTeamName, testChannelIds))
        .toThrow('Bot token is required and must be a string');
    });

    it('should throw error for missing team name', () => {
      expect(() => new SlackClient(testAppToken, testBotToken, '', testChannelIds))
        .toThrow('Team name is required and must be a string');
    });

    it('should throw error for invalid team name type', () => {
      expect(() => new SlackClient(testAppToken, testBotToken, 123, testChannelIds))
        .toThrow('Team name is required and must be a string');
    });

    it('should throw error for empty channel IDs', () => {
      expect(() => new SlackClient(testAppToken, testBotToken, testTeamName, []))
        .toThrow('Channel IDs must be a non-empty array');
    });

    it('should throw error for invalid channel IDs type', () => {
      expect(() => new SlackClient(testAppToken, testBotToken, testTeamName, 'not-array'))
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
      expect(slackClient.isInvalidated).toBe(false);

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('should invalidate team on authentication error', async () => {
      const authError = new Error('invalid_auth');
      authError.code = 'invalid_auth';
      mockSocketModeClient.start.mockRejectedValue(authError);

      try {
        await slackClient.connect();
      } catch (e) {
        expect(e).toBe(authError);
      }

      expect(slackClient.isConnected).toBe(false);
      expect(slackClient.isConnecting).toBe(false);
      expect(slackClient.isInvalidated).toBe(true);
    });

    it('should not connect if team is invalidated', async () => {
      slackClient.isInvalidated = true;
      await slackClient.connect();
      expect(mockSocketModeClient.start).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToChannels', () => {
    it('should subscribe to valid channels', async () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
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
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      testClient.webClient = mockWebClient;
      
      mockWebClient.conversations.info
        .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } })
        .mockResolvedValueOnce({ ok: false });

      await testClient.subscribeToChannels();

      expect(testClient.channelIds).toEqual(['C1234567890']);
      expect(testClient.channelNames.get('C1234567890')).toBe('general');
    });

    it('should handle channel access errors', async () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      testClient.webClient = mockWebClient;
      
      mockWebClient.conversations.info
        .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } })
        .mockRejectedValueOnce(new Error('Access denied'));

      await testClient.subscribeToChannels();

      expect(testClient.channelIds).toEqual(['C1234567890']);
    });

    it('should throw error if no valid channels', async () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      testClient.webClient = mockWebClient;
      
      mockWebClient.conversations.info.mockResolvedValue({ ok: false });

      await expect(testClient.subscribeToChannels())
        .rejects.toThrow('No valid channels available for subscription');
    });

    it('should throw error if web client not initialized', async () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      testClient.webClient = null;

      await expect(testClient.subscribeToChannels())
        .rejects.toThrow('Web client not initialized');
    });
  });

  describe('handleMessage', () => {
    let testClient;
    
    beforeEach(() => {
      testClient = new SlackClient(testAppToken, testBotToken, testTeamName, ['C1234567890']);
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
        type: 'message',
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
        type: 'message',
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
        type: 'message',
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
        type: 'message',
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
        type: 'message',
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
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      testClient.isConnecting = true;
      const connectSpy = vi.spyOn(testClient, 'connect');

      await testClient.reconnect();

      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should not reconnect if already connected', async () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      testClient.isConnected = true;
      const connectSpy = vi.spyOn(testClient, 'connect');

      await testClient.reconnect();

      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should not reconnect if max attempts reached', async () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      testClient.reconnectAttempts = testClient.maxReconnectAttempts;
      const connectSpy = vi.spyOn(testClient, 'connect');

      await testClient.reconnect();

      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should not reconnect if team is invalidated', async () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      testClient.isInvalidated = true;
      const connectSpy = vi.spyOn(testClient, 'connect');

      await testClient.reconnect();

      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should increment reconnect attempts', async () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      const connectSpy = vi.spyOn(testClient, 'connect').mockResolvedValue();

      await testClient.reconnect();

      expect(testClient.reconnectAttempts).toBe(1);
      expect(connectSpy).toHaveBeenCalledOnce();
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
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
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
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
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      expect(testClient.isClientConnected()).toBe(false);
      
      testClient.isConnected = true;
      expect(testClient.isClientConnected()).toBe(true);
    });

    it('should return team name', () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      expect(testClient.getTeamName()).toBe(testTeamName);
    });

    it('should return channel IDs copy', () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      const channelIds = testClient.getChannelIds();
      expect(channelIds).toEqual(testChannelIds);
      expect(channelIds).not.toBe(testClient.channelIds); // Should be a copy
    });

    it('should return invalidation status', () => {
      const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      expect(testClient.isTeamInvalidated()).toBe(false);
      
      testClient.isInvalidated = true;
      expect(testClient.isTeamInvalidated()).toBe(true);
    });
  });

  describe('event handling', () => {
    let testClient;
    
    beforeEach(async () => {
      testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
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

  describe('Connection Error Handling', () => {
    describe('Authentication Error Detection', () => {
      let testClient;

      beforeEach(() => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
      });

      it('should detect authentication errors by message content', () => {
        const authErrors = [
          new Error('invalid_auth'),
          new Error('token_revoked'),
          new Error('account_inactive'),
          new Error('invalid_token'),
          new Error('not_authed'),
          new Error('token_expired'),
          new Error('unauthorized'),
          new Error('authentication failed'),
          new Error('invalid credentials')
        ];

        authErrors.forEach(error => {
          expect(testClient._isAuthenticationError(error)).toBe(true);
        });
      });

      it('should detect authentication errors by error code', () => {
        const authError = new Error('Some error');
        authError.code = 'invalid_auth';
        expect(testClient._isAuthenticationError(authError)).toBe(true);

        const tokenRevokedError = new Error('Some error');
        tokenRevokedError.code = 'token_revoked';
        expect(testClient._isAuthenticationError(tokenRevokedError)).toBe(true);
      });

      it('should detect HTTP 401 errors', () => {
        const unauthorizedError = new Error('Request failed');
        unauthorizedError.status = 401;
        expect(testClient._isAuthenticationError(unauthorizedError)).toBe(true);

        const unauthorizedMessageError = new Error('HTTP 401 Unauthorized');
        expect(testClient._isAuthenticationError(unauthorizedMessageError)).toBe(true);
      });

      it('should not detect non-authentication errors', () => {
        const nonAuthErrors = [
          new Error('Connection timeout'),
          new Error('Network error'),
          new Error('Server error'),
          new Error('Rate limited'),
          null,
          undefined
        ];

        nonAuthErrors.forEach(error => {
          expect(testClient._isAuthenticationError(error)).toBe(false);
        });
      });
    });

    describe('Team Invalidation', () => {
      let testClient;

      beforeEach(() => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
        testClient.socketModeClient = mockSocketModeClient;
        testClient.webClient = mockWebClient;
        testClient.isConnected = true;
      });

      it('should invalidate team on authentication error', () => {
        const authError = new Error('invalid_auth');
        testClient._invalidateTeam(authError);

        expect(testClient.isInvalidated).toBe(true);
        expect(testClient.isConnected).toBe(false);
        expect(testClient.isConnecting).toBe(false);
        expect(testClient.socketModeClient).toBeNull();
        expect(testClient.webClient).toBeNull();
        expect(mockSocketModeClient.disconnect).toHaveBeenCalled();
      });

      it('should handle disconnect error during invalidation', () => {
        mockSocketModeClient.disconnect.mockRejectedValue(new Error('Disconnect failed'));
        
        const authError = new Error('invalid_auth');
        expect(() => testClient._invalidateTeam(authError)).not.toThrow();
        
        expect(testClient.isInvalidated).toBe(true);
      });
    });

    describe('Reconnection with Error Handling', () => {
      let testClient;

      beforeEach(() => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
        // Mock setTimeout to avoid actual delays in tests
        global.setTimeout = vi.fn();
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should not schedule reconnect if team is invalidated', () => {
        testClient.isInvalidated = true;
        testClient._scheduleReconnect();
        expect(global.setTimeout).not.toHaveBeenCalled();
      });

      it('should not schedule reconnect if max attempts reached', () => {
        testClient.reconnectAttempts = testClient.maxReconnectAttempts;
        testClient._scheduleReconnect();
        expect(global.setTimeout).not.toHaveBeenCalled();
      });

      it('should schedule reconnect for non-auth errors', () => {
        testClient.reconnectAttempts = 1;
        testClient._scheduleReconnect();
        expect(global.setTimeout).toHaveBeenCalled();
      });
    });

    describe('Socket Error Event Handling', () => {
      let testClient;
      let errorHandler;

      beforeEach(async () => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
        mockWebClient.conversations.info.mockResolvedValue({
          ok: true,
          channel: { name: 'general' }
        });
        
        await testClient.connect();
        
        // Get the error event handler
        errorHandler = mockSocketModeClient.on.mock.calls
          .find(call => call[0] === 'error')[1];
      });

      it('should invalidate team on socket authentication error', () => {
        const authError = new Error('invalid_auth');
        testClient.isConnected = true;
        testClient.isConnecting = false;

        errorHandler(authError);

        expect(testClient.isInvalidated).toBe(true);
        expect(testClient.isConnected).toBe(false);
      });

      it('should schedule reconnect on non-auth socket error', () => {
        // Mock setTimeout to avoid actual delays in tests
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = vi.fn();

        const networkError = new Error('Network timeout');
        testClient.isConnected = true;
        testClient.isConnecting = false;

        errorHandler(networkError);

        expect(testClient.isInvalidated).toBe(false);
        expect(testClient.isConnected).toBe(false);
        expect(global.setTimeout).toHaveBeenCalled();

        // Restore setTimeout
        global.setTimeout = originalSetTimeout;
      });
    });

    describe('Integration Error Scenarios', () => {
      it('should handle authentication error during initial connection', async () => {
        const authError = new Error('token_revoked');
        authError.code = 'token_revoked';
        mockSocketModeClient.start.mockRejectedValue(authError);

        const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);

        try {
          await testClient.connect();
        } catch (error) {
          expect(error).toBe(authError);
        }

        expect(testClient.isInvalidated).toBe(true);
        expect(testClient.isConnected).toBe(false);
        expect(testClient.isConnecting).toBe(false);
      });

      it('should handle network error during initial connection', async () => {
        const networkError = new Error('ECONNREFUSED');
        mockSocketModeClient.start.mockRejectedValue(networkError);

        // Mock setTimeout to avoid actual delays in tests
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = vi.fn();

        const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);

        try {
          await testClient.connect();
        } catch (error) {
          expect(error).toBe(networkError);
        }

        expect(testClient.isInvalidated).toBe(false);
        expect(testClient.isConnected).toBe(false);
        expect(testClient.isConnecting).toBe(false);
        expect(global.setTimeout).toHaveBeenCalled();

        // Restore setTimeout
        global.setTimeout = originalSetTimeout;
      });

      it('should handle authentication error during reconnection', async () => {
        const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [...testChannelIds]);
        testClient.reconnectAttempts = 1;

        const authError = new Error('account_inactive');
        const connectSpy = vi.spyOn(testClient, 'connect').mockRejectedValue(authError);
        const invalidateSpy = vi.spyOn(testClient, '_invalidateTeam');

        // Mock the authentication error detection
        vi.spyOn(testClient, '_isAuthenticationError').mockReturnValue(true);

        await testClient.reconnect();

        expect(connectSpy).toHaveBeenCalled();
        // The invalidation would happen in the connect method when it catches the auth error
      });
    });
  });

  describe('Channel Error Handling', () => {
    describe('Channel ID Format Validation', () => {
      let testClient;

      beforeEach(() => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, ['C1234567890']);
      });

      it('should validate correct channel ID formats', () => {
        const validChannelIds = [
          'C1234567890',
          'CABCDEFGHIJ',
          'C0123456789'
        ];

        validChannelIds.forEach(channelId => {
          expect(testClient.isValidChannelIdFormat(channelId)).toBe(true);
        });
      });

      it('should reject invalid channel ID formats', () => {
        const invalidChannelIds = [
          'C123456789',     // too short
          'C12345678901',   // too long
          'D1234567890',    // wrong prefix
          'c1234567890',    // lowercase
          '1234567890',     // no prefix
          '',               // empty
          null,             // null
          undefined,        // undefined
          123,              // number
          'C123456789a',    // lowercase letter
          'C123456789-'     // special character
        ];

        invalidChannelIds.forEach(channelId => {
          expect(testClient.isValidChannelIdFormat(channelId)).toBe(false);
        });
      });
    });

    describe('Channel Error Reason Detection', () => {
      let testClient;

      beforeEach(() => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, ['C1234567890']);
      });

      it('should detect API error reasons correctly', () => {
        const apiErrors = [
          { error: 'channel_not_found', expected: 'channel not found' },
          { error: 'not_in_channel', expected: 'bot not in channel' },
          { error: 'access_denied', expected: 'access denied' },
          { error: 'invalid_channel', expected: 'invalid channel ID' },
          { error: 'unknown_error', expected: 'API error: unknown_error' }
        ];

        apiErrors.forEach(({ error, expected }) => {
          const result = { ok: false, error };
          expect(testClient._getChannelErrorReason(result)).toBe(expected);
        });
      });

      it('should detect exception error reasons correctly', () => {
        const exceptions = [
          { message: 'channel_not_found', expected: 'channel not found' },
          { message: 'not_in_channel', expected: 'bot not in channel' },
          { message: 'access_denied', expected: 'access denied' },
          { message: 'invalid_channel', expected: 'invalid channel ID' },
          { message: 'rate_limited', expected: 'rate limited' },
          { message: 'timeout error', expected: 'network timeout' },
          { message: 'ECONNRESET', expected: 'network timeout' },
          { status: 403, message: 'Forbidden', expected: 'permission denied' },
          { status: 404, message: 'Not Found', expected: 'channel not found' },
          { message: 'unknown error', expected: 'access error' }
        ];

        exceptions.forEach(({ message, status, expected }) => {
          const error = new Error(message);
          if (status) error.status = status;
          expect(testClient._getChannelErrorReasonFromException(error)).toBe(expected);
        });
      });
    });

    describe('Channel Subscription with Errors', () => {
      let testClient;

      beforeEach(() => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [
          'C1234567890',  // valid
          'invalid-id',   // invalid format
          'C0987654321',  // valid but access denied
          'C1111111111'   // valid but not found
        ]);
        testClient.webClient = mockWebClient;
      });

      it('should skip channels with invalid format', async () => {
        mockWebClient.conversations.info
          .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } })
          .mockResolvedValueOnce({ ok: false, error: 'access_denied' })
          .mockResolvedValueOnce({ ok: false, error: 'channel_not_found' });

        await testClient.subscribeToChannels();

        expect(testClient.channelIds).toEqual(['C1234567890']);
        expect(testClient.skippedChannels).toHaveLength(3);
        expect(testClient.skippedChannels[0]).toEqual({
          channelId: 'invalid-id',
          reason: 'invalid channel ID format'
        });
      });

      it('should skip channels with API errors', async () => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, ['C1234567890', 'C0987654321']);
        testClient.webClient = mockWebClient;

        mockWebClient.conversations.info
          .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } })
          .mockResolvedValueOnce({ ok: false, error: 'not_in_channel' });

        await testClient.subscribeToChannels();

        expect(testClient.channelIds).toEqual(['C1234567890']);
        expect(testClient.skippedChannels).toHaveLength(1);
        expect(testClient.skippedChannels[0]).toEqual({
          channelId: 'C0987654321',
          reason: 'bot not in channel'
        });
      });

      it('should skip channels with exceptions', async () => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, ['C1234567890', 'C0987654321']);
        testClient.webClient = mockWebClient;

        const accessError = new Error('access_denied');
        accessError.status = 403;

        mockWebClient.conversations.info
          .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } })
          .mockRejectedValueOnce(accessError);

        await testClient.subscribeToChannels();

        expect(testClient.channelIds).toEqual(['C1234567890']);
        expect(testClient.skippedChannels).toHaveLength(1);
        expect(testClient.skippedChannels[0]).toEqual({
          channelId: 'C0987654321',
          reason: 'access denied',
          error: 'access_denied'
        });
      });

      it('should throw error when no valid channels remain', async () => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, ['invalid-id', 'C0987654321']);
        testClient.webClient = mockWebClient;

        mockWebClient.conversations.info
          .mockResolvedValueOnce({ ok: false, error: 'channel_not_found' });

        await expect(testClient.subscribeToChannels())
          .rejects.toThrow('No valid channels available for subscription. Skipped 2 channels.');

        expect(testClient.skippedChannels).toHaveLength(2);
      });

      it('should log summary when channels are skipped', async () => {
        const { logger } = await import('../../src/utils/Logger.js');
        const mockLogger = vi.mocked(logger);

        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, ['C1234567890', 'invalid-id']);
        testClient.webClient = mockWebClient;

        mockWebClient.conversations.info
          .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } });

        await testClient.subscribeToChannels();

        expect(mockLogger.info).toHaveBeenCalledWith(
          `Team: ${testTeamName}, Successfully subscribed to 1 channels, skipped 1 channels`
        );
      });
    });

    describe('Skipped Channels Tracking', () => {
      let testClient;

      beforeEach(() => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, ['C1234567890']);
      });

      it('should return empty array initially', () => {
        expect(testClient.getSkippedChannels()).toEqual([]);
      });

      it('should track skipped channels after subscription', async () => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, ['C1234567890', 'invalid-id']);
        testClient.webClient = mockWebClient;

        mockWebClient.conversations.info
          .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } });

        await testClient.subscribeToChannels();

        const skippedChannels = testClient.getSkippedChannels();
        expect(skippedChannels).toHaveLength(1);
        expect(skippedChannels[0]).toEqual({
          channelId: 'invalid-id',
          reason: 'invalid channel ID format'
        });
      });

      it('should reset skipped channels on re-subscription', async () => {
        testClient = new SlackClient(testAppToken, testBotToken, testTeamName, ['C1234567890']);
        testClient.webClient = mockWebClient;
        testClient.skippedChannels = [{ channelId: 'old-channel', reason: 'old reason' }];

        mockWebClient.conversations.info
          .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } });

        await testClient.subscribeToChannels();

        expect(testClient.getSkippedChannels()).toEqual([]);
      });
    });

    describe('Channel Error Integration', () => {
      it('should handle mixed channel scenarios', async () => {
        const testClient = new SlackClient(testAppToken, testBotToken, testTeamName, [
          'C1234567890',    // valid
          'invalid-format', // invalid format
          'C0987654321',    // access denied
          'C1111111111',    // not found
          'C2222222222'     // exception
        ]);
        testClient.webClient = mockWebClient;

        const networkError = new Error('Network timeout');
        
        mockWebClient.conversations.info
          .mockResolvedValueOnce({ ok: true, channel: { name: 'general' } })
          .mockResolvedValueOnce({ ok: false, error: 'access_denied' })
          .mockResolvedValueOnce({ ok: false, error: 'channel_not_found' })
          .mockRejectedValueOnce(networkError);

        await testClient.subscribeToChannels();

        expect(testClient.channelIds).toEqual(['C1234567890']);
        expect(testClient.skippedChannels).toHaveLength(4);
        
        const reasons = testClient.skippedChannels.map(s => s.reason);
        expect(reasons).toContain('invalid channel ID format');
        expect(reasons).toContain('access denied');
        expect(reasons).toContain('channel not found');
        expect(reasons).toContain('network timeout');
      });
    });
  });
});
