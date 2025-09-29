// background.js - Day 18 分頁控制版本
console.log('🚀 輔大課表生成器背景腳本已載入 - Day 18');

// 為了確保 XPathResult 可用，我們添加一個檢查
if (typeof XPathResult === 'undefined') {
  // 在某些環境中可能需要這樣定義 XPathResult 常量
  // 但在 Chrome 擴展環境中通常已經可用
  console.log('⚠️ XPathResult 未定義，但在 Chrome 環境中通常不需要特別處理');
}

// 擴充功能安裝事件

// 更新消息監聽器以支援新的處理函數
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background 收到消息:', request);
  
  if (request.action === 'generateSchedule') {
    console.log('🚀 開始精確課表生成流程');
    handlePreciseScheduleGeneration(request, sendResponse);
    return true;
  }
  
  if (request.action === 'getSettings') {
    handleGetSettings(sendResponse);
    return true;
  }
  
  if (request.action === 'scheduleDataReady') {
    console.log('✅ 課表資料已準備完成，開啟課表頁面');
    // 關閉可能存在的工作分頁
    if (sender.tab && sender.tab.id) {
      closeWorkingTab(sender.tab.id).then(() => {
        // 開啟自定義課表頁面
        chrome.tabs.create({ url: 'schedule.html' });
      });
    } else {
      chrome.tabs.create({ url: 'schedule.html' });
    }
    sendResponse({ success: true, message: '課表頁面已開啟' });
    return true;
  }
  
  console.log('❓ 未知的消息類型:', request.action);
  sendResponse({ success: false, error: '未知的操作類型' });
});



// 基本的課表生成處理函數（新增分頁控制）
async function handleBasicScheduleGeneration(request, sendResponse) {
  try {
    console.log('🗺️ 開始課表生成流程 - 分頁控制版本');
    
    // 步驟 1：記錄請求資訊
    console.log('📝 步驟 1: 記錄用戶請求');
    console.log('來源頁面:', request.data.url);
    console.log('請求時間:', request.data.timestamp);
    
    // 步驟 2：開啟課表頁面
    console.log('🌐 步驟 2: 開啟課表頁面');
    const tabResult = await openSchedulePage();
    
    if (!tabResult.success) {
      throw new Error('無法開啟課表頁面: ' + tabResult.error);
    }
    
    console.log('✅ 課表頁面已開啟，分頁 ID:', tabResult.tabId);
    
    // 步驟 3：等待頁面載入（模擬）
    console.log('⏳ 步驟 3: 等待頁面載入');
    await simulatePageProcessing(tabResult.tabId);
    
    // 步驟 4：關閉工作分頁
    console.log('🧹 步驟 4: 清理工作分頁');
    await closeWorkingTab(tabResult.tabId);
    
    // 步驟 5：開啟結果頁面
    console.log('🎉 步驟 5: 開啟課表結果頁面');
    chrome.tabs.create({ url: 'schedule.html' });
    
    // 成功回應
    sendResponse({ 
      success: true, 
      message: '分頁控制流程完成',
      data: {
        processedAt: new Date().toISOString(),
        fromUrl: request.data.url,
        tabId: tabResult.tabId
      }
    });
    
  } catch (error) {
    console.error('❌ 分頁控制流程失敗:', error);
    sendResponse({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// 檢查頁面是否已完全載入
function isPageFullyLoaded(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: () => {
        return document.readyState === 'complete';
      }
    }, (results) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      
      if (results && results[0]) {
        resolve(results[0].result === true);
      } else {
        resolve(false);
      }
    });
  });
}

// 開啟課表頁面函數（修改版）
async function openSchedulePage() {
  return new Promise(async (resolve) => {
    console.log('🌐 正在開啟輔大課表頁面...');
    
    try {
      // 首先檢查是否有活動的輔大入口網站分頁
      const tabs = await new Promise(resolve => {
        chrome.tabs.query({url: 'https://portal.fju.edu.tw/student/*'}, resolve);
      });
      
      if (tabs && tabs.length > 0) {
        const portalTab = tabs[0];
        console.log('✅ 找到輔大入口網站分頁:', portalTab.url);
        
        // 等待頁面完全載入
        console.log('⏳ 等待入口網站頁面完全載入...');
        let isLoaded = false;
        const startTime = Date.now();
        while (!isLoaded && (Date.now() - startTime) < 10000) {
          isLoaded = await isPageFullyLoaded(portalTab.id);
          if (!isLoaded) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (!isLoaded) {
          throw new Error('入口網站頁面載入超時');
        }
        
        console.log('✅ 入口網站頁面已完全載入');
        
        // 監聽分頁更新，以便捕獲導向後的課表頁面
        let navigationCompleted = false;
        let finalUrl = '';
        const tabUpdateListener = (tabId, changeInfo, tab) => {
          if (tabId === portalTab.id && changeInfo.status === 'complete' && 
              tab.url && tab.url.includes('estu.fju.edu.tw')) {
            console.log('✅ 檢測到課表頁面導向完成:', tab.url);
            navigationCompleted = true;
            finalUrl = tab.url;
            chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          }
        };
        chrome.tabs.onUpdated.addListener(tabUpdateListener);
        
        // 在入口網站頁面中點擊課表按鈕
        const injectionResult = await new Promise(resolve => {
          chrome.scripting.executeScript({
            target: { tabId: portalTab.id },
            function: () => {
              // 尋找並點擊課表按鈕
              const scheduleButton = document.evaluate(
                '//*[@id="systemID_15"]',
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
              ).singleNodeValue;
              
              if (scheduleButton) {
                console.log('✅ 找到課表按鈕，正在點擊...');
                scheduleButton.click();
                return { success: true, message: '按鈕點擊成功' };
              } else {
                console.error('❌ 無法找到課表按鈕');
                return { success: false, error: '無法找到課表按鈕' };
              }
            }
          }, (results) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            
            if (results && results[0]) {
              resolve(results[0].result);
            } else {
              resolve({ success: false, error: '無法執行腳本' });
            }
          });
        });
        
        if (!injectionResult.success) {
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          throw new Error(injectionResult.error || '點擊按鈕失敗');
        }
        
        // 等待頁面導向完成（最多等待10秒）
        const navStartTime = Date.now();
        while (!navigationCompleted && (Date.now() - navStartTime) < 10000) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        
        if (!navigationCompleted) {
          throw new Error('頁面導向超時');
        }
        
        // 等待課表頁面資料提取完成
        console.log('⏳ 等待課表資料提取完成...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 關閉原分頁並打開我們的 schedule.html
        console.log('🔄 關閉原分頁並打開自定義課表頁面');
        await closeWorkingTab(portalTab.id);
        
        // 開啟自定義的課表頁面
        chrome.tabs.create({ 
          url: 'schedule.html',
          active: true
        }, (newTab) => {
          console.log('✅ 自定義課表頁面開啟成功');
          resolve({ 
            success: true, 
            tabId: newTab.id,
            tabInfo: {
              url: newTab.url,
              status: newTab.status
            }
          });
        });
        return;
      }
      
      // 如果沒有找到入口網站分頁，則直接開啟課表頁面
      console.log('⚠️ 未找到輔大入口網站分頁，直接開啟課表頁面');
      const scheduleUrl = 'http://estu.fju.edu.tw/CheckSelList/HisListNew.aspx';
      
      chrome.tabs.create({ 
        url: scheduleUrl, 
        active: false,  // 在背景開啟，不打擾用戶
        pinned: false   // 不固定分頁
      }, (tab) => {
        // 檢查是否有錯誤
        if (chrome.runtime.lastError) {
          console.error('❌ 開啟分頁失敗:', chrome.runtime.lastError.message);
          resolve({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
          return;
        }
        
        // 檢查分頁是否成功建立
        if (!tab || !tab.id) {
          console.error('❌ 分頁建立失敗：無法獲取分頁資訊');
          resolve({ 
            success: false, 
            error: '分頁建立失敗' 
          });
          return;
        }
        
        console.log('✅ 課表頁面開啟成功');
        console.log('📊 分頁資訊:', {
          id: tab.id,
          url: tab.url,
          status: tab.status
        });
        
        resolve({ 
          success: true, 
          tabId: tab.id,
          tabInfo: {
            url: tab.url,
            status: tab.status
          }
        });
      });
    } catch (error) {
      console.error('❌ 開啟課表頁面時發生錯誤:', error);
      resolve({ 
        success: false, 
        error: error.message 
      });
    }
  });
}

// 關閉工作分頁函數
function closeWorkingTab(tabId) {
  return new Promise((resolve) => {
    console.log('🧹 正在關閉工作分頁，ID:', tabId);
    
    // 檢查分頁 ID 是否有效
    if (!tabId || typeof tabId !== 'number') {
      console.warn('⚠️ 無效的分頁 ID，跳過關閉操作');
      resolve();
      return;
    }
    
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {
        // 分頁可能已經被用戶關閉，這是正常情況
        console.warn('⚠️ 關閉分頁時出現提示:', chrome.runtime.lastError.message);
      } else {
        console.log('✅ 工作分頁已成功關閉');
      }
      
      // 無論成功或失敗都繼續流程
      resolve();
    });
  });
}
// 等待分頁載入完成
function waitForTabLoad(tabId, timeout = 15000) {
  return new Promise((resolve, reject) => {
    console.log('⏳ 開始監聽分頁載入狀態，ID:', tabId);
    
    // 設定超時處理
    const timeoutId = setTimeout(() => {
      console.error('❌ 等待分頁載入超時');
      reject(new Error('分頁載入超時'));
    }, timeout);
    
    // 監聽分頁更新事件
    const listener = (updatedTabId, changeInfo, tab) => {
      // 只處理目標分頁的更新
      if (updatedTabId !== tabId) {
        return;
      }
      
      console.log('📊 分頁狀態更新:', {
        tabId: updatedTabId,
        status: changeInfo.status,
        url: changeInfo.url
      });
      
      // 當分頁載入完成時
      if (changeInfo.status === 'complete') {
        console.log('✅ 分頁載入完成');
        
        // 清理資源
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        
        resolve(tab);
      }
    };
    
    // 註冊監聽器
    chrome.tabs.onUpdated.addListener(listener);
    
    // 檢查分頁是否已經載入完成
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('無法獲取分頁資訊: ' + chrome.runtime.lastError.message));
        return;
      }
      
      if (tab.status === 'complete') {
        console.log('✅ 分頁已經載入完成');
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      }
    });
  });
}
// 模擬頁面處理流程
async function simulatePageProcessing(tabId) {
  try {
    console.log('🔄 開始模擬頁面處理流程');
    
    // 等待頁面載入
    console.log('⏳ 等待頁面載入完成...');
    await waitForTabLoad(tabId);
    
    // 額外等待確保頁面完全渲染
    console.log('🎨 等待頁面渲染完成...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 模擬資料處理
    console.log('📊 模擬資料處理中...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ 頁面處理流程完成');
    
    return {
      success: true,
      message: '模擬處理完成',
      processedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ 頁面處理流程失敗:', error);
    throw error;
  }
}
// 精確的分頁狀態監聽函數
function waitForTabCompleteLoad(tabId, timeout = 20000) {
  return new Promise((resolve, reject) => {
    console.log('🎯 開始精確監聽分頁載入狀態，ID:', tabId);
    
    let isResolved = false;
    
    // 設定超時處理
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        console.error('❌ 等待分頁載入超時');
        isResolved = true;
        reject(new Error('分頁載入超時'));
      }
    }, timeout);
    
    // 分頁狀態變化監聽器
    const stateListener = (updatedTabId, changeInfo, tab) => {
      // 只處理目標分頁
      if (updatedTabId !== tabId || isResolved) {
        return;
      }
      
      console.log('📊 分頁狀態更新:', {
        tabId: updatedTabId,
        status: changeInfo.status,
        url: changeInfo.url?.substring(0, 50) + '...'
      });
      
      // 當分頁完全載入時
      if (changeInfo.status === 'complete') {
        console.log('✅ 分頁載入完全完成');
        
        // 清理資源並回傳結果
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(stateListener);
        isResolved = true;
        
        resolve({
          tabId: tab.id,
          url: tab.url,
          title: tab.title,
          status: tab.status
        });
      }
    };
    
    // 註冊監聽器
    chrome.tabs.onUpdated.addListener(stateListener);
    
    // 檢查分頁當前狀態
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || isResolved) {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(stateListener);
        if (!isResolved) {
          isResolved = true;
          reject(new Error('無法獲取分頁資訊'));
        }
        return;
      }
      
      console.log('📋 分頁當前狀態:', tab.status);
      
      // 如果已經載入完成，直接返回
      if (tab.status === 'complete') {
        console.log('✅ 分頁已經載入完成');
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(stateListener);
        isResolved = true;
        resolve({
          tabId: tab.id,
          url: tab.url,
          title: tab.title,
          status: tab.status
        });
      }
    });
  });
}


// 檢查頁面是否準備就緒（修正版）
function checkPageReady(tabId) {
  return new Promise((resolve, reject) => {
    console.log('🔍 檢查頁面是否準備就緒');
    
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: () => {
        // 在頁面中執行的檢查函數
        try {
          console.log('🔍 開始檢查頁面元素...');
          
          // 檢查基本 DOM 結構
          const hasBody = document.body !== null;
          const hasTitle = document.title.length > 0;
          const domReady = document.readyState === 'complete';
          
          // 檢查是否有表單元素（課表頁面的特徵，但不強制要求）
          const hasForms = document.forms.length > 0;
          
          // 檢查特定的課表元素（作為額外資訊，不影響準備狀態）
          const hasStudentInfo = document.querySelector('#LabStuno1') !== null;
          const hasCourseTable = document.querySelector('#GV_NewSellist') !== null;
          
          const result = {
            ready:hasCourseTable,
            domReady: domReady,
            hasBody: hasBody,
            hasTitle: hasTitle,
            hasForms: hasForms,
            hasStudentInfo: hasStudentInfo,
            hasCourseTable: hasCourseTable,
            pageTitle: document.title,
            url: window.location.href,
            checkTime: new Date().toISOString()
          };
          
          console.log('📊 頁面檢查結果:', result);
          return result;
          
        } catch (error) {
          console.error('❌ 頁面檢查出錯:', error);
          return {
            ready: true, // 即使檢查出錯，也假設頁面已準備就緒
            error: error.message || '未知檢查錯誤',
            fallback: true,
            errorType: 'script_execution_error',
            checkTime: new Date().toISOString()
          };
        }
      }
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.warn('⚠️ 執行頁面檢查腳本失敗，假設頁面已準備就緒:', chrome.runtime.lastError);
        // 如果腳本執行失敗，假設頁面已準備就緒
        resolve({
          ready: true,
          fallback: true,
          error: chrome.runtime.lastError.message || '腳本執行失敗',
          errorType: 'chrome_api_error',
          checkTime: new Date().toISOString()
        });
        return;
      }
      
      if (results && results[0] && results[0].result) {
        const checkResult = results[0].result;
        console.log('✅ 頁面檢查完成:', checkResult);
        resolve(checkResult);
      } else {
        console.warn('⚠️ 無法獲取頁面檢查結果，假設頁面已準備就緒');
        resolve({
          ready: true,
          fallback: true,
          error: '無法獲取檢查結果',
          errorType: 'no_result_error',
          checkTime: new Date().toISOString()
        });
      }
    });
  });
}


// 等待頁面完全準備就緒（修正版）
async function waitForPageFullyReady(tabId) {
  try {
    console.log('⏳ 開始等待頁面完全準備就緒');
    
    // 步驟 1：等待基本載入完成
    console.log('📊 步驟 1: 等待分頁載入完成');
    const tabInfo = await waitForTabCompleteLoad(tabId);
    console.log('✅ 分頁載入完成:', tabInfo.title);
    
    // 步驟 2：額外等待確保渲染完成
    console.log('🎨 步驟 2: 等待頁面渲染');
    await new Promise(resolve => setTimeout(resolve, 3000)); // 延長等待時間
    
    // 步驟 3：檢查頁面元素準備狀態（但不強制要求）
    console.log('🔍 步驟 3: 檢查頁面元素');
    const pageStatus = await checkPageReady(tabId);
    // 修正：即使檢查失敗也繼續執行，並提供更詳細的日誌
    if (!pageStatus.ready) {
      const errorInfo = pageStatus.error || pageStatus.fallback ? '元素檢查容錯模式' : '檢查條件未滿足';
      console.warn('⚠️ 頁面檢查顯示未準備就緒，但繼續執行:', errorInfo);
      console.log('📊 頁面狀態詳情:', {
        ready: pageStatus.ready,
        hasBody: pageStatus.hasBody,
        hasTitle: pageStatus.hasTitle,
        domReady: pageStatus.domReady,
        fallback: pageStatus.fallback,
        error: pageStatus.error
      });
      // 不拋出錯誤，繼續執行
    } else {
      console.log('✅ 頁面元素檢查成功');
    }
    
    console.log('✅ 頁面完全準備就緒');
    return {
      tabInfo: tabInfo,
      pageStatus: pageStatus,
      readyAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ 等待頁面準備失敗:', error);
    throw error;
  }
}


// 更新後的課表生成處理函數
async function handlePreciseScheduleGeneration(request, sendResponse) {
  try {
    console.log('🚀 開始精確課表生成流程');
    
    // 步驟 1：開啟課表頁面
    console.log('🌐 步驟 1: 開啟課表頁面');
    const tabResult = await openSchedulePage();
    
    if (!tabResult.success) {
      throw new Error('無法開啟課表頁面: ' + tabResult.error);
    }
    
    const tabId = tabResult.tabId;
    console.log('✅ 課表頁面已開啟，分頁 ID:', tabId);
    
    // 檢查是否已經跳轉到我們的 schedule.html
    if (tabResult.tabInfo && tabResult.tabInfo.url && tabResult.tabInfo.url.includes('schedule.html')) {
      console.log('✅ 已經跳轉到自定義課表頁面，跳過後續步驟');
      
      // 成功回應
      sendResponse({
        success: true,
        message: '精確課表生成流程完成',
        data: {
          processedAt: new Date().toISOString(),
          tabInfo: tabResult.tabInfo,
          pageReady: true
        }
      });
      return;
    }
    
    // 步驟 2：精確等待頁面準備完成
    console.log('⏳ 步驟 2: 精確等待頁面準備');
    const readyInfo = await waitForPageFullyReady(tabId);
    console.log('✅ 頁面準備完成');
    
    // 步驟 3：模擬資料處理（下次課程會實作真實提取）
    console.log('📊 步驟 3: 模擬資料處理');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 步驟 4：關閉工作分頁
    console.log('🧹 步驟 4: 清理工作分頁');
    await closeWorkingTab(tabId);
    
    // 步驟 5：開啟結果頁面
    console.log('🎉 步驟 5: 開啟結果頁面');
    chrome.tabs.create({ url: 'schedule.html' });
    
    // 成功回應
    sendResponse({
      success: true,
      message: '精確課表生成流程完成',
      data: {
        processedAt: new Date().toISOString(),
        tabInfo: readyInfo.tabInfo,
        pageReady: readyInfo.pageStatus.ready
      }
    });
    
  } catch (error) {
    console.error('❌ 精確課表生成流程失敗:', error);
    sendResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}


