document.getElementById('scrapeButton').addEventListener('click', async () => {
  try {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<p>正在取得課表...</p>';
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const urlResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getSecondPageUrl
    });

    if (urlResults && urlResults[0].result) {
      const href = urlResults[0].result;
      resultDiv.innerHTML = '<p>正在開啟課表頁面...請勿點擊任何東西</p>';
      
      const newTab = await chrome.tabs.create({ url: href, active: false });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const scrapeResults = await chrome.scripting.executeScript({
        target: { tabId: newTab.id },
        function: scrapePageContent
      });
      
      chrome.tabs.remove(newTab.id);
      
      if (scrapeResults && scrapeResults[0].result) {
        const courseData = scrapeResults[0].result;
        console.log('爬取到的課表:', courseData);
        
      
        saveAndShowSchedule(courseData);
        resultDiv.innerHTML = '<p>課表已生成！</p>';
      } else {
        resultDiv.innerHTML = '<p>錯誤：未能獲取課程數據</p>';
      }
    } else {
      resultDiv.innerHTML = '<p>錯誤：未能找到課表連結，請檢查是否已登入輔大系統</p>';
    }

  } catch (error) {
    console.error('發生錯誤:', error);
    document.getElementById('result').innerHTML = `<p>生成課表失敗：請檢查是否已登入輔大系統</p>`;
  }
});


function getSecondPageUrl() {
  try {
    const links = Array.from(document.getElementsByTagName('a'));
    const targetLink = links.find(link => 
      link.textContent.includes('選課清單') || 
      link.href.includes('CheckSelList')
    );
    
    if (targetLink) {
      console.log('找到課表連結:', targetLink.href);
      return targetLink.href;
    }
    
    console.error('未找到課表連結');
    return null;
  } catch (error) {
    console.error('getSecondPageUrl 錯誤:', error);
    return null;
  }
}

function scrapePageContent() {
  try {
    console.log('開始爬取頁面內容');
    
  
    const studentInfo = {
      department: document.querySelector('#LabDptno1')?.textContent?.trim() || '未找到系級',
      studentId: document.querySelector('#LabStuno1')?.textContent?.trim() || '未找到學號',
      name: document.querySelector('#LabStucna1')?.textContent?.trim() || '未找到姓名',
      totalCredits: document.querySelector('#LabTotNum1')?.textContent?.trim() || '未找到學分'
    };

    const semesterSelect = document.querySelector('#DDL_YM');
    const semester = semesterSelect ? semesterSelect.value : '未找到學期';

  
    const courses = [];
    const courseTable = document.querySelector('#GV_NewSellist');
    
    if (courseTable) {
      const rows = courseTable.querySelectorAll('tr:not(:first-child)');
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 17) {
          const courseName = cells[7]?.textContent?.trim();
          const weekday = cells[14]?.textContent?.trim(); // 星期幾
          const timeInfo = cells[16]?.textContent?.trim(); // 節次
          const classroom = cells[17]?.textContent?.trim(); // 教室欄位
          
          if (courseName && weekday && timeInfo) {
          
            const periods = [];
            const timeSegments = timeInfo.split(',');
            
            timeSegments.forEach(segment => {
             
              if (segment.includes('-') && segment.toLowerCase().includes('d')) {
                const [start, end] = segment.toLowerCase().split('-');
                
                // 處理起始到結束的所有時段
                const startNum = start.includes('dn') ? 'n' : 
                               start.startsWith('d') ? start.replace('d', '') : start;
                const endNum = end.includes('dn') ? 'n' : 
                             end.startsWith('d') ? end.replace('d', '') : end;
                
               
                if (startNum === 'n' || endNum === 'n') {
                  if (startNum === 'n') {
                    periods.push('n');
                   
                    for (let i = 5; i <= parseInt(endNum); i++) {
                      periods.push(String(i));
                    }
                  } else {
                  
                    for (let i = parseInt(startNum); i <= 4; i++) {
                      periods.push(String(i));
                    }
                    periods.push('n');
                  }
                } else {
               
                  for (let i = parseInt(startNum); i <= parseInt(endNum); i++) {
                    periods.push(String(i));
                  }
                }
              }
             
              else if (segment.toLowerCase().includes('dn')) {
                periods.push('n');
              }
           
              else if (/^\d+$/.test(segment)) {
                periods.push(segment);
              }
             
              else if (segment.includes('-')) {
                const [start, end] = segment.split('-');
                const startNum = parseInt(start.replace(/\D/g, ''));
                const endNum = parseInt(end.replace(/\D/g, ''));
                
                for (let i = startNum; i <= endNum; i++) {
                  periods.push(String(i));
                }
              }
            });

           
            periods.sort((a, b) => {
              if (a === 'n') return 4.5;  
              return parseInt(a) - parseInt(b);
            });
            
            if (periods.length > 0) {
              courses.push({
                課程名稱: courseName,
                上課時間: [{
                  星期: weekday,
                  節次: periods.join(','),
                  教室: classroom
                }]
              });
            }
          }
        }
      });
    }

    const schedule = {
      studentInfo,
      semester: semester ? `${semester.slice(0, 3)}學年度第${semester.slice(3)}學期` : '未知學期',
      courses,
      debug: {
        courseCount: courses.length,
        hasMainTable: !!courseTable
      }
    };

    console.log('完整數據:', schedule);
    return schedule;

  } catch (error) {
    console.error('解析頁面內容時出錯:', error);
    return null;
  }
}

function saveAndShowSchedule(data) {
  const formattedSchedule = {
    學生資訊: {
      系級: data.studentInfo.department,
      學號: data.studentInfo.studentId,
      姓名: data.studentInfo.name,
      總學分: data.studentInfo.totalCredits
    },
    學期: data.semester,
    課程清單: data.courses,
    調試信息: data.debug
  };

  
  chrome.storage.local.set({ 'courseSchedule': formattedSchedule }, function() {
   
    chrome.tabs.create({ url: 'schedule.html' });
  });
} 