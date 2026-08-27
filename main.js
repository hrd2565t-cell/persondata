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

let matrixAvailableYears = [];
let isAdmin = false;

// ตัวแปรเก็บ Object กราฟ (เพื่อเอาไว้ทำลายทิ้งก่อนวาดใหม่)
let barChartObj = null;
let donutChartObj = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  setupDragAndDrop();
  setupOTPInputs();
  
  let delayTimer;
  const triggerSearch = () => {
    clearTimeout(delayTimer);
    showLoadingState();
    delayTimer = setTimeout(fetchData, 500); 
  };

  document.getElementById('searchInput').addEventListener('input', triggerSearch);
  document.getElementById('filterCourse').addEventListener('change', () => { handleCascadingFilter('course'); triggerSearch(); });
  document.getElementById('filterYear').addEventListener('change', () => { handleCascadingFilter('year'); triggerSearch(); });
  document.getElementById('filterGroup').addEventListener('change', () => { triggerSearch(); });
  document.getElementById('excelUpload').addEventListener('change', (e) => processExcelFile(e.target.files[0], e.target));
});

// 🔐 ระบบรักษาความปลอดภัย (Login)
function openLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
  document.getElementById('loginErrorMsg').classList.add('hidden');
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach(input => input.value = '');
  inputs[0].focus();
}
function closeLoginModal() { document.getElementById('loginModal').classList.add('hidden'); }

function setupOTPInputs() {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      if(e.target.value.length === 1 && index < inputs.length - 1) inputs[index + 1].focus();
      checkOTP();
    });
    input.addEventListener('keydown', (e) => {
      if(e.key === 'Backspace' && e.target.value === '' && index > 0) inputs[index - 1].focus();
    });
    // รองรับการ Paste (Ctrl+V) 6 หลักรวดเดียว
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
      inputs.forEach((inp, i) => { if(pastedData[i]) inp.value = pastedData[i]; });
      if(pastedData.length > 0) inputs[Math.min(pastedData.length, 5)].focus();
      checkOTP();
    });
  });
}

function checkOTP() {
  const inputs = document.querySelectorAll('.otp-input');
  let pin = '';
  inputs.forEach(input => pin += input.value);
  if(pin.length === 6) {
    if(pin === "336699") {
      isAdmin = true;
      document.body.classList.add('is-admin');
      document.getElementById('btnLogin').classList.add('hidden');
      document.getElementById('btnLogout').classList.remove('hidden');
      document.getElementById('btnLogout').classList.add('flex');
      closeLoginModal();
      renderTablePage(); // อัปเดตปุ่มจัดการในตาราง
    } else {
      document.getElementById('loginErrorMsg').classList.remove('hidden');
      inputs.forEach(input => input.value = '');
      inputs[0].focus();
    }
  }
}

window.logoutAdmin = function() {
  isAdmin = false;
  document.body.classList.remove('is-admin');
  document.getElementById('btnLogin').classList.remove('hidden');
  document.getElementById('btnLogout').classList.add('hidden');
  document.getElementById('btnLogout').classList.remove('flex');
  if(document.getElementById('page-import').classList.contains('block')) switchPage('dashboard');
  renderTablePage();
}

window.switchPage = function(pageId) {
  const pages = ['dashboard', 'search', 'timeline', 'import'];
  pages.forEach(p => {
    const section = document.getElementById(`page-${p}`);
    if (section) { section.classList.toggle('hidden', p !== pageId); section.classList.toggle('block', p === pageId); }
    const btn = document.getElementById(`nav-btn-${p}`);
    if (btn) {
      btn.classList.toggle('border-blue-600', p === pageId); btn.classList.toggle('text-blue-600', p === pageId);
      btn.classList.toggle('font-bold', p === pageId); btn.classList.toggle('border-transparent', p !== pageId);
      btn.classList.toggle('text-slate-500', p !== pageId); btn.classList.toggle('font-medium', p !== pageId);
    }
  });
  if (pageId === 'timeline' && globalFiltersMaster) renderTimeline(globalFiltersMaster.relations, globalFiltersMaster.years, globalFiltersMaster.courses);
}

window.switchImportMode = function(mode) {
  const btnBulk = document.getElementById('tab-import-bulk'); const btnSingle = document.getElementById('tab-import-single');
  const secBulk = document.getElementById('importModeBulk'); const secSingle = document.getElementById('importModeSingle');
  if(mode === 'bulk') {
    btnBulk.className = "pb-3 border-b-2 border-blue-600 text-blue-600 font-bold text-sm transition px-4 flex items-center gap-2";
    btnSingle.className = "pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700 font-medium text-sm transition px-4 flex items-center gap-2";
    secBulk.classList.remove('hidden'); secBulk.classList.add('block'); secSingle.classList.remove('block'); secSingle.classList.add('hidden');
  } else {
    btnSingle.className = "pb-3 border-b-2 border-blue-600 text-blue-600 font-bold text-sm transition px-4 flex items-center gap-2";
    btnBulk.className = "pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700 font-medium text-sm transition px-4 flex items-center gap-2";
    secSingle.classList.remove('hidden'); secSingle.classList.add('block'); secBulk.classList.remove('block'); secBulk.classList.add('hidden');
  }
}

async function fetchData() {
  const keyword = document.getElementById('searchInput').value.trim();
  const year = document.getElementById('filterYear').value;
  const course = document.getElementById('filterCourse').value;
  const group = document.getElementById('filterGroup').value;

  try {
    const res = await fetch(`${API_URL}?action=getData&keyword=${encodeURIComponent(keyword)}&year=${year}&course=${encodeURIComponent(course)}&group=${encodeURIComponent(group)}`);
    const result = await res.json();
    if (result.status === 'success') {
      cachedPersonnelData = result.data.list;
      if (!globalFiltersMaster) { globalFiltersMaster = result.data.filters; updateDropdownUI(); }
      renderDashboard(result.data.stats);
      drawCharts(result.data.filters.years, result.data.filters.groups); // วาดกราฟ
      currentFilteredData = result.data.list; currentPage = 1;
      updateSmartSummary(course, year, currentFilteredData.length);
      renderTablePage();
    } else { showErrorState(result.message); }
  } catch (error) { showErrorState('การเชื่อมต่อกับฐานข้อมูลขัดข้อง'); }
}

// 📊 ฟังก์ชันวาดกราฟ Visual Analytics (แสดงตัวเลขและเปอร์เซ็นต์)
function drawCharts(allYears, allGroups) {
  // ลงทะเบียน Plugin สำหรับแสดง Data Labels บน Chart
  Chart.register(ChartDataLabels);

  // 1. Bar Chart (5 ปีล่าสุด)
  const sortedYears = [...allYears].sort((a,b)=>a-b);
  const last5Years = sortedYears.slice(-5);
  const yearData = last5Years.map(y => {
    let count = 0;
    cachedPersonnelData.forEach(p => { if(p.trainings && p.trainings.some(t => String(t.year) === String(y))) count++; });
    return count;
  });

  const ctxBar = document.getElementById('barChart').getContext('2d');
  if(barChartObj) barChartObj.destroy();
  barChartObj = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: last5Years.map(y => 'ปี '+y),
      datasets: [{ label: 'ผู้ผ่านการอบรม', data: yearData, backgroundColor: '#3b82f6', borderRadius: 6 }]
    },
    options: { 
      responsive: true, maintainAspectRatio: false, 
      plugins: { 
        legend: { display: false },
        datalabels: { color: '#334155', anchor: 'end', align: 'top', font: { weight: 'bold' } }
      }, 
      scales: { 
        y: { beginAtZero: true, suggestedMax: Math.max(...yearData) * 1.2, grid: { display: false } }, 
        x: { grid: { display: false } } 
      } 
    }
  });

  // 2. Donut Chart (สัดส่วนกลุ่ม)
  let groupCounts = {};
  cachedPersonnelData.forEach(p => { let g = p.group || 'ไม่ระบุ'; groupCounts[g] = (groupCounts[g] || 0) + 1; });
  let topGroups = Object.entries(groupCounts).sort((a,b)=>b[1]-a[1]).slice(0, 4);
  let otherCount = Object.entries(groupCounts).sort((a,b)=>b[1]-a[1]).slice(4).reduce((sum, val) => sum + val[1], 0);
  if(otherCount > 0) topGroups.push(['อื่นๆ', otherCount]);

  const ctxDonut = document.getElementById('donutChart').getContext('2d');
  if(donutChartObj) donutChartObj.destroy();
  donutChartObj = new Chart(ctxDonut, {
    type: 'doughnut',
    data: {
      labels: topGroups.map(g => g[0]),
      datasets: [{ data: topGroups.map(g => g[1]), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#94a3b8'], hoverOffset: 4, borderWidth: 2 }]
    },
    options: { 
      responsive: true, maintainAspectRatio: false, cutout: '65%', 
      plugins: { 
        legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" } } },
        datalabels: {
          color: '#ffffff',
          font: { weight: 'bold', size: 10 },
          formatter: (value, ctx) => {
            let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            let percentage = (value * 100 / sum).toFixed(1) + "%";
            return percentage;
          }
        }
      } 
    }
  });
}

function renderDashboard(stats) {
  document.getElementById('stat-total').textContent = stats.totalPersonnel;
  document.getElementById('stat-top-year').textContent = stats.topYear;
  document.getElementById('stat-top-course').textContent = stats.topCourse;
  
  const tbody = document.getElementById('courseSummaryBody');
  if (!tbody) return;
  if (!stats.courseSummary || stats.courseSummary.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 font-medium">ไม่มีข้อมูลหลักสูตรในระบบ</td></tr>`; return; }

  tbody.innerHTML = stats.courseSummary.map((item, index) => {
    const retentionPercent = item.totalPeople > 0 ? Math.round((item.activePeople / item.totalPeople) * 100) : 0;
    // 📌 สร้างปุ่มพร้อมดักการแปลง Single Quote ในชื่อคอร์สป้องกันการกดไม่ได้ (Bug Fixed)
    const escapedCourseName = String(item.courseName).replace(/'/g, "\\'");
    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="px-6 py-4 text-center font-mono text-xs text-slate-400">${index + 1}</td>
        <td class="px-6 py-4 font-bold text-slate-800">${item.courseName}</td>
        <td class="px-6 py-4 text-center"><span class="bg-slate-100 px-3 py-1 rounded-lg text-slate-600 text-xs">${item.yearsHeld}</span></td>
        <td class="px-6 py-4">
          <div class="flex justify-between text-xs mb-1.5"><span class="text-slate-500 font-medium">ยังทำงาน ${item.activePeople}/${item.totalPeople} คน</span><span class="font-bold text-emerald-600">${retentionPercent}%</span></div>
          <div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-emerald-500 h-2 rounded-full" style="width: ${retentionPercent}%"></div></div>
        </td>
        <td class="px-6 py-4 text-center">
           <button onclick="openProposalReport('${escapedCourseName}', ${item.totalPeople}, ${item.activePeople})" class="text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 w-full max-w-[120px] mx-auto">
             <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> PDCA Report
           </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.openMatrixReport = function() {
  if (!globalFiltersMaster) return;
  matrixAvailableYears = [...globalFiltersMaster.years].sort((a, b) => a - b);
  if(matrixAvailableYears.length === 0) { alert("ไม่พบข้อมูลปีการศึกษาในระบบ"); return; }
  const startSelect = document.getElementById('matrixStartYear'); const endSelect = document.getElementById('matrixEndYear');
  startSelect.innerHTML = matrixAvailableYears.map(y => `<option value="${y}">${y}</option>`).join(''); endSelect.innerHTML = matrixAvailableYears.map(y => `<option value="${y}">${y}</option>`).join('');
  document.getElementById('matrixModal').classList.remove('hidden'); applyMatrixFilter('all');
}

window.applyMatrixFilter = function(type) {
  if (matrixAvailableYears.length === 0) return;
  const minYear = matrixAvailableYears[0]; const maxYear = matrixAvailableYears[matrixAvailableYears.length - 1]; let startYear, endYear;
  if (type === '5') { startYear = Math.max(minYear, maxYear - 4); endYear = maxYear; } 
  else if (type === '10') { startYear = Math.max(minYear, maxYear - 9); endYear = maxYear; } 
  else if (type === 'all') { startYear = minYear; endYear = maxYear; } 
  else if (type === 'custom') { startYear = parseInt(document.getElementById('matrixStartYear').value); endYear = parseInt(document.getElementById('matrixEndYear').value); if (startYear > endYear) { alert('⚠️ ปีเริ่มต้นต้องไม่มากกว่าปีสิ้นสุด'); return; } }
  document.getElementById('matrixStartYear').value = startYear; document.getElementById('matrixEndYear').value = endYear;
  buildMatrixTable(startYear, endYear);
}

function buildMatrixTable(startYear, endYear) {
  const container = document.getElementById('matrixTableContainer'); const textIndicator = document.getElementById('matrixYearRangeText'); textIndicator.textContent = `(ระหว่างปี ${startYear} - ${endYear})`;
  const filteredYears = matrixAvailableYears.filter(y => y >= startYear && y <= endYear);
  const courses = globalFiltersMaster.courses; const courseCounts = globalFiltersMaster.courseYearCounts || {}; const catMap = globalFiltersMaster.courseCategoryMap || {};
  let groupedCourses = {}; courses.forEach(c => { let cat = catMap[c] || 'อื่นๆ'; if (!groupedCourses[cat]) groupedCourses[cat] = []; groupedCourses[cat].push(c); });

  let html = `
    <table class="w-full text-sm border-collapse border border-slate-800 text-slate-800 mt-4">
      <thead><tr><th rowspan="2" class="border border-slate-800 p-3 bg-slate-100 w-1/4">หลักสูตร</th><th colspan="${filteredYears.length}" class="border border-slate-800 p-2 bg-slate-100 text-center">ปีที่อบรม (จำนวนบุคลากรกีฬา)</th><th rowspan="2" class="border border-slate-800 p-3 bg-slate-100 text-center w-20">รวม</th></tr>
      <tr>${filteredYears.map(y => `<th class="border border-slate-800 p-2 text-center bg-slate-50 font-bold">${y}</th>`).join('')}</tr></thead><tbody>
  `;
  let grandTotal = 0; let yearTotals = {}; filteredYears.forEach(y => yearTotals[y] = 0);
  for (const [category, courseList] of Object.entries(groupedCourses)) {
    html += `<tr><td colspan="${filteredYears.length + 2}" class="border border-slate-800 p-2 font-bold bg-slate-200/70">${category}</td></tr>`;
    courseList.forEach(course => {
      let rowTotal = 0; let rowHtml = `<td class="border border-slate-800 p-2 font-medium">${course}</td>`;
      filteredYears.forEach(year => { let count = (courseCounts[course] && courseCounts[course][year]) ? courseCounts[course][year] : 0; if (count > 0) { rowTotal += count; yearTotals[year] += count; rowHtml += `<td class="border border-slate-800 p-2 text-center">${count}</td>`; } else { rowHtml += `<td class="border border-slate-800 p-2 text-center bg-gray-400"></td>`; } });
      if (rowTotal > 0 || filteredYears.length === matrixAvailableYears.length) { grandTotal += rowTotal; html += `<tr>${rowHtml}<td class="border border-slate-800 p-2 text-center font-bold">${rowTotal}</td></tr>`; } 
      else { html += `<tr>${rowHtml}<td class="border border-slate-800 p-2 text-center font-bold text-slate-400">0</td></tr>`; }
    });
  }
  html += `</tbody><tfoot><tr class="bg-slate-100"><td class="border border-slate-800 p-3 text-right font-bold">รวมทั้งสิ้น</td>${filteredYears.map(y => `<td class="border border-slate-800 p-2 text-center font-bold text-blue-700">${yearTotals[y] || 0}</td>`).join('')}<td class="border border-slate-800 p-3 text-center font-extrabold text-lg text-blue-700">${grandTotal}</td></tr></tfoot></table>`;
  container.innerHTML = html;
}

window.closeMatrixReport = function() { document.getElementById('matrixModal').classList.add('hidden'); }
window.printMatrixReport = function() { document.getElementById('matrixModal').classList.add('print-modal-active'); window.print(); document.getElementById('matrixModal').classList.remove('print-modal-active'); }

// 📑 PDCA Proposal Builder (อัปเดตโมดูลข้อความ PDCA ให้สอดคล้องกับภาระงานจริง)
window.openProposalReport = function(courseName, totalPeople, activePeople) {
  const courseUsers = cachedPersonnelData.filter(u => u.trainings && u.trainings.some(t => t.course === courseName));
  const agencyCount = {}; courseUsers.forEach(u => { if(u.agency) agencyCount[u.agency] = (agencyCount[u.agency] || 0) + 1; });
  const topAgencies = Object.entries(agencyCount).sort((a,b)=>b[1]-a[1]).slice(0,3);
  let feedbacks = []; courseUsers.forEach(u => { if (u.evals) { u.evals.forEach(e => feedbacks.push(e.feedback)); } });
  const displayFeedbacks = feedbacks.slice(-2);

  document.getElementById('reportCourseName').textContent = courseName;
  document.getElementById('reportTotal').textContent = totalPeople;
  document.getElementById('reportActive').textContent = activePeople;
  document.getElementById('reportRetention').textContent = totalPeople > 0 ? Math.round((activePeople/totalPeople)*100) + '%' : '0%';
  
  // ยัดข้อมูลใส่ PDCA หน้า 2
  document.querySelectorAll('.pdca-course-name').forEach(el => el.textContent = courseName);
  document.getElementById('pdcaPlanTarget').textContent = totalPeople;
  document.getElementById('pdcaDoActual').textContent = totalPeople;
  document.getElementById('pdcaCheckActive').textContent = activePeople;
  
  const agencyHtml = topAgencies.length > 0 ? topAgencies.map((a, idx) => `<div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"><div class="flex items-center gap-3"><span class="text-blue-500 font-bold bg-blue-50 px-2 rounded">#${idx+1}</span> <span class="text-sm font-semibold">${a[0]}</span></div><span class="text-sm font-bold text-slate-500">${a[1]} คน</span></div>`).join('') : '<p class="text-sm text-slate-400">ไม่สามารถระบุหน่วยงานได้</p>';
  document.getElementById('reportAgencies').innerHTML = agencyHtml;
  const feedbackHtml = displayFeedbacks.length > 0 ? displayFeedbacks.map(f => `<div class="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-sm italic text-slate-700 shadow-sm leading-relaxed">"${f}"</div>`).join('') : '<p class="text-sm text-slate-400 col-span-2 text-center py-4">ยังไม่มีข้อมูลข้อเสนอแนะในระบบ</p>';
  document.getElementById('reportFeedback').innerHTML = feedbackHtml;
  
  // ใส่ Feedback ลง Check ใน PDCA ด้วย
  const pdcaFeedbackHtml = displayFeedbacks.length > 0 ? displayFeedbacks.map(f => `<li>"${f}"</li>`).join('') : '<li>ยังไม่มีการแจ้งปัญหาหรือข้อเสนอแนะในระบบ</li>';
  document.getElementById('pdcaCheckFeedback').innerHTML = pdcaFeedbackHtml;

  document.getElementById('proposalModal').classList.remove('hidden');
}

window.closeProposalReport = function() { document.getElementById('proposalModal').classList.add('hidden'); }
window.printProposalReport = function() { document.getElementById('proposalModal').classList.add('print-modal-active'); window.print(); document.getElementById('proposalModal').classList.remove('print-modal-active'); }

function updateSmartSummary(course, year, totalCount) {
  const badge = document.getElementById('smartInsightBadge'); const textEl = document.getElementById('smartInsightText');
  if (!course && !year) { badge.classList.add('hidden'); return; }
  badge.classList.remove('hidden'); badge.classList.add('flex');
  if (course && year) { textEl.innerHTML = `สรุปข้อมูล: หลักสูตร <span class="font-bold">${course}</span> ประจำปี <span class="font-bold">${year}</span> มีผู้ผ่านการอบรม <span class="font-bold text-lg mx-1">${totalCount}</span> คน`; } 
  else if (course) { textEl.innerHTML = `สรุปข้อมูล: หลักสูตร <span class="font-bold">${course}</span> มีผู้ผ่านการอบรมรวม <span class="font-bold text-lg mx-1">${totalCount}</span> คน`; } 
  else if (year) { textEl.innerHTML = `สรุปข้อมูล: ภาพรวมปี <span class="font-bold">${year}</span> มีผู้ผ่านการอบรมรวม <span class="font-bold text-lg mx-1">${totalCount}</span> คน`; }
}

function renderTablePage() {
  const tbody = document.getElementById('tableBody');
  const paginationInfo = document.getElementById('tablePaginationInfo');
  if (currentFilteredData.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-slate-500 font-medium">ไม่พบข้อมูล</td></tr>`; if (paginationInfo) paginationInfo.innerHTML = `ไม่มีรายการแสดงผล`; renderPaginationNav(0); return; }
  const totalItems = currentFilteredData.length; const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage; const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageData = currentFilteredData.slice(startIndex, endIndex);

  tbody.innerHTML = pageData.map(item => {
    const initials = item.fullName.substring(0, 2).toUpperCase() || 'U';
    const statusBadge = (item.status === 'ปฏิบัติงาน' || item.status === 'ยังปฏิบัติหน้าที่') ? `<span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-amber-300 text-amber-600 bg-white"><span class="w-1.5 h-1.5 rounded-full mr-2 bg-amber-500"></span>${item.status}</span>` : `<span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-slate-300 text-slate-500 bg-white"><span class="w-1.5 h-1.5 rounded-full mr-2 bg-slate-400"></span>${item.status}</span>`;
    
    const btnText = isAdmin ? `<svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> จัดการ` : `<svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> ดูประวัติ`;

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="px-6 py-4 text-blue-600 font-medium text-sm">${item.uid}</td>
        <td class="px-6 py-4"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">${initials}</div><div class="text-slate-700 font-medium text-sm">${item.fullName}</div></div></td>
        <td class="px-6 py-4 text-slate-600 text-sm truncate max-w-[200px]">${item.agency}</td>
        <td class="px-6 py-4 text-center">${statusBadge}</td>
        <td class="px-6 py-4 text-center"><button onclick="viewProfile('${item.uid}')" class="${isAdmin?'text-amber-500 hover:bg-amber-50':'text-blue-500 hover:bg-blue-50'} p-2 rounded-lg font-bold text-xs flex items-center justify-center mx-auto transition-colors cursor-pointer">${btnText}</button></td>
      </tr>
    `;
  }).join('');
  if (paginationInfo) paginationInfo.innerHTML = `แสดงรายการที่ <span class="font-bold text-slate-800 mx-1">${startIndex + 1} - ${endIndex}</span> จากทั้งหมด <span class="font-bold text-slate-800 mx-1">${totalItems}</span> รายการ`;
  renderPaginationNav(totalPages);
}

function renderPaginationNav(totalPages) {
  const nav = document.getElementById('paginationNav'); if (!nav || totalPages === 0) { if(nav) nav.innerHTML = ''; return; }
  nav.innerHTML = `
    <button type="button" onclick="changePage(${currentPage - 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPage === 1 ? 'disabled' : ''}><svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg> ก่อนหน้า</button>
    <span class="text-sm font-semibold text-blue-600 px-4">หน้า ${currentPage}/${totalPages}</span>
    <button type="button" onclick="changePage(${currentPage + 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPage === totalPages ? 'disabled' : ''}>ถัดไป <svg class="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
  `;
}

window.changePage = function(newPage) { const totalPages = Math.ceil(currentFilteredData.length / itemsPerPage); if (newPage >= 1 && newPage <= totalPages) { currentPage = newPage; renderTablePage(); } }

function renderTimeline(relations, years, courses) {
  const container = document.getElementById('timelineCardsContainer');
  if (!container) return;
  if (!courses || courses.length === 0) { container.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">ไม่พบข้อมูลหลักสูตรสำหรับสร้างไทม์ไลน์</div>`; return; }

  container.innerHTML = courses.map((course, idx) => {
    const activeYearsMap = relations.courseToYears[course] || {}; const activeYears = Object.keys(activeYearsMap).map(y => parseInt(y)).sort((a, b) => a - b);
    if (activeYears.length === 0) return '';
    const firstYear = activeYears[0]; const lastYear = activeYears[activeYears.length - 1]; let missingYears = []; for (let y = firstYear; y <= lastYear; y++) { if (!activeYearsMap[y]) missingYears.push(y); }
    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow space-y-5">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-4">
          <div><span class="text-xs font-semibold text-blue-600 uppercase tracking-wider">หลักสูตรที่ #${idx + 1}</span><h3 class="text-lg font-bold text-slate-800 mt-0.5">${course}</h3></div>
          <div class="flex flex-wrap items-center gap-2"><span class="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">ช่วงเวลา: <span class="text-blue-600">${firstYear} - ${lastYear}</span></span><span class="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-100">จัดทั้งหมด ${activeYears.length} ปี</span></div>
        </div>
        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">✅ ปีที่มีการเปิดอบรม:</p>
          <div class="flex flex-wrap gap-2">${activeYears.map(y => `<div class="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-sm"><svg class="w-3.5 h-3.5 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4.5 12.75l6 6 9-13.5" /></svg>ปี ${y}</div>`).join('')}</div>
        </div>
        ${missingYears.length > 0 ? `<div class="pt-3 border-t border-slate-100"><p class="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">⚠️ ปีที่เว้นช่วงการจัด (Gap):</p><div class="flex flex-wrap gap-2">${missingYears.map(my => `<span class="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1 rounded-lg">ปี ${my} (งดจัด)</span>`).join('')}</div></div>` : `<div class="pt-3 border-t border-slate-100 text-xs text-emerald-600 font-semibold flex items-center gap-1.5"><span>✨ จัดอบรมต่อเนื่องทุกปีโดยไม่มีช่วงว่าง</span></div>`}
      </div>
    `;
  }).join('');
}

function formatThaiName(rawPrefix, rawName) {
  let prefix = String(rawPrefix || '').trim(); let name = String(rawName || '').trim();
  name = name.replace(/[\u200B-\u200D\uFEFF\r\n]/g, ''); prefix = prefix.replace(/[\u200B-\u200D\uFEFF\r\n]/g, '');
  const prefixList = ["ว่าที่ ร.ต.", "ว่าที่ร.ต.", "พล.ต.อ.", "พล.ต.ท.", "พล.ต.ต.", "พ.ต.อ.", "พ.ต.ท.", "พ.ต.ต.", "ร.ต.อ.", "ร.ต.ท.", "ร.ต.ต.", "ศ.ดร.", "รศ.ดร.", "ผศ.ดร.", "ดร.", "ศ.", "รศ.", "ผศ.", "นางสาว", "น.ส.", "นาย", "นาง", "พลฯ", "จ.ส.อ.", "จ.ส.ท.", "จ.ส.ต.", "ส.อ.", "ส.ท.", "ส.ต."];
  for (let p of prefixList) { if (name.startsWith(p)) { prefix = p; name = name.substring(p.length).trim(); break; } }
  if (prefix === "น.ส.") prefix = "นางสาว";
  name = name.split(/\s+/).join(' ');
  return { prefix: prefix, fullName: name };
}

function isSmartMatch(importName, existingName) {
  let cleanImp = String(importName).replace(/[\u200B-\u200D\uFEFF\r\n]/g, '').toLowerCase(); let cleanExt = String(existingName).replace(/[\u200B-\u200D\uFEFF\r\n]/g, '').toLowerCase();
  let noSpaceImp = cleanImp.replace(/\s+/g, ''); let noSpaceExt = cleanExt.replace(/\s+/g, '');
  if (noSpaceImp === noSpaceExt) return true;
  let impKeywords = cleanImp.split(/\s+/).filter(k => k.length > 2); let extKeywords = cleanExt.split(/\s+/).filter(k => k.length > 2);
  if (impKeywords.length > 0 && extKeywords.length > 0) {
    if (impKeywords.every(kw => noSpaceExt.includes(kw)) || extKeywords.every(kw => noSpaceImp.includes(kw))) return true;
  }
  return false;
}
function calculateSimilarity(str1, str2) {
  let s1 = String(str1).toLowerCase().replace(/\s+/g, '').trim(); let s2 = String(str2).toLowerCase().replace(/\s+/g, '').trim();
  if (s1 === s2) return 1.0; let longer = s1; let shorter = s2; if (s1.length < s2.length) { longer = s2; shorter = s1; } let longerLength = longer.length; if (longerLength === 0) return 1.0;
  let costs = new Array();
  for (let i = 0; i <= s1.length; i++) { let lastValue = i; for (let j = 0; j <= s2.length; j++) { if (i === 0) { costs[j] = j; } else { if (j > 0) { let newValue = costs[j - 1]; if (s1.charAt(i - 1) !== s2.charAt(j - 1)) { newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1; } costs[j - 1] = lastValue; lastValue = newValue; } } } if (s2.length > 0) costs[s2.length] = lastValue; }
  return (longerLength - costs[s2.length]) / longerLength;
}

// 📥 จัดการนำเข้าผ่านไฟล์/ลากวาง
function setupDragAndDrop() {
  const dropZone = document.getElementById('dragDropZone');
  if(!dropZone) return;
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-50'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-blue-500', 'bg-blue-50'); });
  dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('border-blue-500', 'bg-blue-50'); if(e.dataTransfer.files.length > 0) processExcelFile(e.dataTransfer.files[0], null); });
}

function processExcelFile(file, inputElement) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, {type: 'array'});
      const jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      if (jsonRows.length > 0 && !('ชื่อ-นามสกุล' in jsonRows[0])) { alert("❌ โครงสร้างไฟล์ผิดพลาด กรุณาใช้ไฟล์ Template มาตรฐาน"); if(inputElement) inputElement.value = ''; return; }
      if (jsonRows.length === 0) { alert("⚠️ ไม่พบข้อมูลในไฟล์ Excel"); if(inputElement) inputElement.value = ''; return; }

      let cleanedRows = jsonRows.map((row, index) => {
        let formatted = formatThaiName(row['คำนำหน้า'], row['ชื่อ-นามสกุล']);
        let matchedExisting = null; let matchType = 'new'; 
        let smartFound = cachedPersonnelData.find(p => isSmartMatch(formatted.fullName, p.fullName));
        if (smartFound) { matchedExisting = smartFound; matchType = 'exact'; } 
        else {
          for (let p of cachedPersonnelData) { let sim = calculateSimilarity(p.fullName, formatted.fullName); if (sim >= 0.75 && sim < 1.0) { matchedExisting = p; matchType = 'fuzzy'; break; } }
        }
        return {
          originalIndex: index, 'คำนำหน้า': formatted.prefix, 'ชื่อ-นามสกุล': formatted.fullName,
          'กลุ่มหน่วยงาน': row['กลุ่มหน่วยงาน'] || '', 'หน่วยงาน': String(row['หน่วยงาน'] || '').replace(/\s+/g, ' ').trim(),
          'สถานะ': row['สถานะ'] || 'ปฏิบัติงาน', 'ชื่อหลักสูตร': row['ชื่อหลักสูตร'] || '', 'ปีที่อบรม': row['ปีที่อบรม'] || '',
          matchType: matchType, matchedUser: matchedExisting, actionType: matchType === 'exact' ? 'merge' : 'auto'
        };
      });
      pendingImportData = cleanedRows; showPreviewSection();
    } catch (error) { alert("❌ เกิดข้อผิดพลาดในการอ่านไฟล์"); }
    if(inputElement) inputElement.value = ''; 
  };
  reader.readAsArrayBuffer(file);
}

// 📥 จัดการฟอร์มนำเข้ารายบุคคล
window.submitSingleEntry = function() {
  const pPrefix = document.getElementById('singlePrefix').value;
  const pName = document.getElementById('singleFullName').value;
  const pGroup = document.getElementById('singleGroup').value;
  const pAgency = document.getElementById('singleAgency').value;
  const pCourse = document.getElementById('singleCourse').value;
  const pYear = document.getElementById('singleYear').value;

  if(!pName || !pAgency) { alert('⚠️ กรุณากรอก ชื่อ-นามสกุล และ หน่วยงาน ให้ครบถ้วน'); return; }

  let formatted = formatThaiName(pPrefix, pName);
  let matchedExisting = null; let matchType = 'new'; 
  let smartFound = cachedPersonnelData.find(p => isSmartMatch(formatted.fullName, p.fullName));
  if (smartFound) { matchedExisting = smartFound; matchType = 'exact'; } 
  else {
    for (let p of cachedPersonnelData) { let sim = calculateSimilarity(p.fullName, formatted.fullName); if (sim >= 0.75 && sim < 1.0) { matchedExisting = p; matchType = 'fuzzy'; break; } }
  }

  pendingImportData = [{
    originalIndex: 0, 'คำนำหน้า': formatted.prefix, 'ชื่อ-นามสกุล': formatted.fullName,
    'กลุ่มหน่วยงาน': pGroup, 'หน่วยงาน': pAgency, 'สถานะ': 'ปฏิบัติงาน', 
    'ชื่อหลักสูตร': pCourse, 'ปีที่อบรม': pYear,
    matchType: matchType, matchedUser: matchedExisting, actionType: matchType === 'exact' ? 'merge' : 'auto'
  }];
  
  document.getElementById('singlePrefix').value = ''; document.getElementById('singleFullName').value = '';
  document.getElementById('singleGroup').value = ''; document.getElementById('singleAgency').value = '';
  document.getElementById('singleCourse').value = ''; document.getElementById('singleYear').value = '';

  showPreviewSection();
}

function showPreviewSection() {
  document.getElementById('importUploadSection').classList.add('hidden'); document.getElementById('importPreviewSection').classList.remove('hidden');
  currentPreviewPage = 1; renderPreviewTablePage();
}

function renderPreviewTablePage() {
  const tbody = document.getElementById('previewTableBody'); const previewInfo = document.getElementById('previewPaginationInfo');
  const totalItems = pendingImportData.length; const totalPages = Math.ceil(totalItems / previewItemsPerPage);
  const startIndex = (currentPreviewPage - 1) * previewItemsPerPage; const endIndex = Math.min(startIndex + previewItemsPerPage, totalItems);
  const pageData = pendingImportData.slice(startIndex, endIndex);

  document.getElementById('previewTotalText').innerHTML = `พบข้อมูลที่รอยืนยัน <span class="font-bold text-blue-600">${totalItems}</span> รายการ`;
  tbody.innerHTML = pageData.map((row, idx) => {
    let badgeHtml = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold">✨ บุคคลใหม่</span>`;
    let targetUidVal = '';
    if (row.matchType === 'exact') {
      badgeHtml = `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold">🔄 อัปเดตคนเดิม (${row.matchedUser.fullName})</span>`; targetUidVal = row.matchedUser.uid;
    } else if (row.matchType === 'fuzzy') {
      badgeHtml = `
        <div class="space-y-1.5"><span class="inline-block bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded text-[11px] font-semibold">⚠️ ชื่อคล้าย: ${row.matchedUser.fullName}</span>
          <select onchange="updateImportAction(${startIndex + idx}, this.value)" class="w-full text-xs bg-slate-50 border border-slate-300 rounded p-1.5 outline-none font-medium text-slate-700">
            <option value="auto" ${row.actionType === 'auto' ? 'selected' : ''}>-- กรุณาเลือก --</option>
            <option value="merge" ${row.actionType === 'merge' ? 'selected' : ''}>🔗 รวมประวัติคนเดิม</option>
            <option value="new" ${row.actionType === 'new' ? 'selected' : ''}>➕ สร้างใหม่แยก</option>
          </select></div>
      `;
      targetUidVal = row.matchedUser.uid;
    }
    return `
      <tr class="hover:bg-slate-50 align-top border-b border-slate-100">
        <td class="px-4 py-3.5 border-r border-slate-100 text-center font-mono text-xs text-slate-400">${startIndex + idx + 1}</td>
        <td class="px-4 py-3.5 border-r border-slate-100 font-medium text-slate-800">${row['คำนำหน้า']} ${row['ชื่อ-นามสกุล']}</td>
        <td class="px-4 py-3.5 border-r border-slate-100 truncate max-w-[180px]">${row['หน่วยงาน'] || '-'}</td>
        <td class="px-4 py-3.5 border-r border-slate-100 text-center"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">${row['สถานะ']}</span></td>
        <td class="px-4 py-3.5 border-r border-slate-100">${row['ชื่อหลักสูตร'] || '-'} <span class="text-xs text-slate-400">(${row['ปีที่อบรม'] || '-'})</span></td>
        <td class="px-4 py-3.5 text-center"><input type="hidden" id="targetUid_${startIndex + idx}" value="${targetUidVal}">${badgeHtml}</td>
      </tr>
    `;
  }).join('');
  if (previewInfo) previewInfo.innerHTML = `แสดงรายการที่ <span class="font-bold text-slate-800 mx-1">${startIndex + 1} - ${endIndex}</span> จากทั้งหมด <span class="font-bold text-slate-800 mx-1">${totalItems}</span> รายการ`;
  renderPreviewPaginationNav(totalPages);
}

window.updateImportAction = function(absoluteIndex, choice) { if (pendingImportData[absoluteIndex]) { pendingImportData[absoluteIndex].actionType = choice; } }

function renderPreviewPaginationNav(totalPages) {
  const nav = document.getElementById('previewPaginationNav'); if (!nav || totalPages === 0) { if(nav) nav.innerHTML = ''; return; }
  nav.innerHTML = `
    <button type="button" onclick="changePreviewPage(${currentPreviewPage - 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPreviewPage === 1 ? 'disabled' : ''}><svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg> ก่อนหน้า</button>
    <span class="text-sm font-semibold text-blue-600 px-4">หน้า ${currentPreviewPage}/${totalPages}</span>
    <button type="button" onclick="changePreviewPage(${currentPreviewPage + 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPreviewPage === totalPages ? 'disabled' : ''}>ถัดไป <svg class="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
  `;
}

window.changePreviewPage = function(newPage) { const totalPages = Math.ceil(pendingImportData.length / previewItemsPerPage); if (newPage >= 1 && newPage <= totalPages) { currentPreviewPage = newPage; renderPreviewTablePage(); } }
window.cancelImport = function() { pendingImportData = []; document.getElementById('importPreviewSection').classList.add('hidden'); document.getElementById('importUploadSection').classList.remove('hidden'); };

window.confirmImport = async function() {
  if (!pendingImportData || pendingImportData.length === 0) return;
  const processedRows = pendingImportData.map((row, idx) => { const targetUidInput = document.getElementById(`targetUid_${idx}`); return { ...row, targetUid: targetUidInput ? targetUidInput.value : '' }; });
  const btn = document.getElementById('btnConfirmImport'); const originalText = btn.innerHTML; btn.innerHTML = `กำลังบันทึก...`; btn.disabled = true;
  try {
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'bulkImport', rows: processedRows }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    const result = await response.json();
    if (result.status === 'success') { alert(`✅ ${result.message}`); globalFiltersMaster = null; fetchData(); cancelImport(); switchPage('search'); } 
    else { alert(`❌ เกิดข้อผิดพลาด: ${result.message}`); }
  } catch (error) { alert("❌ การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง"); }
  btn.innerHTML = originalText; btn.disabled = false;
};

window.viewProfile = function(uid) {
  currentActiveUid = uid; const person = cachedPersonnelData.find(p => p.uid === uid);
  if (!person) { alert("❌ ไม่พบข้อมูลบุคลากร"); return; }
  document.getElementById('profileName').textContent = person.fullName; document.getElementById('profileUid').textContent = `รหัสอ้างอิง: ${person.uid}`; 
  document.getElementById('profileAgency').textContent = `${person.agency} (${person.status})`;
  document.getElementById('profileGroup').textContent = person.group || 'ไม่ระบุกลุ่ม'; 

  const timelineEl = document.getElementById('profileTrainings');
  if (person.trainings && person.trainings.length > 0) {
    const sortedTrainings = person.trainings.sort((a, b) => b.year - a.year);
    timelineEl.innerHTML = sortedTrainings.map(t => `<li class="relative pl-6 pb-4 border-l-2 border-slate-200 last:border-0 last:pb-0"><div class="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 ring-4 ring-white shadow-sm"></div><p class="text-sm font-bold text-slate-800">${t.course}</p><p class="text-xs text-slate-500 mt-0.5">ปีการศึกษา: ${t.year}</p></li>`).join('');
  } else { timelineEl.innerHTML = `<li class="text-sm text-slate-500 pl-4">ยังไม่มีประวัติการอบรม</li>`; }
  
  const dutyEl = document.getElementById('profileDuties');
  if (person.duties && person.duties.length > 0) {
    dutyEl.innerHTML = person.duties.map(d => `<li class="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1 shadow-sm"><span class="text-sm font-bold text-slate-800">${d.sport}</span><span class="text-xs text-slate-500">สถานะ: ${d.role}</span></li>`).join('');
  } else { dutyEl.innerHTML = `<div class="text-sm text-slate-500">ยังไม่มีประวัติลงพื้นที่</div>`; }
  
  const evalEl = document.getElementById('profileEvals');
  if (person.evals && person.evals.length > 0) {
    evalEl.innerHTML = person.evals.map(e => `<div class="bg-white p-3.5 rounded-xl border border-slate-200 text-sm text-slate-700 italic shadow-sm">"${e.feedback}"</div>`).join('');
  } else { evalEl.innerHTML = `<div class="text-sm text-slate-500">ยังไม่มีข้อเสนอแนะ</div>`; }
  
  const slideOver = document.getElementById('slideOver'); const backdrop = document.getElementById('slideOverBackdrop'); const panel = document.getElementById('slideOverPanel');
  slideOver.classList.remove('hidden'); setTimeout(() => { backdrop.classList.remove('opacity-0'); backdrop.classList.add('opacity-100'); panel.classList.remove('translate-x-full'); panel.classList.add('translate-x-0'); }, 10);
  switchTab('general');
}

window.closeProfile = function() {
  currentActiveUid = null; const backdrop = document.getElementById('slideOverBackdrop'); const panel = document.getElementById('slideOverPanel');
  backdrop.classList.remove('opacity-100'); backdrop.classList.add('opacity-0'); panel.classList.remove('translate-x-0'); panel.classList.add('translate-x-full');
  setTimeout(() => { document.getElementById('slideOver').classList.add('hidden'); }, 300);
}

window.switchTab = function(tabName) {
  ['general', 'duty', 'eval'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`); const content = document.getElementById(`tab-content-${t}`);
    if (t === tabName) { btn.classList.add('border-blue-600', 'text-blue-600', 'font-bold'); btn.classList.remove('border-transparent', 'text-slate-500', 'font-medium'); content.classList.remove('hidden'); content.classList.add('block'); } 
    else { btn.classList.add('border-transparent', 'text-slate-500', 'font-medium'); btn.classList.remove('border-blue-600', 'text-blue-600', 'font-bold'); content.classList.remove('block'); content.classList.add('hidden'); }
  });
}

window.submitDuty = async function() {
  if (!currentActiveUid) return; const sport = document.getElementById('inputDutySport').value.trim(); const role = document.getElementById('inputDutyRole').value.trim();
  if (!sport || !role) return alert('⚠️ กรุณากรอก ชนิดกีฬา และ ประเภทบุคลากร');
  const btn = document.getElementById('btnSaveDuty'); btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;
  try {
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveDuty', uid: currentActiveUid, sport: sport, role: role }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    const result = await response.json();
    if(result.status === 'success') { alert('✅ บันทึกสำเร็จ'); document.getElementById('inputDutySport').value = ''; document.getElementById('inputDutyRole').value = ''; fetchData(); } else { alert(`❌ ข้อผิดพลาด: ${result.message}`); }
  } catch(e) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  btn.textContent = 'บันทึกข้อมูล'; btn.disabled = false;
}

window.submitEval = async function() {
  if (!currentActiveUid) return; const feedback = document.getElementById('inputEvalFeedback').value.trim();
  if (!feedback) return alert('⚠️ กรุณากรอกข้อเสนอแนะ');
  const btn = document.getElementById('btnSaveEval'); btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;
  try {
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveEval', uid: currentActiveUid, feedback: feedback }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    const result = await response.json();
    if(result.status === 'success') { alert('✅ บันทึกสำเร็จ'); document.getElementById('inputEvalFeedback').value = ''; fetchData(); } else { alert(`❌ ข้อผิดพลาด: ${result.message}`); }
  } catch(e) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  btn.textContent = 'บันทึกข้อเสนอแนะ'; btn.disabled = false;
}

function handleCascadingFilter(changedType) {
  if (!globalFiltersMaster) return;
  const yearSelect = document.getElementById('filterYear'); const courseSelect = document.getElementById('filterCourse');
  const selectedYear = yearSelect.value; const selectedCourse = courseSelect.value; const relations = globalFiltersMaster.relations;
  if (changedType === 'course' && selectedCourse) { const validYears = Object.keys(relations.courseToYears[selectedCourse] || {}); if (selectedYear && !validYears.includes(selectedYear)) yearSelect.value = ''; } 
  else if (changedType === 'year' && selectedYear) { const validCourses = Object.keys(relations.yearToCourses[selectedYear] || {}); if (selectedCourse && !validCourses.includes(selectedCourse)) courseSelect.value = ''; }
  updateDropdownUI(); 
}

function updateDropdownUI() {
  if (!globalFiltersMaster) return;
  const selectedYear = document.getElementById('filterYear').value; const selectedCourse = document.getElementById('filterCourse').value; const selectedGroup = document.getElementById('filterGroup').value;
  const relations = globalFiltersMaster.relations;
  let availableYears = globalFiltersMaster.years; let availableCourses = globalFiltersMaster.courses; let availableGroups = globalFiltersMaster.groups;
  
  if (selectedCourse) availableYears = Object.keys(relations.courseToYears[selectedCourse] || {}).sort((a,b) => b-a);
  if (selectedYear) availableCourses = Object.keys(relations.yearToCourses[selectedYear] || {}).sort();
  
  populateDropdown('filterYear', availableYears, selectedYear, 'ทุกปีการศึกษา'); 
  populateDropdown('filterCourse', availableCourses, selectedCourse, 'ทุกหลักสูตร');
  populateDropdown('filterGroup', availableGroups, selectedGroup, 'ทุกกลุ่มบุคลากร');
}

function populateDropdown(elementId, items, currentValue, defaultLabel) {
  const select = document.getElementById(elementId); select.innerHTML = `<option value="">${defaultLabel}</option>`;
  items.forEach(item => { const option = document.createElement('option'); option.value = item; option.textContent = item; select.appendChild(option); });
  select.value = currentValue;
}

window.exportToExcel = function() {
  const filterYear = document.getElementById('filterYear').value; const filterCourse = document.getElementById('filterCourse').value; let exportData = [];
  currentFilteredData.forEach(user => {
    let userTrainings = user.trainings || [];
    let matchedTrainings = userTrainings.filter(t => { const matchY = filterYear === '' || String(t.year) === String(filterYear); const matchC = filterCourse === '' || String(t.course) === String(filterCourse); return matchY && matchC; });
    if (matchedTrainings.length > 0) { 
      matchedTrainings.forEach(t => { exportData.push({ 'รหัส UID': user.uid, 'ชื่อ-นามสกุล': user.fullName, 'กลุ่มหน่วยงาน': user.group || '-', 'หน่วยงาน': user.agency, 'สถานะ': user.status, 'ชื่อหลักสูตร': t.course, 'ปีที่อบรม': parseInt(t.year) || t.year }); }); 
    } else if (filterYear === '' && filterCourse === '') { 
      exportData.push({ 'รหัส UID': user.uid, 'ชื่อ-นามสกุล': user.fullName, 'กลุ่มหน่วยงาน': user.group || '-', 'หน่วยงาน': user.agency, 'สถานะ': user.status, 'ชื่อหลักสูตร': '-', 'ปีที่อบรม': '-' }); 
    }
  });
  exportData.sort((a, b) => { const yearA = parseInt(a['ปีที่อบรม']) || 9999; const yearB = parseInt(b['ปีที่อบรม']) || 9999; return yearA - yearB; });
  if (exportData.length === 0) { alert('⚠️ ไม่พบข้อมูลประวัติการอบรมสำหรับเงื่อนไขนี้'); return; }
  const ws = XLSX.utils.json_to_sheet(exportData); ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 40 }, { wch: 15 }]; 
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Personnel_Training_Log");
  let filename = "ข้อมูลบุคลากรกีฬา"; if (filterCourse) filename += "_" + filterCourse.replace(/\s+/g, ""); if (filterYear) filename += "_ปี" + filterYear; filename += ".xlsx"; XLSX.writeFile(wb, filename);
};

window.downloadTemplate = function() {
  const templateData = [ ["คำนำหน้า", "ชื่อ-นามสกุล", "กลุ่มหน่วยงาน", "หน่วยงาน", "สถานะ", "ชื่อหลักสูตร", "ปีที่อบรม"], ["นาย", "ทดสอบ ตัวอย่างการกรอก", "สมาคมกีฬา", "สมาคมกีฬาแห่งจังหวัดกรุงเทพมหานคร", "ปฏิบัติงาน", "TSLP", "2569"] ];
  const ws = XLSX.utils.aoa_to_sheet(templateData); ws['!cols'] = [{wch:10}, {wch:30}, {wch:20}, {wch:40}, {wch:15}, {wch:20}, {wch:15}]; const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import_Template"); XLSX.writeFile(wb, "Template_นำเข้าบุคลากร.xlsx");
};

function showLoadingState() { const tbody = document.getElementById('tableBody'); if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-blue-500 font-medium">กำลังโหลดข้อมูล...</td></tr>`; }
function showErrorState(message) { const tbody = document.getElementById('tableBody'); if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-red-400 font-medium">❌ ${message}</td></tr>`; }
