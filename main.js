const API_URL = 'https://script.google.com/macros/s/AKfycbw--515Ocaod1h_wkMMc8dfiUumw4XD7anSkhWcM4coEXQJAVjGSKORwIMGLgq9t6Fi/exec';

let cachedPersonnelData = [];
let currentActiveUid = null; // ตัวแปรเก็บรหัสของคนที่กำลังเปิด Profile อยู่ (Zero-Error Reference)

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
  filterYear.addEventListener('change', triggerSearch);
  filterCourse.addEventListener('change', triggerSearch);

  document.getElementById('excelUpload').addEventListener('change', handleExcelUpload);
});

async function fetchData() {
  const keyword = document.getElementById('searchInput').value.trim();
  const year = document.getElementById('filterYear').value;
  const course = document.getElementById('filterCourse').value;

  try {
    const res = await fetch(`${API_URL}?action=getData&keyword=${encodeURIComponent(keyword)}&year=${year}&course=${encodeURIComponent(course)}`);
    const result = await res.json();
    
    if (result.status === 'success') {
      cachedPersonnelData = result.data.list;
      
      populateDropdown('filterYear', result.data.filters.years, year, 'ทุกปีการศึกษา');
      populateDropdown('filterCourse', result.data.filters.courses, course, 'ทุกหลักสูตร');
      
      document.getElementById('stat-total').textContent = result.data.stats.total;
      document.getElementById('stat-recent').textContent = result.data.stats.recent;
      document.getElementById('stat-top-course').textContent = result.data.stats.topCourse;
      
      const tbody = document.getElementById('tableBody');
      if (result.data.list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-red-500 font-medium">ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา</td></tr>`;
        return;
      }
      
      tbody.innerHTML = result.data.list.map(item => `
        <tr class="hover:bg-blue-50 border-b border-gray-100 transition-colors">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">${item.uid}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${item.fullName}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 truncate max-w-xs">${item.agency}</td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
             <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'ปฏิบัติงาน' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${item.status}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
             <button onclick="viewProfile('${item.uid}')" class="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 hover:text-blue-900 transition-colors font-medium shadow-sm">ดูประวัติ</button>
          </td>
        </tr>
      `).join('');
    } else {
      showErrorState(result.message);
    }
  } catch (error) {
    showErrorState('การเชื่อมต่อกับฐานข้อมูลขัดข้อง');
  }
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
         showLoadingState("กำลังนำเข้าข้อมูล...");
         const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'bulkImport', rows: jsonRows }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
         });
         const result = await response.json();
         if(result.status === 'success') { alert(`✅ ${result.message}`); fetchData(); } 
         else { alert(`❌ เกิดข้อผิดพลาด: ${result.message}`); fetchData(); }
      }
    } catch (error) { alert("❌ เกิดข้อผิดพลาดในการอ่านไฟล์"); fetchData(); }
    e.target.value = ''; 
  };
  reader.readAsArrayBuffer(file);
}

// ==========================================
// UX/UI Controller & Data Submission
// ==========================================

window.viewProfile = function(uid) {
  currentActiveUid = uid; // ล็อกเป้าหมาย
  const person = cachedPersonnelData.find(p => p.uid === uid);
  if (!person) return;

  document.getElementById('profileName').textContent = person.fullName;
  document.getElementById('profileUid').textContent = `รหัสอ้างอิง: ${person.uid}`;
  document.getElementById('profileAgency').textContent = `${person.agency} (${person.status})`;

  // วาด Tab 1: การอบรม
  const timelineEl = document.getElementById('profileTrainings');
  if (person.trainings && person.trainings.length > 0) {
    const sortedTrainings = person.trainings.sort((a, b) => b.year - a.year);
    timelineEl.innerHTML = sortedTrainings.map(t => `
      <li class="relative pl-6 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
        <div class="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 ring-4 ring-white"></div>
        <p class="text-sm font-bold text-gray-800">${t.course}</p>
        <p class="text-xs text-gray-500 mt-0.5">ปีการศึกษา: ${t.year}</p>
      </li>
    `).join('');
  } else {
    timelineEl.innerHTML = `<li class="text-sm text-gray-400 pl-4">ยังไม่มีประวัติการอบรม</li>`;
  }

  // วาด Tab 2: การปฏิบัติหน้าที่
  const dutyEl = document.getElementById('profileDuties');
  if (person.duties && person.duties.length > 0) {
    dutyEl.innerHTML = person.duties.map(d => `
      <li class="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col gap-1">
        <span class="text-sm font-bold text-gray-800">${d.sport}</span>
        <span class="text-xs text-gray-500">สถานะ: ${d.role}</span>
      </li>
    `).join('');
  } else {
    dutyEl.innerHTML = `<li class="text-sm text-gray-400">ยังไม่มีประวัติลงพื้นที่</li>`;
  }

  // วาด Tab 3: การประเมินผล
  const evalEl = document.getElementById('profileEvals');
  if (person.evals && person.evals.length > 0) {
    evalEl.innerHTML = person.evals.map(e => `
      <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-700 italic">
        "${e.feedback}"
      </div>
    `).join('');
  } else {
    evalEl.innerHTML = `<div class="text-sm text-gray-400">ยังไม่มีข้อเสนอแนะ</div>`;
  }

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
  currentActiveUid = null; // ปลดล็อก
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
      btn.classList.add('border-blue-600', 'text-blue-700', 'font-bold');
      btn.classList.remove('border-transparent', 'text-gray-500', 'font-medium');
      content.classList.remove('hidden'); content.classList.add('block');
    } else {
      btn.classList.add('border-transparent', 'text-gray-500', 'font-medium');
      btn.classList.remove('border-blue-600', 'text-blue-700', 'font-bold');
      content.classList.remove('block'); content.classList.add('hidden');
    }
  });
}

// 📌 ฟังก์ชันส่งข้อมูลเข้า Google Sheets (Zero-Error POST)
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
      fetchData(); // สั่งรีเฟรชข้อมูลเบื้องหลัง
    } else {
      alert(`❌ ข้อผิดพลาด: ${result.message}`);
    }
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
      fetchData(); // สั่งรีเฟรชข้อมูลเบื้องหลัง
    } else {
      alert(`❌ ข้อผิดพลาด: ${result.message}`);
    }
  } catch(e) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  
  btn.textContent = 'บันทึกข้อเสนอแนะ'; btn.disabled = false;
}

function showLoadingState(message = "กำลังประมวลผลข้อมูล...") {
  document.getElementById('tableBody').innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-blue-600 font-medium">
    <svg class="animate-spin -ml-1 mr-3 h-6 w-6 text-blue-600 inline mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
    ${message}</td></tr>`;
}

function showErrorState(message) {
  document.getElementById('tableBody').innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-red-500 font-medium">❌ ${message}</td></tr>`;
}
