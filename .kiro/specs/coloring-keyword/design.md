# 設計書

## 概要

設定ファイルにキーワード（正規表現）を配列として登録し、ログメッセージ出力時にそれらのキーワードにマッチするメッセージを赤太文字でハイライト表示する機能を実装する。既存のConsoleOutputHandlerを拡張し、設定ファイルからキーワードを読み込んでハイライト処理を行う。

## アーキテクチャ

### 全体構成

```
ConfigurationManager
    ↓ (設定読み込み)
HighlightConfig
    ↓ (キーワード提供)
ConsoleOutputHandler
    ↓ (ハイライト処理)
chalk (赤太文字出力)
```

### 処理フロー

1. アプリケーション起動時にConfigurationManagerが設定ファイル（.env.json）を読み込む
2. HighlightConfigクラスがキーワード配列を管理
3. ConsoleOutputHandlerがメッセージ出力時にキーワードマッチングを実行
4. マッチした場合、chalkライブラリを使用して赤太文字でメッセージを出力

## コンポーネントと インターフェース

### 1. HighlightConfig クラス

**責任:** キーワード設定の管理と正規表現マッチング

**メソッド:**
- `constructor(keywords = [])` - キーワード配列で初期化
- `addKeyword(pattern)` - キーワード（正規表現文字列）を追加
- `removeKeyword(pattern)` - キーワードを削除
- `matchesAny(text)` - テキストがいずれかのキーワードにマッチするかチェック
- `getKeywords()` - 設定されているキーワード一覧を取得
- `parseRegexString(regexStr)` - "/pattern/flags"形式の文字列を正規表現オブジェクトに変換

**プロパティ:**
- `keywords` - 正規表現パターンの配列
- `compiledRegexes` - コンパイル済み正規表現オブジェクトの配列

### 2. ConsoleOutputHandler 拡張

**既存機能の拡張:**
- `formatForOutput(message)` メソッドにハイライト処理を追加
- HighlightConfigインスタンスを保持
- メッセージテキストのマッチング判定とchalkによる色付け

**新規メソッド:**
- `applyHighlight(formattedMessage, originalText)` - ハイライト適用処理

### 3. ConfigurationManager 拡張

**既存機能の拡張:**
- `.env.json`の`highlight`セクション読み込み対応
- `getHighlightConfig()` メソッド追加

## データモデル

### 設定ファイル構造（.env.json）

```json
{
  "teams": {
    // 既存のteams設定
  },
  "handlers": {
    // 既存のhandlers設定
  },
  "highlight": {
    "keywords": [
      "/(uzulla|uzura)/i",
      "/@?uzulla/i",
      "/php/i"
    ]
  }
}
```

**サポートする形式:**
- **正規表現リテラル形式**: `"/pattern/flags"` (例: `"/php/i"`, `"/error/gi"`)

### HighlightConfig データ構造

```javascript
{
  keywords: [
    "/(uzulla|uzura)/i",
    "/@?uzulla/i", 
    "/php/i"
  ],
}
```

## エラーハンドリング

### 設定ファイル関連

1. **highlight セクションが存在しない場合**
   - デフォルトで空のキーワード配列を使用
   - ハイライト機能は無効状態

2. **keywords が配列でない場合**
   - エラーを出力して、終了

3. **無効な正規表現が含まれる場合**
   - 無効な正規表現のエラーログを出力して、終了

### ハイライト処理関連

1. **正規表現マッチング エラー**
   - エラーログを出力
   - アプリケーション終了

2. **chalk ライブラリ エラー**
   - エラーログを出力
   - アプリケーション終了

## テスト戦略

### 単体テスト

1. **HighlightConfig クラス**
   - キーワード追加・削除機能
   - 正規表現マッチング機能
   - 無効な正規表現の処理

2. **ConsoleOutputHandler 拡張**
   - ハイライト適用処理
   - マッチしない場合の通常出力
   - エラー時のフォールバック

3. **ConfigurationManager 拡張**
   - highlight セクションの読み込み
   - 設定検証機能

### 統合テスト

1. **設定ファイル読み込みからハイライト出力まで**
   - 正常なキーワードマッチング
   - 複数キーワードのマッチング
   - 設定なしでの動作

2. **エラーケース**
   - 無効な設定での動作
   - 正規表現エラー時の動作

### 手動テスト

1. **実際のSlackメッセージでのハイライト確認**
2. **設定変更後の再起動での反映確認**
3. **パフォーマンス確認（大量メッセージ時）**

## 実装の詳細

### ファイル構成

```
src/
├── config/
│   ├── ConfigurationManager.js (拡張)
│   └── HighlightConfig.js (新規)
├── message/
│   └── handlers/
│       └── ConsoleOutputHandler.js (拡張)
└── utils/
    └── Logger.js (既存)
```

### 依存関係

- **chalk**: 既存依存関係、赤太文字出力に使用
- **正規表現**: JavaScript標準機能
- **fs**: 設定ファイル読み込み（既存使用）

### パフォーマンス考慮事項

1. **正規表現のコンパイル**
   - 設定読み込み時に一度だけコンパイル
   - 実行時は事前コンパイル済みオブジェクトを使用

2. **マッチング処理**
   - 短絡評価でマッチした時点で処理終了
   - キーワード数が少ない想定のためシンプルな実装

3. **エラー処理**
   - ハイライト処理でエラーが発生した場合は致命的エラーとして終了
   - 設定エラーは起動時に検出して早期終了
