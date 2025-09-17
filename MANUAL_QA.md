# Slagg マニュアルQA手順書

このドキュメントは、Slagg（Slack Aggregator CLI）を実際のSlack環境でテストするための手順書です。

## 前提条件

- Node.js 20.x以上がインストールされていること
- Slackワークスペースの管理者権限があること（アプリを作成するため）
- 複数のSlackワークスペースにアクセスできること（マルチチーム機能をテストするため）

## 1. Slackアプリの作成とトークン取得

### 1.1 Slackアプリの作成

1. [Slack API](https://api.slack.com/apps) にアクセス
2. 「Create New App」をクリック
3. 「From scratch」を選択
4. アプリ名を入力（例：「Slagg Test App」）
5. 開発用ワークスペースを選択
6. 「Create App」をクリック

**参考URL**: https://api.slack.com/start/quickstart

### 1.2 Socket Modeの有効化

1. 作成したアプリの設定画面で「Socket Mode」を選択
2. 「Enable Socket Mode」をオンにする
3. App-Level Tokenの名前を入力（例：「slagg-token」）
4. 以下のスコープを追加：
   - `connections:write`
5. 「Generate」をクリック
6. **生成されたApp-Level Token（xapp-1-で始まる）を保存**

### 1.3 OAuth & Permissionsの設定

1. 「OAuth & Permissions」を選択
2. 「Scopes」セクションで「Bot Token Scopes」に以下を追加：
   - `channels:history` - パブリックチャンネルのメッセージ履歴を読む
   - `channels:read` - パブリックチャンネル情報を読む
   - `groups:history` - プライベートチャンネルのメッセージ履歴を読む
   - `groups:read` - プライベートチャンネル情報を読む
   - `im:history` - ダイレクトメッセージの履歴を読む
   - `im:read` - ダイレクトメッセージ情報を読む
   - `mpim:history` - グループダイレクトメッセージの履歴を読む
   - `mpim:read` - グループダイレクトメッセージ情報を読む

**参考URL**: https://api.slack.com/scopes

### 1.4 Event Subscriptionsの設定

1. 「Event Subscriptions」を選択
2. 「Enable Events」をオンにする
3. 「Subscribe to bot events」で以下のイベントを追加：
   - `message.channels` - パブリックチャンネルのメッセージ
   - `message.groups` - プライベートチャンネルのメッセージ
   - `message.im` - ダイレクトメッセージ
   - `message.mpim` - グループダイレクトメッセージ

### 1.5 アプリのインストール

1. 「Install App」を選択
2. 「Install to Workspace」をクリック
3. 権限を確認して「Allow」をクリック
4. **Bot User OAuth Token（xoxb-で始まる）を保存**

**参考URL**: https://api.slack.com/authentication/basics

## 2. チャンネルIDの取得

### 2.1 Webブラウザでの取得方法

1. Slackをブラウザで開く
2. テスト対象のチャンネルを開く
3. URLを確認：`https://app.slack.com/client/TXXXXXXXX/CXXXXXXXXX`
4. 最後の「CXXXXXXXXX」部分がチャンネルID

### 2.2 Slack APIでの取得方法

```bash
curl -H "Authorization: Bearer xoxb-your-bot-token" \
  https://slack.com/api/conversations.list
```

**参考URL**: https://api.slack.com/methods/conversations.list

## 3. 設定ファイルの作成

### 3.1 .env.jsonファイルの作成

プロジェクトルートに`.env.json`ファイルを作成：

```json
{
  "teams": {
    "test-team-1": {
      "appToken": "xapp-1-your-app-level-token-1",
      "botToken": "xoxb-your-bot-token-1",
      "channels": ["C1234567890", "C0987654321"]
    },
    "test-team-2": {
      "appToken": "xapp-1-your-app-level-token-2",
      "botToken": "xoxb-your-bot-token-2", 
      "channels": ["C1111111111"]
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

**注意**: 
- `appToken`にはApp-Level Token（xapp-1-で始まる）を使用
- `botToken`にはBot User OAuth Token（xoxb-で始まる）を使用
- `channels`には実際のチャンネルIDを設定
- 複数チームをテストする場合は、各チームでアプリを作成して両方のトークンを取得

## 4. アプリケーションのビルドと実行

### 4.1 依存関係のインストール

```bash
npm install
```

### 4.2 アプリケーションの実行

```bash
node src/main.js
```

または、グローバルインストール後：

```bash
npm install -g .
slagg
```

## 5. マニュアルテスト手順

### 5.1 起動テスト

**作業内容**: アプリケーションを起動する

**実行コマンド**:
```bash
node src/main.js
```

**期待結果**:
- STDERRに接続状況が表示される
- エラーなく起動する
- 設定したチーム数分の接続メッセージが表示される

**確認例**:
```
[INFO] Connecting to teams...
[INFO] Connected to team: test-team-1 (2 channels)
[INFO] Connected to team: test-team-2 (1 channels)
[INFO] All teams connected. Monitoring started.
```

### 5.2 メッセージ受信テスト

**作業内容**: 設定したチャンネルにメッセージを投稿する

**実行手順**:
1. Slackで設定したチャンネルを開く
2. テストメッセージを投稿（例：「Hello from manual test」）

**期待結果**:
- STDOUTにメッセージが表示される
- フォーマットが「{team}/{channel}/{user} > {message}」になっている
- リアルタイムで表示される（数秒以内）

**確認例**:
```
test-team-1/general/testuser > Hello from manual test
```

### 5.3 複数チャンネルテスト

**作業内容**: 異なるチャンネルに同時にメッセージを投稿する

**実行手順**:
1. チャンネルAにメッセージを投稿
2. すぐにチャンネルBにメッセージを投稿
3. 異なるチームのチャンネルにもメッセージを投稿

**期待結果**:
- 全てのメッセージが時系列順に表示される
- チーム名とチャンネル名が正しく表示される
- メッセージの順序がSlackのタイムスタンプに基づいている

### 5.4 改行を含むメッセージテスト

**作業内容**: 改行を含むメッセージを投稿する

**実行手順**:
1. Slackで以下のような複数行メッセージを投稿：
```
Line 1
Line 2
Line 3
```

**期待結果**:
- 改行が空白文字に置換されて1行で表示される
- メッセージ内容が正しく表示される

**確認例**:
```
test-team-1/general/testuser > Line 1 Line 2 Line 3
```

### 5.5 エラーハンドリングテスト

#### 5.5.1 無効なトークンテスト

**作業内容**: 無効なトークンを設定してアプリケーションを起動する

**実行手順**:
1. `.env.json`の一つのトークンを無効な値に変更
2. アプリケーションを起動

**期待結果**:
- STDERRにエラーメッセージが表示される
- 有効なトークンのチームは正常に接続される
- アプリケーションは継続して動作する

**確認例**:
```
[ERROR] Team: invalid-team, Error: Invalid token
[INFO] Connected to team: test-team-1 (2 channels)
```

#### 5.5.2 無効なチャンネルIDテスト

**作業内容**: 存在しないチャンネルIDを設定する

**実行手順**:
1. `.env.json`に存在しないチャンネルIDを追加
2. アプリケーションを起動

**期待結果**:
- STDERRに警告メッセージが表示される
- 有効なチャンネルは正常に監視される
- アプリケーションは継続して動作する

**確認例**:
```
[WARN] Channel: C9999999999 skipped due to access error
```

### 5.6 シャットダウンテスト

**作業内容**: アプリケーションを正常終了する

**実行手順**:
1. アプリケーション実行中にCtrl+Cを押す

**期待結果**:
- STDERRにシャットダウンメッセージが表示される
- 全ての接続が適切に終了される
- プロセスが正常に終了する

**確認例**:
```
[INFO] Shutting down...
[INFO] All connections closed.
```

### 5.7 パイプ・リダイレクトテスト

**作業内容**: 出力をパイプやリダイレクトで処理する

**実行手順**:
```bash
# ファイルへのリダイレクト
node src/main.js > messages.log 2> errors.log

# grepでのフィルタリング
node src/main.js | grep "specific-user"

# wcでの行数カウント
node src/main.js | wc -l
```

**期待結果**:
- STDOUTとSTDERRが適切に分離される
- パイプ処理が正常に動作する
- エスケープシーケンスが出力に含まれない

## 6. トラブルシューティング

### 6.1 接続エラー

**症状**: 「Connection failed」エラーが発生する

**確認事項**:
- App-Level Tokenが正しく設定されているか
- Socket Modeが有効になっているか
- ネットワーク接続が正常か

### 6.2 メッセージが表示されない

**症状**: メッセージを投稿してもCLIに表示されない

**確認事項**:
- チャンネルIDが正しいか
- ボットがチャンネルに追加されているか
- Event Subscriptionsが正しく設定されているか

### 6.3 権限エラー

**症状**: 「Permission denied」エラーが発生する

**確認事項**:
- 必要なBot Token Scopesが設定されているか
- アプリがワークスペースにインストールされているか
- ボットがプライベートチャンネルに招待されているか

## 7. テスト完了チェックリスト

- [ ] Slackアプリが正常に作成できた
- [ ] App-Level Tokenが取得できた
- [ ] 必要なスコープが設定できた
- [ ] .env.jsonファイルが正しく作成できた
- [ ] アプリケーションが正常に起動する
- [ ] メッセージがリアルタイムで表示される
- [ ] 複数チャンネルのメッセージが時系列順に表示される
- [ ] 改行を含むメッセージが正しく処理される
- [ ] エラーハンドリングが適切に動作する
- [ ] シャットダウンが正常に動作する
- [ ] パイプ・リダイレクトが正常に動作する

## 8. 参考リンク

- [Slack API Documentation](https://api.slack.com/)
- [Socket Mode Guide](https://api.slack.com/apis/connections/socket)
- [Bot Token Scopes](https://api.slack.com/scopes)
- [Event Subscriptions](https://api.slack.com/events-api)
- [Slack App Management](https://api.slack.com/apps)
