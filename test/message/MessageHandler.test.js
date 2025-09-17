import { describe, expect, it } from 'vitest';
import { MessageHandler } from '../../src/message/MessageHandler.js';

describe('MessageHandler', () => {
  describe('interface verification', () => {
    it('should throw error when handle method is not implemented', async () => {
      const handler = new MessageHandler();
      const message = {
        team: 'test-team',
        channel: 'test-channel',
        channelId: 'C1234567890',
        user: 'test-user',
        text: 'test message',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      await expect(handler.handle(message)).rejects.toThrow(
        'handle method must be implemented by subclass'
      );
    });

    it('should throw error when getName method is not implemented', () => {
      const handler = new MessageHandler();

      expect(() => handler.getName()).toThrow('getName method must be implemented by subclass');
    });

    it('should throw error when isEnabled method is not implemented', () => {
      const handler = new MessageHandler();

      expect(() => handler.isEnabled()).toThrow('isEnabled method must be implemented by subclass');
    });
  });

  describe('subclass implementation', () => {
    class TestHandler extends MessageHandler {
      async handle(message) {
        return `Handled: ${message.text}`;
      }

      getName() {
        return 'TestHandler';
      }

      isEnabled() {
        return true;
      }
    }

    it('should allow proper subclass implementation', async () => {
      const handler = new TestHandler();
      const message = {
        team: 'test-team',
        channel: 'test-channel',
        channelId: 'C1234567890',
        user: 'test-user',
        text: 'test message',
        timestamp: '1234567890.123456',
        formattedTime: new Date(),
      };

      const result = await handler.handle(message);
      expect(result).toBe('Handled: test message');
      expect(handler.getName()).toBe('TestHandler');
      expect(handler.isEnabled()).toBe(true);
    });
  });
});
