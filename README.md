# YouTube チャンネル情報収集システム

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285F4?logo=google&logoColor=white)](https://developers.google.com/apps-script)
[![YouTube Data API v3](https://img.shields.io/badge/YouTube%20Data%20API-FF0000?logo=youtube&logoColor=white)](https://developers.google.com/youtube/v3)

**目標達成を絶対条件とし、クォータ上限を回避しつつ最短時間で収集する自動化システム**

[デモ](#-デモ) · [機能](#-主な機能) · [セットアップ](#-クイックスタート) · [技術スタック](#-技術スタック)

</div>

---

## 📋 概要

YouTube Data API v3を活用し、検索キーワードベースで効率的にチャンネル情報を収集・管理するGoogle Apps Scriptシステムです。マーケティングリサーチ、営業リスト作成、競合分析など、YouTubeデータを活用したビジネスニーズに対応します。

### 解決する課題

| 課題 | 解決方法 |
|------|---------|
| 🎯 **大量データ収集の自動化** | 目標件数まで24時間自動実行 |
| ⏱️ **実行時間制限（6分）** | トリガーベースの自動継続 |
| 📊 **APIクォータ管理** | 1日10,000ユニットを自動監視 |
| 🔍 **多様な検索ニーズ** | 3種類の検索順序を自動切替 |
| 📧 **メールアドレス抽出** | 正規表現による自動抽出 |

## ✨ 主な機能

### 🎯 目標達成保証システム
- **自動継続実行**: 目標件数に達するまで自動的に継続（6分制限を回避）
- **クォータ自動管理**: 1日の上限（10,000ユニット）を自動監視し、95%で停止
- **翌日自動再開**: クォータ超過時は翌朝6時に自動再開
- **進捗永続化**: Properties Serviceで進捗を保存、エラー時も復旧可能
- **メール通知**: 完了・エラー・クォータ上限時に自動通知

### 🔍 高度な検索機能
- **複数検索順序**: relevance（関連性）→ viewCount（視聴回数）→ date（新着）を自動切替
- **2つの検索モード**: 
  - **チャンネル直接検索**: チャンネルを直接検索（効率的）
  - **動画経由検索**: 動画を検索してチャンネルを抽出（広範囲）
- **詳細フィルタリング**: 
  - 地域コード（20種類）、言語（16種類）、カテゴリ（14種類）
  - チャンネル規模（登録者数、動画数、総再生回数）
- **メールアドレス抽出**: 正規表現による自動抽出（オプション）

### 📊 データ管理
- **検索順序別シート**: 各検索順序（関連性順/視聴回数順/新着順）の結果を別シートに保存
- **独立した重複チェック**: 各シート内で個別に重複除外
- **リアルタイム共有**: Google スプレッドシートで即座にデータ共有可能
- **実行ログ**: 全ての実行履歴とステータスを記録
- **設定シート**: プルダウンメニューで簡単設定（コード編集不要）

## 🚀 技術スタック

### コア技術
```
Google Apps Script (JavaScript ES6)
├── YouTube Data API v3        # 公式APIによるデータ取得
├── Google Sheets API           # スプレッドシート操作
├── Properties Service          # 進捗の永続化
└── Time-driven Triggers        # 自動継続実行
```

### 実装パターン
- **クラスベース設計**: YouTubeClient / ChannelManager / EmailExtractor
- **責任分離**: API通信 / データ管理 / ビジネスロジックを分離
- **OAuth 2.0認証**: セキュアなAPI認証
- **エラーハンドリング**: リトライ機能 + メール通知
- **状態管理**: Properties Serviceによる進捗保存

### アーキテクチャ
```
Code.gs (メインロジック)
├── Config.gs (設定管理)
├── YouTubeClient.gs (API通信)
│   └── YouTube Data API v3
├── ChannelManager.gs (データ管理)
│   └── Google Sheets API
└── EmailExtractor.gs (メール抽出)
```

## 📈 パフォーマンス

| 目標件数 | 予想時間 | クォータ消費 | 備考 |
|---------|---------|------------|------|
| 100件 | 10-20分 | 約300-500ユニット | 連続実行 |
| 500件 | 30-60分 | 約1,500-2,500ユニット | 自動継続 |
| 1,000件 | 1-2時間 | 約2,000-3,000ユニット | 自動継続 |
| 3,000件 | 1日 | 約9,000ユニット | クォータ上限考慮 |

*チャンネル直接検索、メールフィルタなしの場合

### クォータ消費の内訳
- search API: 100ユニット/回（50件取得）
- channels API: 1ユニット/回（最大50チャンネル）
- 1,000件収集: 約2,000-3,000ユニット

## 🎬 デモ

### 実行結果のシート構成
実行すると以下のシートが自動作成されます：

| シート名 | 説明 |
|---------|------|
| **関連性順** | relevance検索の結果 |
| **視聴回数順** | viewCount検索の結果 |
| **新着順** | date検索の結果 |
| **チャンネルデータ** | 全データの統合（後方互換性） |
| **実行ログ** | 実行履歴とステータス |
| **設定** | 検索条件（プルダウンで簡単設定） |

### 収集されるデータ
各シートには以下の情報が保存されます：

| 列名 | 説明 | 例 |
|-----|------|-----|
| チャンネルID | 一意のID | UCxxxxx |
| チャンネル名 | 表示名 | Tech Channel |
| チャンネルURL | URL | https://youtube.com/channel/UCxxxxx |
| カスタムURL | カスタムURL | @techchannel |
| メールアドレス | 抽出されたメール | info@example.com |
| 登録者数 | 登録者数 | 10,000 |
| 動画数 | 公開動画数 | 150 |
| 総再生回数 | 累計再生回数 | 1,000,000 |
| 作成日 | チャンネル作成日 | 2020-01-01 |

## 🚀 クイックスタート

### 前提条件
- Googleアカウント
- YouTube Data API v3へのアクセス（無料、クォータ: 10,000/日）

### セットアップ手順（所要時間: 約5分）

#### 1. スプレッドシートの作成
```
1. Google Sheets (https://sheets.google.com) で新規作成
2. ファイル名を「YouTubeチャンネル収集」に変更
```

#### 2. Apps Script エディタを開く
```
1. メニュー「拡張機能」→「Apps Script」を選択
2. Apps Script エディタが新しいタブで開きます
```

#### 3. ファイルの作成とコピー
以下のファイルを順番に作成してコピー：

```
1. Config.gs - 設定ファイル
2. YouTubeClient.gs - YouTube API クライアント
3. ChannelManager.gs - データ管理
4. EmailExtractor.gs - メール抽出
5. Code.gs - メインロジック
```

#### 4. YouTube Data API v3 の有効化

**4-1. GASエディタでサービスを追加**
```
1. 左メニュー「サービス」（+アイコン）をクリック
2. 「YouTube Data API v3」を検索
3. 選択して「追加」をクリック
```

**4-2. Google Cloud ConsoleでAPIを有効化**
```
1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
2. 「APIとサービス」→「ライブラリ」
3. 「YouTube Data API v3」を検索して有効化
```

#### 5. 初期セットアップを実行
```
1. 関数選択: setup
2. 「実行」をクリック
3. 初回実行時にOAuth2の権限を許可
4. スプレッドシートに「設定」シートが自動作成されます
```

#### 6. 設定シートで条件を設定
スプレッドシートの「設定」シートで以下を設定：

| 項目 | 説明 | 例 |
|-----|------|-----|
| 検索キーワード | 収集対象のキーワード | 釣り |
| 目標件数 | 収集するチャンネル数 | 1000 |
| メールアドレス必須 | TRUE/FALSEを選択 | FALSE |
| 検索モード | channel / video | channel |
| 地域コード | JP, US, KRなど | JP |
| 言語 | ja, en, koなど | ja |
| カテゴリID | 1-28の番号 | 17 (Sports) |
| 最小登録者数 | 空欄=制限なし | 1000 |
| 最小動画数 | 空欄=制限なし | 10 |
| 最小総再生回数 | 空欄=制限なし | 10000 |

#### 7. 収集を開始
```
1. 関数選択: collectChannels
2. 「実行」をクリック
3. 自動的に目標達成まで継続実行されます
```

## 📁 ファイル構成

```
youtube_channel_scraper_gas/
├── README.md                 # このファイル
├── README_GAS.md            # 詳細なドキュメント
├── SETUP.md                 # セットアップガイド
├── LICENSE                  # MITライセンス
├── .gitignore              # Git管理除外設定
│
├── Config.gs                # 設定ファイル
├── YouTubeClient.gs         # YouTube API クライアント
├── EmailExtractor.gs        # メールアドレス抽出
├── ChannelManager.gs        # スプレッドシート操作
├── Code.gs                  # メインロジック
└── appsscript.json          # プロジェクト設定
```

## 🔧 詳細設定

### 設定シートの項目

**基本設定**
- `検索キーワード`: 検索するキーワード
- `目標件数`: 収集するチャンネル数
- `メールアドレス必須`: TRUE（メールありのみ）/ FALSE（すべて収集）

**検索フィルタ**
- `地域コード`: JP, US, KRなど20種類から選択（空欄=全世界）
- `言語`: ja, en, koなど16種類から選択（空欄=すべて）
- `カテゴリID`: 1-28の14種類から選択（空欄=すべて）

**チャンネル規模**
- `最小登録者数`: 例: 1000（空欄=制限なし）
- `最小動画数`: 例: 10（空欄=制限なし）
- `最小総再生回数`: 例: 10000（空欄=制限なし）

### Config.gsでの高度な設定

```javascript
// クォータ管理
const DAILY_QUOTA_LIMIT = 10000;          // 1日の上限
const QUOTA_SAFETY_MARGIN = 0.95;         // 安全マージン（95%）

// 検索設定
const SEARCH_ORDERS = ['relevance', 'viewCount', 'date'];
const DEFAULT_SEARCH_MODE = 'channel';
const RESULTS_PER_PAGE = 50;

// 実行時間管理
const MAX_EXECUTION_TIME = 330000;        // 5分30秒（6分制限回避）
const RETRY_INTERVAL_SECONDS = 5;         // リトライ間隔

// 通知設定
const SEND_ERROR_EMAIL = true;            // エラー時メール送信
```

## 🎯 使用例

### 例1: 釣り系YouTuberのリスト作成
```
検索キーワード: 釣り
目標件数: 500
メールアドレス必須: TRUE
検索モード: channel
地域コード: JP
言語: ja
最小登録者数: 1000
```

### 例2: テック系チャンネルの競合分析
```
検索キーワード: プログラミング
目標件数: 1000
メールアドレス必須: FALSE
検索モード: video
地域コード: JP
言語: ja
カテゴリID: 28 (Science & Technology)
最小登録者数: 10000
```

## ❓ よくある質問

### Q1. クォータ上限に達したら？
→ 自動的に翌朝6時に再開されます。メールで通知も届きます。

### Q2. 6分で実行が止まる？
→ 自動的に継続トリガーが設定され、5秒後に再開されます。

### Q3. エラーが発生したら？
→ 自動リトライされ、メールで通知されます。進捗は保持されます。

### Q4. PCを起動し続ける必要は？
→ 不要です。Googleのクラウドで24時間自動実行されます。

### Q5. 途中経過を確認したい
→ スプレッドシートの各シートをリアルタイムで確認できます。

### Q6. 検索順序を変更したい
→ Config.gsのSEARCH_ORDERS配列を編集してください。

## 🐛 トラブルシューティング

問題が発生した場合：

1. **「実行ログ」シート**でエラー内容を確認
2. **Apps Script のログ**を確認（実行 → ログを表示）
3. **「設定」シート**の設定値を確認
4. **YouTube Data API v3**が有効化されているか確認
5. **OAuth2の権限**が許可されているか確認

詳細は [README_GAS.md](README_GAS.md) を参照してください。

## 📚 関連ドキュメント

- [詳細ガイド (README_GAS.md)](README_GAS.md) - 完全な技術ドキュメント
- [セットアップガイド (SETUP.md)](SETUP.md) - 詳細なセットアップ手順
- [YouTube Data API](https://developers.google.com/youtube/v3) - API リファレンス
- [Apps Script ガイド](https://developers.google.com/apps-script) - GAS 公式ドキュメント

## 🎓 技術的特徴

### 1. 実行時間制限の克服

**課題**: Google Apps Scriptは1回の実行が最大6分に制限される

**解決策**:
```javascript
// 5分30秒経過時点で自動的に継続トリガーを設定
if (Date.now() - startTime > MAX_EXECUTION_TIME) {
  ScriptApp.newTrigger('collectChannels')
    .timeBased()
    .after(RETRY_INTERVAL_SECONDS * 1000)
    .create();
  return;
}
```

- 実行時間を常時監視し、5分30秒で安全マージンを確保
- トリガーによる5秒後の自動再開
- 進捗をProperties Serviceに保存して継続性を保証

### 2. APIクォータ管理システム

**課題**: YouTube Data APIは1日10,000ユニットまで

**解決策**:
```javascript
if (quotaUsed >= DAILY_QUOTA_LIMIT * QUOTA_SAFETY_MARGIN) {
  // 翌朝6時に自動再開トリガーを設定
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);
  ScriptApp.newTrigger('collectChannels').timeBased().at(tomorrow).create();
}
```

- リアルタイムでクォータ消費を追跡、95%で安全停止
- 翌朝6時（APIリセット後）に自動再開
- メール通知で状況を報告

### 3. 状態管理と復旧機能

**課題**: エラー時や中断時にデータが失われる可能性

**解決策**:
```javascript
// Properties Serviceで進捗を永続化
function saveProgress(searchOrderIndex, nextPageToken, skippedCount) {
  PropertiesService.getScriptProperties().setProperties({
    'searchOrderIndex': searchOrderIndex.toString(),
    'nextPageToken': nextPageToken || '',
    'skippedCount': skippedCount.toString(),
    'lastExecutionTime': Date.now().toString()
  });
}
```

- 検索順序・ページトークン・スキップ数を保存
- エラー時も進捗を保持し、再開時に前回の続きから実行

### 4. マルチオーダー検索戦略

**課題**: 単一の検索順序では取得できるデータに限界がある

**解決策**:
```javascript
const SEARCH_ORDERS = ['relevance', 'viewCount', 'date'];
// 各順序で結果が尽きるまで収集し、次の順序へ自動移行
for (const order of SEARCH_ORDERS) {
  while (hasMoreResults) {
    const results = youtubeClient.search(query, 50, pageToken, searchMode, order, filters);
    channelManager.addChannelsByOrder(results, order);  // 順序別シートに保存
  }
}
```

- relevance → viewCount → date の順で自動切替
- 順序別シートで結果を分類管理し、より広範囲なデータ収集を実現

### 5. クラスベース設計

```
Code.gs (オーケストレーション)
├── Config.gs         (設定の中央管理)
├── YouTubeClient.gs  (API通信層)  search() / getChannelDetails()
├── ChannelManager.gs (データ管理層) addChannelsByOrder() / loadExistingChannelIds()
└── EmailExtractor.gs (抽出ロジック) extractEmails()
```

- 単一責任の原則に従ったクラス分割
- 疎結合で保守性・テスト容易性を確保

### 6. エラーハンドリング

```javascript
try {
  return YouTube.Search.list('snippet', params);
} catch (error) {
  if (error.message.includes('quotaExceeded')) {
    handleQuotaExceeded();
  } else if (error.message.includes('rateLimitExceeded')) {
    Utilities.sleep(5000);
    return this.search(...arguments);  // リトライ
  }
  MailApp.sendEmail({ to: notificationEmail, subject: 'エラー通知', body: error.message });
  throw error;
}
```

- エラーの種類に応じた適切な処理（クォータ超過・レート制限・一般エラー）
- メール通知で無人運用をサポート

## 📊 実装統計

| 項目 | 値 |
|-----|-----|
| 総行数 | 約1,500行 |
| GSファイル数 | 5ファイル |
| クラス数 | 3（YouTubeClient / ChannelManager / EmailExtractor） |
| 関数数 | 約30関数 |
| 1,000件収集 | 約1-2時間 |
| クォータ効率 | 約2-3ユニット/チャンネル |

## 🚀 今後の拡張可能性

### 機能拡張
- [ ] チャンネル統計の時系列分析
- [ ] BigQueryへのデータエクスポート
- [ ] Looker Studioでの可視化
- [ ] Slackへの通知機能

### 技術的改善
- [ ] TypeScriptへの移行（clasp利用）
- [ ] ユニットテストの追加
- [ ] CI/CDパイプラインの構築

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照

---

**作成日**: 2026年2月  
**バージョン**: 2.0  
**言語**: Google Apps Script (JavaScript ES6)
