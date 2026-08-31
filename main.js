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
let srFormState = []; // 📌 ตัวแปรใหม่ เก็บสถานะฟอร์มรายงานผล (รองรับ Multiple Duties)
let globalSettings = { activeReportYear: '2569', adminPin: '336699' }; 

// 📌 อัปเกรด: เพิ่ม "ต่างประเทศ" เข้าไปเป็นตัวเลือกแรกสุด
const provinces = ["ต่างประเทศ","กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม","นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี"];

let currentReportCourseBase64 = null; 

function utf8ToBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
function base64ToUtf8(str) { return decodeURIComponent(escape(atob(str))); }

document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  setupDragAndDrop();
  setupOTPInputs();
  switchPage('report');
  
  let delayTimer;
  const triggerSearch = () => { clearTimeout(delayTimer); showLoadingState(); delayTimer = setTimeout(fetchData, 500); };
  document.getElementById('searchInput').addEventListener('input', triggerSearch);
  document.getElementById('filterCourse').addEventListener('change', () => { handleCascadingFilter('course'); triggerSearch(); });
  document.getElementById('filterYear').addEventListener('change', () => { handleCascadingFilter('year'); triggerSearch(); });
  document.getElementById('filterGroup').addEventListener('change', () => { triggerSearch(); });
  document.getElementById('excelUpload').addEventListener('change', (e) => { processExcelFile(e.target.files[0], e.target); });
  document.getElementById('singleFullName').addEventListener('blur', function() { if(this.value) this.value = this.value.trim().replace(/\s+/g, ' '); });
});

window.showToast = function(message) {
   const toast = document.getElementById('toastNotification');
   document.getElementById('toastMessage').textContent = message;
   toast.classList.remove('translate-y-20', 'opacity-0');
   setTimeout(() => { toast.classList.add('translate-y-20', 'opacity-0'); }, 3000);
};

window.updatePersonnelStatus = async function(uid, newStatus, selectElement) {
  selectElement.disabled = true; selectElement.classList.add('opacity-50', 'animate-pulse');
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
      fetchData(); 
    } else { alert('❌ ' + result.message); }
  } catch(err) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  selectElement.disabled = false; selectElement.classList.remove('opacity-50', 'animate-pulse');
};

// 📌 ฟังก์ชันเปิด-ปิด Evidence Viewer Modal (Phase 2)
window.openEvidenceModal = function(url) {
  if(!url) return;
  let previewUrl = url;
  if (url.includes('drive.google.com/file/d/')) {
    const fileIdMatch = url.match(/\/d\/(.*?)\//);
    if (fileIdMatch && fileIdMatch[1]) previewUrl = `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
  }
  const modal = document.getElementById('evidenceModal');
  const iframe = document.getElementById('evidenceIframe');
  const loading = document.getElementById('evidenceLoading');
  loading.classList.remove('hidden'); iframe.classList.add('hidden');
  modal.classList.remove('hidden'); iframe.src = previewUrl;
};
window.closeEvidenceModal = function() {
  document.getElementById('evidenceModal').classList.add('hidden');
  document.getElementById('evidenceIframe').src = ''; 
};

// ==========================================
// 📌 MODULE: Smart Default & Multiple Duties
// ==========================================

window.clearSelfReportSearch = function() {
  document.getElementById('srSearchName').value = '';
  document.getElementById('srFormContainer').classList.add('hidden');
  document.getElementById('srUserWarn').classList.add('hidden');
  document.getElementById('srDynamicForms').innerHTML = '';
  srSelectedUser = null;
  srFormState = []; // เคลียร์ State
  document.getElementById('srSearchName').focus(); 
};

window.handleSelfReportUserSelect = function() {
  const inputVal = document.getElementById('srSearchName').value; 
  const warnText = document.getElementById('srUserWarn'); 
  const formContainer = document.getElementById('srFormContainer'); 
  const activeYear = globalSettings.activeReportYear;
  
  const match = inputVal.match(/\((USR-\d{4}-\d{4})\)/);
  if(match) {
    const uid = match[1]; 
    srSelectedUser = cachedPersonnelData.find(p => p.uid === uid);
    
    if(srSelectedUser) {
      const filteredCourses = (srSelectedUser.trainings || []).filter(t => String(t.year) === String(activeYear));
      
      if(filteredCourses.length === 0) { 
        warnText.textContent = `⚠️ ท่านไม่มีประวัติการอบรมในปีงบประมาณ ${activeYear} จึงไม่ต้องรายงานผลในรอบนี้`; 
        warnText.classList.remove('hidden'); formContainer.classList.add('hidden'); 
        return; 
      }
      
      warnText.classList.add('hidden'); 
      formContainer.classList.remove('hidden');
      
      srFormState = []; // รีเซ็ต State
      
      // ดึงข้อมูลเก่ามาใส่ (Smart Default)
      filteredCourses.forEach(c => {
         const existingDuties = (srSelectedUser.duties || []).filter(d => String(d.year) === String(activeYear) && d.course === c.course);
         if (existingDuties.length > 0) {
            existingDuties.forEach(d => {
               srFormState.push({ course: c.course, data: d, isReported: true, tempData: null });
            });
         } else {
            srFormState.push({ course: c.course, data: null, isReported: false, tempData: null });
         }
      });
      
      renderSrForms();
      return;
    }
  }
  
  srSelectedUser = null; srFormState = [];
  warnText.textContent = '⚠️ ไม่พบประวัติการอบรมของชื่อนี้ กรุณาตรวจสอบการสะกดคำ'; 
  warnText.classList.remove('hidden'); formContainer.classList.add('hidden');
};

function syncSrFormState() {
  srFormState.forEach((form, i) => {
    form.tempData = {
      eventType: document.getElementById(`srEventType_${i}`)?.value || '',
      eventTypeOther: document.getElementById(`srEventTypeOther_${i}`)?.value || '',
      eventName: document.getElementById(`srEventName_${i}`)?.value || '',
      role: document.getElementById(`srRole_${i}`)?.value || '',
      roleOther: document.getElementById(`srRoleOther_${i}`)?.value || '',
      sport: document.getElementById(`srSport_${i}`)?.value || '',
      startDate: document.getElementById(`srStartDate_${i}`)?.value || '',
      endDate: document.getElementById(`srEndDate_${i}`)?.value || '',
      province: document.getElementById(`srProvince_${i}`)?.value || '',
      location: document.getElementById(`srLocation_${i}`)?.value || '',
      knowledge: document.getElementById(`srKnowledge_${i}`)?.value || ''
    };
  });
}

window.addDutyForm = function(courseName) {
  syncSrFormState(); // จำค่าที่ผู้ใช้เพิ่งพิมพ์
  srFormState.push({ course: courseName, data: null, isReported: false, tempData: null });
  renderSrForms();
};

window.removeDutyForm = function(idx) {
  if(confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) {
    syncSrFormState();
    srFormState.splice(idx, 1);
    renderSrForms();
  }
};

window.toggleOtherInput = function(selectEl, otherId) {
  const otherInput = document.getElementById(otherId);
  if(selectEl.value === 'อื่นๆ') {
    otherInput.classList.remove('hidden'); otherInput.focus();
  } else {
    otherInput.classList.add('hidden'); otherInput.value = '';
  }
};

window.renderSrForms = function() {
  const dynamicForms = document.getElementById('srDynamicForms');
  let html = '';
  
  const uniqueCourses = [...new Set(srFormState.map(s => s.course))];
  
  uniqueCourses.forEach((courseName) => {
    html += `
    <div class="mb-8 p-6 md:p-8 bg-blue-50/30 border-2 border-blue-100 rounded-3xl shadow-sm">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-blue-200 pb-4">
        <div>
           <h3 class="text-xl font-extrabold text-slate-800 border-l-4 border-blue-600 pl-3">หลักสูตร: <span class="text-blue-700">${courseName}</span></h3>
           <p class="text-xs text-slate-500 mt-1 pl-4">ระบุรายละเอียดการปฏิบัติหน้าที่ (สามารถเพิ่มได้หลายรายการหากไปหลายงาน)</p>
        </div>
        <button onclick="addDutyForm('${courseName}')" class="shrink-0 bg-white border border-blue-300 hover:bg-blue-100 text-blue-700 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg> 
          เพิ่มรายการปฏิบัติหน้าที่
        </button>
      </div>`;
    
    const formsForCourse = srFormState.filter(s => s.course === courseName);
    
    if (formsForCourse.length === 0) {
       html += `<div class="text-center py-6 text-slate-400 text-sm bg-white rounded-2xl border border-dashed border-slate-300">ยังไม่มีรายการปฏิบัติหน้าที่ กรุณากดปุ่มเพิ่มรายการด้านบน</div>`;
    }

    formsForCourse.forEach((form, relativeIdx) => {
      const i = srFormState.indexOf(form); // Global Index
      const d = form.tempData || form.data || {};
      
      const badgeHTML = form.isReported 
        ? `<span class="bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-bl-xl rounded-tr-2xl text-[11px] font-extrabold flex items-center gap-1 shadow-sm"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> รายงานแล้ว (กำลังแก้ไข)</span>` 
        : `<span class="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-bl-xl rounded-tr-2xl text-[11px] font-extrabold flex items-center gap-1 shadow-sm"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ข้อมูลใหม่ (รอส่ง)</span>`;
      
      // ดึงค่า Dropdown (รองรับคำว่า 'อื่นๆ')
      let valEvent = d.eventType || '';
      let valEventOther = d.eventTypeOther || '';
      if(valEvent && valEvent.startsWith('อื่นๆ: ')) { valEventOther = valEvent.substring(7).trim(); valEvent = 'อื่นๆ'; }
      else if(valEvent && !['รายการแข่งขันระดับจังหวัด','รายการแข่งขันระดับชาติ','รายการแข่งขันระดับนานาชาติ','รายการอบรมสัมมนา','ปฏิบัติงานบริหารจัดการทั่วไป','อื่นๆ'].includes(valEvent)) { valEventOther = valEvent; valEvent = 'อื่นๆ'; }

      let valRole = d.role || '';
      let valRoleOther = d.roleOther || '';
      if(valRole && valRole.startsWith('อื่นๆ: ')) { valRoleOther = valRole.substring(7).trim(); valRole = 'อื่นๆ'; }
      else if(valRole && !['ผู้ตัดสิน','ผู้ฝึกสอน','วิทยากร','ประธานจัดการแข่งขัน','ผู้จัดการทีม','เจ้าหน้าที่เทคนิค','ผู้ดูแลระบบ/ประสานงาน','อื่นๆ'].includes(valRole)) { valRoleOther = valRole; valRole = 'อื่นๆ'; }
      
      // วันที่ Format (YYYY-MM-DD)
      const sDate = d.startDate ? new Date(d.startDate).toISOString().split('T')[0] : '';
      const eDate = d.endDate ? new Date(d.endDate).toISOString().split('T')[0] : '';
      
      const provOptions = '<option value="">-- เลือกจังหวัด / ต่างประเทศ --</option>' + provinces.map(p => `<option value="${p}" ${d.province === p ? 'selected' : ''}>${p}</option>`).join('');

      let imageAlert = '';
      let keepImagesValue = '';
      if (form.data && form.data.images) {
         keepImagesValue = form.data.images;
         imageAlert = `<div class="mt-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">✅ ระบบจำรูปภาพเดิมไว้แล้ว หากไม่ต้องการเปลี่ยน ไม่ต้องเลือกไฟล์ใหม่</div>`;
      }

      html += `
      <div class="sr-card-item bg-white border border-slate-200 rounded-2xl p-6 md:p-8 relative shadow-sm mb-5">
        <input type="hidden" id="srCourse_${i}" value="${courseName}">
        <input type="hidden" id="keepImages_${i}" value="${keepImagesValue}">
        
        <div class="absolute top-0 right-0">${badgeHTML}</div>
        <div class="flex justify-between items-center mb-5 mt-2">
           <h4 class="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-md">งานที่ ${relativeIdx + 1}</h4>
           <button type="button" onclick="removeDutyForm(${i})" class="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-3 py-1 rounded-lg transition">ลบงานนี้</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div><label class="block text-xs font-bold text-slate-500 mb-1.5">รูปแบบงาน / ระดับการแข่งขัน <span class="text-red-500">*</span></label>
            <select id="srEventType_${i}" onchange="toggleOtherInput(this, 'srEventTypeOther_${i}')" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="">-- เลือกรูปแบบงาน --</option><option value="รายการแข่งขันระดับจังหวัด" ${valEvent==='รายการแข่งขันระดับจังหวัด'?'selected':''}>รายการแข่งขันระดับจังหวัด</option><option value="รายการแข่งขันระดับชาติ" ${valEvent==='รายการแข่งขันระดับชาติ'?'selected':''}>รายการแข่งขันระดับชาติ</option><option value="รายการแข่งขันระดับนานาชาติ" ${valEvent==='รายการแข่งขันระดับนานาชาติ'?'selected':''}>รายการแข่งขันระดับนานาชาติ</option><option value="รายการอบรมสัมมนา" ${valEvent==='รายการอบรมสัมมนา'?'selected':''}>รายการอบรมสัมมนา</option><option value="ปฏิบัติงานบริหารจัดการทั่วไป" ${valEvent==='ปฏิบัติงานบริหารจัดการทั่วไป'?'selected':''}>ปฏิบัติงานบริหารจัดการทั่วไป</option><option value="อื่นๆ" ${valEvent==='อื่นๆ'?'selected':''}>อื่นๆ</option>
            </select>
            <input type="text" id="srEventTypeOther_${i}" value="${valEventOther}" placeholder="โปรดระบุรูปแบบงาน..." class="${valEvent==='อื่นๆ'?'':'hidden'} w-full mt-2 text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
          </div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1.5">ชื่องาน / รายการที่ไปปฏิบัติหน้าที่ <span class="text-red-500">*</span></label>
            <input type="text" id="srEventName_${i}" value="${d.event || d.eventName || ''}" placeholder="เช่น กีฬาแห่งชาติ ครั้งที่ 49" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1.5">ตำแหน่งที่ท่านปฏิบัติหน้าที่ <span class="text-red-500">*</span></label>
            <select id="srRole_${i}" onchange="toggleOtherInput(this, 'srRoleOther_${i}')" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="">-- เลือกตำแหน่ง --</option><option value="ผู้ตัดสิน" ${valRole==='ผู้ตัดสิน'?'selected':''}>ผู้ตัดสิน</option><option value="ผู้ฝึกสอน" ${valRole==='ผู้ฝึกสอน'?'selected':''}>ผู้ฝึกสอน</option><option value="วิทยากร" ${valRole==='วิทยากร'?'selected':''}>วิทยากร</option><option value="ประธานจัดการแข่งขัน" ${valRole==='ประธานจัดการแข่งขัน'?'selected':''}>ประธานจัดการแข่งขัน</option><option value="ผู้จัดการทีม" ${valRole==='ผู้จัดการทีม'?'selected':''}>ผู้จัดการทีม</option><option value="เจ้าหน้าที่เทคนิค" ${valRole==='เจ้าหน้าที่เทคนิค'?'selected':''}>เจ้าหน้าที่เทคนิค</option><option value="ผู้ดูแลระบบ/ประสานงาน" ${valRole==='ผู้ดูแลระบบ/ประสานงาน'?'selected':''}>ผู้ดูแลระบบ/ประสานงาน</option><option value="อื่นๆ" ${valRole==='อื่นๆ'?'selected':''}>อื่นๆ</option>
            </select>
            <input type="text" id="srRoleOther_${i}" value="${valRoleOther}" placeholder="โปรดระบุตำแหน่ง..." class="${valRole==='อื่นๆ'?'':'hidden'} w-full mt-2 text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
          </div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1.5">ชนิดกีฬา <span class="text-red-500">*</span></label>
            <input type="text" id="srSport_${i}" value="${d.sport || ''}" placeholder="เช่น ฟุตบอล, มวยไทย (หากไม่มีให้ใส่ -)" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1.5">วันที่เริ่มต้นปฏิบัติงาน <span class="text-red-500">*</span></label>
            <input type="date" id="srStartDate_${i}" value="${sDate}" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          </div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1.5">วันที่สิ้นสุดการปฏิบัติงาน <span class="text-red-500">*</span></label>
            <input type="date" id="srEndDate_${i}" value="${eDate}" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          </div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1.5">สถานที่ (จังหวัด / ประเทศ) <span class="text-red-500">*</span></label>
            <select id="srProvince_${i}" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500">${provOptions}</select>
          </div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1.5">สถานที่จัดงาน (รายละเอียด) <span class="text-red-500">*</span></label>
            <input type="text" id="srLocation_${i}" value="${d.location || ''}" placeholder="ระบุ สนามกีฬา, เมือง, หรือ ประเทศ..." class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div class="space-y-4">
          <div><label class="block text-xs font-bold text-slate-500 mb-2">อธิบายความรู้ที่ท่านได้นำไปประยุกต์ใช้ <span class="text-red-500">*</span></label>
            <textarea id="srKnowledge_${i}" rows="3" class="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="อธิบายสั้นๆ...">${d.knowledge || ''}</textarea>
          </div>
          <div class="bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
            <label class="block text-xs font-bold text-slate-700 mb-2">แนบรูปภาพหลักฐานประกอบ (ถ้ามี / ไม่เกิน 5MB ต่อภาพ)</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><input type="file" id="srFile1_${i}" accept="image/jpeg, image/png, image/jpg" class="w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 bg-white border border-slate-200 rounded p-1 cursor-pointer"></div>
              <div><input type="file" id="srFile2_${i}" accept="image/jpeg, image/png, image/jpg" class="w-full text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 bg-white border border-slate-200 rounded p-1 cursor-pointer"></div>
            </div>
            ${imageAlert}
          </div>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  
  dynamicForms.innerHTML = html; 
};

window.submitSelfReport = async function() {
  syncSrFormState(); // อัปเดตข้อมูลล่าสุดจากหน้าจอ
  const activeYear = document.getElementById('srActiveYear').value; 
  let allReports = [];
  
  // 📌 1. Validation (ตรวจสอบความถูกต้องก่อนลบข้อมูลเดิม)
  for (let i = 0; i < srFormState.length; i++) {
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
    const keepImages = document.getElementById(`keepImages_${i}`).value;
    
    if (eventType === 'อื่นๆ') {
      const otherVal = document.getElementById(`srEventTypeOther_${i}`).value.trim();
      if(!otherVal) return alert(`⚠️ กรุณาระบุรูปแบบงานใน ${course} งานที่ ${i+1}`);
      eventType = 'อื่นๆ: ' + otherVal;
    }
    if (role === 'อื่นๆ') {
      const otherVal = document.getElementById(`srRoleOther_${i}`).value.trim();
      if(!otherVal) return alert(`⚠️ กรุณาระบุตำแหน่งใน ${course} งานที่ ${i+1}`);
      role = 'อื่นๆ: ' + otherVal;
    }

    if(!eventType || !eventName || !role || !sport || !startDate || !endDate || !province || !location || !knowledge) { 
      return alert(`⚠️ กรุณากรอกข้อมูลสำคัญที่มีดอกจันสีแดงให้ครบถ้วนในหลักสูตร ${course}`); 
    }
    
    const file1 = document.getElementById(`srFile1_${i}`).files[0]; 
    const file2 = document.getElementById(`srFile2_${i}`).files[0];
    
    allReports.push({ course, eventType, eventName, role, sport, startDate, endDate, province, location, knowledge, keepImages, file1, file2 });
  }

  document.getElementById('srLoadingOverlay').classList.remove('hidden');

  try {
    // 📌 2. อ่านไฟล์รูปภาพทั้งหมดเป็น Base64 (ถ้ามีไฟล์ใหญ่เกินจะพังตรงนี้ จะได้ไม่ลบข้อมูลเดิมฟรี)
    for (let r of allReports) {
       if(r.file1) { r.file1Data = await getBase64(r.file1); r.file1Name = r.file1.name; r.file1Mime = r.file1.type; }
       if(r.file2) { r.file2Data = await getBase64(r.file2); r.file2Name = r.file2.name; r.file2Mime = r.file2.type; }
    }

    // 📌 3. ล้างข้อมูลเดิม (Clear Data) สำหรับปีประเมินนี้ ป้องกันข้อมูลเบิ้ล
    document.getElementById('srLoadingTitle').textContent = `กำลังเคลียร์ข้อมูลเดิม...`;
    await fetch(API_URL, { 
       method: 'POST', 
       body: JSON.stringify({ action: 'clearDutyRecords', uid: srSelectedUser.uid, year: activeYear }),
       headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });

    // 📌 4. บันทึกข้อมูลชุดใหม่ (Replace)
    for (let i = 0; i < allReports.length; i++) {
      document.getElementById('srLoadingTitle').textContent = `กำลังบันทึกข้อมูลงานที่ ${i+1} / ${allReports.length}`;
      let r = allReports[i]; 
      
      const payload = { 
        action: 'saveSelfReport', 
        uid: srSelectedUser.uid, 
        fullName: srSelectedUser.fullName, 
        course: r.course, 
        eventType: r.eventType, 
        eventName: r.eventName, 
        role: r.role, 
        sport: r.sport, 
        startDate: r.startDate, 
        endDate: r.endDate, 
        year: activeYear, 
        province: r.province, 
        location: r.location, 
        knowledge: r.knowledge, 
        keepImages: r.keepImages, // ส่งลิงก์รูปเก่ากลับไป
        file1Data: r.file1Data || null, 
        file1Name: r.file1Name || '', 
        file1Mime: r.file1Mime || '', 
        file2Data: r.file2Data || null, 
        file2Name: r.file2Name || '', 
        file2Mime: r.file2Mime || '' 
      };
      
      const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) }); 
      const json = await res.json();
      if(json.status !== 'success') throw new Error(json.message);
    }
    
    alert('✅ บันทึกรายงานสำเร็จทั้งหมด ข้อมูลของคุณได้รับการอัปเดตเรียบร้อยแล้ว'); 
    document.getElementById('srSearchName').value = ''; 
    document.getElementById('srFormContainer').classList.add('hidden'); 
    srSelectedUser = null; 
    srFormState = [];
    fetchData(); 
  } catch(err) {
    if(err.message === 'ขนาดไฟล์เกิน 5MB') alert('❌ ' + err.message); 
    else alert('❌ เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
  }
  
  document.getElementById('srLoadingOverlay').classList.add('hidden');
};

// ==========================================
// 📌 MODULE: Admin Management & Other Core Functions
// ==========================================

window.viewProfile = function(uid) {
  currentActiveUid = uid; 
  const person = cachedPersonnelData.find(p => p.uid === uid);
  if (!person) { alert("❌ ไม่พบข้อมูลบุคลากร"); return; }
  
  document.getElementById('profileName').textContent = person.fullName; 
  document.getElementById('profileUid').textContent = `รหัสอ้างอิง: ${person.uid}`; 
  document.getElementById('profileAgency').textContent = `${person.agency} (${person.status})`; 
  document.getElementById('profileGroup').textContent = person.group || 'ไม่ระบุกลุ่ม'; 

  const timelineEl = document.getElementById('profileTrainings');
  if (person.trainings && person.trainings.length > 0) { 
    const sortedTrainings = person.trainings.sort((a, b) => b.year - a.year); 
    timelineEl.innerHTML = sortedTrainings.map(t => `
      <li class="relative pl-6 pb-4 border-l-2 border-slate-200 last:border-0 last:pb-0">
        <div class="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 ring-4 ring-white shadow-sm"></div>
        <p class="text-sm font-bold text-slate-800">${t.course}</p>
        <p class="text-xs text-slate-500 mt-0.5">ปีการศึกษา: ${t.year}</p>
      </li>`).join(''); 
  } else { 
    timelineEl.innerHTML = `<li class="text-sm text-slate-500 pl-4">ยังไม่มีประวัติการอบรม</li>`; 
  }
  
  const dutyEl = document.getElementById('profileDuties');
  if (person.duties && person.duties.length > 0) {
    dutyEl.innerHTML = person.duties.map(d => {
      let evidenceHtml = '';
      if (d.images) {
        const links = d.images.split(',').map(l => l.trim()).filter(l => l);
        if (links.length > 0) {
          evidenceHtml = `<div class="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-100">`;
          links.forEach((link, idx) => {
            evidenceHtml += `
            <button onclick="openEvidenceModal('${link}')" class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-1.5 px-3 rounded-lg border border-blue-200 transition-colors flex items-center gap-1.5 shadow-sm">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> 
              หลักฐานชิ้นที่ ${idx + 1}
            </button>`;
          });
          evidenceHtml += `</div>`;
        }
      }
      return `
      <li class="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1 shadow-sm">
        <div class="flex justify-between items-start">
          <span class="text-sm font-bold text-slate-800">${d.sport}</span>
          <span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">ปี ${d.year || '-'}</span>
        </div>
        <span class="text-xs text-blue-600 font-semibold">${d.role}</span>
        <span class="text-xs text-slate-500 flex items-center gap-1 mt-1">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> 
          ${d.event || 'ไม่ระบุชื่องาน'}
        </span>
        ${evidenceHtml}
      </li>`;
    }).join('');
  } else { 
    dutyEl.innerHTML = `<div class="text-sm text-slate-500">ยังไม่มีประวัติลงพื้นที่</div>`; 
  }
  
  const evalEl = document.getElementById('profileEvals');
  if (person.evals && person.evals.length > 0) { 
    evalEl.innerHTML = person.evals.map(e => `
      <div class="bg-white p-3.5 rounded-xl border border-slate-200 text-sm text-slate-700 italic shadow-sm">"${e.feedback}"</div>
    `).join(''); 
  } else { 
    evalEl.innerHTML = `<div class="text-sm text-slate-500">ยังไม่มีข้อเสนอแนะ</div>`; 
  }
  
  const slideOver = document.getElementById('slideOver'); 
  const backdrop = document.getElementById('slideOverBackdrop'); 
  const panel = document.getElementById('slideOverPanel');
  
  slideOver.classList.remove('hidden'); 
  setTimeout(() => { 
    backdrop.classList.remove('opacity-0'); backdrop.classList.add('opacity-100'); 
    panel.classList.remove('translate-x-full'); panel.classList.add('translate-x-0'); 
  }, 10);
  switchTab('general');
};

window.closeProfile = function() { 
  currentActiveUid = null; 
  const backdrop = document.getElementById('slideOverBackdrop'); 
  const panel = document.getElementById('slideOverPanel'); 
  backdrop.classList.remove('opacity-100'); backdrop.classList.add('opacity-0'); 
  panel.classList.remove('translate-x-0'); panel.classList.add('translate-x-full'); 
  setTimeout(() => { document.getElementById('slideOver').classList.add('hidden'); }, 300); 
};

window.switchTab = function(tabName) {
  ['general', 'duty', 'eval'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`); 
    const content = document.getElementById(`tab-content-${t}`);
    if (t === tabName) { 
      btn.classList.add('border-blue-600', 'text-blue-600', 'font-bold'); btn.classList.remove('border-transparent', 'text-slate-500', 'font-medium'); 
      content.classList.remove('hidden'); content.classList.add('block'); 
    } else { 
      btn.classList.add('border-transparent', 'text-slate-500', 'font-medium'); btn.classList.remove('border-blue-600', 'text-blue-600', 'font-bold'); 
      content.classList.remove('block'); content.classList.add('hidden'); 
    }
  });
};

window.submitDuty = async function() {
  if (!currentActiveUid) return; 
  const sport = document.getElementById('inputDutySport').value.trim(); 
  const role = document.getElementById('inputDutyRole').value.trim(); 
  const event = document.getElementById('inputDutyEvent').value.trim(); 
  const year = document.getElementById('inputDutyYear').value.trim();
  if (!sport || !role || !event || !year) return alert('⚠️ กรุณากรอกข้อมูล ชนิดกีฬา, ประเภทบุคลากร, ชื่องาน และ ปีที่ปฏิบัติงาน ให้ครบถ้วน');
  
  const btn = document.getElementById('btnSaveDuty'); 
  btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;
  try {
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveDuty', uid: currentActiveUid, sport: sport, role: role, event: event, year: year }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    const result = await response.json();
    if(result.status === 'success') { 
      alert('✅ บันทึกสำเร็จ'); document.getElementById('inputDutySport').value = ''; document.getElementById('inputDutyRole').value = ''; document.getElementById('inputDutyEvent').value = ''; document.getElementById('inputDutyYear').value = ''; fetchData(); 
    } else { alert(`❌ ข้อผิดพลาด: ${result.message}`); }
  } catch(e) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  btn.textContent = 'บันทึกข้อมูล'; btn.disabled = false;
};

window.submitEval = async function() {
  if (!currentActiveUid) return; 
  const feedback = document.getElementById('inputEvalFeedback').value.trim();
  if (!feedback) return alert('⚠️ กรุณากรอกข้อเสนอแนะ');
  const btn = document.getElementById('btnSaveEval'); 
  btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;
  try {
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'saveEval', uid: currentActiveUid, feedback: feedback }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    const result = await response.json();
    if(result.status === 'success') { alert('✅ บันทึกสำเร็จ'); document.getElementById('inputEvalFeedback').value = ''; fetchData(); } else { alert(`❌ ข้อผิดพลาด: ${result.message}`); }
  } catch(e) { alert('❌ การเชื่อมต่อล้มเหลว'); }
  btn.textContent = 'บันทึกข้อเสนอแนะ'; btn.disabled = false;
};

function handleCascadingFilter(changedType) {
  if (!globalFiltersMaster) return;
  const yearSelect = document.getElementById('filterYear'); 
  const courseSelect = document.getElementById('filterCourse'); 
  const selectedYear = yearSelect.value; 
  const selectedCourse = courseSelect.value; 
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
  const selectedYear = document.getElementById('filterYear').value; 
  const selectedCourse = document.getElementById('filterCourse').value; 
  const selectedGroup = document.getElementById('filterGroup').value;
  const relations = globalFiltersMaster.relations; 
  let availableYears = globalFiltersMaster.years; 
  let availableCourses = globalFiltersMaster.courses; 
  let availableGroups = globalFiltersMaster.groups;
  if (selectedCourse) availableYears = Object.keys(relations.courseToYears[selectedCourse] || {}).sort((a,b) => b-a);
  if (selectedYear) availableCourses = Object.keys(relations.yearToCourses[selectedYear] || {}).sort();
  populateDropdown('filterYear', availableYears, selectedYear, 'ทุกปีการศึกษา'); 
  populateDropdown('filterCourse', availableCourses, selectedCourse, 'ทุกหลักสูตร'); 
  populateDropdown('filterGroup', availableGroups, selectedGroup, 'ทุกกลุ่มบุคลากร');
}

function populateDropdown(elementId, items, currentValue, defaultLabel) {
  const select = document.getElementById(elementId); select.innerHTML = `<option value="">${defaultLabel}</option>`;
  items.forEach(item => { const option = document.createElement('option'); option.value = item; option.textContent = item; select.appendChild(option); }); select.value = currentValue;
}

window.exportToExcel = function() {
  const filterYear = document.getElementById('filterYear').value; const filterCourse = document.getElementById('filterCourse').value; let exportData = [];
  currentFilteredData.forEach(user => {
    let matchedTrainings = (user.trainings || []).filter(t => { return (filterYear === '' || String(t.year) === String(filterYear)) && (filterCourse === '' || String(t.course) === String(filterCourse)); });
    if (matchedTrainings.length > 0) { 
      matchedTrainings.forEach(t => { exportData.push({ 'รหัส UID': user.uid, 'ชื่อ-นามสกุล': user.fullName, 'กลุ่มหน่วยงาน': user.group || '-', 'หน่วยงาน': user.agency, 'สถานะ': user.status, 'ชื่อหลักสูตร': t.course, 'ปีที่อบรม': parseInt(t.year) || t.year }); }); 
    } else if (filterYear === '' && filterCourse === '') { 
      exportData.push({ 'รหัส UID': user.uid, 'ชื่อ-นามสกุล': user.fullName, 'กลุ่มหน่วยงาน': user.group || '-', 'หน่วยงาน': user.agency, 'สถานะ': user.status, 'ชื่อหลักสูตร': '-', 'ปีที่อบรม': '-' }); 
    }
  });
  exportData.sort((a, b) => { return (parseInt(a['ปีที่อบรม']) || 9999) - (parseInt(b['ปีที่อบรม']) || 9999); });
  if (exportData.length === 0) { alert('⚠️ ไม่พบข้อมูลประวัติการอบรมสำหรับเงื่อนไขนี้'); return; }
  const ws = XLSX.utils.json_to_sheet(exportData); ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 40 }, { wch: 15 }]; 
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Personnel_Training_Log");
  let filename = "ข้อมูลบุคลากรกีฬา"; if (filterCourse) filename += "_" + filterCourse.replace(/\s+/g, ""); if (filterYear) filename += "_ปี" + filterYear; filename += ".xlsx"; 
  XLSX.writeFile(wb, filename);
};

window.downloadTemplate = function() {
  const ws = XLSX.utils.aoa_to_sheet([["คำนำหน้า", "ชื่อ-นามสกุล", "กลุ่มหน่วยงาน", "หน่วยงาน", "สถานะ", "ชื่อหลักสูตร", "ปีที่อบรม"], ["นาย", "ทดสอบ ตัวอย่างการกรอก", "สมาคมกีฬา", "สมาคมกีฬาแห่งจังหวัดกรุงเทพมหานคร", "ปฏิบัติงาน", "TSLP", "2569"]]); 
  ws['!cols'] = [{wch:10}, {wch:30}, {wch:20}, {wch:40}, {wch:15}, {wch:20}, {wch:15}]; const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import_Template"); XLSX.writeFile(wb, "Template_นำเข้าบุคลากร.xlsx");
};

function showLoadingState() { const tbody = document.getElementById('tableBody'); if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-blue-500 font-medium">กำลังโหลดข้อมูล...</td></tr>`; }
function showErrorState(message) { const tbody = document.getElementById('tableBody'); if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-red-400 font-medium">❌ ${message}</td></tr>`; }
