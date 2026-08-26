const API_URL = 'https://script.google.com/macros/s/AKfycbw--515Ocaod1h_wkMMc8dfiUumw4XD7anSkhWcM4coEXQJAVjGSKORwIMGLgq9t6Fi/exec';

let cachedPersonnelData = [];
let currentActiveUid = null;
let globalFiltersMaster = null; 

document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  
  const searchInput = document.getElementById('searchInput');
  const filterYear = document.getElementById('filterYear');
  const filterCourse = document.getElementById('filterCourse');
  
  let delayTimer;
  const triggerSearch = () => {
    clearTimeout(delayTimer);
    showLoadingState();
    delayTimer = setTimeout(fetchData, 500);
  };

  searchInput.addEventListener('input', triggerSearch);
  filterCourse.addEventListener('change', () => { handleCascadingFilter('course'); triggerSearch(); });
  filterYear.addEventListener('change', () => { handleCascadingFilter('year'); triggerSearch(); });

  document.getElementById('excelUpload').addEventListener('change', handleExcelUpload);
});

// 📌 Navigation Controller (Light Theme colors)
window.switchPage = function(pageId) {
  const pages = ['dashboard', 'search', 'timeline', 'import'];
  pages.forEach(p => {
    const section = document.getElementById(`page-${p}`);
    if (section) {
      section.classList.toggle('hidden', p !== pageId);
      section.classList.toggle('block', p === pageId);
    }
    const btn = document.getElementById(`nav-btn-${p}`);
    if (btn) {
      btn.classList.toggle('border-blue-600', p === pageId);
      btn.classList.toggle('text-blue-600', p === pageId);
      btn.classList.toggle('font-bold', p === pageId);
      btn.classList.toggle('border-transparent', p !== pageId);
      btn.classList.toggle('text-slate-500', p !== pageId);
      btn.classList.toggle('font-medium', p !== pageId);
    }
  });

  if (pageId === 'timeline' && globalFiltersMaster) {
    renderTimeline(globalFiltersMaster.relations, globalFiltersMaster.years, globalFiltersMaster.courses);
  }
}

async function fetchData() {
  const keyword = document.getElementById('searchInput').value.trim();
  const year = document.getElementById('filterYear').value;
  const course = document.getElementById('filterCourse').value;

  try {
    const res = await fetch(`${API_URL}?action=getData&keyword=${encodeURIComponent(keyword)}&year=${year}&course=${encodeURIComponent(course)}`);
    const result = await res.json();
    
    if (result.status === 'success') {
      cachedPersonnelData = result.data.list;
      
      if (!globalFiltersMaster) {
        globalFiltersMaster = result.data.filters;
        updateDropdownUI(); 
      }
      
      // 📌 วาด Dashboard ใหม่: ภาพรวมแต่ละหลักสูตร
      renderDashboard(globalFiltersMaster.courses, globalFiltersMaster.relations);
      
      const tbody = document.getElementById('tableBody');
      const paginationInfo = document.getElementById('tablePaginationInfo');
      
      if (result.data.list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-slate-500 font-medium">ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา</td></tr>`;
        if (paginationInfo) paginationInfo.innerHTML = `ไม่พบข้อมูลที่ค้นหา`;
        return;
      }
      
      tbody.innerHTML = result.data.list.map(item => {
        const initials = item.fullName.substring(0, 2).toUpperCase() || 'U';
        const statusClass = item.status === 'ปฏิบัติงาน' 
          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
          : 'bg-amber-50 text-amber-600 border-amber-200';
        const dotClass = item.status === 'ปฏิบัติงาน' ? 'bg-emerald-500' : 'bg-amber-500';

        return `
          <tr class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4 whitespace-nowrap text-blue-600 font-mono text-xs">${item.uid}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shadow-sm border border-blue-200">
                  ${initials}
                </div>
                <div>
                  <div class="text-slate-800 font-medium text-sm group-hover:text-blue-600 transition-colors">${item.fullName}</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-slate-600 truncate max-w-[200px]">${item.agency}</td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusClass}">
                <span class="w-1.5 h-1.5 rounded-full mr-1.5 ${dotClass}"></span>
                ${item.status}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <button onclick="viewProfile('${item.uid}')" class="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors outline-none cursor-pointer" title="ดูประวัติและปฏิบัติหน้าที่">
                <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </td>
          </tr>
        `;
      }).join('');
      
      if (paginationInfo) {
        const count = result.data.list.length;
        paginationInfo.innerHTML = `แสดงผล <span class="font-bold text-slate-800">1</span> ถึง <span class="font-bold text-slate-800">${count}</span> จาก <span class="font-bold text-slate-800">${count}</span> รายการที่ค้นพบ`;
      }
      
    } else {
      showErrorState(result.message);
    }
  } catch (error) {
    showErrorState('การเชื่อมต่อกับฐานข้อมูลขัดข้อง');
  }
}

// 📌 ฟังก์ชันสร้างการ์ดสถิติแต่ละหลักสูตรในหน้า Dashboard
function renderDashboard(courses, relations) {
  const grid = document.getElementById('courseStatsGrid');
  if (!grid) return;
  
  if (!courses || courses.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center text-slate-500 py-8">ไม่มีข้อมูลหลักสูตรในระบบ</div>`;
    return;
  }

  let html = '';
  courses.forEach(course => {
    // คำนวณจำนวนครั้งที่จัด (จำนวนปีที่มีหลักสูตรนี้)
    const timesHeld = Object.keys(relations.courseToYears[course] || {}).length;
    
    // คำนวณจำนวนคนที่ผ่านการอบรมหลักสูตรนี้
    const totalPeople = cachedPersonnelData.filter(p => p.trainings.some(t => t.course === course)).length;

    html += `
      <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
        <h3 class="text-sm font-bold text-slate-800 line-clamp-2 min-h-[40px]" title="${course}">${course}</h3>
        
        <div class="mt-6 flex justify-between items-end border-t border-slate-100 pt-4">
          <div>
            <p class="text-xs text-slate-500 uppercase font-semibold">จำนวนคน (คน)</p>
            <p class="text-3xl font-extrabold text-blue-600 mt-1">${totalPeople}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-500 uppercase font-semibold">จำนวนที่จัด (ครั้ง)</p>
            <p class="text-3xl font-extrabold text-emerald-600 mt-1">${timesHeld}</p>
          </div>
        </div>
      </div>
    `;
  });
  
  grid.innerHTML = html;
}

function renderTimeline(relations, years, courses) {
  const headerRow = document.getElementById('timelineHeaderRow');
  const bodyEl = document.getElementById('timelineBody');
  if (!headerRow || !bodyEl) return;

  const sortedYears = [...years].sort((a, b) => a - b);
  headerRow.innerHTML = `
    <th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider w-1/3 border-r border-slate-200">ชื่อหลักสูตร</th>
    ${sortedYears.map(y => `<th class="px-4 py-4 text-center text-xs font-bold text-blue-900 uppercase tracking-wider w-20 border-r border-slate-200 bg-blue-50/50">${y}</th>`).join('')}
  `;

  bodyEl.innerHTML = courses.map(course => {
    const activeYears = relations.courseToYears[course] || {};
    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-6 py-4 text-sm font-semibold text-slate-700 border-r border-slate-100">${course}</td>
        ${sortedYears.map(y => {
          const isActive = activeYears[y];
          return `
            <td class="px-2 py-4 text-center border-r border-slate-100">
              ${isActive ? 
                `<span class="inline-block w-full py-1.5 bg-blue-600 text-white text-xs font-semibold rounded shadow-sm">จัดอบรม</span>` : 
                `<span class="inline-block w-full py-1.5 bg-slate-100 text-slate-400 text-xs rounded">-</span>`
              }
            </td>
          `;
        }).join('')}
      </tr>
    `;
  }).join('');
}

function handleCascadingFilter(changedType) {
  if (!globalFiltersMaster) return;
  const yearSelect = document.getElementById('filterYear');
  const courseSelect = document.getElementById('filterCourse');
  
  const selectedYear = yearSelect.value;
  const selectedCourse = courseSelect.value;
  const relations = globalFiltersMaster.relations;

  if (changedType === 'course' && selectedCourse) {
    const validYears = Object.keys(relations.courseToYears[selectedCourse] || {});
    if (selectedYear && !validYears.includes(selectedYear)) yearSelect.value = '';
  } 
  else if (changedType === 'year' && selectedYear) {
    const validCourses = Object.keys(relations.yearToCourses[selectedYear] || {});
    if (selectedCourse && !validCourses.includes(selectedCourse)) courseSelect.value = '';
  }
  updateDropdownUI(); 
}

function updateDropdownUI() {
  if (!globalFiltersMaster) return;
  const selectedYear = document.getElementById('filterYear').value;
  const selectedCourse = document.getElementById('filterCourse').value;
  const relations = globalFiltersMaster.relations;
  
  let availableYears = globalFiltersMaster.years;
  let availableCourses = globalFiltersMaster.courses;

  if (selectedCourse) availableYears = Object.keys(relations.courseToYears[selectedCourse] || {}).sort((a,b) => b-a);
  if (selectedYear) availableCourses = Object.keys(relations.yearToCourses[selectedYear] || {}).sort();

  populateDropdown('filterYear', availableYears, selectedYear, 'ทุกปีการศึกษา');
  populateDropdown('filterCourse', availableCourses, selectedCourse, 'ทุกหลักสูตร');
}

function populateDropdown(elementId, items, currentValue, defaultLabel) {
  const select = document.getElementById(elementId);
  select.innerHTML = `<option value="">${defaultLabel}</option>`;
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item; option.textContent = item;
    select.appendChild(option);
  });
  select.value = currentValue;
}

function handleExcelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      
      if (jsonRows.length > 0 && !('ชื่อ-นามสกุล' in jsonRows[0])) {
        alert("❌ โครงสร้างไฟล์ผิดพลาด กรุณาใช้ Template มาตรฐาน");
        e.target.value = ''; return;
      }

      if(confirm(`ตรวจพบข้อมูล ${jsonRows.length} รายการ\nต้องการบันทึกเข้าสู่ระบบใช่หรือไม่?`)) {
         switchPage('dashboard');
         const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'bulkImport', rows: jsonRows }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
         });
         const result = await response.json();
         if(result.status === 'success') { 
            alert(`✅ ${result.message}`); 
            globalFiltersMaster = null; 
            fetchData(); 
            switchPage('search'); 
         } else { 
            alert(`❌ เกิดข้อผิดพลาด: ${result.message}`); fetchData(); 
         }
      }
    } catch (error) { alert("❌ เกิดข้อผิดพลาดในการอ่านไฟล์"); fetchData(); }
    e.target.value = ''; 
  };
  reader.readAsArrayBuffer(file);
}

window.viewProfile = function(uid) {
  currentActiveUid = uid;
  const person = cachedPersonnelData.find(p => p.uid === uid);
  if (!person) return;

  document.getElementById('profileName').textContent = person.fullName;
  document.getElementById('profileUid').textContent = `รหัสอ้างอิง: ${person.uid}`;
  document.getElementById('profileAgency').textContent = `${person.agency} (${person.status})`;

  const timelineEl = document.getElementById('profileTrainings');
  if (person.trainings && person.trainings.length > 0) {
    const sortedTrainings = person.trainings.sort((a, b) => b.year - a.year);
    timelineEl.innerHTML = sortedTrainings.map(t => `
      <li class="relative pl-6 pb-4 border-l-2 border-slate-200 last:border-0 last:pb-0">
        <div class="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 ring-4 ring-white shadow-sm"></div>
        <p class="text-sm font-bold text-slate-800">${t.course}</p>
        <p class="text-xs text-slate-500 mt-0.5">ปีการศึกษา: ${t.year}</p>
      </li>
    `).join('');
  } else { timelineEl.innerHTML = `<li class="text-sm text-slate-500 pl-4">ยังไม่มีประวัติการอบรม</li>`; }

  const dutyEl = document.getElementById('profileDuties');
  if (person.duties && person.duties.length > 0) {
    dutyEl.innerHTML = person.duties.map(d => `
      <li class="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1 shadow-sm">
        <span class="text-sm font-bold text-slate-800">${d.sport}</span>
        <span class="text-xs text-slate-500">สถานะ: ${d.role}</span>
      </li>
    `).join('');
  } else { dutyEl.innerHTML = `<li class="text-sm text-slate-500">ยังไม่มีประวัติลงพื้นที่</li>`; }

  const evalEl = document.getElementById('profileEvals');
  if (person.evals && person.evals.length > 0) {
    evalEl.innerHTML = person.evals.map(e => `
      <div class="bg-white p-3.5 rounded-xl border border-slate-200 text-sm text-slate-700 italic shadow-sm">"${e.feedback}"</div>
    `).join('');
  } else { evalEl.innerHTML = `<div class="text-sm text-slate-500">ยังไม่มีข้อเสนอแนะ</div>`; }

  const slideOver = document.getElementById('slideOver');
  const backdrop = document.getElementById('slideOverBackdrop');
  const panel = document.getElementById('slideOverPanel');

  slideOver.classList.remove('hidden');
  setTimeout(() => {
    backdrop.classList.remove('opacity-0'); backdrop.classList.add('opacity-100');
    panel.classList.remove('translate-x-full'); panel.classList.add('translate-x-0');
  }, 10);
  switchTab('general');
}

window.closeProfile = function() {
  currentActiveUid = null;
  const backdrop = document.getElementById('slideOverBackdrop');
  const panel = document.getElementById('slideOverPanel');
  backdrop.classList.remove('opacity-100'); backdrop.classList.add('opacity-0');
  panel.classList.remove('translate-x-0'); panel.classList.add('translate-x-full');
  setTimeout(() => { document.getElementById('slideOver').classList.add('hidden'); }, 300);
}

window.switchTab = function(tabName) {
  ['general', 'duty', 'eval'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const content = document.getElementById(`tab-content-${t}`);
    if (t === tabName) {
      btn.classList.add('border-blue-600', 'text-blue-600', 'font-bold');
      btn.classList.remove('border-transparent', 'text-slate-500', 'font-medium');
      content.classList.remove('hidden'); content.classList.add('block');
    } else {
      btn.classList.add('border-transparent', 'text-slate-500', 'font-medium');
      btn.classList.remove('border-blue-600', 'text-blue-600', 'font-bold');
      content.classList.remove('block'); content.classList.add('hidden');
    }
  });
}

window.submitDuty = async function() {
  if (!currentActiveUid) return;
  const sport = document.getElementById('inputDutySport').value.trim();
  const role = document.getElementById('inputDutyRole').value.trim();
  if (!sport || !role) return alert('⚠️ กรุณากรอก ชนิดกีฬา และ ประเภทบุคลากร ให้ครบถ้วน');
  
  const btn = document.getElementById('btnSaveDuty');
  btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveDuty', uid: currentActiveUid, sport: sport, role: role }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const result = await response.json();
    if(result.status === 'success') {
      alert('✅ บันทึกประวัติสำเร็จ');
      document.getElementById('inputDutySport').value = '';
      document.getElementById('inputDutyRole').value = '';
      fetchData(); 
    } else { alert(`❌ ข้อผิดพลาด: ${result.message}`); }
  } catch(e) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  btn.textContent = 'บันทึกข้อมูล'; btn.disabled = false;
}

window.submitEval = async function() {
  if (!currentActiveUid) return;
  const feedback = document.getElementById('inputEvalFeedback').value.trim();
  if (!feedback) return alert('⚠️ กรุณากรอกข้อเสนอแนะก่อนบันทึก');
  
  const btn = document.getElementById('btnSaveEval');
  btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveEval', uid: currentActiveUid, feedback: feedback }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const result = await response.json();
    if(result.status === 'success') {
      alert('✅ บันทึกข้อเสนอแนะสำเร็จ');
      document.getElementById('inputEvalFeedback').value = '';
      fetchData(); 
    } else { alert(`❌ ข้อผิดพลาด: ${result.message}`); }
  } catch(e) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  btn.textContent = 'บันทึกข้อเสนอแนะ'; btn.disabled = false;
}

function showLoadingState(message = "กำลังประมวลผลข้อมูล...") {
  const tbody = document.getElementById('tableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-blue-600 font-medium">
      <svg class="animate-spin -ml-1 mr-3 h-6 w-6 text-blue-600 inline mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      ${message}</td></tr>`;
  }
}

function showErrorState(message) {
  const tbody = document.getElementById('tableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-red-500 font-medium">❌ ${message}</td></tr>`;
  }
}
