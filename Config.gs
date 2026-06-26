/**
 * YouTube Data API チャンネル情報取得システム - 設定ファイル (GAS版)
 * 
 * 目標達成を絶対条件とし、クォータ上限を回避しつつ最短時間で収集
 * 
 * ※ YouTube Data API v3 の高度なサービスを使用
 * セットアップ手順:
 * 1. GASエディタで「サービス」→「YouTube Data API v3」を追加
 * 2. Google Cloud Consoleで「YouTube Data API v3」を有効化
 * 3. 初回実行時にOAuth2の権限を承認
 */

// ==================== 検索条件 ====================
// 検索キーワード
const SEARCH_QUERY = 'KEYWORD';

// 目標取得チャンネル数
const MAX_CHANNELS = 1000;

// メールアドレスが抽出できたチャンネルのみ収集するか
// true: メールアドレスありのみ / false: すべて収集
const ONLY_WITH_EMAIL = true;

// ==================== チャンネル条件フィルタ（最小条件のみ） ====================
// スプレッドシートの「設定」シートから設定可能
// 以下はデフォルト値（nullで無制限）
const MIN_SUBSCRIBER_COUNT = null;  // 最小登録者数（例: 1000）
const MIN_VIDEO_COUNT = null;       // 最小動画数（例: 10）
const MIN_VIEW_COUNT = null;        // 最小総再生回数（例: 10000）

// ==================== 検索設定 ====================
// 検索順序（複数の順序で検索を実行）
const SEARCH_ORDERS = ['relevance', 'viewCount', 'date'];

// デフォルト検索モード（channel: チャンネル検索 / video: 動画検索）
const DEFAULT_SEARCH_MODE = 'channel';

// 1回の検索で取得する件数（最大50）
const RESULTS_PER_PAGE = 50;

// ==================== 実行制御設定 ====================
// 1回の実行での最大処理時間（ミリ秒）
// GASの6分制限を考慮して5分30秒に設定
const MAX_EXECUTION_TIME = 5.5 * 60 * 1000;

// API呼び出し間の待機時間（ミリ秒）
const REQUEST_DELAY = 1000;

// 進捗保存の頻度（何件取得ごとに保存するか）
const SAVE_INTERVAL = 10;

// ==================== クォータ管理設定 ====================
// 1日あたりのクォータ上限
const DAILY_QUOTA_LIMIT = 10000;

// クォータ上限の安全マージン（95%で停止）
const QUOTA_SAFETY_MARGIN = 0.95;

// API呼び出しごとのクォータコスト
const QUOTA_COSTS = {
  'search.list': 100,
  'channels.list': 1
};

// ==================== スプレッドシート設定 ====================
// 設定を保存するシート名（スプレッドシートから読み込む設定）
const SETTINGS_SHEET_NAME = '設定';

// データを保存するシート名
const DATA_SHEET_NAME = 'チャンネルデータ';

// 検索順序別のシート名
const ORDER_SHEET_NAMES = {
  'relevance': '関連性順',
  'viewCount': '視聴回数順',
  'date': '新着順'
};

// ログを保存するシート名
const LOG_SHEET_NAME = '実行ログ';

// ヘッダー行
const HEADERS = [
  'チャンネルID',
  'チャンネル名',
  'チャンネルURL',
  'カスタムURL',
  'メールアドレス',
  '登録者数',
  '動画数',
  '総再生回数',
  '作成日'
];

// ==================== メールアドレス抽出設定 ====================
// メールアドレスの正規表現パターン
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// 除外するドメイン
const EXCLUDED_DOMAINS = [
  'example.com',
  'test.com',
  'sample.com'
];

// ==================== エラーハンドリング設定 ====================
// 最大リトライ回数
const MAX_RETRIES = 3;

// リトライ時の待機時間（ミリ秒）
const RETRY_DELAY = 2000;

// エラー時にメール通知を送るか
const SEND_ERROR_EMAIL = true;

// 通知先メールアドレス（空の場合はスクリプト所有者）
const NOTIFICATION_EMAIL = '';
