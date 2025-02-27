document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get('courseSchedule', function(data) {
        console.log('獲取到的數據:', data);
        const scheduleData = data.courseSchedule;
        
        if (!scheduleData) {
            console.error('未找到課表數據');
            return;
        }

     
        const studentInfoDiv = document.getElementById('studentInfo');
        studentInfoDiv.innerHTML = `
            <h2>${scheduleData.學期}</h2>
            <p>系級：${scheduleData.學生資訊.系級}</p>
            <p>學號：${scheduleData.學生資訊.學號}</p>
            <p>姓名：${scheduleData.學生資訊.姓名}</p>
            <p>總學分：${scheduleData.學生資訊.總學分}</p>
        `;

     
        const dayMap = {
            '一': '1',
            '二': '2',
            '三': '3',
            '四': '4',
            '五': '5'
        };

       
        const periodTimeMap = {
            '1': '08:10-09:00',
            '2': '09:10-10:00',
            '3': '10:10-11:00',
            '4': '11:10-12:00',
            'DN': '12:10-13:00 <br>or <br> 12:40-13:30',
            '5': '13:40-14:30',
            '6': '14:40-15:30',
            '7': '15:40-16:30',

            '8': '16:40-17:30',
            'E0': '17:40-18:30'
        };

       
        const scheduleTable = document.getElementById('scheduleTable');
        
        
        const scheduleContainer = document.createElement('div');
        scheduleContainer.className = 'schedule-container';
        
       
        scheduleContainer.appendChild(studentInfoDiv.cloneNode(true));
        scheduleContainer.appendChild(scheduleTable);
        
        
        studentInfoDiv.parentNode.replaceChild(scheduleContainer, studentInfoDiv);

        const periods = ['1', '2', '3', '4', 'DN', '5', '6', '7', '8', 'E0'];
        
        periods.forEach(period => {
            const row = document.createElement('tr');
          
            row.innerHTML = `<td>${period}<br>${periodTimeMap[period]}</td>`;
            
            for (let day = 1; day <= 5; day++) {
                const cell = document.createElement('td');
                const coursesForThisTime = scheduleData.課程清單.filter(course => {
                    return course.上課時間.some(time => {
                        const dayNumber = dayMap[time.星期];
                        const periods = time.節次.split(',');
                        if (period === 'DN') {
                            return dayNumber === String(day) && periods.includes('n');
                        }
                        return dayNumber === String(day) && periods.includes(period);
                    });
                });
                
                if (coursesForThisTime.length > 0) {
                    cell.innerHTML = coursesForThisTime.map(course => `
                        <div class="course-card">
                            <div class="course-name">${course.課程名稱}</div>
                            <div class="course-room">${course.上課時間[0].教室}</div>
                        </div>
                    `).join('');
                }
                row.appendChild(cell);
            }
            scheduleTable.appendChild(row);
        });
    });

    let devInfoButton = document.getElementById('devInfoButton');
    devInfoButton.addEventListener('click', function () {
        alert('開發人員資訊：\n開發者：輔大智慧資安 412580084 蔡宇倫\n開發時間：2025年\n聯絡信箱：412580084@m365.fju.edu.tw\n版本：1.0.0');
    });

    
    const themeSelector = document.getElementById('themeSelector');
    
  
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSelector.value = savedTheme;

    
    themeSelector.addEventListener('change', function(e) {
        const theme = e.target.value;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    });

    // 添加保存課表按鈕
    const saveScheduleButton = document.getElementById('saveScheduleButton');
    // 保存課表的功能
    saveScheduleButton.addEventListener('click', function () {
        const scheduleTable = document.getElementById('scheduleTable');
        html2canvas(scheduleTable).then(canvas => {
            const link = document.createElement('a');
            link.download = '課表.png'; // 設定下載的檔案名稱
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    });
});



