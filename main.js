// ประกาศ API URL ที่คุณเพิ่ง Deploy มา (ล็อกเป้าหมายฐานข้อมูล)
const API_URL = 'https://script.google.com/macros/s/AKfycbw--515Ocaod1h_wkMMc8dfiUumw4XD7anSkhWcM4coEXQJAVjGSKORwIMGLgq9t6Fi/exec';

// เมื่อหน้าเว็บโหลดโครงสร้างเสร็จ (DOM Content Loaded)
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 System Initialized. Zero-Error Standard Active.');
  
  // ผูกตัวแปรกับ Element ในหน้าเว็บ
  const searchInput = document.getElementById('searchInput');
  const addPersonBtn = document.getElementById('addPersonBtn');
  
  // ป้องกันการพิมพ์ค้นหารัวๆ (Debounce) ทำให้ไม่กินโควต้า API และลดอาการเว็บกระตุก
  let searchTimeout;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const keyword = e.target.value.trim();
    
    // ตั้งหน่วงเวลา 500ms ก่อนยิง API หากพิมพ์เสร็จ
    searchTimeout = setTimeout(() => {
      if(keyword.length > 0) {
        console.log('กำลังค้นหา:', keyword);
        // TODO: เรียกฟังก์ชันดึงข้อมูลค้นหาที่นี่
      }
    }, 500);
  });

  addPersonBtn.addEventListener('click', () => {
    console.log('เปิดหน้าต่างเพิ่มบุคลากร...');
    // TODO: เรียกฟังก์ชันเปิด Modal ที่นี่
  });

});