import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleOutputHandler } from '../../../src/message/handlers/ConsoleOutputHandler.js';

describe('ConsoleOutputHandler', () => {
  let handler;
  let consoleSpy;

  beforeEach(() => {
    handler = new ConsoleOutputHandler();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('interface implementation', () => {
    it('should implement getName method', () => {
      expect(handler.getName()).toBe('ConsoleOutputHandler');
    });

    it('should implement isEnabled method with default true', () => {
      expect(handler.isEnabled()).toBe(true);
    });

    it('should implement isEnabled method with custom value', () => {
      const disabledHandler = new ConsoleOutputHandler(false);
      expect(disabledHandler.isEnabled()).toBe(false);
    });

    it('should implement handle method', async () => {
      const message = {
        team: 'test-team',
        channel: 'general',
        user: 'testuser',
        text: 'Hello world',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      await handler.handle(message);

      expect(consoleSpy).toHaveBeenCalledWith('test-team/general/testuser > Hello world');
    });
  });

  describe('formatForOutput', () => {
    it('should format message correctly', () => {
      const message = {
        team: 'mycompany',
        channel: 'general',
        user: 'john.doe',
        text: 'Hello everyone!',
      };

      const result = handler.formatForOutput(message);
      expect(result).toBe('mycompany/general/john.doe > Hello everyone!');
    });

    it('should handle special characters in team/channel/user names', () => {
      const message = {
        team: 'my-company',
        channel: 'general-chat',
        user: 'john_doe',
        text: 'Test message',
      };

      const result = handler.formatForOutput(message);
      expect(result).toBe('my-company/general-chat/john_doe > Test message');
    });
  });

  describe('sanitizeText', () => {
    it('should remove control characters', () => {
      const text = 'Hello\x00\x01\x02World\x7F';
      const result = handler.sanitizeText(text);
      expect(result).toBe('HelloWorld');
    });

    it('should preserve normal characters', () => {
      const text = 'Hello World! 123 @#$%';
      const result = handler.sanitizeText(text);
      expect(result).toBe('Hello World! 123 @#$%');
    });

    it('should handle empty string', () => {
      const result = handler.sanitizeText('');
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      expect(handler.sanitizeText(null)).toBe('');
      expect(handler.sanitizeText(undefined)).toBe('');
      expect(handler.sanitizeText(123)).toBe('');
    });
  });

  describe('replaceNewlines', () => {
    it('should replace single newline with space', () => {
      const text = 'Line 1\nLine 2';
      const result = handler.replaceNewlines(text);
      expect(result).toBe('Line 1 Line 2');
    });

    it('should replace multiple newlines with single space', () => {
      const text = 'Line 1\n\n\nLine 2';
      const result = handler.replaceNewlines(text);
      expect(result).toBe('Line 1 Line 2');
    });

    it('should replace carriage return + newline with space', () => {
      const text = 'Line 1\r\nLine 2';
      const result = handler.replaceNewlines(text);
      expect(result).toBe('Line 1 Line 2');
    });

    it('should collapse multiple spaces', () => {
      const text = 'Word1    Word2     Word3';
      const result = handler.replaceNewlines(text);
      expect(result).toBe('Word1 Word2 Word3');
    });

    it('should trim leading and trailing spaces', () => {
      const text = '  Hello World  ';
      const result = handler.replaceNewlines(text);
      expect(result).toBe('Hello World');
    });

    it('should handle complex multiline text', () => {
      const text = 'First line\nSecond line\r\nThird line\n\nFifth line';
      const result = handler.replaceNewlines(text);
      expect(result).toBe('First line Second line Third line Fifth line');
    });

    it('should handle empty string', () => {
      const result = handler.replaceNewlines('');
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      expect(handler.replaceNewlines(null)).toBe('');
      expect(handler.replaceNewlines(undefined)).toBe('');
      expect(handler.replaceNewlines(123)).toBe('');
    });
  });

  describe('integration tests', () => {
    it('should handle message with newlines and control characters', async () => {
      const message = {
        team: 'test-team',
        channel: 'general',
        user: 'testuser',
        text: 'Multi\nline\x00message\r\nwith\x01control\x02chars',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      await handler.handle(message);

      expect(consoleSpy).toHaveBeenCalledWith(
        'test-team/general/testuser > Multi linemessage withcontrolchars'
      );
    });

    it('should handle empty message text', async () => {
      const message = {
        team: 'test-team',
        channel: 'general',
        user: 'testuser',
        text: '',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      await handler.handle(message);

      expect(consoleSpy).toHaveBeenCalledWith('test-team/general/testuser > ');
    });
  });
});
