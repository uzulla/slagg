/**
 * Abstract base class for message handlers
 * Provides the interface that all message handlers must implement
 */
export class MessageHandler {
  /**
   * Handle a message - must be implemented by subclasses
   * @param {Object} message - The message object to handle
   * @param {string} message.team - Team name
   * @param {string} message.channel - Channel name
   * @param {string} message.channelId - Channel ID
   * @param {string} message.user - User name
   * @param {string} message.text - Message text
   * @param {string} message.timestamp - Slack timestamp
   * @param {Date} message.formattedTime - JavaScript Date object
   * @returns {Promise<void>}
   */
  async handle(message) {
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
