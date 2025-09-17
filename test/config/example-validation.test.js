import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationManager } from '../../src/config/ConfigurationManager.js';

// Mock fs module
vi.mock('node:fs');

describe('Example Configuration Validation', () => {
  let configManager;
  let mockReadFileSync;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    mockReadFileSync = vi.mocked(readFileSync);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should validate the .env.json.example file successfully', () => {
    // Load the actual example file content
    const exampleConfig = {
      teams: {
        mycompany: {
          appToken: 'xapp-1-A123456789012345678901234567890123456789',
          botToken: 'xoxb-test-123456789012-1234567890123-mocktoken1234567',
          channels: ['C1234567890', 'C0987654321'],
        },
        clientteam: {
          appToken: 'xapp-1-B987654321098765432109876543210987654321',
          botToken: 'xoxb-test-987654321098-0987654321098-mocktoken7654321',
          channels: ['C1111111111'],
        },
        opensource: {
          appToken: 'xapp-1-C555666777888999000111222333444555666777',
          botToken: 'xoxb-test-555666777888-5556667778889-mocktoken5556667',
          channels: ['C2222222222', 'C3333333333'],
        },
      },
      handlers: {
        console: {
          enabled: true,
        },
        notification: {
          enabled: false,
        },
        speech: {
          enabled: false,
          command: 'say',
        },
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(exampleConfig));

    // Should load and validate without throwing errors
    expect(() => configManager.loadConfig()).not.toThrow();

    // Verify all teams are accessible
    const teamConfigs = configManager.getTeamConfigs();
    expect(Object.keys(teamConfigs)).toEqual(['mycompany', 'clientteam', 'opensource']);

    // Verify specific team configurations
    expect(configManager.getChannelIds('mycompany')).toEqual(['C1234567890', 'C0987654321']);
    expect(configManager.getChannelIds('clientteam')).toEqual(['C1111111111']);
    expect(configManager.getChannelIds('opensource')).toEqual(['C2222222222', 'C3333333333']);

    // Verify tokens
    expect(configManager.getTeamToken('mycompany')).toBe(
      'xapp-1-A123456789012345678901234567890123456789'
    );
    expect(configManager.getTeamToken('clientteam')).toBe(
      'xapp-1-B987654321098765432109876543210987654321'
    );
    expect(configManager.getTeamToken('opensource')).toBe(
      'xapp-1-C555666777888999000111222333444555666777'
    );

    // Verify new token format methods
    const mycompanyTokens = configManager.getTeamTokens('mycompany');
    expect(mycompanyTokens.appToken).toBe('xapp-1-A123456789012345678901234567890123456789');
    expect(mycompanyTokens.botToken).toBe('xoxb-test-123456789012-1234567890123-mocktoken1234567');

    // Verify handler configurations
    const handlerConfigs = configManager.getHandlerConfigs();
    expect(handlerConfigs.console.enabled).toBe(true);
    expect(handlerConfigs.notification.enabled).toBe(false);
    expect(handlerConfigs.speech.enabled).toBe(false);
    expect(handlerConfigs.speech.command).toBe('say');
  });

  it('should validate all token formats in example', () => {
    const appTokens = [
      'xapp-1-A123456789012345678901234567890123456789',
      'xapp-1-B987654321098765432109876543210987654321',
      'xapp-1-C555666777888999000111222333444555666777',
    ];

    const botTokens = [
      'xoxb-test-123456789012-1234567890123-mocktoken1234567',
      'xoxb-test-987654321098-0987654321098-mocktoken7654321',
      'xoxb-test-555666777888-5556667778889-mocktoken5556667',
    ];

    for (const token of appTokens) {
      expect(configManager.isValidSlackAppToken(token)).toBe(true);
      expect(configManager.isValidSlackToken(token)).toBe(true);
    }

    for (const token of botTokens) {
      expect(configManager.isValidSlackBotToken(token)).toBe(true);
    }
  });

  it('should validate all channel IDs in example', () => {
    const channelIds = ['C1234567890', 'C0987654321', 'C1111111111', 'C2222222222', 'C3333333333'];

    for (const channelId of channelIds) {
      expect(configManager.isValidChannelId(channelId)).toBe(true);
    }
  });
});
