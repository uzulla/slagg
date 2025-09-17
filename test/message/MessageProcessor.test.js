import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageHandler } from '../../src/message/MessageHandler.js';
import { MessageProcessor } from '../../src/message/MessageProcessor.js';

// Mock handler classes for testing
class MockHandler extends MessageHandler {
  constructor(name, enabled = true) {
    super();
    this.name = name;
    this.enabled = enabled;
    this.handleSpy = vi.fn();
  }

  async handle(message) {
    this.handleSpy(message);
    return `${this.name} handled: ${message.text}`;
  }

  getName() {
    return this.name;
  }

  isEnabled() {
    return this.enabled;
  }
}

class ErrorHandler extends MessageHandler {
  constructor(name) {
    super();
    this.name = name;
  }

  async handle(message) {
    throw new Error(`${this.name} error`);
  }

  getName() {
    return this.name;
  }

  isEnabled() {
    return true;
  }
}

describe('MessageProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new MessageProcessor();
  });

  describe('handler registration', () => {
    it('should register a valid handler', () => {
      const handler = new MockHandler('test-handler');

      processor.registerHandler(handler);

      expect(processor.getHandlerCount()).toBe(1);
      expect(processor.getHandler('test-handler')).toBe(handler);
    });

    it('should throw error when registering handler without handle method', () => {
      const invalidHandler = { getName: () => 'invalid', isEnabled: () => true };

      expect(() => processor.registerHandler(invalidHandler)).toThrow(
        'Handler must implement handle method'
      );
    });

    it('should throw error when registering handler without getName method', () => {
      const invalidHandler = { handle: () => {}, isEnabled: () => true };

      expect(() => processor.registerHandler(invalidHandler)).toThrow(
        'Handler must implement getName method'
      );
    });

    it('should throw error when registering handler without isEnabled method', () => {
      const invalidHandler = { handle: () => {}, getName: () => 'invalid' };

      expect(() => processor.registerHandler(invalidHandler)).toThrow(
        'Handler must implement isEnabled method'
      );
    });

    it('should register multiple handlers', () => {
      const handler1 = new MockHandler('handler1');
      const handler2 = new MockHandler('handler2');

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);

      expect(processor.getHandlerCount()).toBe(2);
      expect(processor.getHandler('handler1')).toBe(handler1);
      expect(processor.getHandler('handler2')).toBe(handler2);
    });

    it('should replace handler with same name', () => {
      const handler1 = new MockHandler('same-name');
      const handler2 = new MockHandler('same-name');

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);

      expect(processor.getHandlerCount()).toBe(1);
      expect(processor.getHandler('same-name')).toBe(handler2);
    });
  });

  describe('handler unregistration', () => {
    it('should unregister existing handler', () => {
      const handler = new MockHandler('test-handler');
      processor.registerHandler(handler);

      const result = processor.unregisterHandler('test-handler');

      expect(result).toBe(true);
      expect(processor.getHandlerCount()).toBe(0);
      expect(processor.getHandler('test-handler')).toBeUndefined();
    });

    it('should return false when unregistering non-existent handler', () => {
      const result = processor.unregisterHandler('non-existent');

      expect(result).toBe(false);
      expect(processor.getHandlerCount()).toBe(0);
    });
  });

  describe('handler retrieval', () => {
    it('should get all handlers', () => {
      const handler1 = new MockHandler('handler1');
      const handler2 = new MockHandler('handler2');

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);

      const handlers = processor.getHandlers();
      expect(handlers).toHaveLength(2);
      expect(handlers).toContain(handler1);
      expect(handlers).toContain(handler2);
    });

    it('should return empty array when no handlers registered', () => {
      const handlers = processor.getHandlers();
      expect(handlers).toHaveLength(0);
    });

    it('should get handler by name', () => {
      const handler = new MockHandler('test-handler');
      processor.registerHandler(handler);

      expect(processor.getHandler('test-handler')).toBe(handler);
      expect(processor.getHandler('non-existent')).toBeUndefined();
    });
  });

  describe('handler counting', () => {
    it('should count total handlers', () => {
      expect(processor.getHandlerCount()).toBe(0);

      processor.registerHandler(new MockHandler('handler1'));
      expect(processor.getHandlerCount()).toBe(1);

      processor.registerHandler(new MockHandler('handler2'));
      expect(processor.getHandlerCount()).toBe(2);
    });

    it('should count enabled handlers', () => {
      processor.registerHandler(new MockHandler('enabled1', true));
      processor.registerHandler(new MockHandler('disabled1', false));
      processor.registerHandler(new MockHandler('enabled2', true));

      expect(processor.getHandlerCount()).toBe(3);
      expect(processor.getEnabledHandlerCount()).toBe(2);
    });
  });

  describe('message processing', () => {
    it('should process message through enabled handlers', async () => {
      const handler1 = new MockHandler('handler1', true);
      const handler2 = new MockHandler('handler2', false);
      const handler3 = new MockHandler('handler3', true);

      processor.registerHandler(handler1);
      processor.registerHandler(handler2);
      processor.registerHandler(handler3);

      const message = {
        team: 'test-team',
        channel: 'general',
        user: 'testuser',
        text: 'test message',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      await processor.processMessage(message);

      expect(handler1.handleSpy).toHaveBeenCalledWith(message);
      expect(handler2.handleSpy).not.toHaveBeenCalled();
      expect(handler3.handleSpy).toHaveBeenCalledWith(message);
    });

    it('should handle errors in individual handlers gracefully', async () => {
      const goodHandler = new MockHandler('good-handler');
      const errorHandler = new ErrorHandler('error-handler');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      processor.registerHandler(goodHandler);
      processor.registerHandler(errorHandler);

      const message = {
        team: 'test-team',
        channel: 'general',
        user: 'testuser',
        text: 'test message',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      await processor.processMessage(message);

      expect(goodHandler.handleSpy).toHaveBeenCalledWith(message);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in handler error-handler:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('multiple message processing', () => {
    it('should process multiple messages in order', async () => {
      const handler = new MockHandler('test-handler');
      processor.registerHandler(handler);

      const messages = [
        {
          team: 'team1',
          channel: 'general',
          user: 'user1',
          text: 'message1',
          timestamp: '1234567890.123456',
          formattedTime: new Date('2023-01-01T10:00:00Z'),
        },
        {
          team: 'team2',
          channel: 'general',
          user: 'user2',
          text: 'message2',
          timestamp: '1234567891.123456',
          formattedTime: new Date('2023-01-01T10:01:00Z'),
        },
      ];

      await processor.processMessages(messages);

      expect(handler.handleSpy).toHaveBeenCalledTimes(2);
      expect(handler.handleSpy).toHaveBeenNthCalledWith(1, messages[0]);
      expect(handler.handleSpy).toHaveBeenNthCalledWith(2, messages[1]);
    });

    it('should throw error for non-array input', async () => {
      await expect(processor.processMessages('not-an-array')).rejects.toThrow(
        'Messages must be an array'
      );
    });
  });

  describe('timestamp sorting', () => {
    it('should sort messages by formattedTime', () => {
      const messages = [
        {
          text: 'second',
          timestamp: '1234567891.123456',
          formattedTime: new Date('2023-01-01T10:01:00Z'),
        },
        {
          text: 'first',
          timestamp: '1234567890.123456',
          formattedTime: new Date('2023-01-01T10:00:00Z'),
        },
        {
          text: 'third',
          timestamp: '1234567892.123456',
          formattedTime: new Date('2023-01-01T10:02:00Z'),
        },
      ];

      const sorted = processor.sortByTimestamp(messages);

      expect(sorted[0].text).toBe('first');
      expect(sorted[1].text).toBe('second');
      expect(sorted[2].text).toBe('third');
    });

    it('should sort messages by timestamp when formattedTime is not available', () => {
      const messages = [
        { text: 'second', timestamp: '1234567891.123456' },
        { text: 'first', timestamp: '1234567890.123456' },
        { text: 'third', timestamp: '1234567892.123456' },
      ];

      const sorted = processor.sortByTimestamp(messages);

      expect(sorted[0].text).toBe('first');
      expect(sorted[1].text).toBe('second');
      expect(sorted[2].text).toBe('third');
    });

    it('should handle empty array', () => {
      const sorted = processor.sortByTimestamp([]);
      expect(sorted).toEqual([]);
    });

    it('should handle non-array input', () => {
      const sorted = processor.sortByTimestamp('not-an-array');
      expect(sorted).toEqual([]);
    });

    it('should not modify original array', () => {
      const messages = [
        { text: 'second', timestamp: '1234567891.123456' },
        { text: 'first', timestamp: '1234567890.123456' },
      ];
      const originalOrder = [...messages];

      processor.sortByTimestamp(messages);

      expect(messages).toEqual(originalOrder);
    });
  });

  describe('handler management', () => {
    it('should clear all handlers', () => {
      processor.registerHandler(new MockHandler('handler1'));
      processor.registerHandler(new MockHandler('handler2'));

      expect(processor.getHandlerCount()).toBe(2);

      processor.clearHandlers();

      expect(processor.getHandlerCount()).toBe(0);
      expect(processor.getHandlers()).toHaveLength(0);
    });
  });
});
