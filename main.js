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

// 📌 ฟังก์ชัน Admin Panel โหลดข้อมูลโครงการ 11 หัวข้อ
window.loadProjectData = function(course) {
  const form = document.getElementById('pdFormContainer');
  if(!course) { form.classList.add('hidden'); return; }
  
  form.classList.remove('hidden');
  
  document.getElementById('pdRationale').value = '';
  document.getElementById('pdObjectives').value = '';
  document.getElementById('pdGoalsText').value = '';
  document.getElementById('pdSection42').value = '';
  document.getElementById('pdGovPolicy').value = '';
  document.getElementById('pdShortTerm').value = '';
  document.getElementById('pdExpected').value = '';
  document.getElementById('pdSocialImpact').value = '';
  document.getElementById('pdEnvImpact').value = '';
  document.getElementById('pdHealthImpact').value = '';
  document.getElementById('pdAthleteImpact').value = '';

  document.querySelectorAll('.pd-target-cb').forEach(cb => {
      cb.checked = false;
      let numInput = cb.parentElement.nextElementSibling;
      if(numInput) { numInput.value = ''; numInput.classList.add('hidden'); }
  });

  if(cachedProjectDetails && cachedProjectDetails[course]) {
    const d = cachedProjectDetails[course];
    document.getElementById('pdRationale').value = d.rationale || '';
    document.getElementById('pdObjectives').value = d.objectives || '';
    document.getElementById('pdGoalsText').value = d.goalsText || '';
    document.getElementById('pdSection42').value = d.section42 || '';
    document.getElementById('pdGovPolicy').value = d.govPolicy || '';
    document.getElementById('pdShortTerm').value = d.shortTerm || '';
    document.getElementById('pdExpected').value = d.expected || '';
    document.getElementById('pdSocialImpact').value = d.socialImpact || '';
    document.getElementById('pdEnvImpact').value = d.envImpact || '';
    document.getElementById('pdHealthImpact').value = d.healthImpact || '';
    document.getElementById('pdAthleteImpact').value = d.athleteImpact || '';

    if(d.targets) {
      const targets = d.targets.includes('||') ? d.targets.split('||') : d.targets.split(',').map(t=>t.trim()+'|0');
      targets.forEach(t => {
        let [tName, tCount] = t.split('|');
        document.querySelectorAll('.pd-target-cb').forEach(cb => {
          if(cb.value === tName) {
            cb.checked = true;
            let numInput = cb.parentElement.nextElementSibling;
            if(numInput) {
              numInput.value = parseInt(tCount) > 0 ? tCount : '';
              numInput.classList.remove('hidden');
            }
          }
        });
      });
    }
  }
}

// 📌 บันทึกข้อมูลโครงการครบ 11 หัวข้อ
window.submitProjectDetails = async function() {
  const course = document.getElementById('pdCourse').value;
  const rationale = document.getElementById('pdRationale').value.trim();
  const objectives = document.getElementById('pdObjectives').value.trim();
  const goalsText = document.getElementById('pdGoalsText').value.trim();
  const section42 = document.getElementById('pdSection42').value.trim();
  const govPolicy = document.getElementById('pdGovPolicy').value.trim();
  const shortTerm = document.getElementById('pdShortTerm').value.trim();
  const expected = document.getElementById('pdExpected').value.trim();
  const socialImpact = document.getElementById('pdSocialImpact').value.trim();
  const envImpact = document.getElementById('pdEnvImpact').value.trim();
  const healthImpact = document.getElementById('pdHealthImpact').value.trim();
  const athleteImpact = document.getElementById('pdAthleteImpact').value.trim();
  
  if(!course) return alert('⚠️ กรุณาเลือกหลักสูตรก่อนบันทึกข้อมูล');
  
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
    const payload = { 
      action: 'saveProjectDetails', 
      course: course, 
      rationale: rationale, 
      objectives: objectives, 
      goalsText: goalsText,
      targets: targetString,
      section42: section42,
      govPolicy: govPolicy,
      shortTerm: shortTerm,
      expected: expected,
      socialImpact: socialImpact,
      envImpact: envImpact,
      healthImpact: healthImpact,
      athleteImpact: athleteImpact
    };
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    const result = await response.json();
    if(result.status === 'success') { alert('✅ ' + result.message); fetchData(); } else { alert('❌ ' + result.message); }
  } catch(e) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  
  btn.textContent = 'บันทึกข้อมูลโครงการทั้งหมด'; btn.disabled = false;
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
      if(filteredCourses.length === 0) { warnText.textContent = `⚠️ ท่านไม่มีประวัติการอบรมในปีงบประมาณ ${activeYear} จึงไม่ต้องรายงานผลในรอบนี้`; warnText.classList.remove('hidden'); formContainer.classList.add('hidden'); return; }       warnText.classList.add('hidden'); formContainer.classList.remove('hidden');       const provOptions = '<option value="">-- เลือกจังหวัด --</option>' + provinces.map(p => `<option value="${p}">${p}</option>`).join('');       let html = '';       filteredCourses.forEach((c, i) => {         let copyBtn = i > 0 ? `<div class="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl"><input type="checkbox" id="copyCheck_${i}" onchange="copyFormData(${i})" class="w-4 h-4 text-blue-600 rounded cursor-pointer"><label for="copyCheck_${i}" class="text-sm font-bold text-blue-800 cursor-pointer">📋 คัดลอกข้อมูลสถานที่และเวลาจากหลักสูตรด้านบน</label></div>` : '';
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
