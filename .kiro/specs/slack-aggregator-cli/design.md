# 設計文書

## 概要

Slagg（Slack Aggregator）は、複数のSlackチームからリアルタイムでメッセージを集約し、統合されたタイムラインとして表示するNode.js CLIアプリケーションです。Slack Socket APIを使用してリアルタイム通信を実現し、モジュラーアーキテクチャにより将来の機能拡張を容易にします。

## アーキテクチャ

### 全体アーキテクチャ

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CLI Entry     │───▶│  Configuration   │───▶│  Team Manager   │
│   (main.js)     │    │   Manager        │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                          │
                                                          ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   Message        │◀───│  Slack Client   │
                       │   Processor      │    │   (per team)    │
                       └──────────────────┘    └─────────────────┘
                                 │                       │
                                 ▼                       ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Message Handler │    │  Socket API     │
                       │   (Interface)    │    │  Connection     │
                       └──────────────────┘    └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
          ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
          │  Console    │ │Notification │ │   Speech    │
          │  Output     │ │  Handler    │ │  Handler    │
          │  Handler    │ │             │ │             │
          └─────────────┘ └─────────────┘ └─────────────┘
```

### レイヤー構造

1. **エントリーポイント層**: CLI起動とアプリケーション初期化
2. **設定管理層**: 環境変数とチーム設定の管理
3. **チーム管理層**: 複数チームの接続とライフサイクル管理
4. **通信層**: Slack Socket APIとの通信
5. **メッセージ処理層**: メッセージの受信、変換、フォーマット
6. **出力層**: コンソールへの統合出力

## コンポーネントと インターフェース

### 1. Configuration Manager

**責任**: 設定ファイルの読み込みと検証

```javascript
export class ConfigurationManager {
  loadConfig()           // .env.jsonファイルから設定を読み込み
  validateConfig()       // 設定の形式とトークンの検証
  getTeamConfigs()       // チーム設定の取得
  getChannelIds(team)    // 指定チームのチャンネルID取得
}
```

**設定形式（.env.json）**:
```json
{
  "teams": {
    "mycompany": {
      "token": "xapp-1-xxxxx",
      "channels": ["C1234567890", "C0987654321"]
    },
    "clientteam": {
      "token": "xapp-1-yyyyy", 
      "channels": ["C1111111111"]
    },
    "opensource": {
      "token": "xapp-1-zzzzz",
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
  }
}
```

### 2. Team Manager

**責任**: 複数チームの管理と調整

```javascript
export class TeamManager {
  initialize()           // 全チームの初期化
  connectAllTeams()      // 全チーム接続開始
  handleTeamError()      // チーム固有エラー処理
  shutdown()             // 全チーム接続終了
}
```

### 3. Slack Client

**責任**: 個別チームのSocket API接続

```javascript
export class SlackClient {
  constructor(token, teamName, channelIds)
  connect()              // Socket接続開始
  subscribeToChannels()  // チャンネル購読
  handleMessage()        // メッセージイベント処理
  reconnect()            // 自動再接続
  disconnect()           // 接続終了
}
```

### 4. Message Processor

**責任**: メッセージの統合処理とハンドラー管理

```javascript
export class MessageProcessor {
  constructor()
  registerHandler()      // メッセージハンドラーの登録
  unregisterHandler()    // メッセージハンドラーの削除
  processMessage()       // メッセージ処理とハンドラー実行
  sortByTimestamp()      // タイムスタンプソート
}
```

### 5. Message Handler Interface

**責任**: メッセージハンドラーの共通インターフェース

```javascript
export class MessageHandler {
  async handle(message)  // メッセージ処理（抽象メソッド）
  getName()              // ハンドラー名の取得
  isEnabled()            // ハンドラーの有効/無効状態
}
```

### 6. Built-in Message Handlers

**責任**: 標準的なメッセージ処理機能

```javascript
export class ConsoleOutputHandler extends MessageHandler {
  async handle(message)  // コンソール出力処理
  formatForOutput()      // 出力形式への変換（STDOUT）
  sanitizeText()         // テキストサニタイズ
  replaceNewlines()      // 改行置換
}

export class NotificationHandler extends MessageHandler {
  async handle(message)  // 通知処理（将来実装）
}

export class SpeechHandler extends MessageHandler {
  async handle(message)  // 読み上げ処理（将来実装）
}
```

### 7. Logger

**責任**: ログ出力の管理

```javascript
export class Logger {
  info(message)          // 情報ログ（STDERR）
  warn(message)          // 警告ログ（STDERR）
  error(message)         // エラーログ（STDERR）
}
```

## データモデル

### Team Configuration
```javascript
{
  name: string,           // チーム名（設定で指定した名前）
  token: string,          // App-Level Token
  channelIds: string[],   // 監視対象チャンネルID
  client: SlackClient     // Socket接続クライアント
}
```

### Configuration File
- `.env.json` ファイル（JSON形式）のみをサポート
- カレントディレクトリから読み込み

### Message Object
```javascript
{
  team: string,           // チーム名
  channel: string,        // チャンネル名
  channelId: string,      // チャンネルID
  user: string,           // ユーザー名
  text: string,           // メッセージ内容
  timestamp: string,      // Slackタイムスタンプ
  formattedTime: Date     // JavaScript Date オブジェクト
}
```

## エラーハンドリング

### エラー分類と対応

1. **設定エラー**
   - 無効なトークン: エラーログ出力、該当チームをスキップ
   - 設定ファイル不存在: エラーメッセージ表示、アプリ終了

2. **接続エラー**
   - Socket接続失敗: エラーログ出力、自動再接続試行
   - 認証エラー: エラーログ出力、該当チームを無効化

3. **チャンネルエラー**
   - 無効なチャンネルID: エラーログ出力、該当チャンネルをスキップ
   - アクセス権限なし: エラーログ出力、該当チャンネルをスキップ

4. **メッセージ処理エラー**
   - フォーマットエラー: エラーログ出力、メッセージをスキップ
   - 出力エラー: エラーログ出力、処理継続

### エラー出力形式（STDERR）
```
[ERROR] Team: team-name, Error: error-message
[WARN] Channel: channel-id skipped due to access error
```

## コード品質管理

### Biome設定
- Linting: コード品質チェック
- Formatting: 一貫したコードスタイル
- Import sorting: インポート文の整理
- ES2022+ 対応

### 開発ワークフロー
```bash
npm run lint      # コード品質チェック
npm run format    # コードフォーマット
npm run check     # lint + format の統合チェック
```

## テスト戦略

### 単体テスト
- Configuration Manager: 設定読み込みと検証
- Message Formatter: フォーマット変換とサニタイズ
- Message Processor: メッセージ処理とソート

### 統合テスト
- Slack Client: Socket API接続とメッセージ受信
- Team Manager: 複数チーム管理
- エンドツーエンド: 設定から出力までの全体フロー

### モックテスト
- Slack API レスポンスのモック
- Socket接続のモック
- エラーシナリオのシミュレーション

## 技術仕様

### 依存関係
```json
{
  "name": "slagg",
  "type": "module",
  "bin": {
    "slagg": "./src/main.js"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "lint": "biome lint src/",
    "format": "biome format --write src/",
    "check": "biome check src/"
  },
  "dependencies": {
    "@slack/socket-mode": "^2.0.0",
    "@slack/web-api": "^7.0.0",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.8.0"
  }
}
```

### Node.js要件
- Node.js 20.x以上（22.x LTS推奨）
- ES Modules使用（package.jsonで"type": "module"を指定）
- import/export構文を使用
- グローバルインストール対応（npm install -g slagg）
- CLIコマンド実行（slaggコマンド）

### ファイル構造
```
├── package.json            # パッケージ設定（binエントリ含む）
├── biome.json             # Biome設定ファイル
├── .env.json.example      # 設定ファイルのサンプル
└── src/
    ├── main.js            # エントリーポイント（#!/usr/bin/env node）
    ├── config/
    │   └── ConfigurationManager.js
    ├── team/
    │   ├── TeamManager.js
    │   └── SlackClient.js
    ├── message/
    │   ├── MessageProcessor.js
    │   ├── MessageHandler.js
    │   └── handlers/
    │       ├── ConsoleOutputHandler.js
    │       ├── NotificationHandler.js
    │       └── SpeechHandler.js
    └── utils/
        └── Logger.js
```

### 出力仕様

### インストールと実行

**インストール**:
```bash
npm install -g slagg
```

**実行**:
```bash
slagg  # カレントディレクトリの.env.jsonファイルを読み込み
```

**起動時出力（STDERR）**:
```
[INFO] Connecting to teams...
[INFO] Connected to team: team-name (2 channels)
[INFO] All teams connected. Monitoring started.
```

**メッセージ出力（STDOUT）**:
```
team-name/general/username > Hello world this is a test message
team-name/random/another-user > Multi line message becomes single line
```

**エラー出力（STDERR）**:
```
[ERROR] Team: invalid-team, Error: Invalid token
[WARN] Channel: C1234567890 skipped due to access error
```

**シャットダウン出力（STDERR）**:
```
[INFO] Shutting down...
[INFO] All connections closed.
```
