/**
 * Abstract base class for message handlers
 * Provides the interface that all message handlers must implement
 */
export class MessageHandler {
  /**
   * Handle a message - must be implemented by subclasses
   * @param {Object} _message - The message object to handle
   * @param {string} _message.team - Team name
   * @param {string} _message.channel - Channel name
   * @param {string} _message.channelId - Channel ID
   * @param {string} _message.user - User name
   * @param {string} _message.text - Message text
   * @param {string} _message.timestamp - Slack timestamp
   * @param {Date} _message.formattedTime - JavaScript Date object
   * @returns {Promise<void>}
   */
  async handle(_message) {
    throw new Error('handle method must be implemented by subclass');
  }

  /**
   * Get the name of this handler
   * @returns {string} Handler name
   */
  getName() {
    throw new Error('getName method must be implemented by subclass');
  }

  /**
   * Check if this handler is enabled
   * @returns {boolean} True if enabled, false otherwise
   */
  isEnabled() {
    throw new Error('isEnabled method must be implemented by subclass');
  }
}
