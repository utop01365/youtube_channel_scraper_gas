/**
 * チャンネル情報管理モジュール (GAS版)
 * スプレッドシートへのデータ保存、重複管理、進捗管理を行う
 */

class ChannelManager {
  constructor() {
    this.spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    this.dataSheet = this.getOrCreateSheet(DATA_SHEET_NAME);
    this.logSheet = this.getOrCreateSheet(LOG_SHEET_NAME);
    this.channelIds = new Set(this.loadExistingChannelIds());
    
    // 各検索順序用のシートと重複チェック用のSets
    this.orderSheets = {};
    this.orderChannelIds = {};
    
    for (const order in ORDER_SHEET_NAMES) {
      const sheetName = ORDER_SHEET_NAMES[order];
      this.orderSheets[order] = this.getOrCreateSheet(sheetName);
      this.orderChannelIds[order] = new Set(this.loadExistingChannelIdsBySheet(this.orderSheets[order]));
    }
  }

  /**
   * シートを取得または作成
   * @param {string} sheetName - シート名
   * @return {Sheet} シートオブジェクト
   */
  getOrCreateSheet(sheetName) {
    let sheet = this.spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = this.spreadsheet.insertSheet(sheetName);
      
      if (sheetName === DATA_SHEET_NAME || Object.values(ORDER_SHEET_NAMES).includes(sheetName)) {
        // データシートまたは検索順序シートのヘッダー行を設定
        sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
        sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      } else if (sheetName === LOG_SHEET_NAME) {
        // ログシートのヘッダー
        const logHeaders = ['実行日時', 'ステータス', 'メッセージ', 'クォータ使用', '取得件数'];
        sheet.getRange(1, 1, 1, logHeaders.length).setValues([logHeaders]);
        sheet.getRange(1, 1, 1, logHeaders.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      } else if (sheetName === SETTINGS_SHEET_NAME) {
        // 設定シートの初期化
        this.initializeSettingsSheet(sheet);
      }
    }
    
    return sheet;
  }

  /**
   * 既存のチャンネルIDを読み込み
   * @return {Array<string>} チャンネルIDの配列
   */
  loadExistingChannelIds() {
    const lastRow = this.dataSheet.getLastRow();
    if (lastRow <= 1) {
      return [];
    }

    const channelIdColumn = 1; // A列
    const channelIds = this.dataSheet.getRange(2, channelIdColumn, lastRow - 1, 1).getValues();
    return channelIds.map(row => row[0]).filter(id => id);
  }

  /**
   * 指定したシートから既存のチャンネルIDを読み込み
   * @param {Sheet} sheet - シートオブジェクト
   * @return {Array<string>} チャンネルIDの配列
   */
  loadExistingChannelIdsBySheet(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return [];
    }

    const channelIdColumn = 1; // A列
    const channelIds = sheet.getRange(2, channelIdColumn, lastRow - 1, 1).getValues();
    return channelIds.map(row => row[0]).filter(id => id);
  }

  /**
   * チャンネルが重複しているかチェック
   * @param {string} channelId - チェックするチャンネルID
   * @return {boolean} 重複している場合true
   */
  isDuplicate(channelId) {
    return this.channelIds.has(channelId);
  }

  /**
   * チャンネル情報を追加
   * @param {Object} channelData - チャンネル情報
   * @return {boolean} 追加成功時true
   */
  addChannel(channelData) {
    const channelId = channelData.channelId;
    
    if (!channelId || this.isDuplicate(channelId)) {
      return false;
    }

    const row = [
      channelData.channelId,
      channelData.channelTitle,
      channelData.channelUrl,
      channelData.customUrl || '',
      channelData.email || '',
      channelData.subscriberCount || 0,
      channelData.videoCount || 0,
      channelData.viewCount || 0,
      channelData.publishedAt || ''
    ];

    const lastRow = this.dataSheet.getLastRow();
    this.dataSheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);
    
    this.channelIds.add(channelId);
    return true;
  }

  /**
   * 複数のチャンネル情報を一括追加
   * @param {Array<Object>} channelsData - チャンネル情報の配列
   * @return {number} 追加した件数
   */
  addChannels(channelsData) {
    if (!channelsData || channelsData.length === 0) {
      return 0;
    }

    const rows = [];
    let addedCount = 0;

    for (const channelData of channelsData) {
      const channelId = channelData.channelId;
      
      if (!channelId || this.isDuplicate(channelId)) {
        continue;
      }

      rows.push([
        channelData.channelId,
        channelData.channelTitle,
        channelData.channelUrl,
        channelData.customUrl || '',
        channelData.email || '',
        channelData.subscriberCount || 0,
        channelData.videoCount || 0,
        channelData.viewCount || 0,
        channelData.publishedAt || ''
      ]);

      this.channelIds.add(channelId);
      addedCount++;
    }

    if (rows.length > 0) {
      const lastRow = this.dataSheet.getLastRow();
      this.dataSheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return addedCount;
  }

  /**
   * 検索順序ごとに複数のチャンネル情報を一括追加
   * @param {Array<Object>} channelsData - チャンネル情報の配列
   * @param {string} order - 検索順序（'relevance', 'viewCount', 'date'）
   * @return {number} 追加した件数
   */
  addChannelsByOrder(channelsData, order) {
    if (!channelsData || channelsData.length === 0) {
      return 0;
    }

    if (!ORDER_SHEET_NAMES[order]) {
      Logger.log(`警告: 無効な検索順序 '${order}'`);
      return this.addChannels(channelsData);  // フォールバック
    }

    const sheet = this.orderSheets[order];
    const channelIdSet = this.orderChannelIds[order];
    const rows = [];
    let addedCount = 0;

    for (const channelData of channelsData) {
      const channelId = channelData.channelId;
      
      // その検索順序のシート内でのみ重複チェック
      if (!channelId || channelIdSet.has(channelId)) {
        continue;
      }

      rows.push([
        channelData.channelId,
        channelData.channelTitle,
        channelData.channelUrl,
        channelData.customUrl || '',
        channelData.email || '',
        channelData.subscriberCount || 0,
        channelData.videoCount || 0,
        channelData.viewCount || 0,
        channelData.publishedAt || ''
      ]);

      channelIdSet.add(channelId);
      // 全体のチャンネルIDセットにも追加
      this.channelIds.add(channelId);
      addedCount++;
    }

    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return addedCount;
  }

  /**
   * 取得済みチャンネル数を取得
   * @return {number} チャンネル数
   */
  getChannelCount() {
    return this.channelIds.size;
  }

  /**
   * ログを記録
   * @param {string} status - ステータス（INFO, WARNING, ERROR, SUCCESS）
   * @param {string} message - メッセージ
   * @param {number} quotaUsed - クォータ使用量
   * @param {number} channelCount - 取得件数
   */
  log(status, message, quotaUsed = 0, channelCount = 0) {
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    const row = [timestamp, status, message, quotaUsed, channelCount];
    
    const lastRow = this.logSheet.getLastRow();
    this.logSheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);
    
    // ログが多くなりすぎたら古いものを削除（1000行まで保持）
    if (lastRow > 1000) {
      this.logSheet.deleteRows(2, lastRow - 1000);
    }

    Logger.log(`[${status}] ${message}`);
  }

  /**
   * データシートをクリア（デバッグ用）
   */
  clearData() {
    // メインのデータシートをクリア
    const lastRow = this.dataSheet.getLastRow();
    if (lastRow > 1) {
      this.dataSheet.deleteRows(2, lastRow - 1);
    }
    this.channelIds = new Set();
    
    // 各検索順序のシートもクリア
    for (const order in ORDER_SHEET_NAMES) {
      const sheet = this.orderSheets[order];
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      this.orderChannelIds[order] = new Set();
    }
  }

  /**
   * 設定シートを初期化
   * @param {Sheet} sheet - 設定シート
   */
  initializeSettingsSheet(sheet) {
    // ヘッダー行
    const headers = [['設定項目', '値', '説明']];
    sheet.getRange(1, 1, 1, 3).setValues(headers);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    
    // 初期設定値
    const settings = [
      ['■ 基本設定', '', ''],
      ['検索キーワード', '釣り', '検索するキーワード'],
      ['目標件数', 1000, '収集するチャンネル数'],
      ['検索モード', 'channel', '検索方法（channel=チャンネル検索 / video=動画検索）'],
      ['メールアドレス必須', 'TRUE', 'メールアドレスがあるチャンネルのみ収集（TRUE/FALSE）'],
      ['', '', ''],
      ['■ 検索フィルタ', '', ''],
      ['地域コード', '', '国コード（プルダウンから選択、空欄=全世界）'],
      ['言語', '', '言語コード（プルダウンから選択、空欄=すべて）'],
      ['カテゴリID', '', 'カテゴリID（プルダウンから選択、空欄=すべて）'],
      ['', '', ''],
      ['■ チャンネル規模（最小条件）', '', ''],
      ['最小登録者数', '', '最小登録者数（空欄=制限なし）例: 1000'],
      ['最小動画数', '', '最小動画数（空欄=制限なし）例: 10'],
      ['最小総再生回数', '', '最小総再生回数（空欄=制限なし）例: 10000']
    ];
    
    sheet.getRange(2, 1, settings.length, 3).setValues(settings);
    
    // データ検証（プルダウン）を設定
    
    // 検索モードのプルダウン（5行目のB列）
    const searchModes = ['channel', 'video'];
    const searchModeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(searchModes, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('B5').setDataValidation(searchModeRule);
    
    // メールアドレス必須のプルダウン（6行目のB列）
    const booleanValues = ['TRUE', 'FALSE'];
    const booleanRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(booleanValues, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('B6').setDataValidation(booleanRule);
    
    // 地域コードのプルダウン（9行目のB列）
    const regionCodes = [
      '（指定なし）',
      'JP - 日本',
      'US - アメリカ',
      'KR - 韓国',
      'CN - 中国',
      'TW - 台湾',
      'GB - イギリス',
      'CA - カナダ',
      'AU - オーストラリア',
      'DE - ドイツ',
      'FR - フランス',
      'IT - イタリア',
      'ES - スペイン',
      'BR - ブラジル',
      'MX - メキシコ',
      'IN - インド',
      'TH - タイ',
      'VN - ベトナム',
      'PH - フィリピン',
      'ID - インドネシア'
    ];
    const regionRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(regionCodes, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('B9').setDataValidation(regionRule);
    
    // 言語のプルダウン（10行目のB列）
    const languages = [
      '（指定なし）',
      'ja - 日本語',
      'en - 英語',
      'ko - 韓国語',
      'zh - 中国語',
      'zh-TW - 繁体字中国語',
      'es - スペイン語',
      'fr - フランス語',
      'de - ドイツ語',
      'it - イタリア語',
      'pt - ポルトガル語',
      'ru - ロシア語',
      'ar - アラビア語',
      'hi - ヒンディー語',
      'th - タイ語',
      'vi - ベトナム語',
      'id - インドネシア語'
    ];
    const languageRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(languages, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('B10').setDataValidation(languageRule);
    
    // カテゴリIDのプルダウン（11行目のB列）
    const categories = [
      '（指定なし）',
      '1 - Film & Animation（映画・アニメ）',
      '2 - Autos & Vehicles（自動車・乗り物）',
      '10 - Music（音楽）',
      '15 - Pets & Animals（ペット・動物）',
      '17 - Sports（スポーツ）',
      '19 - Travel & Events（旅行・イベント）',
      '20 - Gaming（ゲーム）',
      '22 - People & Blogs（ブログ）',
      '23 - Comedy（コメディ）',
      '24 - Entertainment（エンターテイメント）',
      '25 - News & Politics（ニュース・政治）',
      '26 - Howto & Style（ハウツー・スタイル）',
      '27 - Education（教育）',
      '28 - Science & Technology（科学・技術）'
    ];
    const categoryRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(categories, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('B11').setDataValidation(categoryRule);
    
    // 列幅を調整
    sheet.setColumnWidth(1, 250);
    sheet.setColumnWidth(2, 200);
    sheet.setColumnWidth(3, 400);
    
    // セクションヘッダーのスタイル
    sheet.getRange('A2:C2').setBackground('#e8f0fe').setFontWeight('bold');
    sheet.getRange('A8:C8').setBackground('#e8f0fe').setFontWeight('bold');
    sheet.getRange('A13:C13').setBackground('#e8f0fe').setFontWeight('bold');
    
    // 入力セルの背景色
    sheet.getRange('B3:B6').setBackground('#fff3cd');
    sheet.getRange('B9:B11').setBackground('#d1ecf1');
    sheet.getRange('B14:B16').setBackground('#d4edda');
    
    sheet.setFrozenRows(1);
  }

  /**
   * スプレッドシートから設定を読み込む
   * @return {Object} 設定オブジェクト
   */
  loadSettings() {
    const settingsSheet = this.getOrCreateSheet(SETTINGS_SHEET_NAME);
    const lastRow = settingsSheet.getLastRow();
    
    if (lastRow <= 1) {
      // 設定シートが空の場合、デフォルト値を返す
      return this.getDefaultSettings();
    }
    
    // 設定を読み込む
    const data = settingsSheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const settings = {};
    
    for (const row of data) {
      const key = row[0];
      const value = row[1];
      
      // セクションヘッダーや空行をスキップ
      if (!key || key.startsWith('■') || key.startsWith('カテゴリID一覧')) {
        continue;
      }
      
      // カテゴリID一覧の行をスキップ（数値のみのキー）
      if (!isNaN(key)) {
        continue;
      }
      
      // 設定値を解析
      switch(key) {
        case '検索キーワード':
          settings.searchQuery = value || '釣り';
          break;
        case '目標件数':
          settings.maxChannels = parseInt(value) || 1000;
          break;
        case '検索モード':
          settings.searchMode = (value === 'video') ? 'video' : 'channel';
          break;
        case 'メールアドレス必須':
          settings.onlyWithEmail = value === 'TRUE' || value === true;
          break;
        case '地域コード':
          // プルダウン形式から抽出（例: "JP - 日本" → "JP"）
          if (value && value !== '（指定なし）') {
            settings.regionCode = value.split(' - ')[0];
          } else {
            settings.regionCode = null;
          }
          break;
        case '言語':
          // プルダウン形式から抽出（例: "ja - 日本語" → "ja"）
          if (value && value !== '（指定なし）') {
            settings.relevanceLanguage = value.split(' - ')[0];
          } else {
            settings.relevanceLanguage = null;
          }
          break;
        case 'カテゴリID':
          // プルダウン形式から抽出（例: "17 - Sports（スポーツ）" → "17"）
          if (value && value !== '（指定なし）') {
            settings.videoCategoryId = value.split(' - ')[0];
          } else {
            settings.videoCategoryId = null;
          }
          break;
        case '最小登録者数':
          settings.minSubscriberCount = value ? parseInt(value) : null;
          break;
        case '最小動画数':
          settings.minVideoCount = value ? parseInt(value) : null;
          break;
        case '最小総再生回数':
          settings.minViewCount = value ? parseInt(value) : null;
          break;
      }
    }
    
    return settings;
  }

  /**
   * デフォルト設定を取得
   * @return {Object} デフォルト設定
   */
  getDefaultSettings() {
    return {
      searchQuery: SEARCH_QUERY,
      maxChannels: MAX_CHANNELS,
      searchMode: DEFAULT_SEARCH_MODE,
      onlyWithEmail: ONLY_WITH_EMAIL,
      regionCode: null,
      relevanceLanguage: null,
      videoCategoryId: null,
      minSubscriberCount: MIN_SUBSCRIBER_COUNT,
      minVideoCount: MIN_VIDEO_COUNT,
      minViewCount: MIN_VIEW_COUNT
    };
  }
}
