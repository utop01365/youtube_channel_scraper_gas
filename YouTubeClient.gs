/**
 * YouTube Data API クライアント (GAS版 - 高度なサービス使用)
 * YouTube Data API v3 の高度なサービスを使用してチャンネル検索と詳細情報取得を行う
 * 
 * セットアップ手順:
 * 1. GASエディタで「サービス」→「YouTube Data API v3」を追加
 * 2. Google Cloud Consoleで「YouTube Data API v3」を有効化
 * 3. 初回実行時にOAuth2の権限を承認
 */

class YouTubeClient {
  constructor() {
    this.quotaUsed = this.loadQuotaUsed();
    this.quotaResetDate = this.getQuotaResetDate();
  }

  /**
   * チャンネルまたは動画を検索
   * @param {string} query - 検索キーワード
   * @param {number} maxResults - 取得件数（最大50）
   * @param {string} pageToken - ページネーショントークン
   * @param {string} searchType - 検索タイプ（'channel' または 'video'）
   * @param {string} order - 検索順序（'relevance', 'viewCount', 'date', etc.）
   * @param {Object} filters - 検索フィルタ（regionCode, relevanceLanguage, videoCategoryId）
   * @return {Object} 検索結果
   */
  search(query, maxResults = 50, pageToken = null, searchType = 'channel', order = 'relevance', filters = {}) {
    this.checkQuotaLimit();
    
    const params = {
      q: query,
      type: searchType,
      order: order,
      maxResults: maxResults
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    // 検索フィルタを追加（searchTypeに応じて適用）
    if (filters.relevanceLanguage) {
      params.relevanceLanguage = filters.relevanceLanguage;
    }
    
    // regionCodeとvideoCategoryIdは動画検索のみで有効
    if (searchType === 'video') {
      if (filters.regionCode) {
        params.regionCode = filters.regionCode;
      }
      if (filters.videoCategoryId) {
        params.videoCategoryId = filters.videoCategoryId;
      }
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // YouTube高度なサービスを使用
        const result = YouTube.Search.list('snippet', params);
        
        this.addQuotaUsed(QUOTA_COSTS['search.list']);
        
        const searchTarget = searchType === 'channel' ? 'チャンネル' : '動画';
        const filterInfo = this.getFilterInfo(filters);
        Logger.log(`${searchTarget}検索成功${filterInfo}: ${result.items ? result.items.length : 0}件取得`);
        
        Utilities.sleep(REQUEST_DELAY);
        return result;
        
      } catch (error) {
        Logger.log(`検索エラー (試行 ${attempt + 1}/${MAX_RETRIES}): ${error.message}`);
        
        // クォータエラーのチェック
        if (error.message.includes('quota') || error.message.includes('Quota')) {
          throw new Error('YouTube API クォータ上限に達しました');
        }
        
        if (attempt < MAX_RETRIES - 1) {
          Utilities.sleep(RETRY_DELAY * Math.pow(2, attempt));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * チャンネル詳細情報を取得
   * @param {Array<string>} channelIds - チャンネルIDの配列（最大50件）
   * @return {Array<Object>} チャンネル情報の配列
   */
  getChannelDetails(channelIds) {
    if (!channelIds || channelIds.length === 0) {
      return [];
    }

    // 最大50件に制限
    if (channelIds.length > 50) {
      Logger.log(`警告: チャンネルID数が50を超えています（${channelIds.length}件）。最初の50件のみ取得します。`);
      channelIds = channelIds.slice(0, 50);
    }

    this.checkQuotaLimit();

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // YouTube高度なサービスを使用
        const result = YouTube.Channels.list('snippet,statistics', {
          id: channelIds.join(',')
        });
        
        this.addQuotaUsed(QUOTA_COSTS['channels.list']);
        
        Logger.log(`チャンネル詳細取得成功: ${result.items ? result.items.length : 0}件`);
        
        Utilities.sleep(REQUEST_DELAY);
        return result.items || [];
        
      } catch (error) {
        Logger.log(`チャンネル詳細取得エラー (試行 ${attempt + 1}/${MAX_RETRIES}): ${error.message}`);
        
        // クォータエラーのチェック
        if (error.message.includes('quota') || error.message.includes('Quota')) {
          throw new Error('YouTube API クォータ上限に達しました');
        }
        
        if (attempt < MAX_RETRIES - 1) {
          Utilities.sleep(RETRY_DELAY * Math.pow(2, attempt));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * クォータ使用量をチェック
   */
  checkQuotaLimit() {
    // 日付が変わっていればリセット
    const currentDate = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    if (currentDate !== this.quotaResetDate) {
      this.resetQuota();
    }

    const quotaLimit = DAILY_QUOTA_LIMIT * QUOTA_SAFETY_MARGIN;
    if (this.quotaUsed >= quotaLimit) {
      throw new Error(`クォータ上限（${quotaLimit}）に達しました。現在の使用量: ${this.quotaUsed}`);
    }
  }

  /**
   * クォータ使用量を追加
   * @param {number} cost - 追加するコスト
   */
  addQuotaUsed(cost) {
    this.quotaUsed += cost;
    this.saveQuotaUsed();
    Logger.log(`クォータ使用: ${this.quotaUsed} / ${DAILY_QUOTA_LIMIT}`);
  }

  /**
   * クォータをリセット
   */
  resetQuota() {
    this.quotaUsed = 0;
    this.quotaResetDate = this.getQuotaResetDate();
    this.saveQuotaUsed();
    Logger.log('クォータをリセットしました');
  }

  /**
   * 現在のクォータ使用量を取得
   * @return {number} クォータ使用量
   */
  getQuotaUsed() {
    return this.quotaUsed;
  }

  /**
   * クォータリセット日を取得
   * @return {string} リセット日（yyyy-MM-dd形式）
   */
  getQuotaResetDate() {
    return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  }

  /**
   * クォータ使用量をPropertiesServiceから読み込み
   * @return {number} クォータ使用量
   */
  loadQuotaUsed() {
    const props = PropertiesService.getScriptProperties();
    const savedDate = props.getProperty('quotaResetDate');
    const currentDate = this.getQuotaResetDate();

    if (savedDate !== currentDate) {
      return 0;
    }

    return parseInt(props.getProperty('quotaUsed') || '0', 10);
  }

  /**
   * クォータ使用量をPropertiesServiceに保存
   */
  saveQuotaUsed() {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('quotaUsed', this.quotaUsed.toString());
    props.setProperty('quotaResetDate', this.quotaResetDate);
  }

  /**
   * フィルタ情報を文字列化（ログ用）
   * @param {Object} filters - フィルタオブジェクト
   * @return {string} フィルタ情報
   */
  getFilterInfo(filters) {
    const parts = [];
    
    if (filters.regionCode) {
      parts.push(`地域:${filters.regionCode}`);
    }
    if (filters.relevanceLanguage) {
      parts.push(`言語:${filters.relevanceLanguage}`);
    }
    if (filters.videoCategoryId) {
      parts.push(`カテゴリ:${filters.videoCategoryId}`);
    }
    
    return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
  }
}
