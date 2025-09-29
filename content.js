// content.js - Day 16 網頁按鈕注入版本
// ==========================================
// Day 23 整合完成 - 真實資料儲存測試系統
// ==========================================
// 使用方式：
// 1. 登入輔大學生系統 (http://estu.fju.edu.tw 或 https://portal.fju.edu.tw)
// 2. 進入選課清單頁面
// 3. 在瀏覽器控制台執行: runIntegratedTest()
// 
// 功能特色：
// - 使用真實的輔大課表資料而非測試資料
// - 支援複雜時段解析 (D7-E0, DN, 1,2,3 等)
// - 完整的資料驗證和狀態管理
// - 詳細的測試日誌和錯誤處理
// ==========================================
console.log('🌐 輔大網頁按鈕注入器已載入 - Day 16');

// 等待頁面載入完成
function waitForPageReady() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });
}

// 等待特定元素載入
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`等待元素超時: ${selector}`));
    }, timeout);
  });
}

// 創建「我的課表」按鈕
function createScheduleButton() {
  console.log('🔧 建立「我的課表」按鈕');
  
  const listItem = document.createElement('li');
  const button = document.createElement('a');
  
  button.href = '#';
  button.id = 'fjuScheduleButton';
  button.textContent = '我的課表';
  
  button.style.cssText = `
    color: #007bff;
    text-decoration: none;
    cursor: pointer;
    padding: 5px 0px;
    border-radius: 3px;
    transition: background-color 0.2s;
  `;
  
  // 滑鼠懸停效果
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = '#f0f8ff';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = 'transparent';
  });
  
  listItem.appendChild(button);
  return { listItem, button };
}

// 處理按鈕點擊事件
// 優化的按鈕點擊處理
function handleScheduleButtonClick(event) {
  event.preventDefault();
  console.log('📊 「我的課表」按鈕被點擊');
  
  const button = event.target;
  const originalText = button.textContent;
  
  // 更新按鈕狀態
  setButtonProcessing(button);
  
  // 發送消息給 background script
  chrome.runtime.sendMessage({
    action: 'generateSchedule',
    source: 'webpage',
    data: {
      url: window.location.href,
      timestamp: new Date().toISOString()
    }
  }, (response) => {
    // 處理回應並恢復按鈕狀態
    handleScheduleResponse(button, originalText, response);
  });
}

// 設定按鈕處理中狀態
function setButtonProcessing(button) {
  button.textContent = '⏳ 處理中...';
  button.style.pointerEvents = 'none';
  button.style.opacity = '0.7';
}

// 處理背景腳本的回應
function handleScheduleResponse(button, originalText, response) {
  // 恢復按鈕狀態
  button.textContent = originalText;
  button.style.pointerEvents = 'auto';
  button.style.opacity = '1';
  
  if (response && response.success) {
    console.log('✅ 課表生成成功');
    showNotification('課表生成成功！正在開啟結果頁面...', 'success');
  } else {
    console.error('❌ 課表生成失敗:', response?.error);
    showNotification('課表生成失敗：' + (response?.error || '未知錯誤'), 'error');
  }
}


// 顯示通知訊息
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.textContent = message;
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
    ${
      type === 'success' ? 'background-color: #28a745;' :
      type === 'error' ? 'background-color: #dc3545;' :
      'background-color: #007bff;'
    }
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// 課表資料提取和儲存函數
async function extractAndStoreScheduleData() {
  try {
    console.log('📊 開始提取和儲存課表資料...');
    
    // 創建資料管理器
    const dataManager = new ScheduleDataManager();
    
    // 使用前面建立的資料提取器
    const extractor = createDataExtractor();
    
    console.log('👤 開始提取學生資訊...');
    const studentResult = await extractor.extract('studentInfo');
    
    if (!studentResult.success) {
      throw new Error('學生資訊提取失敗: ' + studentResult.error);
    }
    
    console.log('📚 開始提取課程資料...');
    const courseResult = await extractor.extract('courseData');
    
    if (!courseResult.success) {
      throw new Error('課程資料提取失敗: ' + courseResult.error);
    }
    
    console.log('💾 開始儲存課表資料...');
    const saveResult = await dataManager.saveScheduleData(
      studentResult.data,
      courseResult.data
    );
    
    if (!saveResult.success) {
      throw new Error('課表資料儲存失敗: ' + saveResult.error);
    }
    
    console.log('✅ 課表資料提取和儲存完成');
    showNotification('課表資料儲存成功！', 'success');
    
    // 儲存完成後，發送消息給 background script 以打開 schedule.html
    chrome.runtime.sendMessage({
      action: 'scheduleDataReady',
      data: saveResult.data
    });
    
    return saveResult;
    
  } catch (error) {
    console.error('❌ 課表資料提取和儲存失敗:', error);
    showNotification('資料儲存失敗: ' + error.message, 'error');
    throw error;
  }
}

// 注入按鈕到網頁選單
async function injectScheduleButton() {
  try {
    console.log('🚀 開始注入「我的課表」按鈕');
    
    // 檢查是否在輔大入口網站頁面
    const isPortalPage = window.location.href.includes('portal.fju.edu.tw/student');
    const isEstuPage = window.location.href.includes('estu.fju.edu.tw');
    
    // 只在輔大入口網站或課表系統頁面注入按鈕
    if (!isPortalPage && !isEstuPage) {
      console.log('❌ 不在輔大學生系統頁面，跳過注入');
      return;
    }
    
    // 如果是課表系統頁面，執行資料提取和儲存
    if (isEstuPage) {
      console.log('📊 在課表系統頁面，執行資料提取...');
      // 等待頁面完全載入後執行資料提取
      setTimeout(async () => {
        try {
          await extractAndStoreScheduleData();
        } catch (error) {
          console.error('資料提取失敗:', error);
        }
      }, 2000);
      return;
    }
    
    // 等待頁面載入完成
    await waitForPageReady();
    
    // 等待選單容器載入（增加超時時間）
    const menuContainer = await waitForElement('#menuSelect ul', 10000);
    
    // 檢查是否已經注入過
    if (document.getElementById('fjuScheduleButton')) {
      console.log('⚠️ 按鈕已存在，跳過注入');
      return;
    }
    
    // 建立並注入按鈕
    const { listItem, button } = createScheduleButton();
    menuContainer.appendChild(listItem);
    
    // 綁定點擊事件
    button.addEventListener('click', handleScheduleButtonClick);
    
    console.log('✅ 「我的課表」按鈕注入成功');
    
  } catch (error) {
    console.error('❌ 按鈕注入失敗:', error);
  }
}

// 頁面載入完成後執行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectScheduleButton);
} else {
  injectScheduleButton();
}

console.log('🚀 輔大網頁按鈕注入器初始化完成 - Day 16');


// 資料提取架構核心類別
class DataExtractor {
  constructor() {
    this.validators = new Map();
    this.extractors = new Map();
    this.formatters = new Map();
    this.debugMode = true;
  }

  // 註冊資料驗證器
  registerValidator(type, validator) {
    this.validators.set(type, validator);
    this.log(`📋 已註冊驗證器: ${type}`);
  }

  // 註冊資料提取器
  registerExtractor(type, extractor) {
    this.extractors.set(type, extractor);
    this.log(`🔧 已註冊提取器: ${type}`);
  }

  // 註冊資料格式器
  registerFormatter(type, formatter) {
    this.formatters.set(type, formatter);
    this.log(`🎨 已註冊格式器: ${type}`);
  }

  // 執行完整的資料提取流程
  async extract(type, element = document) {
    try {
      this.log(`🚀 開始提取 ${type} 資料`);
      
      // 步驟 1：檢查提取器是否存在
      const extractor = this.extractors.get(type);
      if (!extractor) {
        throw new Error(`未找到 ${type} 的提取器`);
      }

      // 步驟 2：執行資料提取
      const rawData = await extractor(element);
      this.log(`📊 ${type} 原始資料提取完成`);

      // 步驟 3：資料驗證
      const validator = this.validators.get(type);
      if (validator) {
        const isValid = validator(rawData);
        if (!isValid) {
          this.log(`⚠️ ${type} 資料驗證失敗，使用容錯機制`);
        }
      }

      // 步驟 4：資料格式化
      const formatter = this.formatters.get(type);
      const formattedData = formatter ? formatter(rawData) : rawData;
      
      this.log(`✅ ${type} 資料提取成功`);
      return {
        success: true,
        data: formattedData,
        type: type,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.log(`❌ ${type} 資料提取失敗: ${error.message}`);
      return {
        success: false,
        error: error.message,
        type: type,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 日誌輸出
  log(message) {
    if (this.debugMode) {
      console.log(`[DataExtractor] ${message}`);
    }
  }
}
// DOM 查詢工具集
class DOMUtils {
  // 安全的元素查詢
  static safeQuery(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (error) {
      console.warn(`查詢失敗: ${selector}`, error);
      return null;
    }
  }

  // 安全的文字內容提取
  static safeTextContent(selector, context = document, defaultValue = '') {
    const element = this.safeQuery(selector, context);
    return element ? element.textContent.trim() : defaultValue;
  }

  // 批量查詢元素
  static safeQueryAll(selector, context = document) {
    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (error) {
      console.warn(`批量查詢失敗: ${selector}`, error);
      return [];
    }
  }

  // 等待元素出現
  static waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = this.safeQuery(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations) => {
        const element = this.safeQuery(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`元素 ${selector} 等待超時`));
      }, timeout);
    });
  }
}
// 學生資訊驗證器 - 改進版
function validateStudentInfo(data) {
  const required = ['department', 'studentId', 'name', 'totalCredits'];
  const invalidValues = ['未找到系級', '未找到學號', '未找到姓名', '未找到學分', '', null, undefined];
  
  for (const field of required) {
    if (!data[field] || invalidValues.includes(data[field])) {
      console.warn(`學生資訊驗證失敗: ${field} 欄位無效，當前值: "${data[field]}"`);
      
      // 提供詳細的錯誤訊息
      if (field === 'department') {
        console.warn('💡 建議檢查：');
        console.warn('1. 確認是否在正確的輔大學生系統頁面');
        console.warn('2. 檢查頁面是否完全載入');
        console.warn('3. 確認元素 #LabDptno1 是否存在');
      }
      
      return false;
    }
  }
  
  // 學號格式檢查（放寬限制）
  if (data.studentId && !/^\d{6,12}$/.test(data.studentId)) {
    console.warn('學號格式可能不正確，但繼續處理');
  }
  
  console.log('✅ 學生資訊驗證通過');
  return true;
}
// 課程資料驗證器
function validateCourseData(courses) {
  if (!Array.isArray(courses) || courses.length === 0) {
    console.warn('課程清單格式錯誤或為空');
    return false;
  }
  
  let validCourses = 0;
  
  courses.forEach((course, index) => {
    if (course.課程名稱 && course.上課時間 && course.上課時間.length > 0) {
      const timeInfo = course.上課時間[0];
      if (timeInfo.星期 && timeInfo.節次) {
        validCourses++;
      } else {
        console.warn(`課程 ${index + 1} 時間資訊不完整`);
      }
    } else {
      console.warn(`課程 ${index + 1} 基本資訊不完整`);
    }
  });
  
  const validRate = validCourses / courses.length;
  console.log(`📊 課程資料有效率: ${(validRate * 100).toFixed(1)}%`);
  
  return validRate >= 0.8; // 至少 80% 的課程資料有效
}
// DOM 元素檢測工具
function debugDOMElements() {
  console.log('🔍 檢查 DOM 元素狀態：');
  
  const elements = {
    '系級': '#LabDptno1',
    '學號': '#LabStuno1', 
    '姓名': '#LabStucna1',
    '學分': '#LabTotNum1',
    '學期': '#DDL_YM'
  };
  
  Object.entries(elements).forEach(([name, selector]) => {
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent?.trim();
      console.log(`✅ ${name} (${selector}): "${text}"`);
    } else {
      console.warn(`❌ ${name} (${selector}): 元素不存在`);
    }
  });
  
  // 檢查頁面狀態
  console.log('🌐 當前頁面資訊：');
  console.log(`- URL: ${window.location.href}`);
  console.log(`- 標題: ${document.title}`);
  console.log(`- 載入狀態: ${document.readyState}`);
}

// 學生資訊提取器
function extractStudentInfo(context = document) {
  console.log('📊 開始提取學生資訊');
  
  // 執行 DOM 檢測
  debugDOMElements();
  
  const studentInfo = {
    department: DOMUtils.safeTextContent('#LabDptno1', context, '未找到系級'),
    studentId: DOMUtils.safeTextContent('#LabStuno1', context, '未找到學號'),
    name: DOMUtils.safeTextContent('#LabStucna1', context, '未找到姓名'),
    totalCredits: DOMUtils.safeTextContent('#LabTotNum1', context, '未找到學分')
  };
  
  // 學期資訊提取
  const semesterSelect = DOMUtils.safeQuery('#DDL_YM', context);
  const semester = semesterSelect ? semesterSelect.value : '未知學期';
  
  console.log('📋 學生資訊提取結果:', studentInfo);
  
  // 驗證提取結果
  const isValid = validateStudentInfo(studentInfo);
  if (!isValid) {
    console.warn('⚠️ 學生資訊驗證失敗，但繼續處理');
  }
  
  return {
    ...studentInfo,
    semester: semester,
    isValid: isValid
  };
}
// 課程資料提取器
function extractCourseData(context = document) {
  console.log('📚 開始提取課程資料');
  
  const courses = [];
  const courseTable = DOMUtils.safeQuery('#GV_NewSellist', context);
  
  if (!courseTable) {
    console.warn('未找到課程表格');
    return courses;
  }
  
  const rows = DOMUtils.safeQueryAll('tr:not(:first-child)', courseTable);
  console.log(`📊 找到 ${rows.length} 行課程資料`);
  
  rows.forEach((row, index) => {
    try {
      const cells = DOMUtils.safeQueryAll('td', row);
      
      if (cells.length >= 17) {
        const courseName = cells[7]?.textContent?.trim();
        const weekday = cells[14]?.textContent?.trim();
        const timeInfo = cells[16]?.textContent?.trim();
        const classroom = cells[17]?.textContent?.trim();
        
        if (courseName && weekday && timeInfo) {
          courses.push({
            課程名稱: courseName,
            上課時間: [{
              星期: weekday,
              節次: timeInfo,
              教室: classroom || '未指定教室'
            }],
            原始索引: index
          });
        }
      }
    } catch (error) {
      console.warn(`處理第 ${index + 1} 行課程時出錯:`, error);
    }
  });
  
  console.log(`✅ 課程資料提取完成，共 ${courses.length} 門課程`);
  return courses;
}
// 建立並配置資料提取器
function createDataExtractor() {
  const extractor = new DataExtractor();
  
  // 註冊提取器
  extractor.registerExtractor('studentInfo', extractStudentInfo);
  extractor.registerExtractor('courseData', extractCourseData);
  
  // 註冊驗證器
  extractor.registerValidator('studentInfo', validateStudentInfo);
  extractor.registerValidator('courseData', validateCourseData);
  
  // 註冊格式器（暫時使用原始資料）
  extractor.registerFormatter('studentInfo', data => data);
  extractor.registerFormatter('courseData', data => data);
  
  return extractor;
}

// 測試函數
async function testDataExtraction() {
  console.log('🧪 開始測試資料提取架構');
  
  const extractor = createDataExtractor();
  
  try {
    // 測試學生資訊提取
    const studentResult = await extractor.extract('studentInfo');
    console.log('📊 學生資訊測試結果:', studentResult);
    
    // 測試課程資料提取
    const courseResult = await extractor.extract('courseData');
    console.log('📚 課程資料測試結果:', courseResult);
    
    console.log('✅ 資料提取架構測試完成');
    return { studentResult, courseResult };
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
    throw error;
  }
}

// 測試函數：驗證資料結構和顯示
async function testDataStructure() {
  console.log('🧪 開始測試資料結構...');
  
  try {
    // 檢查儲存的資料
    const storageData = await checkStorage();
    
    if (storageData && storageData.fjuScheduleData) {
      const scheduleData = storageData.fjuScheduleData;
      
      console.log('📋 資料結構分析:');
      console.log('- 學期類型:', typeof scheduleData.學期);
      console.log('- 學期值:', scheduleData.學期);
      console.log('- 學生資訊存在:', !!scheduleData.學生資訊);
      console.log('- 學生資訊類型:', typeof scheduleData.學生資訊);
      
      if (scheduleData.學生資訊) {
        console.log('- 系級:', scheduleData.學生資訊.系級);
        console.log('- 學號:', scheduleData.學生資訊.學號);
        console.log('- 姓名:', scheduleData.學生資訊.姓名);
        console.log('- 總學分:', scheduleData.學生資訊.總學分);
      }
      
      // 模擬渲染器的資料處理
      console.log('🎭 模擬渲染器資料處理:');
      const semester = scheduleData.學期 || '未知學期';
      const department = scheduleData.學生資訊?.系級 || '未知系級';
      const studentId = scheduleData.學生資訊?.學號 || '未知學號';
      const name = scheduleData.學生資訊?.姓名 || '未知姓名';
      const credits = scheduleData.學生資訊?.總學分 || '未知學分';
      
      console.log('顯示結果:');
      console.log('- 學期顯示:', semester);
      console.log('- 系級顯示:', department);
      console.log('- 學號顯示:', studentId);
      console.log('- 姓名顯示:', name);
      console.log('- 總學分顯示:', credits);
    }
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

// 測試函數：驗證資料顯示
function verifyDataDisplay() {
  console.log('🔍 驗證資料顯示...');
  
  // 模擬從 storage 讀取的資料
  const mockData = {
    學期: "1141",
    學生資訊: {
      系級: "資安",
      學號: "123456789",
      姓名: "測試學生",
      總學分: "18"
    },
    課程清單: []
  };
  
  console.log('模擬資料:', mockData);
  
  // 測試顯示邏輯
  const semester = mockData.學期 || '未知學期';
  const department = mockData.學生資訊?.系級 || '未知系級';
  const studentId = mockData.學生資訊?.學號 || '未知學號';
  const name = mockData.學生資訊?.姓名 || '未知姓名';
  const credits = mockData.學生資訊?.總學分 || '未知學分';
  
  console.log('驗證結果:');
  console.log('- 學期:', semester);
  console.log('- 系級:', department);
  console.log('- 學號:', studentId);
  console.log('- 姓名:', name);
  console.log('- 總學分:', credits);
  
  return {
    semester,
    department,
    studentId,
    name,
    credits
  };
}

// ==========================================
// 測試函數（請手動執行）
// ==========================================
// 简單資料提取測試： testDataExtraction()
// 完整儲存測試：   runIntegratedTest()
// 檢查儲存狀態：   checkStorage()
// ==========================================

// 快速檢查 Chrome Storage 內容
async function checkStorage() {
  console.log('🔍 檢查 Chrome Storage 內容...');
  
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(items);
        }
      });
    });
    
    console.log('💾 目前 Storage 中的所有資料:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.fjuScheduleData) {
      console.log('✅ 找到課表資料！');
      console.log('- 學期:', result.fjuScheduleData.學期);
      console.log('- 學生:', result.fjuScheduleData.學生資訊?.姓名);
      console.log('- 課程數量:', result.fjuScheduleData.課程清單?.length);
      console.log('- 更新時間:', result.fjuScheduleData.更新時間);
      
      // 顯示完整的學生資訊結構
      console.log('- 完整學生資訊:', result.fjuScheduleData.學生資訊);
    } else {
      console.log('❌ 未找到課表資料');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ 檢查 Storage 失敗:', error);
    return null;
  }
}

// 測試函數：創建示例課表資料並儲存
async function createTestScheduleData() {
  console.log('🧪 創建測試課表資料...');
  
  const dataManager = new ScheduleDataManager();
  
  // 示例學生資訊
  const studentInfo = {
    department: '資訊工程學系',
    studentId: '123456789',
    name: '測試學生',
    totalCredits: '18',
    semester: '1141'  // 修正學期格式
  };
  
  // 示例課程清單
  const courses = [
    {
      課程名稱: '資料結構',
      上課時間: [
        {
          星期: '一',
          節次: '1,2',
          教室: 'LB101'
        }
      ]
    },
    {
      課程名稱: '演算法',
      上課時間: [
        {
          星期: '三',
          節次: '3,4',
          教室: 'LB205'
        }
      ]
    },
    {
      課程名稱: '資料庫系統',
      上課時間: [
        {
          星期: '五',
          節次: 'n',
          教室: 'LB301'
        }
      ]
    }
  ];
  
  try {
    // 儲存測試資料
    const result = await dataManager.saveScheduleData(studentInfo, courses);
    console.log('💾 測試資料儲存結果:', result);
    
    if (result.success) {
      console.log('✅ 測試資料儲存成功！');
      // 驗證儲存的資料
      await checkStorage();
    } else {
      console.error('❌ 測試資料儲存失敗:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ 儲存測試資料時發生錯誤:', error);
    return { success: false, error: error.message };
  }
}

// 時間轉換器測試函數
class TimeConverter {
  constructor() {
    // 建立基本時段對照表
    this.periodTimeMap = {
      '1': {
        time: '08:10-09:00',
        display: '第一節',
        order: 1
      },
      '2': {
        time: '09:10-10:00', 
        display: '第二節',
        order: 2
      },
      '3': {
        time: '10:10-11:00',
        display: '第三節', 
        order: 3
      },
      '4': {
        time: '11:10-12:00',
        display: '第四節',
        order: 4
      },
      'DN': {
        time: '12:10-13:00',
        display: '午休',
        order: 5
      },
      '5': {
        time: '13:40-14:30',
        display: '第五節',
        order: 6
      },
      '6': {
        time: '14:40-15:30',
        display: '第六節',
        order: 7
      },
      '7': {
        time: '15:40-16:30',
        display: '第七節',
        order: 8
      },
      '8': {
        time: '16:40-17:30',
        display: '第八節',
        order: 9
      },
      'E0': {
        time: '17:40-18:30',
        display: '夜間第零節',
        order: 10
      }
    };
    
    // 正確的時間段順序
    this.periodOrder = ['1', '2', '3', '4', 'DN', '5', '6', '7', '8', 'E0'];
    
    // 星期對照表
    this.dayMap = {
      '一': 1,
      '二': 2,
      '三': 3,
      '四': 4,
      '五': 5,
      '六': 6,
      '日': 0
    };
    
    this.log('⏰ 時間轉換器初始化完成');
  }

  // 轉換時段編號為時間
  convertPeriodToTime(period) {
    const timeInfo = this.periodTimeMap[period];
    if (!timeInfo) {
      this.log(`⚠️ 未知時段: ${period}`);
      return {
        time: '未知時間',
        display: `第${period}節`,
        order: 999
      };
    }
    
    return timeInfo;
  }

  // 轉換星期為數字
  convertDayToNumber(day) {
    const dayNumber = this.dayMap[day];
    if (dayNumber === undefined) {
      this.log(`⚠️ 未知星期: ${day}`);
      return -1;
    }
    
    return dayNumber;
  }

  // 轉換數字為星期
  convertNumberToDay(number) {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    return dayNames[number] || '未知';
  }

  // 解析複合時段 (如: "1,2,3" 或 "5~7")
  parsePeriods(periodString) {
    if (!periodString) return [];
    
    const periods = [];
    const parts = periodString.split(',');
    
    parts.forEach(part => {
      part = part.trim();
      
      // 處理範圍 (如: "5~7")
      if (part.includes('~')) {
        const [start, end] = part.split('~');
        const startOrder = this.periodTimeMap[start]?.order || parseInt(start);
        const endOrder = this.periodTimeMap[end]?.order || parseInt(end);
        
        for (let i = startOrder; i <= endOrder; i++) {
          const period = this.findPeriodByOrder(i);
          if (period) periods.push(period);
        }
      } else {
        // 單一時段
        periods.push(part);
      }
    });
    
    return periods;
  }

  // 根據順序查找時段
  findPeriodByOrder(order) {
    for (const [period, info] of Object.entries(this.periodTimeMap)) {
      if (info.order === order) {
        return period;
      }
    }
    return null;
  }

  // 按照正確順序獲取時間段
  getPeriodsInOrder() {
    return this.periodOrder;
  }

  // 格式化時間顯示
  formatTimeDisplay(timeInfo) {
    const dayNumber = this.convertDayToNumber(timeInfo.星期);
    const periods = this.parsePeriods(timeInfo.節次);
    
    const timeRanges = periods.map(period => {
      const info = this.convertPeriodToTime(period);
      return info.time;
    });
    
    return {
      day: this.convertNumberToDay(dayNumber),
      dayNumber: dayNumber,
      periods: periods,
      timeRanges: timeRanges,
      classroom: timeInfo.教室 || '未指定教室',
      fullDisplay: `星期${this.convertNumberToDay(dayNumber)} ${timeRanges.join(', ')} (${timeInfo.教室 || '未指定教室'})`
    };
  }

  // 檢查時間衝突
  checkTimeConflict(time1, time2) {
    if (!time1.星期 || !time2.星期 || time1.星期 !== time2.星期) {
      return false; // 不同星期不衝突
    }
    
    const periods1 = this.parsePeriods(time1.節次);
    const periods2 = this.parsePeriods(time2.節次);
    
    // 檢查是否有重疊的時段
    return periods1.some(p1 => periods2.includes(p1));
  }

  // 日誌輸出
  log(message) {
    console.log(`[TimeConverter] ${message}`);
  }
}

// 課程時間處理器
class CourseTimeProcessor {
  constructor() {
    this.timeConverter = new TimeConverter();
    this.log('📚 課程時間處理器初始化完成');
  }

  // 處理單一課程的所有時間
  processCourseTime(course) {
    if (!course.上課時間 || !Array.isArray(course.上課時間)) {
      this.log(`⚠️ 課程 ${course.課程名稱} 缺少時間資訊`);
      return course;
    }

    const processedTimes = course.上課時間.map((timeInfo, index) => {
      try {
        const formattedTime = this.timeConverter.formatTimeDisplay(timeInfo);
        
        return {
          ...timeInfo,
          索引: index,
          格式化資訊: formattedTime,
          時段列表: this.timeConverter.parsePeriods(timeInfo.節次)
        };
      } catch (error) {
        this.log(`❌ 處理課程 ${course.課程名稱} 第 ${index + 1} 個時間時出錯: ${error.message}`);
        return timeInfo;
      }
    });

    return {
      ...course,
      上課時間: processedTimes,
      總時段數: processedTimes.reduce((total, time) => {
        return total + (time.時段列表?.length || 0);
      }, 0)
    };
  }

  // 日誌輸出
  log(message) {
    console.log(`[CourseTimeProcessor] ${message}`);
  }
}

// 時間轉換器測試函數
function testTimeConverter() {
  console.log('🕐 開始測試時間轉換器');
  
  const converter = new TimeConverter();
  
  // 測試時段轉換
  const testPeriods = ['1', '2', 'DN', '5', 'E0'];
  testPeriods.forEach(period => {
    const result = converter.convertPeriodToTime(period);
    console.log(`時段 ${period}:`, result);
  });
  
  // 測試星期轉換
  const testDays = ['一', '二', '三', '四', '五'];
  testDays.forEach(day => {
    const number = converter.convertDayToNumber(day);
    const backToDay = converter.convertNumberToDay(number);
    console.log(`星期${day} -> ${number} -> 星期${backToDay}`);
  });
  
  console.log('✅ 時間轉換器測試完成');
}


// 時間轉換器測試函數（手動執行）
// testTimeConverter();

// 多時段處理測試
function testMultiPeriodProcessing() {
  console.log('🔄 開始測試多時段處理功能');
  
  const converter = new TimeConverter();
  
  // 測試複合時段解析
  const testComplexPeriods = ['1,2,3', '5~7', 'E1,E2', 'DN'];
  testComplexPeriods.forEach(periods => {
    const parsed = converter.parsePeriods(periods);
    console.log(`複合時段 ${periods} 解析為:`, parsed);
  });
  
  // 測試時間衝突檢測
  const time1 = { 星期: '一', 節次: '1,2' };
  const time2 = { 星期: '一', 節次: '2,3' };
  const conflict = converter.checkTimeConflict(time1, time2);
  console.log(`時間衝突檢測 (${time1.星期} ${time1.節次} vs ${time2.星期} ${time2.節次}):`, conflict);
  
  // 測試課程時間處理器
  const processor = new CourseTimeProcessor();
  const testCourse = {
    課程名稱: '測試課程',
    上課時間: [
      { 星期: '一', 節次: '1,2', 教室: 'LB001' },
      { 星期: '三', 節次: '5~7', 教室: 'LB002' }
    ]
  };
  
  const processedCourse = processor.processCourseTime(testCourse);
  console.log('課程處理結果:', processedCourse);
  
  console.log('✅ 多時段處理測試完成');
}

// 多時段處理測試函數（手動執行）
// testMultiPeriodProcessing();

// 課表資料管理器
// 課表資料結構管理器 - Day 23 升級版（整合真實資料）
class ScheduleDataManager {
  constructor() {
    this.storageKey = 'fjuScheduleData';
    this.log('💾 課表資料管理器初始化完成');
  }

  // 建立標準資料結構
  createDataStructure(studentInfo, courses) {
    return {
      學期: studentInfo.semester || '未知學期',
      學生資訊: {
        系級: studentInfo.department,
        學號: studentInfo.studentId,
        姓名: studentInfo.name,
        總學分: studentInfo.totalCredits
      },
      課程清單: courses || [],
      更新時間: new Date().toISOString(),
      版本: '1.0',
      資料狀態: {
        完整性: true,
        錯誤訊息: []
      }
    };
  }

  // 高級時段解析器（整合完整專案邏輯）
  parseTimeSegments(timeInfo) {
    const periods = [];
    const timeSegments = timeInfo.split(',');
    
    timeSegments.forEach(segment => {
      // 清理空白字符
      segment = segment.trim();
      
      // 處理 E0 時段
      if (segment.toUpperCase() === 'E0') {
        periods.push('E0');
      }
      // 處理 D7-E0 這種特殊範圍
      else if (segment.toUpperCase() === 'D7-E0' || segment.toLowerCase() === 'd7-e0') {
        periods.push('7', '8', 'E0');
      }
      // 處理包含範圍且有 D 的情況
      else if (segment.includes('-') && segment.toLowerCase().includes('d')) {
        const [start, end] = segment.toLowerCase().split('-');
        
        // 檢查是否是 D數字-E數字 的格式
        if (start.startsWith('d') && end.startsWith('e')) {
          const startNum = parseInt(start.replace('d', ''));
          const endPeriod = end.toUpperCase();
          
          // 從 D開始節次到第8節
          for (let i = startNum; i <= 8; i++) {
            periods.push(String(i));
          }
          // 添加 E 時段
          periods.push(endPeriod);
        }
        // 原有的 D 時段處理邏輯
        else {
          const startNum = start.includes('dn') ? 'n' : 
                         start.startsWith('d') ? start.replace('d', '') : start;
          const endNum = end.includes('dn') ? 'n' : 
                       end.startsWith('d') ? end.replace('d', '') : end;
          
          if (startNum === 'n' || endNum === 'n') {
            if (startNum === 'n') {
              periods.push('n');
              // 從第5節到結束節次
              for (let i = 5; i <= parseInt(endNum); i++) {
                periods.push(String(i));
              }
            } else {
              // 從起始節次到第4節
              for (let i = parseInt(startNum); i <= 4; i++) {
                periods.push(String(i));
              }
              periods.push('n');
            }
          } else {
            // 數字範圍
            for (let i = parseInt(startNum); i <= parseInt(endNum); i++) {
              periods.push(String(i));
            }
          }
        }
      }
      // 處理 DN 時段
      else if (segment.toLowerCase().includes('dn')) {
        periods.push('n');
      }
      // 處理純數字時段
      else if (/^\d+$/.test(segment)) {
        periods.push(segment);
      }
      // 處理數字範圍
      else if (segment.includes('-')) {
        const [start, end] = segment.split('-');
        const startNum = parseInt(start.replace(/\D/g, ''));
        const endNum = parseInt(end.replace(/\D/g, ''));
        
        if (!isNaN(startNum) && !isNaN(endNum)) {
          for (let i = startNum; i <= endNum; i++) {
            periods.push(String(i));
          }
        }
      }
      // 處理其他可能的特殊時段（如 E1, E2 等）
      else if (/^[A-Z]\d+$/.test(segment.toUpperCase())) {
        periods.push(segment.toUpperCase());
      }
    });

    // 排序時段
    periods.sort((a, b) => {
      // 定義時段權重值
      const getTimeWeight = (period) => {
        if (period === 'n') return 4.5;  // DN 時段在第4和第5節之間
        if (period === 'E0') return 9;   // E0 時段在第8節之後
        if (/^E\d+$/.test(period)) {      // 其他 E 系列時段
          return 9 + parseInt(period.substring(1));
        }
        return parseInt(period) || 0;
      };
      
      return getTimeWeight(a) - getTimeWeight(b);
    });
    
    return periods;
  }

  // 儲存課表資料（升級版）
  async saveScheduleData(studentInfo, courses) {
    try {
      this.log('開始儲存課表資料（升級版）');
      
      // 處理課程時段資料
      const processedCourses = courses.map(course => {
        if (course.上課時間 && course.上課時間.length > 0) {
          return {
            ...course,
            上課時間: course.上課時間.map(timeInfo => ({
              ...timeInfo,
              節次: Array.isArray(timeInfo.節次) ? 
                   timeInfo.節次.join(',') : 
                   this.parseTimeSegments(timeInfo.節次 || '').join(',')
            }))
          };
        }
        return course;
      });
      
      // 建立標準資料結構
      const scheduleData = this.createDataStructure(studentInfo, processedCourses);
      
      // 驗證資料
      const validation = this.validateData(scheduleData);
      if (!validation.isValid) {
        throw new Error(`資料驗證失敗: ${validation.errors.join(', ')}`);
      }
      
      // 儲存到 Chrome Storage
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({
          [this.storageKey]: scheduleData
        }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      
      this.log('✅ 課表資料儲存成功（包含時段處理）');
      return { success: true, data: scheduleData };
      
    } catch (error) {
      this.log(`❌ 儲存失敗: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // 驗證資料完整性
  validateData(data) {
    const errors = [];
    
    // 檢查必要欄位
    if (!data.學生資訊?.學號) {
      errors.push('缺少學號資訊');
    }
    
    if (!data.課程清單 || !Array.isArray(data.課程清單)) {
      errors.push('課程清單格式錯誤');
    }
    
    if (data.課程清單?.length === 0) {
      errors.push('課程清單為空');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  // 讀取課表資料
  async loadScheduleData() {
    try {
      this.log('開始讀取課表資料');
      
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get([this.storageKey], (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });
      
      const scheduleData = result[this.storageKey];
      
      if (!scheduleData) {
        this.log('⚠️ 沒有找到課表資料');
        return { success: false, error: '沒有儲存的課表資料' };
      }
      
      // 驗證讀取的資料
      const validation = this.validateData(scheduleData);
      if (!validation.isValid) {
        this.log(`⚠️ 資料完整性檢查失敗: ${validation.errors.join(', ')}`);
      }
      
      this.log('✅ 課表資料讀取成功');
      return { 
        success: true, 
        data: scheduleData,
        validation: validation
      };
      
    } catch (error) {
      this.log(`❌ 讀取失敗: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // 清除舊資料
  async clearScheduleData() {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.remove([this.storageKey], () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      
      this.log('✅ 課表資料已清除');
      return { success: true };
      
    } catch (error) {
      this.log(`❌ 清除失敗: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // 檢查資料是否過期
  isDataExpired(data, maxAgeHours = 24) {
    if (!data.更新時間) return true;
    
    const updateTime = new Date(data.更新時間);
    const now = new Date();
    const diffHours = (now - updateTime) / (1000 * 60 * 60);
    
    return diffHours > maxAgeHours;
  }

  // 獲取儲存狀態資訊
  async getStorageInfo() {
    try {
      const result = await this.loadScheduleData();
      
      if (!result.success) {
        return {
          hasData: false,
          message: '無儲存資料'
        };
      }
      
      const data = result.data;
      const isExpired = this.isDataExpired(data);
      
      return {
        hasData: true,
        學期: data.學期,
        學號: data.學生資訊?.學號,
        課程數量: data.課程清單?.length || 0,
        更新時間: data.更新時間,
        資料過期: isExpired,
        完整性: result.validation?.isValid
      };
      
    } catch (error) {
      this.log(`❌ 獲取儲存資訊失敗: ${error.message}`);
      return {
        hasData: false,
        error: error.message
      };
    }
  }

  // 日誌輸出
  log(message) {
    console.log(`[ScheduleDataManager] ${message}`);
  }
}

// 真實資料儲存測試函數 - Day 23 整合版
async function testRealDataStorage() {
  console.log('💾 開始測試真實資料儲存功能');
  
  const dataManager = new ScheduleDataManager();
  
  try {
    // 使用前面 Day 20-22 建立的資料提取器
    const extractor = createDataExtractor();
    
    console.log('📊 開始提取真實學生資訊...');
    const studentResult = await extractor.extract('studentInfo');
    
    if (!studentResult.success) {
      throw new Error('學生資訊提取失敗: ' + studentResult.error);
    }
    
    console.log('📚 開始提取真實課程資料...');
    const courseResult = await extractor.extract('courseData');
    
    if (!courseResult.success) {
      throw new Error('課程資料提取失敗: ' + courseResult.error);
    }
    
    console.log('✅ 真實資料提取完成');
    console.log('- 學生資訊:', studentResult.data);
    console.log('- 課程數量:', courseResult.data.length);
    console.log('- 課程詳情:', courseResult.data);
    
    // 使用真實資料進行儲存測試
    console.log('💾 開始儲存真實課表資料...');
    const saveResult = await dataManager.saveScheduleData(
      studentResult.data,
      courseResult.data
    );
    console.log('儲存結果:', saveResult);
    
    if (!saveResult.success) {
      throw new Error('儲存失敗: ' + saveResult.error);
    }
    
    // 測試讀取剛儲存的真實資料
    console.log('📖 測試讀取已儲存的真實資料...');
    const loadResult = await dataManager.loadScheduleData();
    console.log('讀取結果:', loadResult);
    
    // 驗證資料完整性
    if (loadResult.success) {
      const loadedData = loadResult.data;
      console.log('📋 真實資料驗證結果:');
      console.log('- 學期:', loadedData.學期);
      console.log('- 學號:', loadedData.學生資訊?.學號);
      console.log('- 姓名:', loadedData.學生資訊?.姓名);
      console.log('- 系級:', loadedData.學生資訊?.系級);
      console.log('- 總學分:', loadedData.學生資訊?.總學分);
      console.log('- 課程數量:', loadedData.課程清單?.length);
      
      // 顯示課程詳細資訊
      loadedData.課程清單?.forEach((course, index) => {
        console.log(`- 課程 ${index + 1}: ${course.課程名稱}`);
        course.上課時間?.forEach((time, timeIndex) => {
          console.log(`  時間 ${timeIndex + 1}: 星期${time.星期} ${time.節次} (${time.教室})`);
        });
      });
    }
    
    // 測試儲存狀態資訊
    console.log('📈 測試儲存狀態資訊...');
    const storageInfo = await dataManager.getStorageInfo();
    console.log('儲存狀態:', storageInfo);
    
    console.log('✅ 真實資料 Chrome Storage 測試完成');
    
    return {
      success: true,
      studentData: studentResult.data,
      courseData: courseResult.data,
      storageResult: saveResult
    };
    
  } catch (error) {
    console.error('❌ 真實資料測試過程中發生錯誤:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 頁面準備檢查函數
function checkPageReady() {
  console.log('🔍 檢查頁面準備狀態...');
  
  // 檢查是否在正確的選課頁面
  if (!window.location.href.includes('portal.fju.edu.tw') && !window.location.href.includes('estu.fju.edu.tw')) {
    console.warn('⚠️ 不在輔大學生系統頁面');
    return false;
  }
  
  // 檢查是否有學生資訊元素
  const studentElements = [
    document.querySelector('#LabStuno1'),  // 學號
    document.querySelector('#LabStucna1'), // 姓名
    document.querySelector('#LabDptno1')   // 系級
  ];
  
  const hasStudentInfo = studentElements.some(el => el && el.textContent.trim());
  
  // 檢查是否有課程表格
  const courseTable = document.querySelector('#GV_NewSellist');
  const hasCourseTable = courseTable && courseTable.rows.length > 1;
  
  console.log('📊 頁面狀態檢查結果:');
  console.log('- 學生資訊可用:', hasStudentInfo);
  console.log('- 課程表格可用:', hasCourseTable);
  console.log('- 頁面準備完成:', hasStudentInfo && hasCourseTable);
  
  return hasStudentInfo && hasCourseTable;
}

// 自動化整合測試主函數
async function runIntegratedTest() {
  console.log('🚀 開始執行整合測試...');
  
  // 檢查頁面是否準備就緒
  if (!checkPageReady()) {
    console.error('❌ 頁面未準備就緒，請確保:');
    console.error('1. 已登入輔大學生系統');
    console.error('2. 已進入選課清單頁面');
    console.error('3. 頁面已完全載入');
    return;
  }
  
  try {
    // 執行真實資料儲存測試
    const testResult = await testRealDataStorage();
    
    if (testResult.success) {
      console.log('🎉 整合測試成功完成！');
      console.log('📋 測試摘要:');
      console.log('- 學生:', testResult.studentData?.name || testResult.studentData?.姓名);
      console.log('- 學號:', testResult.studentData?.studentId || testResult.studentData?.學號);
      console.log('- 課程數量:', testResult.courseData?.length || 0);
      console.log('- 儲存狀態:', testResult.storageResult?.success ? '成功' : '失敗');
      
      // 顯示成功通知
      if (typeof showNotification === 'function') {
        showNotification('課表資料儲存成功！', 'success');
      }
    } else {
      console.error('❌ 整合測試失敗:', testResult.error);
      
      // 顯示錯誤通知
      if (typeof showNotification === 'function') {
        showNotification('測試失敗: ' + testResult.error, 'error');
      }
    }
    
  } catch (error) {
    console.error('❌ 整合測試執行錯誤:', error);
  }
}

// 手動執行測試：
 runIntegratedTest()