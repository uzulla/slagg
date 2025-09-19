import chalk from 'chalk';
import { MessageHandler } from '../MessageHandler.js';

/**
 * Console output handler that formats and displays messages to STDOUT
 * Formats messages as: {team}/{channel}/{user} > message
 */
export class ConsoleOutputHandler extends MessageHandler {
  constructor(enabled = true, highlightConfig = null) {
    super();
    this.enabled = enabled;
    this.highlightConfig = highlightConfig;
  }

  /**
   * Handle a message by formatting and outputting to STDOUT
   * @param {Object} message - The message object to handle
   */
  async handle(message) {
    const formattedMessage = this.formatForOutput(message);
    console.log(formattedMessage);
  }

  /**
   * Get the name of this handler
   * @returns {string} Handler name
   */
  getName() {
    return 'ConsoleOutputHandler';
  }

  /**
   * Check if this handler is enabled
   * @returns {boolean} True if enabled, false otherwise
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Format message for console output
   * @param {Object} message - The message object
   * @returns {string} Formatted message string
   */
  formatForOutput(message) {
    const sanitizedText = this.sanitizeText(message.text);
    const textWithoutNewlines = this.replaceNewlines(sanitizedText);
    const formattedMessage = `${message.team}/${message.channel}/${message.user} > ${textWithoutNewlines}`;

    return this.applyHighlight(formattedMessage, message.text);
  }

  /**
   * Apply highlight to formatted message if keywords match
   * @param {string} formattedMessage - The formatted message string
   * @param {string} originalText - The original message text for matching
   * @returns {string} Highlighted or original formatted message
   */
  applyHighlight(formattedMessage, originalText) {
    if (!this.highlightConfig || !originalText) {
      return formattedMessage;
    }

    try {
      if (this.highlightConfig.matchesAny(originalText)) {
        return chalk.red.bold(formattedMessage);
      }
    } catch (error) {
      // ハイライト処理でエラーが発生した場合は通常の表示でメッセージを出力
      return formattedMessage;
    }

    return formattedMessage;
  }

  /**
   * Sanitize text by removing potentially problematic characters
   * @param {string} text - The text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    if (typeof text !== 'string') {
      return '';
    }

    // Remove control characters except for newlines and tabs (which we'll handle separately)
    // Using String.fromCharCode to avoid control characters in regex
    const controlCharsRegex = new RegExp(
      `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}${String.fromCharCode(12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
      'g'
    );
    return text.replace(controlCharsRegex, '');
  }

  /**
   * Replace newlines with spaces to ensure single-line output
   * @param {string} text - The text to process
   * @returns {string} Text with newlines replaced by spaces
   */
  replaceNewlines(text) {
    if (typeof text !== 'string') {
      return '';
    }

    return text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
