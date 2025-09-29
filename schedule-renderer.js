// schedule-renderer.js - Day 27 課表渲染引擎（完整版）
// ==========================================
// 功能：從 Chrome Storage 讀取課表資料並渲染到 schedule.html 頁面
// 包含重新載入、圖片匯出功能和主題系統
// ==========================================

console.log('🚀 課表渲染引擎已載入 - Day 27');

// 輔大課程時間段定義
const TIME_PERIODS = {
  '1': { time: '08:10-09:00', display: '第一節' },
  '2': { time: '09:10-10:00', display: '第二節' },
  '3': { time: '10:10-11:00', display: '第三節' },
  '4': { time: '11:10-12:00', display: '第四節' },
  'n': { time: '12:10-13:00 <br>or<br> 12:40-13:00 ', display: 'DN' }, // DN 時段
  '5': { time: '13:40-14:30', display: '第五節' },
  '6': { time: '14:40-15:30', display: '第六節' },
  '7': { time: '15:40-16:30', display: '第七節' },
  '8': { time: '16:40-17:30', display: '第八節' },
  'E0': { time: '17:40-18:30', display: 'E0' }
};

// 正確的時間段順序
const PERIOD_ORDER = ['1', '2', '3', '4', 'n', '5', '6', '7', '8', 'E0'];

// 星期對照表
const DAY_MAP = {
  '一': 1,
  '二': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '日': 0
};

// 反向星期對照表
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

// 課表渲染引擎核心類別
class ScheduleRenderer {
  constructor() {
    this.storageKey = 'fjuScheduleData';
    this.currentTheme = 'default';
    this.log('🎨 課表渲染引擎初始化完成');
  }

  // 讀取儲存的課表資料
  async loadScheduleData() {
    try {
      this.log('📖 開始讀取儲存的課表資料');

      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get([this.storageKey], (items) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(items);
          }
        });
      });

      const scheduleData = result[this.storageKey];

      // 調試輸出
      this.log('🔍 儲存資料結構:');
      this.log(JSON.stringify(scheduleData, null, 2));

      if (!scheduleData) {
        throw new Error('未找到儲存的課表資料');
      }

      this.log('✅ 成功讀取課表資料');
      return scheduleData;

    } catch (error) {
      this.log(`❌ 讀取課表資料失敗: ${error.message}`);
      throw error;
    }
  }

  // 渲染學生資訊
  renderStudentInfo(scheduleData) {
    this.log('👤 開始渲染學生資訊');

    try {
      // 更新學生資訊顯示
      document.getElementById('semesterInfo').textContent = scheduleData.學期 || '未知學期';
      document.getElementById('departmentInfo').textContent = scheduleData.學生資訊?.系級 || '未知系級';
      document.getElementById('studentIdInfo').textContent = scheduleData.學生資訊?.學號 || '未知學號';
      document.getElementById('nameInfo').textContent = scheduleData.學生資訊?.姓名 || '未知姓名';
      document.getElementById('creditsInfo').textContent = scheduleData.學生資訊?.總學分 || '未知學分';

      this.log('✅ 學生資訊渲染完成');
    } catch (error) {
      this.log(`❌ 學生資訊渲染失敗: ${error.message}`);
    }
  }

  // 解析課程時間段
  parseCoursePeriods(periodString) {
    if (!periodString) return [];

    // 處理多個時段（如 "1,2,3"）
    return periodString.split(',').map(p => p.trim());
  }

  // 建立課表網格結構
  createScheduleGrid() {
    this.log('📊 建立課表網格結構');

    const scheduleBody = document.getElementById('scheduleBody');
    if (!scheduleBody) {
      throw new Error('找不到課表主體元素');
    }

    // 清空現有內容
    scheduleBody.innerHTML = '';

    // 按照正確的時間順序建立時間段行
    PERIOD_ORDER.forEach(periodKey => {
      const periodInfo = TIME_PERIODS[periodKey];
      if (!periodInfo) return;

      const row = document.createElement('tr');

      // 時間欄位
      const timeCell = document.createElement('td');
      timeCell.innerHTML = `
        <div class="time-period">${periodInfo.display}</div>
        <div class="time-range">${periodInfo.time}</div>
      `;
      row.appendChild(timeCell);

      // 星期欄位（週一到週五）
      for (let day = 1; day <= 5; day++) {
        const dayCell = document.createElement('td');
        dayCell.setAttribute('data-period', periodKey);
        dayCell.setAttribute('data-day', day);
        dayCell.className = 'schedule-cell';
        row.appendChild(dayCell);
      }

      scheduleBody.appendChild(row);
    });

    this.log('✅ 課表網格結構建立完成');
  }

  // 渲染課程到課表
  renderCourses(courses) {
    this.log(`📚 開始渲染 ${courses.length} 門課程`);

    // 清除所有現有的課程卡片
    document.querySelectorAll('.course-card').forEach(card => card.remove());

    courses.forEach((course, index) => {
      try {
        if (!course.上課時間 || !Array.isArray(course.上課時間)) {
          this.log(`⚠️ 課程 ${course.課程名稱} 缺少時間資訊，跳過渲染`);
          return;
        }

        course.上課時間.forEach((timeSlot, slotIndex) => {
          const day = DAY_MAP[timeSlot.星期];
          const periods = this.parseCoursePeriods(timeSlot.節次);

          // 檢查是否為有效星期（週一到週五）
          if (day === undefined || day < 1 || day > 5) {
            this.log(`⚠️ 課程 ${course.課程名稱} 星期資訊無效: ${timeSlot.星期}`);
            return;
          }

          // 為每個時段創建課程卡片
          periods.forEach(period => {
            const cell = document.querySelector(`td[data-period="${period}"][data-day="${day}"]`);

            if (cell) {
              const courseCard = document.createElement('div');
              courseCard.className = 'course-card';
              courseCard.innerHTML = `
                <div class="course-name">${course.課程名稱}</div>
                <div class="course-room">${timeSlot.教室 || '未指定教室'}</div>
              `;

              // 添加一些樣式變化以區分不同課程
              const colors = ['#4a90e2', '#66bb6a', '#9575cd', '#ffb74d', '#9fa8da', '#006064'];
              const color = colors[index % colors.length];
              courseCard.style.borderLeft = `4px solid ${color}`;

              cell.appendChild(courseCard);
            } else {
              this.log(`⚠️ 找不到對應的課表格子: 星期${timeSlot.星期} 第${period}節`);
            }
          });
        });
      } catch (error) {
        this.log(`❌ 渲染課程 ${course.課程名稱} 時發生錯誤: ${error.message}`);
      }
    });

    this.log('✅ 課程渲染完成');
  }

  // 應用主題
  applyTheme(themeName) {
    this.log(`🎨 應用主題: ${themeName}`);

    document.documentElement.setAttribute('data-theme', themeName);
    this.currentTheme = themeName;

    // 儲存主題選擇
    localStorage.setItem('fjuScheduleTheme', themeName);

    // 更新主題選擇器顯示
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
      themeSelector.value = themeName;
    }
  }

  // 初始化主題選擇器
  initThemeSelector() {
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
      // 恢復上次選擇的主題
      const savedTheme = localStorage.getItem('fjuScheduleTheme') || 'default';
      themeSelector.value = savedTheme;
      this.applyTheme(savedTheme);

      // 綁定主題切換事件
      themeSelector.addEventListener('change', (event) => {
        this.applyTheme(event.target.value);
      });
    }
  }

  // 初始化控制按鈕
  initControls() {
    // 重新載入按鈕
    const refreshBtn = document.getElementById('refreshDataBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        try {
          refreshBtn.disabled = true;
          refreshBtn.textContent = '🔄 載入中...';

          await this.reloadSchedule();

          refreshBtn.disabled = false;
          refreshBtn.textContent = '🔄 重新載入';

        } catch (error) {
          refreshBtn.disabled = false;
          refreshBtn.textContent = '🔄 重新載入';
          this.showNotification('重新載入失敗: ' + error.message, 'error');
        }
      });
    }

    // 匯出圖片按鈕
    const exportImageBtn = document.getElementById('exportImageBtn');
    if (exportImageBtn) {
      exportImageBtn.addEventListener('click', () => {
        this.exportAsImage();
      });
    }
  }

  // 重新載入課表
  async reloadSchedule() {
    this.log('🔄 開始重新載入課表');

    try {
      // 顯示載入狀態
      this.showNotification('正在重新載入課表...', 'info');

      // 重新渲染課表
      const success = await this.renderSchedule();

      if (success) {
        this.showNotification('課表重新載入成功', 'success');
      } else {
        this.showNotification('課表重新載入失敗', 'error');
      }

      return success;

    } catch (error) {
      this.log(`❌ 重新載入失敗: ${error.message}`);
      this.showNotification('重新載入失敗: ' + error.message, 'error');
      return false;
    }
  }

  // 匯出為圖片
  exportAsImage() {
    this.log('🖼️ 開始匯出為圖片');

    try {
      // 檢查是否有所需的庫
      if (typeof html2canvas === 'undefined') {
        this.showNotification('缺少 html2canvas 庫，請先引入該庫', 'error');
        return;
      }

      // 獲取課表表格
      const scheduleTable = document.querySelector('.schedule-table');
      if (!scheduleTable) {
        throw new Error('找不到課表表格');
      }

      // 顯示匯出狀態
      this.showNotification('正在生成圖片...', 'info');

      // 使用 html2canvas 轉換為圖片
      html2canvas(scheduleTable, {
        scale: 2, // 提高圖片品質
        useCORS: true,
        backgroundColor: '#ffffff'
      }).then(canvas => {
        // 轉換為圖片數據
        const imageData = canvas.toDataURL('image/png');

        // 創建下載連結
        const link = document.createElement('a');
        link.download = `輔大課表_${new Date().toISOString().split('T')[0]}.png`;
        link.href = imageData;
        link.click();

        this.showNotification('課表圖片匯出成功', 'success');
        this.log('✅ 課表圖片匯出完成');
      }).catch(error => {
        throw error;
      });

    } catch (error) {
      this.log(`❌ 圖片匯出失敗: ${error.message}`);
      this.showNotification('圖片匯出失敗: ' + error.message, 'error');
    }
  }

  // 顯示通知
  showNotification(message, type = 'info') {
    // 移除現有的通知
    const existingNotification = document.querySelector('.schedule-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `schedule-notification notification-${type}`;
    notification.textContent = message;

    // 添加樣式
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 5px;
      color: white;
      font-weight: bold;
      z-index: 10000;
      transition: opacity 0.3s;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      ${type === 'success' ? 'background-color: #28a745;' :
        type === 'error' ? 'background-color: #dc3545;' :
          type === 'warning' ? 'background-color: #ffc107; color: #212529;' :
            'background-color: #007bff;'
      }
    `;

    document.body.appendChild(notification);

    // 3秒後自動移除
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // 渲染完整課表
  async renderSchedule() {
    this.log('🚀 開始渲染完整課表');

    try {
      // 讀取儲存的課表資料
      const scheduleData = await this.loadScheduleData();

      // 渲染學生資訊
      this.renderStudentInfo(scheduleData);

      // 建立課表網格
      this.createScheduleGrid();

      // 渲染課程
      this.renderCourses(scheduleData.課程清單);

      // 執行響應式調整
      this.adjustForScreenSize();

      this.log('🎉 課表渲染完成');
      return true;

    } catch (error) {
      this.log(`❌ 課表渲染失敗: ${error.message}`);
      this.showNotification('課表渲染失敗: ' + error.message, 'error');
      return false;
    }
  }

  // 響應式調整
  adjustForScreenSize() {
    const isMobile = window.innerWidth <= 767;
    const scheduleWrapper = document.querySelector('.schedule-wrapper');
    const scheduleTable = document.querySelector('.schedule-table');

    if (isMobile && scheduleWrapper) {
      // 在行動裝置上確保課表可以橫向滾動
      scheduleWrapper.style.overflowX = 'auto';
      scheduleWrapper.style.webkitOverflowScrolling = 'touch';

      // 添加滾動提示
      if (scheduleTable) {
        // 檢查是否已存在提示
        const existingHint = scheduleWrapper.querySelector('.scroll-hint');
        if (!existingHint) {
          const hint = document.createElement('div');
          hint.className = 'scroll-hint';
          hint.textContent = '↔️ 滑動查看完整課表';
          scheduleWrapper.style.position = 'relative';
          scheduleWrapper.appendChild(hint);

          // 3秒後淡出提示
          setTimeout(() => {
            hint.style.opacity = '0';
            setTimeout(() => {
              if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
              }
            }, 500);
          }, 3000);
        }
      }
    }
  }

  // 日誌輸出
  log(message) {
    console.log(`[ScheduleRenderer] ${message}`);
  }
}

// 初始化渲染引擎
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎯 開始初始化課表渲染引擎');

  try {
    const renderer = new ScheduleRenderer();

    // 初始化主題選擇器
    renderer.initThemeSelector();

    // 初始化控制按鈕
    renderer.initControls();

    // 渲染課表
    await renderer.renderSchedule();

    // 監聽視窗大小變化以進行響應式調整
    window.addEventListener('resize', () => {
      renderer.adjustForScreenSize();
    });

    console.log('✅ 課表渲染引擎初始化完成');

    // 添加測試函數供調試使用
    window.testScheduleRenderer = renderer;

  } catch (error) {
    console.error('❌ 課表渲染引擎初始化失敗:', error);

    // 顯示錯誤通知
    const notification = document.createElement('div');
    notification.className = 'schedule-notification notification-error';
    notification.textContent = '課表載入失敗: ' + error.message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 5px;
      background-color: #dc3545;
      color: white;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    `;
    document.body.appendChild(notification);
  }
});