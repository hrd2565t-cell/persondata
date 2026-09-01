// ==========================================
// ⚙️ ตั้งค่าพื้นฐาน (Configuration)
// ==========================================
// นำ URL ของ Web App ที่คุณ Deploy จาก API.gs มาใส่ที่นี่
const API_URL = 'YOUR_WEB_APP_URL_HERE'; 

// ตัวแปรเก็บสถานะของระบบ
const AppState = {
  data: {},          // เก็บข้อมูลทั้งหมดที่ดึงมาจาก API
  currentUid: null,  // รหัสบุคลากรที่กำลังเลือกอยู่
  keptImages: [],    // เก็บ URL รูปภาพเดิมที่ผู้ใช้ไม่ได้กดลบ (สำหรับส่งกลับไปอัปเดต)
  isLoading: false   // สถานะการโหลด
};

// ==========================================
// 🚀 ฟังก์ชันเริ่มต้นระบบ (Initialization)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('Smart HR System: Frontend Initialized');
  // ดึงข้อมูลครั้งแรกเมื่อเปิดหน้าเว็บ
  fetchDashboardData();
  
  // ผูก Event Listener กับฟอร์มรายงานผล (Self-Report)
  const selfReportForm = document.getElementById('selfReportForm');
  if (selfReportForm) {
    selfReportForm.addEventListener('submit', handleSelfReportSubmit);
  }
});

// ==========================================
// 📡 ฟังก์ชันเรียก API (API Calls)
// ==========================================

// 1. ฟังก์ชันดึงข้อมูลหลัก (getData)
async function fetchDashboardData(keyword = '', year = '', course = '', group = '') {
  toggleLoading(true);
  try {
    const url = new URL(API_URL);
    url.searchParams.append('action', 'getData');
    if (keyword) url.searchParams.append('keyword', keyword);
    if (year) url.searchParams.append('year', year);
    if (course) url.searchParams.append('course', course);
    if (group) url.searchParams.append('group', group);

    const response = await fetch(url);
    const result = await response.json();

    if (result.status === 'success') {
      AppState.data = result.data;
      console.log('Data fetched successfully:', AppState.data);
      // เรียกฟังก์ชันอัปเดตหน้าจอ (สร้างตาราง, กราฟ ฯลฯ)
      renderPersonnelList(AppState.data.list);
    } else {
      showError('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + result.message);
    }
  } catch (error) {
    showError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ' + error.message);
  } finally {
    toggleLoading(false);
  }
}

// ==========================================
// 🖼️ ฟังก์ชันจัดการฟอร์มและรูปภาพ (Form & UI)
// ==========================================

// 2. ฟังก์ชันเปิดฟอร์มแก้ไข/เพิ่มข้อมูล (รองรับการเขียนทับแถวเดิม)
function openSelfReportModal(uid, existingData = null) {
  AppState.currentUid = uid;
  const form = document.getElementById('selfReportForm');
  form.reset();
  
  // เตรียม Container สำหรับโชว์รูปเก่า
  const previewContainer = document.getElementById('imagePreviewContainer');
  previewContainer.innerHTML = '';
  AppState.keptImages = [];

  if (existingData) {
    // โหมด "แก้ไข (Update)" ทับแถวเดิม
    // นำ recordId ที่ API.gs ส่งมา ใส่ไว้ใน input ซ่อน เพื่อให้หลังบ้านรู้ว่าต้องทับแถวไหน
    document.getElementById('recordId').value = existingData.recordId || ''; 
    document.getElementById('sport').value = existingData.sport || '';
    document.getElementById('role').value = existingData.role || '';
    document.getElementById('eventName').value = existingData.event || '';
    document.getElementById('year').value = existingData.year || '';
    
    // กฎพิเศษ: แปลงคำว่า "ทั่วไป" เป็น "ไม่ระบุ" อัตโนมัติ หากเจอข้อมูลเก่า
    let courseVal = existingData.course || '';
    if (courseVal === 'ทั่วไป') courseVal = 'ไม่ระบุ';
    document.getElementById('course').value = courseVal;
    
    // จัดการระบบโชว์รูปเก่าและปุ่มลบ (Feature 2)
    if (existingData.images) {
      const imageUrls = existingData.images.split(',').map(s => s.trim()).filter(s => s);
      AppState.keptImages = [...imageUrls]; // เก็บลง State
      
      imageUrls.forEach(url => {
        // สร้างกรอบรูปและปุ่มลบ
        const wrapper = document.createElement('div');
        wrapper.style = "position: relative; display: inline-block; margin-right: 10px; margin-bottom: 10px;";
        wrapper.innerHTML = `
          <img src="${url}" alt="หลักฐาน" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid #ccc;">
          <button type="button" 
                  style="position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 12px;"
                  onclick="removeKeptImage('${url}', this)">X</button>
        `;
        previewContainer.appendChild(wrapper);
      });
    }
  } else {
    // โหมด "เพิ่มใหม่"
    document.getElementById('recordId').value = ''; 
  }
  
  // แสดง Modal (ปรับใช้ตาม Framework ที่คุณมี เช่น Bootstrap หรือ Tailwind)
  document.getElementById('selfReportModal').style.display = 'block';
}

// 3. ฟังก์ชันเตะรูปเก่าออกจากระบบ (เมื่อผู้ใช้กดลบรูปเดิม)
window.removeKeptImage = function(url, btnElement) {
  // นำ URL ออกจาก Array
  AppState.keptImages = AppState.keptImages.filter(imgUrl => imgUrl !== url);
  // ลบรูปภาพออกจากหน้าจอ
  btnElement.parentElement.remove();
  console.log('รูปภาพที่เตรียมเก็บไว้:', AppState.keptImages);
  // หมายเหตุ: ไฟล์ใน Drive จะยังไม่ถูกลบจนกว่าผู้ใช้จะกด "บันทึก" ฟอร์ม
};

// ==========================================
// 📤 ฟังก์ชันบันทึกข้อมูล (Submit & Data Processing)
// ==========================================

// 4. ฟังก์ชันจัดการเมื่อกด Submit ฟอร์ม
async function handleSelfReportSubmit(event) {
  event.preventDefault();
  toggleLoading(true);

  const form = event.target;
  const file1Input = document.getElementById('file1');
  const file2Input = document.getElementById('file2');

  try {
    // แปลงไฟล์เป็น Base64
    let file1Data = null, file1Mime = null, file1Name = null;
    let file2Data = null, file2Mime = null, file2Name = null;

    if (file1Input.files.length > 0) {
      const file = file1Input.files[0];
      const base64 = await fileToBase64(file);
      file1Data = base64.split(',')[1];
      file1Mime = file.type;
      file1Name = file.name;
    }

    if (file2Input.files.length > 0) {
      const file = file2Input.files[0];
      const base64 = await fileToBase64(file);
      file2Data = base64.split(',')[1];
      file2Mime = file.type;
      file2Name = file.name;
    }

    // เตรียม Payload ส่งไปหลังบ้าน
    const payload = {
      action: 'saveSelfReport',
      uid: AppState.currentUid,
      recordId: document.getElementById('recordId').value, // รหัสแถวสำหรับเขียนทับ
      sport: document.getElementById('sport').value,
      role: document.getElementById('role').value,
      eventName: document.getElementById('eventName').value,
      year: document.getElementById('year').value,
      course: document.getElementById('course').value === 'ทั่วไป' ? 'ไม่ระบุ' : document.getElementById('course').value,
      eventType: document.getElementById('eventType')?.value || '',
      startDate: document.getElementById('startDate')?.value || '',
      endDate: document.getElementById('endDate')?.value || '',
      province: document.getElementById('province')?.value || '',
      location: document.getElementById('location')?.value || '',
      knowledge: document.getElementById('knowledge')?.value || '',
      keepImages: AppState.keptImages.join(','), // ส่ง URL ที่เหลือกลับไป
      
      // ข้อมูลไฟล์ใหม่
      file1Data: file1Data, file1Mime: file1Mime, file1Name: file1Name,
      file2Data: file2Data, file2Mime: file2Mime, file2Name: file2Name
    };

    // ส่งข้อมูลไป API.gs
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();

    if (result.status === 'success') {
      showSuccess('บันทึกข้อมูลเรียบร้อยแล้ว!');
      document.getElementById('selfReportModal').style.display = 'none';
      form.reset();
      // รีเฟรชข้อมูลหน้าแดชบอร์ดใหม่
      fetchDashboardData(); 
    } else {
      showError('บันทึกล้มเหลว: ' + result.message);
    }
  } catch (error) {
    showError('เกิดข้อผิดพลาดในการส่งข้อมูล: ' + error.message);
  } finally {
    toggleLoading(false);
  }
}

// 5. ฟังก์ชันส่งแบบประเมิน (Evaluation)
async function submitEvaluation(uid, feedbackText) {
  // กฎพิเศษ: คำถามแบบประเมินต้องอิงตามมาตรฐานที่ตั้งไว้
  const defaultQuestion = "ข้อคิดเห็นและข้อเสนอแนะอื่นๆ ที่เป็นประโยชน์ต่อการพัฒนาการบริหารงานตามหลักธรรมาภิบาลของสมาคมกีฬา";
  
  toggleLoading(true);
  try {
    const payload = {
      action: 'saveEval',
      uid: uid,
      feedback: feedbackText,
      questionContext: defaultQuestion 
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.status === 'success') {
      showSuccess('ขอบคุณสำหรับข้อเสนอแนะที่เป็นประโยชน์ต่อการพัฒนาการบริหารงานตามหลักธรรมาภิบาลของสมาคมกีฬาครับ');
    } else {
      showError('ไม่สามารถบันทึกแบบประเมินได้');
    }
  } catch (error) {
    showError('เกิดข้อผิดพลาด: ' + error.message);
  } finally {
    toggleLoading(false);
  }
}

// ==========================================
// 🛠️ ฟังก์ชันเครื่องมือเสริม (Utilities)
// ==========================================

// แปลงไฟล์เป็น Base64 String 
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// จัดการ UI Loading
function toggleLoading(show) {
  AppState.isLoading = show;
  const loader = document.getElementById('loadingOverlay');
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  } else {
    // Fallback หากไม่มี HTML Loading Overlay
    if(show) console.log('กำลังประมวลผล...');
  }
}

// แสดงแจ้งเตือนสำเร็จ (ปรับไปใช้ SweetAlert2 ได้ตามต้องการ)
function showSuccess(message) {
  alert('✅ สำเร็จ: ' + message);
}

// แสดงแจ้งเตือนข้อผิดพลาด (ปรับไปใช้ SweetAlert2 ได้ตามต้องการ)
function showError(message) {
  alert('❌ ข้อผิดพลาด: ' + message);
}

// ตัวอย่างฟังก์ชันอัปเดต UI ชั่วคราว
function renderPersonnelList(list) {
  console.log(`พบข้อมูลบุคลากรทั้งหมด ${list.length} รายการ`);
  // โค้ดสำหรับวนลูปสร้างแถวใน <table> ของคุณจะอยู่ที่นี่
}
