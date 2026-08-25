// ล็อกเป้าหมาย API ของคุณ
const API_URL = 'https://script.google.com/macros/s/AKfycbw--515Ocaod1h_wkMMc8dfiUumw4XD7anSkhWcM4coEXQJAVjGSKORwIMGLgq9t6Fi/exec';

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 System Initialized. Zero-Error Standard Active.');
  
  // 1. ดึงข้อมูลครั้งแรกเมื่อเปิดเว็บ
  fetchData();
  
  // 2. ผูก Event Listener สำหรับระบบค้นหาและตัวกรอง
  const searchInput = document.getElementById('searchInput');
  const filterYear = document.getElementById('filterYear');
  const filterCourse = document.getElementById('filterCourse');
  
  // ระบบ Debounce ป้องกันการยิง API ถี่เกินไป
  let delayTimer;
  const triggerSearch = () => {
    clearTimeout(delayTimer);
    showLoadingState();
    delayTimer = setTimeout(fetchData, 500);
  };

  searchInput.addEventListener('input', triggerSearch);
  filterYear.addEventListener('change', triggerSearch);
  filterCourse.addEventListener('change', triggerSearch);

  // 3. ผูก Event Listener สำหรับปุ่มนำเข้า Excel
  document.getElementById('excelUpload').addEventListener('change', handleExcelUpload);
  
  // 4. ปุ่มเพิ่มบุคคล (เตรียมไว้สำหรับเฟสต่อไป)
  document.getElementById('addPersonBtn').addEventListener('click', () => {
    alert('เตรียมพบกับฟีเจอร์ Slide-over Panel สำหรับเพิ่มรายบุคคลในเร็วๆ นี้ครับ!');
  });
});

// ฟังก์ชันหลัก: ดึงข้อมูลและอัปเดตหน้าจอ
async function fetchData() {
  const keyword = document.getElementById('searchInput').value.trim();
  const year = document.getElementById('filterYear').value;
  const course = document.getElementById('filterCourse').value;

  try {
    const res = await fetch(`${API_URL}?action=getData&keyword=${encodeURIComponent(keyword)}&year=${year}&course=${encodeURIComponent(course)}`);
    const result = await res.json();
    
    if (result.status === 'success') {
      // อัปเดตตัวเลข KPI Dashboard
      document.getElementById('stat-total').textContent = result.data.stats.total;
      document.getElementById('stat-recent').textContent = result.data.stats.recent;
      document.getElementById('stat-top-course').textContent = result.data.stats.topCourse;
      
      // อัปเดตตารางรายชื่อ
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
    console.error('Fetch Error:', error);
  }
}

// ฟังก์ชันนำเข้าไฟล์ Excel แบบ Zero-Error
function handleExcelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // แปลงข้อมูลเป็น JSON
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      
      // Zero-Error Check: ตรวจสอบหัวคอลัมน์
      if (jsonRows.length > 0 && !('ชื่อ-นามสกุล' in jsonRows[0])) {
        alert("❌ โครงสร้างไฟล์ผิดพลาด กรุณาใช้ Template มาตรฐานของระบบ");
        e.target.value = ''; // เคลียร์ไฟล์ทิ้ง
        return;
      }

      if(confirm(`ตรวจพบข้อมูลบุคลากรจำนวน ${jsonRows.length} รายการ\nต้องการบันทึกเข้าสู่ระบบใช่หรือไม่?`)) {
         showLoadingState("กำลังนำเข้าข้อมูล กรุณารอสักครู่...");
         
         const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'bulkImport', rows: jsonRows }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
         });
         
         const result = await response.json();
         if(result.status === 'success') {
            alert(`✅ นำเข้าข้อมูลสำเร็จ!\n${result.message}`);
            fetchData(); // รีเฟรชหน้าจอใหม่
         } else {
            alert(`❌ เกิดข้อผิดพลาด: ${result.message}`);
            fetchData(); // โหลดข้อมูลเดิมกลับมา
         }
      }
    } catch (error) {
      alert("❌ เกิดข้อผิดพลาดในการอ่านไฟล์ Excel");
      console.error(error);
      fetchData();
    }
    
    e.target.value = ''; // เคลียร์ช่อง input ให้พร้อมอัปโหลดรอบใหม่เสมอ
  };
  reader.readAsArrayBuffer(file);
}

// ฟังก์ชัน UI Utilities
function showLoadingState(message = "กำลังประมวลผลข้อมูล...") {
  document.getElementById('tableBody').innerHTML = `
    <tr>
      <td colspan="5" class="px-6 py-12 text-center text-blue-600 font-medium">
        <svg class="animate-spin -ml-1 mr-3 h-6 w-6 text-blue-600 inline mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        ${message}
      </td>
    </tr>`;
}

function showErrorState(message) {
  document.getElementById('tableBody').innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-red-500 font-medium">❌ ${message}</td></tr>`;
}

window.viewProfile = function(uid) {
  alert('เปิดหน้าประวัติของรหัส: ' + uid);
}
