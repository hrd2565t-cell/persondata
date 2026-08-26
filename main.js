const API_URL = 'https://script.google.com/macros/s/AKfycbw--515Ocaod1h_wkMMc8dfiUumw4XD7anSkhWcM4coEXQJAVjGSKORwIMGLgq9t6Fi/exec';

let cachedPersonnelData = [];
let currentActiveUid = null;
let globalFiltersMaster = null; 
let currentFilteredData = [];
let currentPage = 1;
const itemsPerPage = 10;

// Preview Data
let pendingImportData = [];
let currentPreviewPage = 1;
const previewItemsPerPage = 10;

document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  document.getElementById('searchInput').addEventListener('input', () => { setTimeout(fetchData, 500); });
  document.getElementById('filterCourse').addEventListener('change', fetchData);
  document.getElementById('filterYear').addEventListener('change', fetchData);
  document.getElementById('excelUpload').addEventListener('change', handleExcelUpload);
});

window.switchPage = function(pageId) {
  ['dashboard', 'search', 'timeline', 'import'].forEach(p => {
    const section = document.getElementById(`page-${p}`);
    if(section) { section.classList.toggle('hidden', p !== pageId); section.classList.toggle('block', p === pageId); }
    const btn = document.getElementById(`nav-btn-${p}`);
    if(btn) { btn.classList.toggle('border-blue-600', p === pageId); btn.classList.toggle('text-slate-500', p !== pageId); }
  });
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
      if (!globalFiltersMaster) { globalFiltersMaster = result.data.filters; }
      renderDashboard(result.data.stats);
      currentFilteredData = result.data.list;
      currentPage = 1;
      renderTablePage();
    }
  } catch (error) { console.error(error); }
}

// 📌 ฟังก์ชันเรนเดอร์แดชบอร์ด + แถบแสดงอัตราการคงอยู่ (Retainer Tracker)
function renderDashboard(stats) {
  document.getElementById('stat-total').textContent = stats.totalPersonnel;
  document.getElementById('stat-top-year').textContent = stats.topYear;
  document.getElementById('stat-top-course').textContent = stats.topCourse;
  
  const tbody = document.getElementById('courseSummaryBody');
  if (!tbody) return;
  if (!stats.courseSummary || stats.courseSummary.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8">ไม่มีข้อมูล</td></tr>`; return;
  }

  tbody.innerHTML = stats.courseSummary.map((item, index) => {
    // คำนวณเปอร์เซ็นต์ความคุ้มค่าของโครงการ (Retention Rate)
    const retentionPercent = item.totalPeople > 0 ? Math.round((item.activePeople / item.totalPeople) * 100) : 0;
    
    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="px-6 py-4 text-center font-mono text-xs text-slate-400">${index + 1}</td>
        <td class="px-6 py-4 font-bold text-slate-800">${item.courseName}</td>
        <td class="px-6 py-4 text-center"><span class="bg-slate-100 px-3 py-1 rounded-lg text-slate-600 text-xs">${item.yearsHeld}</span></td>
        
        <!-- 🎯 แถบกราฟแบบ Retainer Tracker -->
        <td class="px-6 py-4">
          <div class="flex justify-between text-xs mb-1.5">
            <span class="text-slate-500 font-medium">ยังทำงาน ${item.activePeople}/${item.totalPeople} คน</span>
            <span class="font-bold text-emerald-600">${retentionPercent}%</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2">
            <div class="bg-emerald-500 h-2 rounded-full" style="width: ${retentionPercent}%"></div>
          </div>
        </td>

        <!-- 📄 ปุ่ม Proposal Builder สร้างรายงานส่งกองทุนฯ -->
        <td class="px-6 py-4 text-center">
           <button onclick="openProposalReport('${item.courseName}', ${item.totalPeople}, ${item.activePeople})" class="bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 mx-auto border border-blue-200 hover:border-blue-600">
             <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> สร้างรายงาน (NSDF)
           </button>
        </td>
      </tr>
    `;
  }).join('');
}

// 📌 ฟังก์ชันเปิดหน้าต่าง Proposal Report สำหรับปริ้นรายงานส่ง NSDF
window.openProposalReport = function(courseName, totalPeople, activePeople) {
  // ดึงข้อมูลรายชื่อคนที่อยู่ในหลักสูตรนี้มาวิเคราะห์หาข้อมูลย่อย
  const courseUsers = cachedPersonnelData.filter(u => u.trainings && u.trainings.some(t => t.course === courseName));
  
  // 1. วิเคราะห์สัดส่วนหน่วยงาน 3 อันดับแรก
  const agencyCount = {};
  courseUsers.forEach(u => { if(u.agency) agencyCount[u.agency] = (agencyCount[u.agency] || 0) + 1; });
  const topAgencies = Object.entries(agencyCount).sort((a,b)=>b[1]-a[1]).slice(0,3);

  // 2. ดึงข้อเสนอแนะเชิงธรรมาภิบาลล่าสุดมาโชว์ 2 รายการ
  let feedbacks = [];
  courseUsers.forEach(u => { if (u.evals) { u.evals.forEach(e => feedbacks.push(e.feedback)); } });
  const displayFeedbacks = feedbacks.slice(-2);

  // ยัดข้อมูลใส่ Modal
  document.getElementById('reportCourseName').textContent = courseName;
  document.getElementById('reportTotal').textContent = totalPeople;
  document.getElementById('reportActive').textContent = activePeople;
  document.getElementById('reportRetention').textContent = totalPeople > 0 ? Math.round((activePeople/totalPeople)*100) + '%' : '0%';
  
  // Render หน่วยงาน
  const agencyHtml = topAgencies.length > 0 ? topAgencies.map((a, idx) => `
    <div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <div class="flex items-center gap-3"><span class="text-blue-500 font-bold bg-blue-50 px-2 rounded">#${idx+1}</span> <span class="text-sm font-semibold">${a[0]}</span></div>
      <span class="text-sm font-bold text-slate-500">${a[1]} คน</span>
    </div>
  `).join('') : '<p class="text-sm text-slate-400">ไม่สามารถระบุหน่วยงานได้</p>';
  document.getElementById('reportAgencies').innerHTML = agencyHtml;
  
  // Render ข้อเสนอแนะ
  const feedbackHtml = displayFeedbacks.length > 0 ? displayFeedbacks.map(f => `
    <div class="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-sm italic text-slate-700 shadow-sm leading-relaxed">
      "${f}"
    </div>
  `).join('') : '<p class="text-sm text-slate-400 col-span-2 text-center py-4">ยังไม่มีข้อมูลข้อเสนอแนะในระบบ</p>';
  document.getElementById('reportFeedback').innerHTML = feedbackHtml;

  // เปิด Modal
  document.getElementById('proposalModal').classList.remove('hidden');
}

window.closeProposalReport = function() {
  document.getElementById('proposalModal').classList.add('hidden');
}

window.printProposalReport = function() {
  window.print();
}

// -- ส่วนโค้ดตารางหลัก, Pagination และการนำเข้าข้อมูล (คงเดิมทั้งหมด) --
function renderTablePage() {
  const tbody = document.getElementById('tableBody');
  const paginationInfo = document.getElementById('tablePaginationInfo');
  
  if (currentFilteredData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-slate-500 font-medium">ไม่พบข้อมูล</td></tr>`; return;
  }

  const totalItems = currentFilteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const pageData = currentFilteredData.slice(startIndex, endIndex);

  tbody.innerHTML = pageData.map(item => `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="px-6 py-4 text-blue-600 font-medium text-sm">${item.uid}</td>
        <td class="px-6 py-4 text-slate-700 font-medium text-sm">${item.fullName}</td>
        <td class="px-6 py-4 text-slate-600 text-sm truncate max-w-[200px]">${item.agency}</td>
        <td class="px-6 py-4 text-center text-xs"><span class="bg-slate-100 px-2 py-1 rounded">${item.status}</span></td>
        <td class="px-6 py-4 text-center"><button onclick="viewProfile('${item.uid}')" class="text-blue-600 font-bold text-xs">จัดการ</button></td>
      </tr>
  `).join('');
  
  if (paginationInfo) paginationInfo.innerHTML = `แสดงรายการ ${startIndex + 1} - ${endIndex} จาก ${totalItems}`;
  renderPaginationNav(totalPages);
}

function renderPaginationNav(totalPages) { /* (โค้ดสร้างปุ่มแบ่งหน้า คงเดิม) */ }
window.changePage = function(newPage) { currentPage = newPage; renderTablePage(); }
function handleExcelUpload(e) { /* (โค้ดดึงไฟล์ คงเดิม) */ }
function showPreviewSection(data) { /* (โค้ดหน้าพรีวิว คงเดิม) */ }
window.confirmImport = async function() { /* (โค้ดบันทึก คงเดิม) */ }
window.viewProfile = function(uid) { /* (โค้ดดูประวัติ คงเดิม) */ }
window.closeProfile = function() { /* (โค้ดปิดหน้าประวัติ คงเดิม) */ }
