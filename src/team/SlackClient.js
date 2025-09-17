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
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.messageCallback = null;
    this.channelNames = new Map(); // Cache channel names
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
    if (this.isConnecting || this.isConnected) {
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
      logger.error(`Team: ${this.teamName}, Error: Failed to connect - ${error.message}`);

      // Attempt reconnection
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

    // Fetch channel names for better message formatting
    for (const channelId of this.channelIds) {
      try {
        const result = await this.webClient.conversations.info({
          channel: channelId,
        });

        if (result.ok && result.channel) {
          this.channelNames.set(channelId, result.channel.name);
          validChannelIds.push(channelId);
        } else {
          logger.warn(`Channel: ${channelId} skipped due to access error`);
        }
      } catch (error) {
        logger.warn(`Channel: ${channelId} skipped due to access error - ${error.message}`);
      }
    }

    if (validChannelIds.length === 0) {
      throw new Error('No valid channels available for subscription');
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
    if (this.isConnecting || this.isConnected) {
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Team: ${this.teamName}, Error: Max reconnection attempts reached`);
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
}
