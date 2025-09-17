/**
 * Logger class for handling application logging
 * Outputs all logs to STDERR in standard text format
 */
export class Logger {
  /**
   * Log an informational message
   * @param {string} message - The message to log
   */
  info(message) {
    this._writeLog('INFO', message);
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   */
  warn(message) {
    this._writeLog('WARN', message);
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   */
  error(message) {
    this._writeLog('ERROR', message);
  }

  /**
   * Internal method to write log messages to STDERR
   * @private
   * @param {string} level - The log level (INFO, WARN, ERROR)
   * @param {string} message - The message to log
   */
  _writeLog(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${level}] ${message}`;
    process.stderr.write(`${logMessage}\n`);
  }
}

// Export a singleton instance for convenience
export const logger = new Logger();
