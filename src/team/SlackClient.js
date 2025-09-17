import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import { logger } from '../utils/Logger.js';

/**
 * SlackClient handles Socket Mode API connection for a single team
 * Manages real-time message streaming and auto-reconnection
 */
export class SlackClient {
  constructor(token, teamName, channelIds) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token is required and must be a string');
    }
    if (!teamName || typeof teamName !== 'string') {
      throw new Error('Team name is required and must be a string');
    }
    if (!Array.isArray(channelIds) || channelIds.length === 0) {
      throw new Error('Channel IDs must be a non-empty array');
    }

    this.token = token;
    this.teamName = teamName;
    this.channelIds = channelIds;
    this.socketModeClient = null;
    this.webClient = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isInvalidated = false; // Track if team has been invalidated due to auth errors
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.messageCallback = null;
    this.channelNames = new Map(); // Cache channel names
    this.skippedChannels = []; // Track skipped channels with reasons
  }

  /**
   * Set the callback function for handling received messages
   * @param {Function} callback - Function to call when a message is received
   */
  setMessageCallback(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Message callback must be a function');
    }
    this.messageCallback = callback;
  }

  /**
   * Connect to Slack using Socket Mode API
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnecting || this.isConnected || this.isInvalidated) {
      return;
    }

    this.isConnecting = true;

    try {
      // Initialize clients
      this.socketModeClient = new SocketModeClient(this.token);
      this.webClient = new WebClient(this.token);

      // Set up event listeners
      this._setupEventListeners();

      // Start the connection
      await this.socketModeClient.start();

      // Subscribe to channels after connection
      await this.subscribeToChannels();

      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000; // Reset delay

      logger.info(`Connected to team: ${this.teamName} (${this.channelIds.length} channels)`);
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;

      // Check if this is an authentication error
      if (this._isAuthenticationError(error)) {
        this._invalidateTeam(error);
        throw error;
      }

      logger.error(`Team: ${this.teamName}, Error: Failed to connect - ${error.message}`);

      // Attempt reconnection for non-auth errors
      this._scheduleReconnect();
      throw error;
    }
  }

  /**
   * Subscribe to specified channels
   * @returns {Promise<void>}
   */
  async subscribeToChannels() {
    if (!this.webClient) {
      throw new Error('Web client not initialized');
    }

    const validChannelIds = [];
    this.skippedChannels = []; // Reset skipped channels list

    // Fetch channel names for better message formatting
    for (const channelId of this.channelIds) {
      // First validate channel ID format
      if (!this.isValidChannelIdFormat(channelId)) {
        const errorReason = 'invalid channel ID format';
        logger.warn(`Channel: ${channelId} skipped due to ${errorReason}`);
        this.skippedChannels.push({ channelId, reason: errorReason });
        continue;
      }

      try {
        const result = await this.webClient.conversations.info({
          channel: channelId,
        });

        if (result.ok && result.channel) {
          this.channelNames.set(channelId, result.channel.name);
          validChannelIds.push(channelId);
        } else {
          const errorReason = this._getChannelErrorReason(result);
          logger.warn(`Channel: ${channelId} skipped due to ${errorReason}`);
          this.skippedChannels.push({ channelId, reason: errorReason });
        }
      } catch (error) {
        const errorReason = this._getChannelErrorReasonFromException(error);
        logger.warn(`Channel: ${channelId} skipped due to ${errorReason} - ${error.message}`);
        this.skippedChannels.push({ channelId, reason: errorReason, error: error.message });
      }
    }

    if (validChannelIds.length === 0) {
      const errorMessage = `No valid channels available for subscription. Skipped ${this.skippedChannels.length} channels.`;
      logger.error(`Team: ${this.teamName}, Error: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Log summary of channel subscription results
    if (this.skippedChannels.length > 0) {
      logger.info(
        `Team: ${this.teamName}, Successfully subscribed to ${validChannelIds.length} channels, skipped ${this.skippedChannels.length} channels`
      );
    }

    // Update the channel IDs list with only valid channels
    this.channelIds = validChannelIds;
  }

  /**
   * Handle incoming message events
   * @param {Object} event - The message event from Slack
   */
  async handleMessage(event) {
    try {
      // Only process messages from subscribed channels
      if (!this.channelIds.includes(event.channel)) {
        return;
      }

      // Skip bot messages and message subtypes we don't want
      if (event.bot_id || event.subtype) {
        return;
      }

      // Get user information
      let userName = 'Unknown User';
      if (event.user && this.webClient) {
        try {
          const userResult = await this.webClient.users.info({
            user: event.user,
          });
          if (userResult.ok && userResult.user) {
            userName =
              userResult.user.display_name ||
              userResult.user.real_name ||
              userResult.user.name ||
              'Unknown User';
          }
        } catch (error) {
          // If we can't get user info, use the user ID
          userName = event.user;
        }
      }

      // Get channel name
      const channelName = this.channelNames.get(event.channel) || event.channel;

      // Create message object
      const message = {
        team: this.teamName,
        channel: channelName,
        channelId: event.channel,
        user: userName,
        text: event.text || '',
        timestamp: event.ts,
        formattedTime: new Date(Number.parseFloat(event.ts) * 1000),
      };

      // Call the message callback if set
      if (this.messageCallback) {
        await this.messageCallback(message);
      }
    } catch (error) {
      logger.error(`Team: ${this.teamName}, Error processing message: ${error.message}`);
    }
  }

  /**
   * Reconnect to Slack with exponential backoff
   * @returns {Promise<void>}
   */
  async reconnect() {
    if (this.isConnecting || this.isConnected || this.isInvalidated) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Team: ${this.teamName}, Error: Max reconnection attempts reached`);
      return;
    }

    this.reconnectAttempts++;
    logger.info(
      `Team: ${this.teamName}, Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
    );

    try {
      await this.connect();
    } catch (error) {
      // connect() method already handles scheduling the next reconnect
      // or invalidates the team for auth errors
    }
  }

  /**
   * Disconnect from Slack
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.isConnected = false;
    this.isConnecting = false;

    if (this.socketModeClient) {
      try {
        await this.socketModeClient.disconnect();
      } catch (error) {
        logger.warn(`Team: ${this.teamName}, Warning during disconnect: ${error.message}`);
      }
    }

    this.socketModeClient = null;
    this.webClient = null;
    this.channelNames.clear();

    logger.info(`Disconnected from team: ${this.teamName}`);
  }

  /**
   * Check if the client is connected
   * @returns {boolean}
   */
  isClientConnected() {
    return this.isConnected;
  }

  /**
   * Check if the team has been invalidated due to authentication errors
   * @returns {boolean}
   */
  isTeamInvalidated() {
    return this.isInvalidated;
  }

  /**
   * Get team name
   * @returns {string}
   */
  getTeamName() {
    return this.teamName;
  }

  /**
   * Get subscribed channel IDs
   * @returns {string[]}
   */
  getChannelIds() {
    return [...this.channelIds];
  }

  /**
   * Set up event listeners for the Socket Mode client
   * @private
   */
  _setupEventListeners() {
    if (!this.socketModeClient) {
      return;
    }

    // Handle message events
    this.socketModeClient.on('message', async (event) => {
      await this.handleMessage(event);
    });

    // Handle connection events
    this.socketModeClient.on('connected', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socketModeClient.on('disconnected', () => {
      this.isConnected = false;
      if (!this.isConnecting) {
        logger.warn(`Team: ${this.teamName}, Connection lost`);
        this._scheduleReconnect();
      }
    });

    // Handle errors
    this.socketModeClient.on('error', (error) => {
      logger.error(`Team: ${this.teamName}, Socket error: ${error.message}`);
      this.isConnected = false;

      // Check if this is an authentication error
      if (this._isAuthenticationError(error)) {
        this._invalidateTeam(error);
        return;
      }

      if (!this.isConnecting) {
        this._scheduleReconnect();
      }
    });
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   * @private
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || this.isInvalidated) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error(`Team: ${this.teamName}, Error: Max reconnection attempts reached`);
      }
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * 2 ** this.reconnectAttempts,
      this.maxReconnectDelay
    );

    setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  /**
   * Check if an error is an authentication error
   * @private
   * @param {Error} error - The error to check
   * @returns {boolean} True if the error is an authentication error
   */
  _isAuthenticationError(error) {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code;

    // Common authentication error patterns
    const authErrorPatterns = [
      'invalid_auth',
      'token_revoked',
      'account_inactive',
      'invalid_token',
      'not_authed',
      'token_expired',
      'unauthorized',
      'authentication failed',
      'invalid credentials',
    ];

    // Check error message for auth patterns
    const hasAuthPattern = authErrorPatterns.some((pattern) => errorMessage.includes(pattern));

    // Check for specific error codes
    const authErrorCodes = ['invalid_auth', 'token_revoked', 'account_inactive'];
    const hasAuthCode = authErrorCodes.includes(errorCode);

    // Check for HTTP 401 Unauthorized
    const isUnauthorized = error.status === 401 || errorMessage.includes('401');

    return hasAuthPattern || hasAuthCode || isUnauthorized;
  }

  /**
   * Invalidate the team due to authentication errors
   * @private
   * @param {Error} error - The authentication error
   */
  _invalidateTeam(error) {
    this.isInvalidated = true;
    this.isConnected = false;
    this.isConnecting = false;

    logger.error(`Team: ${this.teamName}, Error: Authentication failed - ${error.message}`);
    logger.error(`Team: ${this.teamName} has been invalidated and will not attempt reconnection`);

    // Clean up connections
    if (this.socketModeClient) {
      try {
        // Don't await the disconnect to avoid blocking invalidation
        this.socketModeClient.disconnect().catch(() => {
          // Ignore disconnect errors during invalidation
        });
      } catch (disconnectError) {
        // Ignore disconnect errors during invalidation
      }
    }

    this.socketModeClient = null;
    this.webClient = null;
    this.channelNames.clear();
  }

  /**
   * Determine the reason for channel error from API response
   * @private
   * @param {Object} result - The API response result
   * @returns {string} Human-readable error reason
   */
  _getChannelErrorReason(result) {
    if (!result.ok) {
      switch (result.error) {
        case 'channel_not_found':
          return 'channel not found';
        case 'not_in_channel':
          return 'bot not in channel';
        case 'access_denied':
          return 'access denied';
        case 'invalid_channel':
          return 'invalid channel ID';
        default:
          return `API error: ${result.error}`;
      }
    }
    return 'unknown error';
  }

  /**
   * Determine the reason for channel error from exception
   * @private
   * @param {Error} error - The exception thrown
   * @returns {string} Human-readable error reason
   */
  _getChannelErrorReasonFromException(error) {
    if (!error) return 'unknown error';

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code;

    // Check for specific error patterns
    if (errorMessage.includes('channel_not_found') || errorCode === 'channel_not_found') {
      return 'channel not found';
    }
    if (errorMessage.includes('not_in_channel') || errorCode === 'not_in_channel') {
      return 'bot not in channel';
    }
    if (errorMessage.includes('access_denied') || errorCode === 'access_denied') {
      return 'access denied';
    }
    if (errorMessage.includes('invalid_channel') || errorCode === 'invalid_channel') {
      return 'invalid channel ID';
    }
    if (errorMessage.includes('rate_limited') || errorCode === 'rate_limited') {
      return 'rate limited';
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('econnreset')) {
      return 'network timeout';
    }
    if (error.status === 403) {
      return 'permission denied';
    }
    if (error.status === 404) {
      return 'channel not found';
    }

    return 'access error';
  }

  /**
   * Validate channel ID format
   * @param {string} channelId - Channel ID to validate
   * @returns {boolean} True if channel ID format is valid
   */
  isValidChannelIdFormat(channelId) {
    if (!channelId || typeof channelId !== 'string') {
      return false;
    }
    // Slack channel ID format: C followed by 10 alphanumeric characters
    return /^C[A-Z0-9]{10}$/.test(channelId);
  }

  /**
   * Get list of skipped channels with reasons
   * @returns {Array} Array of skipped channel information
   */
  getSkippedChannels() {
    return this.skippedChannels || [];
  }
}
