// popup.js - Day 12 完整版本（含錯誤處理）
console.log('🎨 Popup 腳本已載入');

// 簡化的錯誤處理

document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM 載入完成');
  try {
    initializeButtons();
    initializeStatus();
  } catch (error) {
    console.error('❌ 初始化失敗:', error);
    showStatus('初始化失敗', 'error');
  }
});

function initializeButtons() {
  const generateButton = document.getElementById('generateButton');
  const viewScheduleButton = document.getElementById('viewScheduleButton');
  const settingsButton = document.getElementById('settingsButton');
  
  if (!generateButton || !viewScheduleButton || !settingsButton) {
    throw new Error('找不到必要的按鈕元素');
  }
  
  generateButton.addEventListener('click', handleGenerateClick);
  viewScheduleButton.addEventListener('click', handleViewScheduleClick);
  settingsButton.addEventListener('click', handleSettingsClick);
  
  console.log('✅ 所有按鈕事件已綁定');
}

function initializeStatus() {
  showStatus('準備就緒', 'success');
}

function showStatus(message, type = 'info') {
  try {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) {
      throw new Error('找不到狀態顯示元素');
    }
    
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.classList.remove('success', 'error', 'info');
    statusDiv.classList.add(type);
    
    console.log(`📊 狀態更新: ${message} (${type})`);
  } catch (error) {
    console.error('❌ 狀態顯示失敗:', error);
  }
}

function showLoadingStatus(message) {
  try {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    statusDiv.innerHTML = `${message} <span class="loading">⏳</span>`;
    statusDiv.style.display = 'block';
    statusDiv.classList.remove('success', 'error');
    statusDiv.classList.add('info');
  } catch (error) {
    console.error('❌ 載入狀態顯示失敗:', error);
  }
}

function setButtonLoading(buttonId, loadingText) {
  try {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
  } catch (error) {
    console.error('❌ 按鈕狀態設定失敗:', error);
  }
}

function resetButton(buttonId) {
  try {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  } catch (error) {
    console.error('❌ 按鈕狀態重置失敗:', error);
  }
}

function handleViewScheduleClick() {
  console.log('🔘 查看課表按鈕被點擊');
  
  try {
    setButtonLoading('viewScheduleButton', '⏳ 載入中...');
    showLoadingStatus('正在檢查課表資料...');
    
    // 檢查是否有儲存的課表資料
    chrome.storage.local.get(['fjuScheduleData'], (result) => {
      resetButton('viewScheduleButton');
      
      if (chrome.runtime.lastError) {
        showStatus('儲存空間讀取失敗', 'error');
        console.error('❌ Chrome Storage 錯誤:', chrome.runtime.lastError);
        return;
      }
      
      if (result.fjuScheduleData) {
        // 有課表資料，開啟課表頁面
        chrome.tabs.create({
          url: chrome.runtime.getURL('schedule.html')
        });
        showStatus('正在開啟課表...', 'success');
      } else {
        // 沒有課表資料，提示用戶先生成課表
        showStatus('請先生成課表', 'error');
      }
    });
  } catch (error) {
    resetButton('viewScheduleButton');
    showStatus('系統錯誤，請重新啟動瀏覽器', 'error');
    console.error('❌ 查看課表錯誤:', error);
  }
}

function handleGenerateClick() {
  console.log('🔘 生成課表按鈕被點擊');
  
  try {
    setButtonLoading('generateButton', '⏳ 處理中...');
    showLoadingStatus('正在與背景腳本溝通...');
    
    chrome.runtime.sendMessage({
      action: 'generateSchedule',
      data: { timestamp: new Date().toISOString() }
    }, (response) => {
      resetButton('generateButton');

      if (chrome.runtime.lastError) {
        showStatus('連線失敗，請重新載入擴充功能', 'error');
        console.error('❌ Chrome API 錯誤:', chrome.runtime.lastError);
        return;
      }

      if (response && response.success) {
        showStatus('課表生成成功！', 'success');
        console.log('✅ 成功:', response);
      } else {
        const errorMsg = response?.error || '未知錯誤';
        showStatus('課表生成失敗：' + errorMsg, 'error');
      }
    });
  } catch (error) {
    resetButton('generateButton');
    showStatus('系統錯誤，請重新啟動瀏覽器', 'error');
    console.error('❌ 同步錯誤:', error);
  }
}

function handleSettingsClick() {
  console.log('🔘 設定按鈕被點擊');
  
  try {
    setButtonLoading('settingsButton', '⏳ 載入中...');
    showLoadingStatus('正在載入設定...');
    
    chrome.runtime.sendMessage({
      action: 'getSettings'
    }, (response) => {
      resetButton('settingsButton');

      if (chrome.runtime.lastError) {
        showStatus('連線失敗，請重新載入擴充功能', 'error');
        console.error('❌ Chrome API 錯誤:', chrome.runtime.lastError);
        return;
      }

      if (response && response.success) {
        const settings = response.settings;
        showStatus(`自動儲存：${settings.autoSave ? '開啟' : '關閉'}`, 'success');

        setTimeout(() => {
          showStatus('準備就緒', 'success');
        }, 3000);
      } else {
        showStatus('載入設定失敗', 'error');
      }
    });
  } catch (error) {
    resetButton('settingsButton');
    showStatus('系統錯誤，請重新啟動瀏覽器', 'error');
    console.error('❌ 設定同步錯誤:', error);
  }
}
