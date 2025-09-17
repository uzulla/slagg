/**
 * MessageProcessor handles message processing and handler management
 * Manages registration of message handlers and processes messages through them
 */
export class MessageProcessor {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * Register a message handler
   * @param {MessageHandler} handler - The handler to register
   */
  registerHandler(handler) {
    if (!handler || typeof handler.handle !== 'function') {
      throw new Error('Handler must implement handle method');
    }

    if (typeof handler.getName !== 'function') {
      throw new Error('Handler must implement getName method');
    }

    if (typeof handler.isEnabled !== 'function') {
      throw new Error('Handler must implement isEnabled method');
    }

    const handlerName = handler.getName();
    this.handlers.set(handlerName, handler);
  }

  /**
   * Unregister a message handler
   * @param {string} handlerName - The name of the handler to remove
   * @returns {boolean} True if handler was removed, false if not found
   */
  unregisterHandler(handlerName) {
    return this.handlers.delete(handlerName);
  }

  /**
   * Get all registered handlers
   * @returns {MessageHandler[]} Array of registered handlers
   */
  getHandlers() {
    return Array.from(this.handlers.values());
  }

  /**
   * Get a specific handler by name
   * @param {string} handlerName - The name of the handler
   * @returns {MessageHandler|undefined} The handler or undefined if not found
   */
  getHandler(handlerName) {
    return this.handlers.get(handlerName);
  }

  /**
   * Process a single message through all enabled handlers
   * @param {Object} message - The message to process
   */
  async processMessage(message) {
    const enabledHandlers = Array.from(this.handlers.values()).filter((handler) =>
      handler.isEnabled()
    );

    const promises = enabledHandlers.map((handler) =>
      handler.handle(message).catch((error) => {
        console.error(`Error in handler ${handler.getName()}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Process multiple messages, sorting them by timestamp first
   * @param {Object[]} messages - Array of messages to process
   */
  async processMessages(messages) {
    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array');
    }

    const sortedMessages = this.sortByTimestamp(messages);

    for (const message of sortedMessages) {
      await this.processMessage(message);
    }
  }

  /**
   * Sort messages by timestamp
   * @param {Object[]} messages - Array of messages to sort
   * @returns {Object[]} Sorted array of messages
   */
  sortByTimestamp(messages) {
    if (!Array.isArray(messages)) {
      return [];
    }

    return [...messages].sort((a, b) => {
      // Use formattedTime if available, otherwise parse timestamp
      const timeA = a.formattedTime || new Date(Number.parseFloat(a.timestamp) * 1000);
      const timeB = b.formattedTime || new Date(Number.parseFloat(b.timestamp) * 1000);

      return timeA.getTime() - timeB.getTime();
    });
  }

  /**
   * Get count of registered handlers
   * @returns {number} Number of registered handlers
   */
  getHandlerCount() {
    return this.handlers.size;
  }

  /**
   * Get count of enabled handlers
   * @returns {number} Number of enabled handlers
   */
  getEnabledHandlerCount() {
    return Array.from(this.handlers.values()).filter((handler) => handler.isEnabled()).length;
  }

  /**
   * Clear all registered handlers
   */
  clearHandlers() {
    this.handlers.clear();
  }
}
