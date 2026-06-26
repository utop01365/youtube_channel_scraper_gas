/**
 * YouTube Data API チャンネル情報取得システム - メインスクリプト (GAS版)
 * 
 * 目標達成を絶対条件とし、クォータ上限を回避しつつ最短時間で収集
 * 6分の実行時間制限を回避するため、継続トリガーで自動再開
 * 
 * ※ YouTube Data API v3 の高度なサービスを使用
 */

/**
 * メイン処理：チャンネル情報を収集
 * フェーズ1: チャンネル検索で可能な限り収集
 * フェーズ2: 動画検索で追加収集
 * トリガーまたは手動で実行
 */
function collectChannels() {
  const startTime = new Date().getTime();
  
  try {
    const youtubeClient = new YouTubeClient();
    const channelManager = new ChannelManager();
    const emailExtractor = new EmailExtractor();
    const progress = loadProgress();

    // スプレッドシートから設定を読み込む
    const settings = channelManager.loadSettings();
    
    const currentCount = channelManager.getChannelCount();
    const targetCount = settings.maxChannels;

    // 現在の検索順序インデックスを決定
    let searchOrderIndex = progress.searchOrderIndex || 0;
    
    // 検索順序が配列の範囲外の場合はリセット
    if (searchOrderIndex >= SEARCH_ORDERS.length) {
      searchOrderIndex = 0;
    }
    
    const currentOrder = SEARCH_ORDERS[searchOrderIndex];
    const searchMode = settings.searchMode;
    
    channelManager.log('INFO', `収集開始 [モード: ${searchMode}, 順序: ${currentOrder}(${searchOrderIndex + 1}/${SEARCH_ORDERS.length})]: 現在 ${currentCount}/${targetCount} 件 [キーワード: ${settings.searchQuery}]`, youtubeClient.getQuotaUsed(), currentCount);

    // 既に目標達成している場合
    if (currentCount >= targetCount) {
      channelManager.log('SUCCESS', `目標達成済み: ${currentCount} 件`, youtubeClient.getQuotaUsed(), currentCount);
      clearAllTriggers();
      return;
    }

    let nextPageToken = progress.nextPageToken;
    let processedInThisRun = 0;
    let skippedCount = progress.skippedCount || 0;

    // 実行時間内でループ処理
    while (channelManager.getChannelCount() < targetCount) {
      // 実行時間チェック
      const elapsedTime = new Date().getTime() - startTime;
      if (elapsedTime > MAX_EXECUTION_TIME) {
        channelManager.log('INFO', `実行時間上限に達しました（${Math.floor(elapsedTime / 1000)}秒）。継続トリガーを設定します。`);
        break;
      }

      // クォータチェック
      try {
        youtubeClient.checkQuotaLimit();
      } catch (error) {
        channelManager.log('WARNING', `クォータ上限近く: ${error.message}。明日まで待機します。`);
        saveProgress({
          searchOrderIndex: searchOrderIndex,
          nextPageToken: nextPageToken,
          skippedCount: skippedCount,
          lastUpdated: new Date().toISOString()
        });
        // 明日の朝に再開するトリガーを設定
        createDailyTrigger();
        return;
      }

      // 検索モードと順序を決定
      const searchType = searchMode; // 'channel' または 'video'
      const order = SEARCH_ORDERS[searchOrderIndex];
      
      // 検索フィルタを準備
      const searchFilters = {
        regionCode: settings.regionCode,
        relevanceLanguage: settings.relevanceLanguage,
        videoCategoryId: settings.videoCategoryId
      };
      
      // チャンネル/動画を検索
      const searchResult = youtubeClient.search(
        settings.searchQuery,
        RESULTS_PER_PAGE,
        nextPageToken,
        searchType,
        order,
        searchFilters
      );
      
      if (!searchResult.items || searchResult.items.length === 0) {
        channelManager.log('WARNING', `${order}検索結果が見つかりませんでした`);
        
        // 次の検索順序へ移行
        if (searchOrderIndex < SEARCH_ORDERS.length - 1) {
          searchOrderIndex++;
          nextPageToken = null;
          channelManager.log('INFO', `検索順序を${SEARCH_ORDERS[searchOrderIndex]}に変更します（${searchOrderIndex + 1}/${SEARCH_ORDERS.length}）`);
          
          saveProgress({
            searchOrderIndex: searchOrderIndex,
            nextPageToken: null,
            skippedCount: skippedCount,
            lastUpdated: new Date().toISOString()
          });
          
          continue;
        } else {
          // すべての検索順序が完了
          channelManager.log('INFO', 'すべての検索順序が完了。収集を終了します。');
          break;
        }
      }

      // チャンネルIDを抽出
      const channelIds = extractChannelIds(searchResult.items, channelManager, searchType);
      
      if (channelIds.length === 0) {
        channelManager.log('INFO', 'すべて重複チャンネルでした。次のページへ');
        nextPageToken = searchResult.nextPageToken;
        
        if (!nextPageToken) {
          // 次ページがない場合、検索順序遷移
          if (searchOrderIndex < SEARCH_ORDERS.length - 1) {
            searchOrderIndex++;
            channelManager.log('INFO', `${order}の検索完了。次の順序: ${SEARCH_ORDERS[searchOrderIndex]}（${searchOrderIndex + 1}/${SEARCH_ORDERS.length}）`);
            
            saveProgress({
              searchOrderIndex: searchOrderIndex,
              nextPageToken: null,              skippedCount: skippedCount,
              lastUpdated: new Date().toISOString()
            });
            
            continue;
          } else {
            channelManager.log('WARNING', 'すべての検索順序が完了。これ以上検索結果がありません');
            break;
          }
        }
        continue;
      }

      // チャンネル詳細を取得
      const channels = youtubeClient.getChannelDetails(channelIds);
      
      if (channels.length === 0) {
        channelManager.log('WARNING', 'チャンネル詳細の取得に失敗しました');
        nextPageToken = searchResult.nextPageToken;
        continue;
      }

      // チャンネル情報を抽出
      const channelsData = [];
      
      for (const channel of channels) {
        const channelInfo = extractChannelInfo(channel, emailExtractor);
        
        // メールアドレスフィルタリング
        if (settings.onlyWithEmail && !channelInfo.email) {
          skippedCount++;
          Logger.log(`メールアドレスなしでスキップ（${skippedCount}件目）: ${channelInfo.channelTitle}`);
          continue;
        }
        
        // チャンネル統計情報フィルタリング
        if (!meetsChannelCriteria(channelInfo, settings)) {
          skippedCount++;
          Logger.log(`条件不一致でスキップ（${skippedCount}件目）: ${channelInfo.channelTitle} ` +
                     `[登録者:${channelInfo.subscriberCount}, 動画:${channelInfo.videoCount}, 再生:${channelInfo.viewCount}]`);
          continue;
        }
        
        channelsData.push(channelInfo);
      }

      // チャンネル情報を検索順序ごとのシートに保存
      const addedCount = channelManager.addChannelsByOrder(channelsData, order);
      processedInThisRun += addedCount;

      const newCount = channelManager.getChannelCount();
      Logger.log(`進捗 [${order}]: ${newCount}/${targetCount} 件（今回+${addedCount}、スキップ${skippedCount}）`);

      // 次ページトークンを更新
      nextPageToken = searchResult.nextPageToken;

      // 進捗を保存
      if (processedInThisRun % SAVE_INTERVAL === 0) {
        saveProgress({
          searchOrderIndex: searchOrderIndex,
          nextPageToken: nextPageToken,
          skippedCount: skippedCount,
          lastUpdated: new Date().toISOString()
        });
      }

      // 目標達成チェック
      if (newCount >= targetCount) {
        channelManager.log('SUCCESS', `目標達成！ ${newCount} 件収集完了`, youtubeClient.getQuotaUsed(), newCount);
        
        clearProgress();
        clearAllTriggers();
        
        // 成功通知メールを送信
        sendNotificationEmail('成功', `目標のチャンネル数（${targetCount}件）を収集しました！`);
        return;
      }

      // 次ページがない場合
      if (!nextPageToken) {
        // 次の検索順序へ移行
        if (searchOrderIndex < SEARCH_ORDERS.length - 1) {
          searchOrderIndex++;
          channelManager.log('INFO', `${order}の検索完了。次の順序: ${SEARCH_ORDERS[searchOrderIndex]}（${searchOrderIndex + 1}/${SEARCH_ORDERS.length}）`);
          
          saveProgress({
            searchOrderIndex: searchOrderIndex,
            nextPageToken: null,
            skippedCount: skippedCount,
            lastUpdated: new Date().toISOString()
          });
          
          continue;
        } else {
          // すべての検索順序が完了
          if (newCount >= targetCount) {
            channelManager.log('SUCCESS', `すべての検索順序完了。${newCount}件収集`, youtubeClient.getQuotaUsed(), newCount);
          } else {
            channelManager.log('WARNING', `すべての検索順序が完了。目標${targetCount}件に対し${newCount}件を収集しました。`, youtubeClient.getQuotaUsed(), newCount);
            sendNotificationEmail('警告', `検索結果が尽きました。目標${targetCount}件に対し${newCount}件を収集しました。`);
          }
          
          clearProgress();
          clearAllTriggers();
          return;
        }
      }
    }

    // まだ目標未達で継続可能な場合
    if (channelManager.getChannelCount() < targetCount) {
      saveProgress({
        searchOrderIndex: searchOrderIndex,
        nextPageToken: nextPageToken,
        skippedCount: skippedCount,
        lastUpdated: new Date().toISOString()
      });

      const currentCount = channelManager.getChannelCount();
      const currentOrder = SEARCH_ORDERS[searchOrderIndex];
      channelManager.log('INFO', `継続実行を設定 [${searchMode}, ${currentOrder}]: ${currentCount}/${targetCount} 件`, youtubeClient.getQuotaUsed(), currentCount);
      
      // 継続トリガーを設定（数秒後に再実行）
      createContinuationTrigger();
    }

  } catch (error) {
    const channelManager = new ChannelManager();
    channelManager.log('ERROR', `エラー発生: ${error.message}`);
    Logger.log(`エラーの詳細: ${error.stack}`);
    
    // エラー通知メールを送信
    sendNotificationEmail('エラー', `エラーが発生しました: ${error.message}`);
    
    throw error;
  }
}

/**
 * チャンネルIDを抽出
 * @param {Array<Object>} items - 検索結果のアイテム
 * @param {ChannelManager} channelManager - チャンネル管理オブジェクト
 * @param {string} searchType - 検索タイプ（'channel' または 'video'）
 * @return {Array<string>} 新規チャンネルIDの配列
 */
function extractChannelIds(items, channelManager, searchType) {
  const channelIds = [];
  
  for (const item of items) {
    let channelId = null;
    
    if (searchType === 'channel') {
      // チャンネル検索の場合
      if (item.id && typeof item.id === 'object' && item.id.channelId) {
        channelId = item.id.channelId;
      } else if (typeof item.id === 'string') {
        channelId = item.id;
      }
    } else {
      // 動画検索の場合
      channelId = item.snippet.channelId;
    }
    
    if (channelId && !channelManager.isDuplicate(channelId)) {
      channelIds.push(channelId);
    }
  }
  
  return channelIds;
}

/**
 * チャンネルが設定された条件を満たすかチェック
 * @param {Object} channelInfo - チャンネル情報
 * @param {Object} settings - 設定オブジェクト
 * @return {boolean} 条件を満たす場合true
 */
function meetsChannelCriteria(channelInfo, settings) {
  // 最小登録者数のチェック
  if (settings.minSubscriberCount !== null && channelInfo.subscriberCount < settings.minSubscriberCount) {
    return false;
  }
  
  // 最小動画数のチェック
  if (settings.minVideoCount !== null && channelInfo.videoCount < settings.minVideoCount) {
    return false;
  }
  
  // 最小総再生回数のチェック
  if (settings.minViewCount !== null && channelInfo.viewCount < settings.minViewCount) {
    return false;
  }
  
  return true;
}

/**
 * チャンネル情報を抽出
 * @param {Object} channel - YouTube APIのチャンネルオブジェクト
 * @param {EmailExtractor} emailExtractor - メール抽出オブジェクト
 * @return {Object} チャンネル情報
 */
function extractChannelInfo(channel, emailExtractor) {
  const snippet = channel.snippet || {};
  const statistics = channel.statistics || {};
  
  const channelId = channel.id;
  const description = snippet.description || '';
  const email = emailExtractor.extract(description);
  
  return {
    channelId: channelId,
    channelTitle: snippet.title || '',
    channelUrl: `https://www.youtube.com/channel/${channelId}`,
    customUrl: snippet.customUrl || '',
    email: email,
    subscriberCount: parseInt(statistics.subscriberCount || 0),
    videoCount: parseInt(statistics.videoCount || 0),
    viewCount: parseInt(statistics.viewCount || 0),
    publishedAt: snippet.publishedAt || ''
  };
}

/**
 * 進捗を保存
 * @param {Object} progress - 進捗情報
 */
function saveProgress(progress) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('progress', JSON.stringify(progress));
}

/**
 * 進捗を読み込み
 * @return {Object} 進捗情報
 */
function loadProgress() {
  const props = PropertiesService.getScriptProperties();
  const progressJson = props.getProperty('progress');
  
  if (!progressJson) {
    return {
      searchOrderIndex: 0,  // デフォルトは最初の検索順序（relevance）
      nextPageToken: null,
      skippedCount: 0
    };
  }
  
  return JSON.parse(progressJson);
}

/**
 * 進捗をクリア
 */
function clearProgress() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('progress');
}

/**
 * 継続実行用トリガーを作成（5秒後に実行）
 */
function createContinuationTrigger() {
  // 既存のトリガーをクリア
  clearAllTriggers();
  
  // 5秒後に実行
  ScriptApp.newTrigger('collectChannels')
    .timeBased()
    .after(5 * 1000)
    .create();
  
  Logger.log('継続トリガーを設定しました（5秒後に再実行）');
}

/**
 * 日次実行用トリガーを作成（翌朝6時に実行）
 */
function createDailyTrigger() {
  // 既存のトリガーをクリア
  clearAllTriggers();
  
  // 翌朝6時に実行
  ScriptApp.newTrigger('collectChannels')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();
  
  Logger.log('日次トリガーを設定しました（翌朝6時に実行）');
}

/**
 * 全てのトリガーをクリア
 */
function clearAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'collectChannels') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

/**
 * 通知メールを送信
 * @param {string} status - ステータス（成功/警告/エラー）
 * @param {string} message - メッセージ
 */
function sendNotificationEmail(status, message) {
  if (!SEND_ERROR_EMAIL) {
    return;
  }
  
  const recipient = NOTIFICATION_EMAIL || Session.getActiveUser().getEmail();
  const channelManager = new ChannelManager();
  const settings = channelManager.loadSettings();
  
  const subject = `[YouTube収集システム] ${status}`;
  const body = `
YouTube Data API チャンネル情報取得システム

ステータス: ${status}
メッセージ: ${message}

検索キーワード: ${settings.searchQuery}
目標件数: ${settings.maxChannels}

スプレッドシート: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}

このメールは自動送信されました。
  `;
  
  try {
    MailApp.sendEmail(recipient, subject, body);
    Logger.log(`通知メールを送信しました: ${recipient}`);
  } catch (error) {
    Logger.log(`メール送信エラー: ${error.message}`);
  }
}

/**
 * 初期設定：スプレッドシートとトリガーをセットアップ
 * 初回実行時に手動で実行してください
 */
function setup() {
  const channelManager = new ChannelManager();
  
  // 設定シートを作成
  channelManager.getOrCreateSheet(SETTINGS_SHEET_NAME);
  
  channelManager.log('INFO', 'セットアップ完了');
  
  Logger.log('='+ '='.repeat(59));
  Logger.log('YouTube Data API チャンネル情報取得システム (GAS版)');
  Logger.log('='+ '='.repeat(59));
  Logger.log('');
  Logger.log('セットアップが完了しました！');
  Logger.log('');
  Logger.log('次のステップ:');
  Logger.log('1. GASエディタで「サービス」→「YouTube Data API v3」を追加');
  Logger.log('2. Google Cloud Consoleで「YouTube Data API v3」を有効化');
  Logger.log('3. スプレッドシートの「設定」シートで検索条件を設定');
  Logger.log('4. collectChannels() を実行して収集開始');
  Logger.log('5. 初回実行時にOAuth2の権限を承認');
  Logger.log('');
  Logger.log(`スプレッドシート: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`);
}

/**
 * データをクリア（デバッグ用）
 */
function clearAllData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'データクリア確認',
    'すべてのデータと進捗をクリアしますか？',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    const channelManager = new ChannelManager();
    channelManager.clearData();
    clearProgress();
    clearAllTriggers();
    
    const youtubeClient = new YouTubeClient();
    youtubeClient.resetQuota();
    
    channelManager.log('INFO', 'すべてのデータをクリアしました');
    ui.alert('完了', 'すべてのデータがクリアされました。', ui.ButtonSet.OK);
  }
}
