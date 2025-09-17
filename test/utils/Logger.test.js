import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, logger } from '../../src/utils/Logger.js';

describe('Logger', () => {
  let mockStderr;
  let originalWrite;

  beforeEach(() => {
    // Mock process.stderr.write to capture output
    originalWrite = process.stderr.write;
    mockStderr = vi.fn();
    process.stderr.write = mockStderr;
  });

  afterEach(() => {
    // Restore original stderr.write
    process.stderr.write = originalWrite;
    vi.clearAllMocks();
  });

  describe('Logger class', () => {
    let loggerInstance;

    beforeEach(() => {
      loggerInstance = new Logger();
    });

    it('should create a new Logger instance', () => {
      expect(loggerInstance).toBeInstanceOf(Logger);
      expect(loggerInstance.info).toBeTypeOf('function');
      expect(loggerInstance.warn).toBeTypeOf('function');
      expect(loggerInstance.error).toBeTypeOf('function');
    });

    it('should log info messages to STDERR with correct format', () => {
      const message = 'This is an info message';
      
      loggerInstance.info(message);
      
      expect(mockStderr).toHaveBeenCalledOnce();
      const logOutput = mockStderr.mock.calls[0][0];
      expect(logOutput).toMatch(/^\[INFO\] This is an info message\n$/);
    });

    it('should log warn messages to STDERR with correct format', () => {
      const message = 'This is a warning message';
      
      loggerInstance.warn(message);
      
      expect(mockStderr).toHaveBeenCalledOnce();
      const logOutput = mockStderr.mock.calls[0][0];
      expect(logOutput).toMatch(/^\[WARN\] This is a warning message\n$/);
    });

    it('should log error messages to STDERR with correct format', () => {
      const message = 'This is an error message';
      
      loggerInstance.error(message);
      
      expect(mockStderr).toHaveBeenCalledOnce();
      const logOutput = mockStderr.mock.calls[0][0];
      expect(logOutput).toMatch(/^\[ERROR\] This is an error message\n$/);
    });

    it('should handle empty messages', () => {
      loggerInstance.info('');
      
      expect(mockStderr).toHaveBeenCalledOnce();
      const logOutput = mockStderr.mock.calls[0][0];
      expect(logOutput).toBe('[INFO] \n');
    });

    it('should handle messages with special characters', () => {
      const message = 'Message with "quotes" and \n newlines';
      
      loggerInstance.error(message);
      
      expect(mockStderr).toHaveBeenCalledOnce();
      const logOutput = mockStderr.mock.calls[0][0];
      expect(logOutput).toMatch(/^\[ERROR\] Message with "quotes" and \n newlines\n$/);
    });

    it('should output each log call separately', () => {
      loggerInstance.info('First message');
      loggerInstance.warn('Second message');
      loggerInstance.error('Third message');
      
      expect(mockStderr).toHaveBeenCalledTimes(3);
      expect(mockStderr.mock.calls[0][0]).toMatch(/^\[INFO\] First message\n$/);
      expect(mockStderr.mock.calls[1][0]).toMatch(/^\[WARN\] Second message\n$/);
      expect(mockStderr.mock.calls[2][0]).toMatch(/^\[ERROR\] Third message\n$/);
    });
  });

  describe('logger singleton', () => {
    it('should export a singleton logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should use the same instance across imports', () => {
      const message = 'Singleton test message';
      
      logger.info(message);
      
      expect(mockStderr).toHaveBeenCalledOnce();
      const logOutput = mockStderr.mock.calls[0][0];
      expect(logOutput).toMatch(/^\[INFO\] Singleton test message\n$/);
    });
  });

  describe('output destination verification', () => {
    it('should write to process.stderr, not process.stdout', () => {
      const mockStdout = vi.fn();
      const originalStdoutWrite = process.stdout.write;
      process.stdout.write = mockStdout;

      const loggerInstance = new Logger();
      loggerInstance.info('Test message');

      // Should write to stderr, not stdout
      expect(mockStderr).toHaveBeenCalledOnce();
      expect(mockStdout).not.toHaveBeenCalled();

      // Restore stdout
      process.stdout.write = originalStdoutWrite;
    });
  });

  describe('log format verification', () => {
    it('should use standard text format without escape sequences', () => {
      const loggerInstance = new Logger();
      loggerInstance.info('Standard format test');
      
      const logOutput = mockStderr.mock.calls[0][0];
      
      // Should not contain ANSI escape sequences for cursor movement or screen control
      expect(logOutput).not.toMatch(/\x1b\[[0-9;]*[HJK]/); // Cursor movement/screen control
      // Should contain only the basic log format
      expect(logOutput).toMatch(/^\[INFO\] Standard format test\n$/);
    });

    it('should end each log message with a newline', () => {
      const loggerInstance = new Logger();
      
      loggerInstance.info('Test');
      loggerInstance.warn('Test');
      loggerInstance.error('Test');
      
      mockStderr.mock.calls.forEach(call => {
        expect(call[0]).toMatch(/\n$/);
      });
    });
  });
});
