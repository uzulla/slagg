# Slagg (Slack Aggregator)

A CLI tool that aggregates multiple Slack teams and channels into a unified real-time timeline.

## Overview

Slagg is a Node.js CLI application that connects to multiple Slack teams simultaneously and displays messages from specified channels in a unified, chronologically-sorted timeline. Using Slack's Socket Mode API, it provides real-time message streaming without polling delays.

## Features

- **Multi-team support**: Connect to multiple Slack teams simultaneously using different tokens
- **Real-time streaming**: Uses Slack Socket Mode API for instant message delivery
- **Channel-specific monitoring**: Configure specific channels to monitor for each team
- **Unified timeline**: Messages from all teams are displayed in chronological order
- **Message highlighting**: Highlight messages containing specific keywords with red bold text
- **Clean output format**: Structured output suitable for piping to other tools
- **Automatic reconnection**: Handles connection failures with automatic retry
- **Modular architecture**: Extensible design for future features

## Installation

Install Slagg globally using npm:

```bash
npm install -g slagg
```

### Requirements

- Node.js 20.0.0 or higher
- Valid Slack App tokens with Socket Mode enabled

## Configuration

### 1. Create Configuration File

Create a `.env.json` file in your working directory:

```bash
cp .env.json.example .env.json
```

### 2. Configure Slack Teams

Edit `.env.json` with your team configurations:

```json
{
  "teams": {
    "mycompany": {
      "appToken": "xapp-1-YOUR_APP_TOKEN",
      "botToken": "xoxb-YOUR_BOT_TOKEN",
      "channels": ["C1234567890", "C0987654321"]
    },
    "clientteam": {
      "appToken": "xapp-1-YOUR_APP_TOKEN",
      "botToken": "xoxb-YOUR_BOT_TOKEN",
      "channels": ["C1111111111"]
    },
    "opensource": {
      "appToken": "xapp-1-YOUR_APP_TOKEN",
      "botToken": "xoxb-YOUR_BOT_TOKEN",
      "channels": ["C2222222222", "C3333333333"]
    }
  },
  "handlers": {
    "console": {
      "enabled": true
    },
    "notification": {
      "enabled": false
    },
    "speech": {
      "enabled": false,
      "command": "say"
    }
  },
  "highlight": {
    "keywords": [
      "/(urgent|emergency)/i",
      "/error/i",
      "/@channel/i"
    ]
  }
}
```

### Configuration Fields

- **teams**: Object containing team configurations
  - **team-name**: Custom name for the team (used in output)
    - **appToken**: Slack App-Level Token (starts with `xapp-1-`)
    - **botToken**: Slack Bot User OAuth Token (starts with `xoxb-`)
    - **channels**: Array of channel IDs to monitor
- **handlers**: Message handler configurations
  - **console**: Console output handler (always enabled)
  - **notification**: Desktop notifications (future feature)
  - **speech**: Text-to-speech (future feature)
- **highlight**: Message highlighting configuration (optional)
  - **keywords**: Array of regular expression patterns in "/pattern/flags" format

### Getting Slack Tokens and Channel IDs

1. **Create a Slack App**: Visit [Slack API](https://api.slack.com/apps) and create a new app
2. **Enable Socket Mode**: In your app settings, enable Socket Mode and generate an App-Level Token (`xapp-1-...`)
3. **Add Bot Scopes**: Add required OAuth scopes:
   - `channels:read`
   - `channels:history`
   - `groups:read`
   - `groups:history`
   - `im:read`
   - `im:history`
   - `mpim:read`
   - `mpim:history`
4. **Install to Workspace**: Install the app to your Slack workspace and get the Bot User OAuth Token (`xoxb-...`)
5. **Get Channel IDs**: Right-click on channels in Slack and copy the channel ID from the URL

### Message Highlighting

Slagg supports highlighting messages that match specific keywords using regular expressions. Messages containing matching keywords are displayed in red bold text for better visibility.

#### Configuration

Add a `highlight` section to your `.env.json` file:

```json
{
  "highlight": {
    "keywords": [
      "/(urgent|emergency)/i",
      "/error/i",
      "/@channel/i",
      "/production/i"
    ]
  }
}
```

#### Keyword Format

Keywords must be specified as regular expression strings in the format `"/pattern/flags"`:

- **Pattern**: The regular expression pattern to match
- **Flags**: Optional regex flags (i = case insensitive, g = global, etc.)

**Examples:**
- `"/error/i"` - Matches "error", "Error", "ERROR" (case insensitive)
- `"/(urgent|emergency)/i"` - Matches "urgent" or "emergency" (case insensitive)
- `"/@channel/"` - Matches "@channel" mentions
- `"/\\b(bug|issue)\\b/i"` - Matches whole words "bug" or "issue"

#### Behavior

- Messages matching any keyword are displayed in red bold text
- If no `highlight` section is configured, all messages display normally
- Invalid regular expressions are logged as errors and skipped
- Highlighting works with all message types and channels

## Usage

### Basic Usage

Run Slagg from the directory containing your `.env.json` file:

```bash
slagg
```

### Output Format

Slagg outputs messages in the following format:

```
team-name/channel-name/username > message content
```

**Example output:**
```
mycompany/general/john.doe > Hello everyone, how's the project going?
clientteam/support/jane.smith > We've resolved the issue with the API
opensource/development/contributor > Just pushed a fix for the memory leak
```

### Startup Information

When starting, Slagg displays connection status on stderr:

```
[INFO] Connecting to teams...
[INFO] Connected to team: mycompany (2 channels)
[INFO] Connected to team: clientteam (1 channels)
[INFO] All teams connected. Monitoring started.
```

### Graceful Shutdown

Stop Slagg with `Ctrl+C`. It will gracefully close all connections:

```
[INFO] Shutting down...
[INFO] All connections closed.
```

## Output Streams

- **STDOUT**: Message content (suitable for piping)
- **STDERR**: Status information, errors, and logs

This separation allows you to pipe messages to other tools while still seeing status information:

```bash
slagg | grep "urgent" | tee urgent-messages.log
```

## Troubleshooting

### Common Issues

#### "Invalid token" Error
```
[ERROR] Team: mycompany, Error: Invalid token
```
**Solution**: Verify both your App-Level Token (`xapp-1-...`) and Bot User OAuth Token (`xoxb-...`) are correct

#### "Channel access denied" Warning
```
[WARN] Channel: C1234567890 skipped due to access error
```
**Solution**: Ensure your Slack app is added to the channel and has proper permissions

#### Connection Failures
```
[ERROR] Team: mycompany, Error: Connection failed
```
**Solution**: Check your internet connection and Slack service status. Slagg will automatically retry.

#### Configuration File Not Found
```
[ERROR] Configuration file .env.json not found
```
**Solution**: Create `.env.json` in your current directory using the example format

### Debug Information

For connection issues:
1. Verify you have both required tokens:
   - App-Level Token (`xapp-1-...`) for Socket Mode connection
   - Bot User OAuth Token (`xoxb-...`) for API calls
2. Ensure Socket Mode is enabled in your Slack app
3. Check that your app has the required OAuth scopes
4. Verify channel IDs are correct (11-character strings starting with 'C')

### Token Requirements

- **App-Level Token** (format: `xapp-1-...`) - Required for Socket Mode connection
- **Bot User OAuth Token** (format: `xoxb-...`) - Required for API calls and user information
- Socket Mode must be enabled in your Slack app settings

### Channel ID Format

- Channel IDs are 11-character strings starting with 'C'
- Example: `C1234567890`
- Get them from Slack by right-clicking channels and copying the link

## Development

### Running from Source

```bash
git clone <repository>
cd slagg
npm install
npm start
```

### Testing

```bash
npm test        # Run all tests with linting
npm run test:watch  # Watch mode for development
```

### Code Quality

```bash
npm run lint    # Check code quality
npm run format  # Format code
npm run check   # Lint and format
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Junichi Ishida aka uzulla <zishida@gmail.com>
