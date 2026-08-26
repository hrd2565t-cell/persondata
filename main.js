const API_URL = 'https://script.google.com/macros/s/AKfycbw--515Ocaod1h_wkMMc8dfiUumw4XD7anSkhWcM4coEXQJAVjGSKORwIMGLgq9t6Fi/exec';

let cachedPersonnelData = [];
let currentActiveUid = null;
let globalFiltersMaster = null; 

let currentFilteredData = [];
let currentPage = 1;
const itemsPerPage = 10;

let pendingImportData = [];
let currentPreviewPage = 1;
const previewItemsPerPage = 10;

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
      
      renderDashboard(result.data.stats);
      
      currentFilteredData = result.data.list;
      currentPage = 1;
      
      updateSmartSummary(course, year, currentFilteredData.length);
      renderTablePage();
    } else {
      showErrorState(result.message);
    }
  } catch (error) {
    showErrorState('การเชื่อมต่อกับฐานข้อมูลขัดข้อง');
  }
}

function updateSmartSummary(course, year, totalCount) {
  const badge = document.getElementById('smartInsightBadge');
  const textEl = document.getElementById('smartInsightText');
  
  if (!course && !year) {
    badge.classList.add('hidden');
    return;
  }
  
  badge.classList.remove('hidden');
  badge.classList.add('flex');
  
  if (course && year) {
    textEl.innerHTML = `สรุปข้อมูล: หลักสูตร <span class="font-bold">${course}</span> ประจำปีการศึกษา <span class="font-bold">${year}</span> มีผู้ผ่านการอบรมทั้งสิ้น <span class="font-bold text-lg mx-1">${totalCount}</span> คน`;
  } else if (course) {
    textEl.innerHTML = `สรุปข้อมูล: หลักสูตร <span class="font-bold">${course}</span> (รวมทุกปี) มีผู้ผ่านการอบรมทั้งสิ้น <span class="font-bold text-lg mx-1">${totalCount}</span> คน`;
  } else if (year) {
    textEl.innerHTML = `สรุปข้อมูล: ภาพรวมปีการศึกษา <span class="font-bold">${year}</span> มีบุคลากรผ่านการอบรมรวมทั้งสิ้น <span class="font-bold text-lg mx-1">${totalCount}</span> คน`;
  }
}

function renderTablePage() {
  const tbody = document.getElementById('tableBody');
  const paginationInfo = document.getElementById('tablePaginationInfo');
  
  if (currentFilteredData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-slate-500 font-medium">ไม่พบข้อมูลที่ค้นหา</td></tr>`;
    if (paginationInfo) paginationInfo.innerHTML = `ไม่มีรายการแสดงผล`;
    renderPaginationNav(0);
    return;
  }

  const totalItems = currentFilteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageData = currentFilteredData.slice(startIndex, endIndex);

  tbody.innerHTML = pageData.map(item => {
    const initials = item.fullName.substring(0, 2).toUpperCase() || 'U';
    const statusBadge = (item.status === 'ปฏิบัติงาน' || item.status === 'ยังปฏิบัติหน้าที่')
      ? `<span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-amber-300 text-amber-600 bg-white"><span class="w-1.5 h-1.5 rounded-full mr-2 bg-amber-500"></span>${item.status}</span>`
      : `<span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-slate-300 text-slate-500 bg-white"><span class="w-1.5 h-1.5 rounded-full mr-2 bg-slate-400"></span>${item.status}</span>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
        <td class="px-6 py-4 whitespace-nowrap text-blue-600 font-medium text-sm border-r border-slate-100">${item.uid}</td>
        <td class="px-6 py-4 whitespace-nowrap border-r border-slate-100">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">${initials}</div>
            <div class="text-slate-700 font-medium text-sm">${item.fullName}</div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-slate-600 truncate max-w-[250px] border-r border-slate-100">${item.agency}</td>
        <td class="px-6 py-4 whitespace-nowrap text-center border-r border-slate-100">${statusBadge}</td>
        <td class="px-6 py-4 whitespace-nowrap text-center">
          <button onclick="viewProfile('${item.uid}')" class="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors outline-none cursor-pointer inline-flex items-center justify-center" title="ดูประวัติและจัดการ">
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
    paginationInfo.innerHTML = `แสดงรายการที่ <span class="font-bold text-slate-800 mx-1">${startIndex + 1} - ${endIndex}</span> จากทั้งหมด <span class="font-bold text-slate-800 mx-1">${totalItems}</span> รายการ`;
  }
  renderPaginationNav(totalPages);
}

function renderPaginationNav(totalPages) {
  const nav = document.getElementById('paginationNav');
  if (!nav || totalPages === 0) { if(nav) nav.innerHTML = ''; return; }

  let html = `
    <button type="button" onclick="changePage(${currentPage - 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPage === 1 ? 'disabled' : ''}>
      <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg> ก่อนหน้า
    </button>
    <span class="text-sm font-semibold text-blue-600 px-4 select-none">หน้า ${currentPage}/${totalPages}</span>
    <button type="button" onclick="changePage(${currentPage + 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPage === totalPages ? 'disabled' : ''}>
      ถัดไป <svg class="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
    </button>
  `;
  nav.innerHTML = html;
}

window.changePage = function(newPage) {
  const totalPages = Math.ceil(currentFilteredData.length / itemsPerPage);
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    renderTablePage();
  }
}

// 📌 ฟังก์ชันคำนวณความคล้ายคลึงของข้อความ (Levenshtein Distance / Fuzzy Match)
function calculateSimilarity(str1, str2) {
  let s1 = String(str1).toLowerCase().replace(/\s+/g, '').trim();
  let s2 = String(str2).toLowerCase().replace(/\s+/g, '').trim();
  if (s1 === s2) return 1.0;
  let longer = s1; let shorter = s2;
  if (s1.length < s2.length) { longer = s2; shorter = s1; }
  let longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  let costs = new Array();
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) { costs[j] = j; } 
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (s2.length > 0) costs[s2.length] = lastValue;
  }
  return (longerLength - costs[s2.length]) / longerLength;
}

// 📌 ฟังก์ชันอ่านไฟล์ และทำ Data Normalization พร้อมสแกนหาชื่อใกล้เคียง
function handleExcelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      
      if (jsonRows.length > 0 && !('ชื่อ-นามสกุล' in jsonRows[0])) {
        alert("❌ โครงสร้างไฟล์ผิดพลาด กรุณาใช้ไฟล์ Template มาตรฐานจากระบบเท่านั้น");
        e.target.value = ''; return;
      }

      if (jsonRows.length === 0) {
        alert("⚠️ ไม่พบข้อมูลในไฟล์ Excel");
        e.target.value = ''; return;
      }

      // ทำความสะอาดข้อความ (Data Normalization: ตัดช่องว่างเกิน)
      let cleanedRows = jsonRows.map((row, index) => {
        let fullName = String(row['ชื่อ-นามสกุล'] || '').replace(/\s+/g, ' ').trim();
        let matchedExisting = null;
        let matchType = 'new'; // 'exact', 'fuzzy', 'new'

        // 1. เช็คชื่อซ้ำเป๊ะๆ (Exact Match)
        let exactFound = cachedPersonnelData.find(p => p.fullName.toLowerCase() === fullName.toLowerCase());
        if (exactFound) {
          matchedExisting = exactFound;
          matchType = 'exact';
        } else {
          // 2. เช็คชื่อใกล้เคียง / พิมพ์ผิด (Fuzzy Match ความเหมือน >= 75%)
          for (let p of cachedPersonnelData) {
            let sim = calculateSimilarity(p.fullName, fullName);
            if (sim >= 0.75 && sim < 1.0) {
              matchedExisting = p;
              matchType = 'fuzzy';
              break;
            }
          }
        }

        return {
          originalIndex: index,
          'คำนำหน้า': row['คำนำหน้า'] || '',
          'ชื่อ-นามสกุล': fullName,
          'กลุ่มหน่วยงาน': row['กลุ่มหน่วยงาน'] || '',
          'หน่วยงาน': String(row['หน่วยงาน'] || '').replace(/\s+/g, ' ').trim(),
          'สถานะ': row['สถานะ'] || 'ปฏิบัติงาน',
          'ชื่อหลักสูตร': row['ชื่อหลักสูตร'] || '',
          'ปีที่อบรม': row['ปีที่อบรม'] || '',
          matchType: matchType,
          matchedUser: matchedExisting,
          actionType: matchType === 'exact' ? 'merge' : 'auto' // ค่าเริ่มต้น
        };
      });

      pendingImportData = cleanedRows;
      showPreviewSection(cleanedRows);

    } catch (error) { 
      alert("❌ เกิดข้อผิดพลาดในการอ่านไฟล์"); 
    }
    e.target.value = ''; 
  };
  reader.readAsArrayBuffer(file);
}

function showPreviewSection(data) {
  document.getElementById('importUploadSection').classList.add('hidden');
  document.getElementById('importPreviewSection').classList.remove('hidden');
  
  currentPreviewPage = 1;
  renderPreviewTablePage();
}

function renderPreviewTablePage() {
  const tbody = document.getElementById('previewTableBody');
  const previewInfo = document.getElementById('previewPaginationInfo');
  const totalItems = pendingImportData.length;
  const totalPages = Math.ceil(totalItems / previewItemsPerPage);

  const startIndex = (currentPreviewPage - 1) * previewItemsPerPage;
  const endIndex = Math.min(startIndex + previewItemsPerPage, totalItems);
  const pageData = pendingImportData.slice(startIndex, endIndex);

  document.getElementById('previewTotalText').innerHTML = `พบข้อมูลในไฟล์ทั้งหมด <span class="font-bold text-blue-600">${totalItems}</span> รายการ`;

  tbody.innerHTML = pageData.map((row, idx) => {
    let badgeHtml = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold">✨ บุคคลใหม่</span>`;
    let targetUidVal = '';

    if (row.matchType === 'exact') {
      badgeHtml = `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold" title=" UID: ${row.matchedUser.uid} ">🔄 รวมกับคนเดิม (${row.matchedUser.fullName})</span>`;
      targetUidVal = row.matchedUser.uid;
    } else if (row.matchType === 'fuzzy') {
      badgeHtml = `
        <div class="space-y-1.5">
          <span class="inline-block bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded text-[11px] font-semibold">
            ⚠️ ชื่อคล้าย: ${row.matchedUser.fullName}
          </span>
          <select onchange="updateImportAction(${startIndex + idx}, this.value)" class="w-full text-xs bg-slate-50 border border-slate-300 rounded p-1.5 outline-none font-medium text-slate-700">
            <option value="merge" ${row.actionType === 'merge' ? 'selected' : ''}>🔗 รวมประวัติเป็นคนเดียวกัน</option>
            <option value="new" ${row.actionType === 'new' ? 'selected' : ''}>➕ สร้างเป็นคนใหม่ (แยก)</option>
          </select>
        </div>
      `;
      targetUidVal = row.matchedUser.uid;
    }

    return `
      <tr class="hover:bg-slate-50 align-top">
        <td class="px-4 py-3.5 border-r border-slate-100 text-center font-mono text-xs text-slate-400">${startIndex + idx + 1}</td>
        <td class="px-4 py-3.5 border-r border-slate-100 font-medium text-slate-800">${row['ชื่อ-นามสกุล']}</td>
        <td class="px-4 py-3.5 border-r border-slate-100 truncate max-w-[180px]">${row['หน่วยงาน'] || '-'}</td>
        <td class="px-4 py-3.5 border-r border-slate-100 text-center"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">${row['สถานะ']}</span></td>
        <td class="px-4 py-3.5 border-r border-slate-100">${row['ชื่อหลักสูตร'] || '-'} <span class="text-xs text-slate-400">(${row['ปีที่อบรม'] || '-'})</span></td>
        <td class="px-4 py-3.5 text-center">
          <input type="hidden" id="targetUid_${startIndex + idx}" value="${targetUidVal}">
          ${badgeHtml}
        </td>
      </tr>
    `;
  }).join('');

  if (previewInfo) {
    previewInfo.innerHTML = `แสดงรายการที่ <span class="font-bold text-slate-800 mx-1">${startIndex + 1} - ${endIndex}</span> จากทั้งหมด <span class="font-bold text-slate-800 mx-1">${totalItems}</span> รายการ`;
  }

  renderPreviewPaginationNav(totalPages);
}

// 📌 ฟังก์ชันอัปเดตการตัดสินใจของแอดมิน (Merge หรือ New) ทีละเคส
window.updateImportAction = function(absoluteIndex, choice) {
  if (pendingImportData[absoluteIndex]) {
    pendingImportData[absoluteIndex].actionType = choice;
  }
}

function renderPreviewPaginationNav(totalPages) {
  const nav = document.getElementById('previewPaginationNav');
  if (!nav || totalPages === 0) { if(nav) nav.innerHTML = ''; return; }

  let html = `
    <button type="button" onclick="changePreviewPage(${currentPreviewPage - 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPreviewPage === 1 ? 'disabled' : ''}>
      <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg> ก่อนหน้า
    </button>
    <span class="text-sm font-semibold text-blue-600 px-4 select-none">หน้า ${currentPreviewPage}/${totalPages}</span>
    <button type="button" onclick="changePreviewPage(${currentPreviewPage + 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPreviewPage === totalPages ? 'disabled' : ''}>
      ถัดไป <svg class="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
    </button>
  `;
  nav.innerHTML = html;
}

window.changePreviewPage = function(newPage) {
  const totalPages = Math.ceil(pendingImportData.length / previewItemsPerPage);
  if (newPage >= 1 && newPage <= totalPages) {
    currentPreviewPage = newPage;
    renderPreviewTablePage();
  }
}

window.cancelImport = function() {
  pendingImportData = [];
  document.getElementById('importPreviewSection').classList.add('hidden');
  document.getElementById('importUploadSection').classList.remove('hidden');
};

window.confirmImport = async function() {
  if (!pendingImportData || pendingImportData.length === 0) return;
  
  // รวบรวมข้อมูล UID ที่แอดมินเลือกในแต่ละแถวพรีวิวส่งไปหลังบ้าน
  const processedRows = pendingImportData.map((row, idx) => {
    const targetUidInput = document.getElementById(`targetUid_${idx}`);
    return {
      ...row,
      targetUid: targetUidInput ? targetUidInput.value : ''
    };
  });

  const btn = document.getElementById('btnConfirmImport');
  const originalText = btn.innerHTML;
  btn.innerHTML = `<svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> กำลังบันทึก...`;
  btn.disabled = true;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'bulkImport', rows: processedRows }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const result = await response.json();
    
    if (result.status === 'success') { 
      alert(`✅ ${result.message}`); 
      globalFiltersMaster = null; 
      fetchData(); 
      cancelImport(); 
      switchPage('search'); 
    } else { 
      alert(`❌ เกิดข้อผิดพลาด: ${result.message}`); 
    }
  } catch (error) { 
    alert("❌ การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง"); 
  }
  
  btn.innerHTML = originalText;
  btn.disabled = false;
};

function renderDashboard(stats) {
  document.getElementById('stat-total').textContent = stats.totalPersonnel;
  document.getElementById('stat-top-year').textContent = stats.topYear;
  document.getElementById('stat-top-course').textContent = stats.topCourse;
  const tbody = document.getElementById('courseSummaryBody');
  if (!tbody) return;
  if (!stats.courseSummary || stats.courseSummary.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-12 text-center text-slate-500 font-medium">ไม่มีข้อมูลหลักสูตรในระบบ</td></tr>`;
    return;
  }
  tbody.innerHTML = stats.courseSummary.map((item, index) => `
    <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
      <td class="px-6 py-4 text-center text-slate-400 font-mono text-xs border-r border-slate-100">${index + 1}</td>
      <td class="px-6 py-4 font-semibold text-slate-700 border-r border-slate-100">${item.courseName}</td>
      <td class="px-6 py-4 text-center border-r border-slate-100"><span class="inline-flex items-center justify-center bg-slate-100 text-slate-600 font-semibold px-2.5 py-1 rounded-lg min-w-[3rem]">${item.yearsHeld}</span></td>
      <td class="px-6 py-4 text-center"><span class="inline-flex items-center justify-center bg-blue-50 text-blue-600 font-semibold px-2.5 py-1 rounded-lg min-w-[3rem]">${item.totalPeople}</span></td>
    </tr>
  `).join('');
}

function renderTimeline(relations, years, courses) {
  const container = document.getElementById('timelineCardsContainer');
  if (!container) return;

  if (!courses || courses.length === 0) {
    container.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">ไม่พบข้อมูลหลักสูตรสำหรับสร้างไทม์ไลน์</div>`;
    return;
  }

  container.innerHTML = courses.map((course, idx) => {
    const activeYearsMap = relations.courseToYears[course] || {};
    const activeYears = Object.keys(activeYearsMap).map(y => parseInt(y)).sort((a, b) => a - b);
    
    if (activeYears.length === 0) return '';

    const firstYear = activeYears[0];
    const lastYear = activeYears[activeYears.length - 1];

    let missingYears = [];
    for (let y = firstYear; y <= lastYear; y++) {
      if (!activeYearsMap[y]) {
        missingYears.push(y);
      }
    }

    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow space-y-5">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-4">
          <div>
            <span class="text-xs font-semibold text-blue-600 uppercase tracking-wider">หลักสูตรที่ #${idx + 1}</span>
            <h3 class="text-lg font-bold text-slate-800 mt-0.5">${course}</h3>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">ช่วงเวลา: <span class="text-blue-600">${firstYear} - ${lastYear}</span></span>
            <span class="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-100">จัดทั้งหมด ${activeYears.length} ปี</span>
          </div>
        </div>

        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">✅ ปีที่มีการเปิดอบรม:</p>
          <div class="flex flex-wrap gap-2">
            ${activeYears.map(y => `
              <div class="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-sm">
                <svg class="w-3.5 h-3.5 text-blue-200" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                ปี ${y}
              </div>
            `).join('')}
          </div>
        </div>

        ${missingYears.length > 0 ? `
          <div class="pt-3 border-t border-slate-100">
            <p class="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              ⚠️ ปีที่เว้นช่วงการจัด (Missing / Gap Years):
            </p>
            <div class="flex flex-wrap gap-2">
              ${missingYears.map(my => `
                <span class="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1 rounded-lg">
                  ปี ${my} (งดจัด)
                </span>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="pt-3 border-t border-slate-100 text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
            <span>✨ จัดอบรมต่อเนื่องทุกปีโดยไม่มีช่วงว่าง (Continuous Lifecycle)</span>
          </div>
        `}
      </div>
    `;
  }).join('');
}

function handleCascadingFilter(changedType) {
  if (!globalFiltersMaster) return;
  const yearSelect = document.getElementById('filterYear'); const courseSelect = document.getElementById('filterCourse');
  const selectedYear = yearSelect.value; const selectedCourse = courseSelect.value;
  const relations = globalFiltersMaster.relations;
  if (changedType === 'course' && selectedCourse) {
    const validYears = Object.keys(relations.courseToYears[selectedCourse] || {});
    if (selectedYear && !validYears.includes(selectedYear)) yearSelect.value = '';
  } else if (changedType === 'year' && selectedYear) {
    const validCourses = Object.keys(relations.yearToCourses[selectedYear] || {});
    if (selectedCourse && !validCourses.includes(selectedCourse)) courseSelect.value = '';
  }
  updateDropdownUI(); 
}

function updateDropdownUI() {
  if (!globalFiltersMaster) return;
  const selectedYear = document.getElementById('filterYear').value; const selectedCourse = document.getElementById('filterCourse').value;
  const relations = globalFiltersMaster.relations;
  let availableYears = globalFiltersMaster.years; let availableCourses = globalFiltersMaster.courses;
  if (selectedCourse) availableYears = Object.keys(relations.courseToYears[selectedCourse] || {}).sort((a,b) => b-a);
  if (selectedYear) availableCourses = Object.keys(relations.yearToCourses[selectedYear] || {}).sort();
  populateDropdown('filterYear', availableYears, selectedYear, 'ทุกปีการศึกษา');
  populateDropdown('filterCourse', availableCourses, selectedCourse, 'ทุกหลักสูตร');
}

function populateDropdown(elementId, items, currentValue, defaultLabel) {
  const select = document.getElementById(elementId);
  select.innerHTML = `<option value="">${defaultLabel}</option>`;
  items.forEach(item => {
    const option = document.createElement('option'); option.value = item; option.textContent = item; select.appendChild(option);
  });
  select.value = currentValue;
}

window.exportToExcel = function() {
  const filterYear = document.getElementById('filterYear').value;
  const filterCourse = document.getElementById('filterCourse').value;
  let exportData = [];

  currentFilteredData.forEach(user => {
    let userTrainings = user.trainings || [];
    let matchedTrainings = userTrainings.filter(t => {
      const matchY = filterYear === '' || String(t.year) === String(filterYear);
      const matchC = filterCourse === '' || String(t.course) === String(filterCourse);
      return matchY && matchC;
    });

    if (matchedTrainings.length > 0) {
      matchedTrainings.forEach(t => {
        exportData.push({ 'รหัส UID': user.uid, 'ชื่อ-นามสกุล': user.fullName, 'หน่วยงาน': user.agency, 'สถานะ': user.status, 'ชื่อหลักสูตร': t.course, 'ปีที่อบรม': parseInt(t.year) || t.year });
      });
    } else if (filterYear === '' && filterCourse === '') {
      exportData.push({ 'รหัส UID': user.uid, 'ชื่อ-นามสกุล': user.fullName, 'หน่วยงาน': user.agency, 'สถานะ': user.status, 'ชื่อหลักสูตร': '-', 'ปีที่อบรม': '-' });
    }
  });

  exportData.sort((a, b) => {
    const yearA = parseInt(a['ปีที่อบรม']) || 9999; 
    const yearB = parseInt(b['ปีที่อบรม']) || 9999;
    return yearA - yearB;
  });

  if (exportData.length === 0) { alert('⚠️ ไม่พบข้อมูลประวัติการอบรมสำหรับเงื่อนไขนี้'); return; }

  const ws = XLSX.utils.json_to_sheet(exportData);
  ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 40 }, { wch: 15 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Personnel_Training_Log");

  let filename = "ข้อมูลบุคลากรกีฬา";
  if (filterCourse) filename += "_" + filterCourse.replace(/\s+/g, "");
  if (filterYear) filename += "_ปี" + filterYear;
  filename += ".xlsx";
  XLSX.writeFile(wb, filename);
};

window.downloadTemplate = function() {
  const templateData = [
    ["คำนำหน้า", "ชื่อ-นามสกุล", "กลุ่มหน่วยงาน", "หน่วยงาน", "สถานะ", "ชื่อหลักสูตร", "ปีที่อบรม"],
    ["นาย", "ทดสอบ ตัวอย่างการกรอก", "สมาคมกีฬา", "สมาคมกีฬาแห่งจังหวัดกรุงเทพมหานคร", "ปฏิบัติงาน", "TSLP", "2569"]
  ];
  const ws = XLSX.utils.aoa_to_sheet(templateData);
  ws['!cols'] = [{wch:10}, {wch:30}, {wch:20}, {wch:40}, {wch:15}, {wch:20}, {wch:15}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import_Template");
  XLSX.writeFile(wb, "Template_นำเข้าบุคลากร.xlsx");
};

window.viewProfile = function(uid) {
  currentActiveUid = uid;
  const person = cachedPersonnelData.find(p => p.uid === uid);
  if (!person) { alert("❌ ไม่พบข้อมูลบุคลากรในระบบ"); return; }

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
  } else { dutyEl.innerHTML = `<div class="text-sm text-slate-500">ยังไม่มีประวัติลงพื้นที่</div>`; }

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

function showLoadingState() { const tbody = document.getElementById('tableBody'); if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-blue-500 font-medium">กำลังโหลดข้อมูล...</td></tr>`; }
function showErrorState(message) { const tbody = document.getElementById('tableBody'); if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-red-400 font-medium">❌ ${message}</td></tr>`; }
