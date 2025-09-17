Slagg (Slack Aggregator)
========================

A CLI tool that aggregates multiple Slack teams and channels into one timeline.

## feature

このCLIアプリケーションは

- 複数のSlack Team、そしてそれらのChannelを横断してチャットの履歴を出力します
- SlackのSocket APIを利用し、リアルタイム性に優れます
- 特定のキーワード（正規表現を利用可能）を見つけた場合、ハイライトをおこない、Notificationの設定を実行します

## 技術的仕様

- node.jsで動作します
- SlackのApplicationとして、Tokenを取得する必要があります
- SlackのApplicationとして、TeamやChannelに登録する必要があります
