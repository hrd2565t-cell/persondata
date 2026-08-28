const API_URL = 'https://script.google.com/macros/s/AKfycbw--515Ocaod1h_wkMMc8dfiUumw4XD7anSkhWcM4coEXQJAVjGSKORwIMGLgq9t6Fi/exec';

let cachedPersonnelData = [];
let cachedProjectDetails = {}; 
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
let barChartObj = null;
let donutChartObj = null;

let srSelectedUser = null; 
let globalSettings = { activeReportYear: '2569' }; 
const provinces = ["กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม","นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี"];

let currentReportCourseBase64 = null; 

function utf8ToBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
function base64ToUtf8(str) { return decodeURIComponent(escape(atob(str))); }

document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  setupDragAndDrop();
  setupOTPInputs();
  populateProvinces();
  switchPage('report');
  
  let delayTimer;
  const triggerSearch = () => { clearTimeout(delayTimer); showLoadingState(); delayTimer = setTimeout(fetchData, 500); };

  document.getElementById('searchInput').addEventListener('input', triggerSearch);
  document.getElementById('filterCourse').addEventListener('change', () => { handleCascadingFilter('course'); triggerSearch(); });
  document.getElementById('filterYear').addEventListener('change', () => { handleCascadingFilter('year'); triggerSearch(); });
  document.getElementById('filterGroup').addEventListener('change', () => { triggerSearch(); });
  document.getElementById('excelUpload').addEventListener('change', (e) => processExcelFile(e.target.files[0], e.target));
  document.getElementById('singleFullName').addEventListener('blur', function() { if(this.value) this.value = this.value.trim().replace(/\s+/g, ' '); });
});

window.showToast = function(message) {
   const toast = document.getElementById('toastNotification');
   document.getElementById('toastMessage').textContent = message;
   toast.classList.remove('translate-y-20', 'opacity-0');
   setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
}

window.updatePersonnelStatus = async function(uid, newStatus, selectElement) {
  selectElement.disabled = true;
  selectElement.classList.add('opacity-50', 'animate-pulse');
  
  try {
    const payload = { action: 'updateStatus', uid: uid, status: newStatus };
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    const result = await response.json();
    
    if (result.status === 'success') {
      const userIndex = cachedPersonnelData.findIndex(u => u.uid === uid);
      if(userIndex > -1) cachedPersonnelData[userIndex].status = newStatus;
      
      if(newStatus === 'พ้นสภาพ') {
         selectElement.className = "text-xs font-bold bg-white border border-slate-300 text-slate-500 rounded-full px-2 py-1 outline-none cursor-pointer shadow-sm text-center w-[110px] mx-auto block transition-colors";
      } else {
         selectElement.className = "text-xs font-bold bg-white border border-amber-300 text-amber-600 rounded-full px-2 py-1 outline-none cursor-pointer shadow-sm text-center w-[110px] mx-auto block transition-colors";
      }
      showToast('บันทึกสถานะเรียบร้อยแล้ว');
      fetch(API_URL + '?action=getData').then(res => res.json()).then(json => {
          if (json.status === 'success') { globalFiltersMaster = json.data.filters; renderDashboard(json.data.stats); drawCharts(json.data.filters.years, json.data.filters.groups); }
      });
    } else { alert('❌ ' + result.message); }
  } catch(err) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  selectElement.disabled = false; selectElement.classList.remove('opacity-50', 'animate-pulse');
}

function populateProvinces() {
  const select = document.getElementById('srProvince');
  if(!select) return;
  select.innerHTML = '<option value="">-- เลือกจังหวัด --</option>' + provinces.map(p => `<option value="${p}">${p}</option>`).join('');
}

window.loadProjectData = function(course) {
  const form = document.getElementById('pdFormContainer');
  if(!course) { form.classList.add('hidden'); return; }
  
  form.classList.remove('hidden');
  document.getElementById('pdRationale').value = ''; document.getElementById('pdObjectives').value = ''; document.getElementById('pdExpected').value = '';
  document.querySelectorAll('.pd-target-cb').forEach(cb => {
      cb.checked = false;
      let numInput = cb.parentElement.nextElementSibling;
      if(numInput) { numInput.value = ''; numInput.classList.add('hidden'); }
  });

  if(cachedProjectDetails && cachedProjectDetails[course]) {
    const d = cachedProjectDetails[course];
    document.getElementById('pdRationale').value = d.rationale || ''; document.getElementById('pdObjectives').value = d.objectives || ''; document.getElementById('pdExpected').value = d.expected || '';
    if(d.targets) {
      const targets = d.targets.includes('||') ? d.targets.split('||') : d.targets.split(',').map(t=>t.trim()+'|0');
      targets.forEach(t => {
        let [tName, tCount] = t.split('|');
        document.querySelectorAll('.pd-target-cb').forEach(cb => {
          if(cb.value === tName) {
            cb.checked = true;
            let numInput = cb.parentElement.nextElementSibling;
            if(numInput) { numInput.value = parseInt(tCount) > 0 ? tCount : ''; numInput.classList.remove('hidden'); }
          }
        });
      });
    }
  }
}

window.submitProjectDetails = async function() {
  const course = document.getElementById('pdCourse').value;
  const rationale = document.getElementById('pdRationale').value.trim();
  const objectives = document.getElementById('pdObjectives').value.trim();
  const expected = document.getElementById('pdExpected').value.trim();
  
  if(!course || !expected) return alert('⚠️ กรุณาเลือกหลักสูตรและระบุผลที่คาดว่าจะได้รับ');
  
  let targets = [];
  document.querySelectorAll('.pd-target-cb:checked').forEach(cb => {
    let numInput = cb.parentElement.nextElementSibling;
    let count = numInput && numInput.value ? parseInt(numInput.value) : 0;
    targets.push(`${cb.value}\vert{}${count}`);
  });
  const targetString = targets.join('||');
  
  const btn = document.getElementById('btnSaveProjectDetails');
  btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;

  try {
    const payload = { action: 'saveProjectDetails', course: course, rationale: rationale, objectives: objectives, expected: expected, targets: targetString };
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    const result = await response.json();
    if(result.status === 'success') { alert('✅ ' + result.message); fetchData(); } else { alert('❌ ' + result.message); }
  } catch(e) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  
  btn.textContent = 'บันทึกข้อมูลโครงการ'; btn.disabled = false;
}

window.saveAdminSettings = async function() {
  const yearInput = document.getElementById('adminActiveYear').value.trim();
  if(!yearInput) return alert('⚠️ กรุณาระบุปี');
  const btn = document.getElementById('btnSaveSetting');
  btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;
  try {
    const payload = { action: 'saveSetting', key: 'ACTIVE_REPORT_YEAR', value: yearInput };
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    const result = await response.json();
    if(result.status === 'success') {
      alert('✅ ' + result.message);
      globalSettings.activeReportYear = yearInput; document.getElementById('srActiveYear').value = yearInput; 
    } else { alert('❌ ข้อผิดพลาด: ' + result.message); }
  } catch(e) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  btn.textContent = 'บันทึก'; btn.disabled = false;
}

function updateSelfReportDatalist() {
  const dl = document.getElementById('dl-all-users');
  if(dl) { dl.innerHTML = cachedPersonnelData.map(p => `<option value="${p.fullName} (${p.uid})">`).join(''); }
}

window.toggleOtherInput = function(selectEl, otherId) {
  const otherInput = document.getElementById(otherId);
  if(selectEl.value === 'อื่นๆ') {
    otherInput.classList.remove('hidden');
    otherInput.focus();
  } else {
    otherInput.classList.add('hidden');
    otherInput.value = '';
  }
}

window.clearSelfReportSearch = function() {
  document.getElementById('srSearchName').value = '';
  document.getElementById('srFormContainer').classList.add('hidden');
  document.getElementById('srUserWarn').classList.add('hidden');
  document.getElementById('srDynamicForms').innerHTML = '';
  srSelectedUser = null;
  document.getElementById('srSearchName').focus(); 
}

window.handleSelfReportUserSelect = function() {
  const inputVal = document.getElementById('srSearchName').value; const warnText = document.getElementById('srUserWarn'); const formContainer = document.getElementById('srFormContainer'); const dynamicForms = document.getElementById('srDynamicForms'); const activeYear = globalSettings.activeReportYear;
  const match = inputVal.match(/\((USR-\d{4}-\d{4})\)/);
  if(match) {
    const uid = match[1]; srSelectedUser = cachedPersonnelData.find(p => p.uid === uid);
    if(srSelectedUser) {
      const filteredCourses = (srSelectedUser.trainings || []).filter(t => String(t.year) === String(activeYear));
      if(filteredCourses.length === 0) { warnText.textContent = `⚠️ ท่านไม่มีประวัติการอบรมในปีงบประมาณ ${activeYear} จึงไม่ต้องรายงานผลในรอบนี้`; warnText.classList.remove('hidden'); formContainer.classList.add('hidden'); return; }
      warnText.classList.add('hidden'); formContainer.classList.remove('hidden');
      const provOptions = '<option value="">-- เลือกจังหวัด --</option>' + provinces.map(p => `<option value="${p}">${p}</option>`).join('');
      let html = '';
      filteredCourses.forEach((c, i) => {
        let copyBtn = i > 0 ? `<div class="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl"><input type="checkbox" id="copyCheck_${i}" onchange="copyFormData(${i})" class="w-4 h-4 text-blue-600 rounded cursor-pointer"><label for="copyCheck_${i}" class="text-sm font-bold text-blue-800 cursor-pointer">📋 คัดลอกข้อมูลสถานที่และเวลาจากหลักสูตรด้านบน</label></div>` : '';
        html += `
        <div class="sr-card-item bg-white border-2 border-slate-100 rounded-2xl p-6 md:p-8 relative shadow-sm"><input type="hidden" id="srCourse_${i}" value="${c.course}">
          <div class="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-blue-800 text-white px-4 py-1.5 rounded-bl-2xl rounded-tr-2xl text-xs font-bold shadow-md">หลักสูตรที่ ${i + 1} /${filteredCourses.length}</div>
          <h3 class="text-lg font-extrabold text-slate-800 mb-2 border-l-4 border-blue-500 pl-3">หลักสูตร: <span class="text-blue-600">${c.course}</span></h3>
          <p class="text-xs text-slate-500 mb-6 pl-4">กรุณากรอกรายละเอียดการนำความรู้ไปใช้ประโยชน์</p>${copyBtn}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div><label class="block text-xs font-bold text-slate-500 mb-1.5">รูปแบบงาน / ระดับการแข่งขัน <span class="text-red-500">*</span></label>
              <select id="srEventType_${i}" onchange="toggleOtherInput(this, 'srEventTypeOther_${i}')" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"><option value="">-- เลือกรูปแบบงาน --</option><option value="รายการแข่งขันระดับจังหวัด">รายการแข่งขันระดับจังหวัด</option><option value="รายการแข่งขันระดับชาติ">รายการแข่งขันระดับชาติ</option><option value="รายการแข่งขันระดับนานาชาติ">รายการแข่งขันระดับนานาชาติ</option><option value="รายการอบรมสัมมนา">รายการอบรมสัมมนา</option><option value="ปฏิบัติงานบริหารจัดการทั่วไป">ปฏิบัติงานบริหารจัดการทั่วไป</option><option value="อื่นๆ">อื่นๆ</option></select>
              <input type="text" id="srEventTypeOther_${i}" placeholder="โปรดระบุรูปแบบงาน..." class="hidden w-full mt-2 text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
            </div>
            <div><label class="block text-xs font-bold text-slate-500 mb-1.5">ชื่องาน / รายการที่ไปปฏิบัติหน้าที่ <span class="text-red-500">*</span></label><input type="text" id="srEventName_${i}" placeholder="เช่น กีฬาแห่งชาติ ครั้งที่ 49" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block text-xs font-bold text-slate-500 mb-1.5">ตำแหน่งที่ท่านปฏิบัติหน้าที่ <span class="text-red-500">*</span></label>
              <select id="srRole_${i}" onchange="toggleOtherInput(this, 'srRoleOther_${i}')" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"><option value="">-- เลือกตำแหน่ง --</option><option value="ผู้ตัดสิน">ผู้ตัดสิน</option><option value="ผู้ฝึกสอน">ผู้ฝึกสอน</option><option value="วิทยากร">วิทยากร</option><option value="ประธานจัดการแข่งขัน">ประธานจัดการแข่งขัน</option><option value="ผู้จัดการทีม">ผู้จัดการทีม</option><option value="เจ้าหน้าที่เทคนิค">เจ้าหน้าที่เทคนิค</option><option value="ผู้ดูแลระบบ/ประสานงาน">ผู้ดูแลระบบ/ประสานงาน</option><option value="อื่นๆ">อื่นๆ</option></select>
              <input type="text" id="srRoleOther_${i}" placeholder="โปรดระบุตำแหน่ง..." class="hidden w-full mt-2 text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
            </div>
            <div><label class="block text-xs font-bold text-slate-500 mb-1.5">ชนิดกีฬา <span class="text-red-500">*</span></label><input type="text" id="srSport_${i}" placeholder="เช่น ฟุตบอล, มวยไทย (หากไม่มีให้ใส่ -)" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block text-xs font-bold text-slate-500 mb-1.5">วันที่เริ่มต้นปฏิบัติงาน <span class="text-red-500">*</span></label><input type="date" id="srStartDate_${i}" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"></div>
            <div><label class="block text-xs font-bold text-slate-500 mb-1.5">วันที่สิ้นสุดการปฏิบัติงาน <span class="text-red-500">*</span></label><input type="date" id="srEndDate_${i}" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"></div>
            <div><label class="block text-xs font-bold text-slate-500 mb-1.5">สถานที่ (จังหวัด) <span class="text-red-500">*</span></label><select id="srProvince_${i}" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500">${provOptions}</select></div>
            <div><label class="block text-xs font-bold text-slate-500 mb-1.5">สถานที่จัดงาน (รายละเอียด) <span class="text-red-500">*</span></label><input type="text" id="srLocation_${i}" placeholder="เช่น สนามกีฬาจังหวัด..." class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"></div>
          </div>
          <div class="space-y-4">
            <div><label class="block text-xs font-bold text-slate-500 mb-2">อธิบายความรู้ที่ท่านได้นำไปประยุกต์ใช้ <span class="text-red-500">*</span></label><textarea id="srKnowledge_${i}" rows="3" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="อธิบายสั้นๆ..."></textarea></div>
            <div class="bg-blue-50/50 border border-blue-100 p-4 rounded-xl"><label class="block text-xs font-bold text-slate-700 mb-2">แนบรูปภาพหลักฐานประกอบ (ถ้ามี / ไม่เกิน 5MB ต่อภาพ)</label><div class="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><input type="file" id="srFile1_${i}" accept="image/jpeg, image/png, image/jpg" class="w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 bg-white border border-slate-200 rounded p-1 cursor-pointer"></div><div><input type="file" id="srFile2_${i}" accept="image/jpeg, image/png, image/jpg" class="w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 bg-white border border-slate-200 rounded p-1 cursor-pointer"></div></div></div>
          </div>
        </div>`;
      });
      dynamicForms.innerHTML = html; return;
    }
  }
  srSelectedUser = null; warnText.textContent = '⚠️ ไม่พบประวัติการอบรมของชื่อนี้ กรุณาตรวจสอบการสะกดคำ'; warnText.classList.remove('hidden'); formContainer.classList.add('hidden');
}

window.copyFormData = function(idx) {
  const isChecked = document.getElementById(`copyCheck_${idx}`).checked;
  if (isChecked) {
    const prev = idx - 1;
    
    const copyOtherEvent = document.getElementById(`srEventTypeOther_${prev}`).value;
    const copyOtherRole = document.getElementById(`srRoleOther_${prev}`).value;

    const currEventType = document.getElementById(`srEventType_${idx}`);
    currEventType.value = document.getElementById(`srEventType_${prev}`).value;
    toggleOtherInput(currEventType, `srEventTypeOther_${idx}`);
    document.getElementById(`srEventTypeOther_${idx}`).value = copyOtherEvent;

    const currRole = document.getElementById(`srRole_${idx}`);
    currRole.value = document.getElementById(`srRole_${prev}`).value;
    toggleOtherInput(currRole, `srRoleOther_${idx}`);
    document.getElementById(`srRoleOther_${idx}`).value = copyOtherRole;

    document.getElementById(`srEventName_${idx}`).value = document.getElementById(`srEventName_${prev}`).value;
    document.getElementById(`srSport_${idx}`).value = document.getElementById(`srSport_${prev}`).value;
    document.getElementById(`srStartDate_${idx}`).value = document.getElementById(`srStartDate_${prev}`).value;
    document.getElementById(`srEndDate_${idx}`).value = document.getElementById(`srEndDate_${prev}`).value;
    document.getElementById(`srProvince_${idx}`).value = document.getElementById(`srProvince_${prev}`).value;
    document.getElementById(`srLocation_${idx}`).value = document.getElementById(`srLocation_${prev}`).value;
  }
}

function getBase64(file) { return new Promise((resolve, reject) => { if(file.size > 5 * 1024 * 1024) { reject(new Error('ขนาดไฟล์เกิน 5MB')); return; } const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = error => reject(error); }); }

window.submitSelfReport = async function() {
  const activeYear = document.getElementById('srActiveYear').value; const cards = document.querySelectorAll('.sr-card-item'); let allReports = [];
  for (let i = 0; i < cards.length; i++) {
    const course = document.getElementById(`srCourse_${i}`).value; 
    let eventType = document.getElementById(`srEventType_${i}`).value; 
    const eventName = document.getElementById(`srEventName_${i}`).value.trim(); 
    let role = document.getElementById(`srRole_${i}`).value; 
    const sport = document.getElementById(`srSport_${i}`).value.trim(); 
    const startDate = document.getElementById(`srStartDate_${i}`).value; 
    const endDate = document.getElementById(`srEndDate_${i}`).value; 
    const province = document.getElementById(`srProvince_${i}`).value; 
    const location = document.getElementById(`srLocation_${i}`).value.trim(); 
    const knowledge = document.getElementById(`srKnowledge_${i}`).value.trim();
    
    if (eventType === 'อื่นๆ') {
      const otherVal = document.getElementById(`srEventTypeOther_${i}`).value.trim();
      if(!otherVal) return alert(`⚠️ กรุณาระบุรูปแบบงาน/ระดับการแข่งขัน (ช่องอื่นๆ) ในหลักสูตรที่ ${i+1} ให้ครบถ้วน`);
      eventType = 'อื่นๆ: ' + otherVal;
    }
    if (role === 'อื่นๆ') {
      const otherVal = document.getElementById(`srRoleOther_${i}`).value.trim();
      if(!otherVal) return alert(`⚠️ กรุณาระบุตำแหน่งที่ปฏิบัติหน้าที่ (ช่องอื่นๆ) ในหลักสูตรที่ ${i+1} ให้ครบถ้วน`);
      role = 'อื่นๆ: ' + otherVal;
    }

    if(!eventType || !eventName || !role || !sport || !startDate || !endDate || !province || !location || !knowledge) { return alert(`⚠️ กรุณากรอกข้อมูลในหลักสูตรที่ ${i+1} ให้ครบถ้วน`); }
    const file1 = document.getElementById(`srFile1_${i}`).files[0]; const file2 = document.getElementById(`srFile2_${i}`).files[0];
    allReports.push({ course, eventType, eventName, role, sport, startDate, endDate, province, location, knowledge, file1, file2 });
  }

  document.getElementById('srLoadingOverlay').classList.remove('hidden');

  try {
    for (let i = 0; i < allReports.length; i++) {
      document.getElementById('srLoadingTitle').textContent = `กำลังอัปโหลดข้อมูลหลักสูตรที่ ${i+1} /${allReports.length}`;
      let r = allReports[i]; let file1Data = null, file1Name = '', file1Mime = ''; let file2Data = null, file2Name = '', file2Mime = '';
      if(r.file1) { file1Data = await getBase64(r.file1); file1Name = r.file1.name; file1Mime = r.file1.type; }
      if(r.file2) { file2Data = await getBase64(r.file2); file2Name = r.file2.name; file2Mime = r.file2.type; }
      const payload = { action: 'saveSelfReport', uid: srSelectedUser.uid, fullName: srSelectedUser.fullName, course: r.course, eventType: r.eventType, eventName: r.eventName, role: r.role, sport: r.sport, startDate: r.startDate, endDate: r.endDate, year: activeYear, province: r.province, location: r.location, knowledge: r.knowledge, file1Data: file1Data, file1Name: file1Name, file1Mime: file1Mime, file2Data: file2Data, file2Name: file2Name, file2Mime: file2Mime };
      const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) }); const json = await res.json();
      if(json.status !== 'success') throw new Error(json.message);
    }
    alert('✅ บันทึกรายงานสำเร็จทั้งหมด'); document.getElementById('srSearchName').value = ''; document.getElementById('srFormContainer').classList.add('hidden'); srSelectedUser = null; fetchData(); 
  } catch(err) {
    if(err.message === 'ขนาดไฟล์เกิน 5MB') alert('❌ ' + err.message); else alert('❌ เกิดข้อผิดพลาด: ' + err.message);
  }
  document.getElementById('srLoadingOverlay').classList.add('hidden');
}

// 📌 ฟังก์ชันจัดการเปิดปิด Modal Login ที่รับประกันว่าคลาส CSS จะไม่ตีกัน
window.openLoginModal = function() { 
  const modal = document.getElementById('loginModal'); 
  modal.classList.remove('hidden'); 
  document.getElementById('loginErrorMsg').classList.add('hidden'); 
  const inputs = document.querySelectorAll('.otp-input'); 
  inputs.forEach(input => input.value = ''); 
  setTimeout(() => { if (inputs.length > 0) inputs[0].focus(); }, 100); 
}
window.closeLoginModal = function() { document.getElementById('loginModal').classList.add('hidden'); }

function setupOTPInputs() { 
    const inputs = document.querySelectorAll('.otp-input'); 
    inputs.forEach((input, index) => { 
        input.addEventListener('input', (e) => { if(e.target.value.length === 1 && index < inputs.length - 1) inputs[index + 1].focus(); checkOTP(); }); 
        input.addEventListener('keydown', (e) => { if(e.key === 'Backspace' && e.target.value === '' && index > 0) inputs[index - 1].focus(); }); 
        input.addEventListener('paste', (e) => { e.preventDefault(); const pastedData = e.clipboardData.getData('text').slice(0, 6).split(''); inputs.forEach((inp, i) => { if(pastedData[i]) inp.value = pastedData[i]; }); if(pastedData.length > 0) inputs[Math.min(pastedData.length, 5)].focus(); checkOTP(); }); 
    }); 
}

// 📌 ฟังก์ชันจัดการ Login ที่รับประกันการลบคลาส flex และ hidden อย่างหมดจด
window.checkOTP = function() { 
    const inputs = document.querySelectorAll('.otp-input'); let pin = ''; inputs.forEach(input => pin += input.value); 
    if(pin.length === 6) { 
        if(pin === "336699") { 
            isAdmin = true; 
            document.body.classList.add('is-admin'); 
            
            const btnLogin = document.getElementById('btnLogin');
            btnLogin.classList.remove('flex'); // ลบ Flex ก่อนเพื่อไม่ให้ปุ่มค้าง
            btnLogin.classList.add('hidden'); 
            
            const btnLogout = document.getElementById('btnLogout'); 
            btnLogout.classList.remove('hidden'); 
            btnLogout.classList.add('flex'); 
            
            closeLoginModal(); 
            switchPage('dashboard'); 
            renderTablePage(); 
        } else { 
            document.getElementById('loginErrorMsg').classList.remove('hidden'); inputs.forEach(input => input.value = ''); inputs[0].focus(); 
        } 
    } 
}

window.logoutAdmin = function() { 
    isAdmin = false; 
    document.body.classList.remove('is-admin'); 
    
    const btnLogin = document.getElementById('btnLogin');
    btnLogin.classList.remove('hidden'); 
    btnLogin.classList.add('flex'); 
    
    const btnLogout = document.getElementById('btnLogout'); 
    btnLogout.classList.remove('flex'); // ลบ Flex ก่อนเพื่อไม่ให้ปุ่มค้าง
    btnLogout.classList.add('hidden'); 
    
    switchPage('report'); 
    renderTablePage(); 
}

window.switchPage = function(pageId) {
  const pages = ['dashboard', 'search', 'timeline', 'import', 'report', 'project'];
  pages.forEach(p => {
    const section = document.getElementById(`page-${p}`);
    if (section) { section.classList.toggle('hidden', p !== pageId); section.classList.toggle('block', p === pageId); }
    const btn = document.getElementById(`nav-btn-${p}`);
    if (btn) {
      if(p === 'report') {
        btn.classList.toggle('bg-blue-50/50', p === pageId); btn.classList.toggle('text-blue-600', p === pageId); btn.classList.toggle('font-bold', p === pageId); btn.classList.toggle('text-slate-500', p !== pageId); btn.classList.toggle('font-medium', p !== pageId);
      } else {
        btn.classList.toggle('border-blue-600', p === pageId); btn.classList.toggle('text-blue-600', p === pageId); btn.classList.toggle('font-bold', p === pageId); btn.classList.toggle('border-transparent', p !== pageId); btn.classList.toggle('text-slate-500', p !== pageId); btn.classList.toggle('font-medium', p !== pageId);
      }
    }
  });
  if (pageId === 'timeline' && globalFiltersMaster) renderTimeline(globalFiltersMaster.relations, globalFiltersMaster.years, globalFiltersMaster.courses);
}

window.switchImportMode = function(mode) {
  const btnBulk = document.getElementById('tab-import-bulk'); const btnSingle = document.getElementById('tab-import-single'); const btnSettings = document.getElementById('tab-import-settings');
  const secBulk = document.getElementById('importModeBulk'); const secSingle = document.getElementById('importModeSingle'); const secSettings = document.getElementById('importModeSettings');
  [btnBulk, btnSingle, btnSettings].forEach(b => { if(b) b.className = "pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700 font-medium text-sm transition px-4 flex items-center gap-2" + (b.id === 'tab-import-settings' ? ' ml-auto' : ''); });
  [secBulk, secSingle, secSettings].forEach(s => { if(s) { s.classList.remove('block'); s.classList.add('hidden'); } });
  if(mode === 'bulk') { btnBulk.classList.add('border-blue-600', 'text-blue-600', 'font-bold'); btnBulk.classList.remove('border-transparent', 'text-slate-500', 'font-medium'); secBulk.classList.remove('hidden'); secBulk.classList.add('block'); } 
  else if (mode === 'single') { btnSingle.classList.add('border-blue-600', 'text-blue-600', 'font-bold'); btnSingle.classList.remove('border-transparent', 'text-slate-500', 'font-medium'); secSingle.classList.remove('hidden'); secSingle.classList.add('block'); }
  else if (mode === 'settings') { btnSettings.classList.add('border-blue-600', 'text-blue-600', 'font-bold'); btnSettings.classList.remove('border-transparent', 'text-slate-500', 'font-medium'); secSettings.classList.remove('hidden'); secSettings.classList.add('block'); }
}

async function fetchData() {
  const keyword = document.getElementById('searchInput').value.trim(); const year = document.getElementById('filterYear').value; const course = document.getElementById('filterCourse').value; const group = document.getElementById('filterGroup').value;
  try {
    const res = await fetch(`${API_URL}?action=getData&keyword=${encodeURIComponent(keyword)}&year=${year}&course=${encodeURIComponent(course)}&group=${encodeURIComponent(group)}`);
    const result = await res.json();
    if (result.status === 'success') {
      cachedPersonnelData = result.data.list;
      if (!globalFiltersMaster) { globalFiltersMaster = result.data.filters; updateDropdownUI(); }
      if(result.data.settings) { globalSettings = result.data.settings; document.getElementById('adminActiveYear').value = globalSettings.activeReportYear; document.getElementById('srActiveYear').value = globalSettings.activeReportYear; }
      if(result.data.projectDetails) { cachedProjectDetails = result.data.projectDetails; } 
      updateDatalists(); updateSelfReportDatalist(); renderDashboard(result.data.stats); drawCharts(result.data.filters.years, result.data.filters.groups); currentFilteredData = result.data.list; currentPage = 1; updateSmartSummary(course, year, currentFilteredData.length); renderTablePage();
    } else { showErrorState(result.message); }
  } catch (error) { showErrorState('การเชื่อมต่อกับฐานข้อมูลขัดข้อง'); }
}

function updateDatalists() {
  if (!globalFiltersMaster) return; let agencies = new Set(); let groups = new Set(); cachedPersonnelData.forEach(p => { if(p.agency) agencies.add(p.agency); if(p.group) groups.add(p.group); });
  const agencyList = document.getElementById('dl-agencies'); if(agencyList) agencyList.innerHTML = Array.from(agencies).sort().map(a => `<option value="${a}">`).join('');
  const groupList = document.getElementById('dl-groups'); if(groupList) groupList.innerHTML = Array.from(groups).sort().map(g => `<option value="${g}">`).join('');
  const courseList = document.getElementById('dl-courses'); if(courseList) courseList.innerHTML = globalFiltersMaster.courses.map(c => `<option value="${c}">`).join('');
  const pdCourse = document.getElementById('pdCourse'); if(pdCourse) pdCourse.innerHTML = '<option value="">-- กรุณาเลือกหลักสูตรเพื่อจัดการข้อมูล --</option>' + globalFiltersMaster.courses.map(c => `<option value="${c}">${c}</option>`).join('');
  const yearList = document.getElementById('dl-years'); if(yearList) yearList.innerHTML = globalFiltersMaster.years.map(y => `<option value="${y}">`).join('');
}

function drawCharts(allYears, allGroups) {
  Chart.register(ChartDataLabels);
  const sortedYears = [...allYears].sort((a,b)=>a-b); const last5Years = sortedYears.slice(-5);
  const yearData = last5Years.map(y => { let count = 0; cachedPersonnelData.forEach(p => { if(p.trainings && p.trainings.some(t => String(t.year) === String(y))) count++; }); return count; });
  const ctxBar = document.getElementById('barChart').getContext('2d'); if(barChartObj) barChartObj.destroy();
  barChartObj = new Chart(ctxBar, { type: 'bar', data: { labels: last5Years.map(y => 'ปี '+y), datasets: [{ label: 'ผู้ผ่านการอบรม', data: yearData, backgroundColor: '#3b82f6', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { color: '#334155', anchor: 'end', align: 'top', font: { weight: 'bold' } } }, scales: { y: { beginAtZero: true, suggestedMax: Math.max(...yearData) * 1.2, grid: { display: false } }, x: { grid: { display: false } } } } });

  let groupCounts = {}; cachedPersonnelData.forEach(p => { let g = p.group || 'ไม่ระบุ'; groupCounts[g] = (groupCounts[g] || 0) + 1; });
  let topGroups = Object.entries(groupCounts).sort((a,b)=>b[1]-a[1]).slice(0, 4); let otherCount = Object.entries(groupCounts).sort((a,b)=>b[1]-a[1]).slice(4).reduce((sum, val) => sum + val[1], 0); if(otherCount > 0) topGroups.push(['อื่นๆ', otherCount]);
  const ctxDonut = document.getElementById('donutChart').getContext('2d'); if(donutChartObj) donutChartObj.destroy();
  donutChartObj = new Chart(ctxDonut, { type: 'doughnut', data: { labels: topGroups.map(g => g[0]), datasets: [{ data: topGroups.map(g => g[1]), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#94a3b8'], hoverOffset: 4, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" } } }, datalabels: { color: '#ffffff', font: { weight: 'bold', size: 10 }, formatter: (value, ctx) => { let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0); let percentage = (value * 100 / sum).toFixed(1) + "%"; return percentage; } } } } });
}

function renderDashboard(stats) {
  document.getElementById('stat-total').textContent = stats.totalPersonnel; document.getElementById('stat-top-year').textContent = stats.topYear; document.getElementById('stat-top-course').textContent = stats.topCourse;
  const tbody = document.getElementById('courseSummaryBody'); if (!tbody) return;
  if (!stats.courseSummary || stats.courseSummary.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 font-medium">ไม่มีข้อมูลหลักสูตรในระบบ</td></tr>`; return; }

  tbody.innerHTML = stats.courseSummary.map((item, index) => {
    const retentionPercent = item.totalPeople > 0 ? Math.round((item.activePeople / item.totalPeople) * 100) : 0;
    const safeEncodedCourseName = utf8ToBase64(item.courseName);
    return `<tr class="hover:bg-slate-50 border-b border-slate-100"><td class="px-6 py-4 text-center font-mono text-xs text-slate-400">${index + 1}</td><td class="px-6 py-4 font-bold text-slate-800">${item.courseName}</td><td class="px-6 py-4 text-center"><span class="bg-slate-100 px-3 py-1 rounded-lg text-slate-600 text-xs">${item.yearsHeld}</span></td><td class="px-6 py-4"><div class="flex justify-between text-xs mb-1.5"><span class="text-slate-500 font-medium">ยังทำงาน ${item.activePeople}/${item.totalPeople} คน</span><span class="font-bold text-emerald-600">${retentionPercent}%</span></div><div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-emerald-500 h-2 rounded-full" style="width: ${retentionPercent}\%"></div></div></td><td class="px-6 py-4 text-center"><button id="btn_report_${index}" onclick="openProposalReport('${safeEncodedCourseName}', 'btn_report_${index}')" class="bg-blue-600 text-white hover:bg-blue-700 px-3
