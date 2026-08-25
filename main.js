// URL API ของคุณ (ตรวจสอบให้ตรงกับเวอร์ชันล่าสุดหลังจาก Deploy ใหม่)
const API_URL = 'https://script.google.com/macros/s/AKfycbw--515Ocaod1h_wkMMc8dfiUumw4XD7anSkhWcM4coEXQJAVjGSKORwIMGLgq9t6Fi/exec';

document.addEventListener('DOMContentLoaded', () => {
  // สั่งให้โหลดข้อมูลทันทีที่เปิดเว็บ
  fetchDashboardStats();
  fetchPersonnel(''); 
  
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  
  // ระบบค้นหาแบบหน่วงเวลา (Debounce) ป้องกันการยิง API ถี่เกินไป
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const keyword = e.target.value.trim();
    
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-gray-500">กำลังประมวลผลข้อมูล...</td></tr>`;
    
    searchTimeout = setTimeout(() => {
      fetchPersonnel(keyword);
    }, 500);
  });
});

// ฟังก์ชันดึง KPI ผู้บริหาร
async function fetchDashboardStats() {
  try {
    const response = await fetch(`${API_URL}?action=getDashboardStats`);
    const result = await response.json();
    
    if (result.status === 'success') {
      document.getElementById('stat-total').textContent = result.data.total;
      document.getElementById('stat-recent').textContent = result.data.recent;
      document.getElementById('stat-top-course').textContent = result.data.topCourse;
    }
  } catch (error) {
    console.error('API Error:', error);
  }
}

// ฟังก์ชันดึงตารางรายชื่อ
async function fetchPersonnel(keyword) {
  try {
    const response = await fetch(`${API_URL}?action=searchPersonnel&keyword=${encodeURIComponent(keyword)}`);
    const result = await response.json();
    const tbody = document.getElementById('tableBody');
    
    if (result.status === 'success') {
      const data = result.data;
      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-red-500 font-bold">ไม่พบข้อมูลที่ค้นหา</td></tr>`;
        return;
      }
      
      // หยอดข้อมูลลงตาราง (Executive UI)
      tbody.innerHTML = data.map(item => `
        <tr class="hover:bg-blue-50 transition-colors">
          <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">${item.uid}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${item.fullName}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${item.agency}</td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'ปฏิบัติงาน' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${item.status}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onclick="viewProfile('${item.uid}')" class="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded-md">ดูประวัติ</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-red-500">การเชื่อมต่อขัดข้อง</td></tr>`;
  }
}

// ฟังก์ชันจำลองเปิดหน้าประวัติ
window.viewProfile = function(uid) {
  alert('กำลังเปิดหน้าประวัติและแก้ไขข้อมูลของ: ' + uid + '\n(สเต็ปต่อไปเราจะทำเป็น Modal สวยๆ กันครับ!)');
}
