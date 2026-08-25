const API_URL = 'ใส่_URL_WEB_APP_ของคุณที่นี่'; // << อย่าลืมแก้ตรงนี้

document.addEventListener('DOMContentLoaded', () => {
  fetchData(); // โหลดครั้งแรก
  
  // 1. จัดการระบบค้นหา และ ตัวกรอง (Smart Filters)
  const searchInput = document.getElementById('searchInput');
  const filterYear = document.getElementById('filterYear');
  const filterCourse = document.getElementById('filterCourse');
  
  let delayTimer;
  const triggerSearch = () => {
    clearTimeout(delayTimer);
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-gray-500">กำลังประมวลผลข้อมูล...</td></tr>`;
    delayTimer = setTimeout(fetchData, 500);
  };

  searchInput.addEventListener('input', triggerSearch);
  filterYear.addEventListener('change', triggerSearch);
  filterCourse.addEventListener('change', triggerSearch);

  // 2. จัดการการอัปโหลดไฟล์ (SheetJS)
  document.getElementById('excelUpload').addEventListener('change', handleExcelUpload);
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
      // อัปเดต Dashboard
      document.getElementById('stat-total').textContent = result.data.stats.total;
      document.getElementById('stat-recent').textContent = result.data.stats.recent;
      document.getElementById('stat-top-course').textContent = result.data.stats.topCourse;
      
      // อัปเดต Table
      const tbody = document.getElementById('tableBody');
      if (result.data.list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-red-500">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</td></tr>`;
        return;
      }
      
      tbody.innerHTML = result.data.list.map(item => `
        <tr class="hover:bg-blue-50 border-b border-gray-100">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">${item.uid}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${item.fullName}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${item.agency}</td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
             <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">${item.status}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
             <button class="text-blue-600 bg-blue-50 px-3 py-1 rounded-md hover:bg-blue-100">ดูประวัติ</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error(error);
  }
}

// ฟังก์ชันนำเข้าไฟล์ Excel แบบ Zero-Error
function handleExcelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, {type: 'array'});
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // แปลงข้อมูลเป็น JSON
    const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    
    // ตรวจสอบหัวคอลัมน์ (Zero-Error Check)
    if (jsonRows.length > 0 && !('ชื่อ-นามสกุล' in jsonRows[0])) {
      alert("❌ โครงสร้างไฟล์ผิดพลาด กรุณาใช้ Template ที่กำหนด");
      return;
    }

    if(confirm(`ตรวจพบข้อมูล ${jsonRows.length} แถว ต้องการบันทึกเข้าสู่ระบบใช่หรือไม่?`)) {
       try {
         document.getElementById('tableBody').innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-blue-600 font-bold">กำลังอัปโหลดข้อมูลเข้าฐานข้อมูล...</td></tr>`;
         
         const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'bulkImport', rows: jsonRows }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } // หลบ CORS
         });
         
         const result = await response.json();
         if(result.status === 'success') {
            alert(`✅ ${result.message}`);
            fetchData(); // รีเฟรชข้อมูลหน้าจอ
         } else {
            alert(`❌ เกิดข้อผิดพลาด: ${result.message}`);
         }
       } catch (error) {
         alert("❌ การเชื่อมต่อล้มเหลว");
       }
    }
    e.target.value = ''; // เคลียร์ช่อง input
  };
  reader.readAsArrayBuffer(file);
}
