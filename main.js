// 👇 นำ Web App URL ชุดใหม่ล่าสุดมาใส่ตรงนี้ (ห้ามลืมเปลี่ยนเด็ดขาด)
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
let srFormState = []; 
let globalSettings = { activeReportYear: '2569', adminPin: '336699' }; 

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
  if(loading) loading.classList.remove('hidden'); 
  if(iframe) iframe.classList.add('hidden');
  if(modal) modal.classList.remove('hidden'); 
  if(iframe) iframe.src = previewUrl;
};

window.closeEvidenceModal = function() {
  const modal = document.getElementById('evidenceModal');
  const iframe = document.getElementById('evidenceIframe');
  if(modal) modal.classList.add('hidden');
  if(iframe) iframe.src = ''; 
};

window.clearSelfReportSearch = function() {
  document.getElementById('srSearchName').value = '';
  document.getElementById('srFormContainer').classList.add('hidden');
  document.getElementById('srUserWarn').classList.add('hidden');
  document.getElementById('srDynamicForms').innerHTML = '';
  srSelectedUser = null;
  srFormState = []; 
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
      const filteredCourses = (srSelectedUser.trainings || []).filter(t => String(t.year).trim() === String(activeYear).trim());
      
      if(filteredCourses.length === 0) { 
        warnText.textContent = `⚠️ ท่านไม่มีประวัติการอบรมในปีงบประมาณ ${activeYear} จึงไม่ต้องรายงานผลในรอบนี้`; 
        warnText.classList.remove('hidden'); formContainer.classList.add('hidden'); 
        return; 
      }
      
      warnText.classList.add('hidden'); 
      formContainer.classList.remove('hidden');
      srFormState = []; 
      
      filteredCourses.forEach(c => {
         const existingDuties = (srSelectedUser.duties || []).filter(d => 
            String(d.year).trim() === String(activeYear).trim() && 
            String(d.course).trim() === String(c.course).trim()
         );
         
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
    const getVal = function(id) {
      const el = document.getElementById(id);
      return el ? el.value : '';
    };
    
    form.tempData = {
      eventType: getVal(`srEventType_${i}`),
      eventTypeOther: getVal(`srEventTypeOther_${i}`),
      eventName: getVal(`srEventName_${i}`),
      role: getVal(`srRole_${i}`),
      roleOther: getVal(`srRoleOther_${i}`),
      sport: getVal(`srSport_${i}`),
      startDate: getVal(`srStartDate_${i}`),
      endDate: getVal(`srEndDate_${i}`),
      province: getVal(`srProvince_${i}`),
      location: getVal(`srLocation_${i}`),
      knowledge: getVal(`srKnowledge_${i}`)
    };
  });
}

window.addDutyForm = function(courseName) {
  syncSrFormState(); 
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
  if(otherInput) {
    if(selectEl.value === 'อื่นๆ') {
      otherInput.classList.remove('hidden'); otherInput.focus();
    } else {
      otherInput.classList.add('hidden'); otherInput.value = '';
    }
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
      const i = srFormState.indexOf(form); 
      const d = form.tempData || form.data || {};
      
      const badgeHTML = form.isReported 
        ? `<span class="bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-bl-xl rounded-tr-2xl text-[11px] font-extrabold flex items-center gap-1 shadow-sm"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> รายงานแล้ว (กำลังแก้ไข)</span>` 
        : `<span class="bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-bl-xl rounded-tr-2xl text-[11px] font-extrabold flex items-center gap-1 shadow-sm"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ข้อมูลใหม่ (รอส่ง)</span>`;
      
      let valEvent = d.eventType || '';
      let valEventOther = d.eventTypeOther || '';
      if(valEvent && valEvent.startsWith('อื่นๆ: ')) { valEventOther = valEvent.substring(7).trim(); valEvent = 'อื่นๆ'; }
      else if(valEvent && !['รายการแข่งขันระดับจังหวัด','รายการแข่งขันระดับชาติ','รายการแข่งขันระดับนานาชาติ','รายการอบรมสัมมนา','ปฏิบัติงานบริหารจัดการทั่วไป','อื่นๆ'].includes(valEvent)) { valEventOther = valEvent; valEvent = 'อื่นๆ'; }

      let valRole = d.role || '';
      let valRoleOther = d.roleOther || '';
      if(valRole && valRole.startsWith('อื่นๆ: ')) { valRoleOther = valRole.substring(7).trim(); valRole = 'อื่นๆ'; }
      else if(valRole && !['ผู้ตัดสิน','ผู้ฝึกสอน','วิทยากร','ประธานจัดการแข่งขัน','ผู้จัดการทีม','เจ้าหน้าที่เทคนิค','ผู้ดูแลระบบ/ประสานงาน','อื่นๆ'].includes(valRole)) { valRoleOther = valRole; valRole = 'อื่นๆ'; }
      
      const sDate = (d.startDate && !isNaN(new Date(d.startDate))) ? new Date(d.startDate).toISOString().split('T')[0] : '';
      const eDate = (d.endDate && !isNaN(new Date(d.endDate))) ? new Date(d.endDate).toISOString().split('T')[0] : '';
      
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
  syncSrFormState(); 
  const activeYear = document.getElementById('srActiveYear').value; 
  let allReports = [];
  
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
    for (let r of allReports) {
       if(r.file1) { r.file1Data = await getBase64(r.file1); r.file1Name = r.file1.name; r.file1Mime = r.file1.type; }
       if(r.file2) { r.file2Data = await getBase64(r.file2); r.file2Name = r.file2.name; r.file2Mime = r.file2.type; }
    }

    document.getElementById('srLoadingTitle').textContent = `กำลังเคลียร์ข้อมูลเดิม...`;
    await fetch(API_URL, { 
       method: 'POST', 
       body: JSON.stringify({ action: 'clearDutyRecords', uid: srSelectedUser.uid, year: activeYear }),
       headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });

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
        keepImages: r.keepImages, 
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

window.openLoginModal = function() { 
  const modal = document.getElementById('loginModal'); 
  if(modal) modal.classList.remove('hidden'); 
  const err = document.getElementById('loginErrorMsg');
  if(err) err.classList.add('hidden'); 
  
  const inputs = Array.from(document.querySelectorAll('.otp-input')).slice(0, 6); 
  inputs.forEach(input => input.value = ''); 
  setTimeout(() => { if (inputs.length > 0) inputs[0].focus(); }, 100); 
};

window.closeLoginModal = function() { 
  const modal = document.getElementById('loginModal');
  if(modal) modal.classList.add('hidden'); 
};

function setupOTPInputs() { 
  const inputs = Array.from(document.querySelectorAll('.otp-input')).slice(0, 6); 
  inputs.forEach((input, index) => { 
      input.addEventListener('input', (e) => { 
        if(e.target.value.length === 1 && index < 5) inputs[index + 1].focus(); 
        checkOTP(); 
      }); 
      input.addEventListener('keydown', (e) => { 
        if(e.key === 'Backspace' && e.target.value === '' && index > 0) inputs[index - 1].focus(); 
      }); 
      input.addEventListener('paste', (e) => { 
        e.preventDefault(); 
        const pastedData = (e.clipboardData || window.clipboardData).getData('text').slice(0, 6).split(''); 
        inputs.forEach((inp, i) => { if(pastedData[i]) inp.value = pastedData[i]; }); 
        if(pastedData.length > 0) inputs[Math.min(pastedData.length, 5)].focus(); 
        checkOTP(); 
      }); 
  }); 
}

window.checkOTP = function() { 
  const inputs = Array.from(document.querySelectorAll('.otp-input')).slice(0, 6); 
  let pin = ''; 
  inputs.forEach(input => pin += input.value); 
  
  if(pin.length === 6) { 
      const correctPin = String(globalSettings.adminPin || "336699").trim();
      
      if(pin === correctPin) { 
          isAdmin = true; 
          document.body.classList.add('is-admin'); 
          
          const btnLogin = document.getElementById('btnLogin');
          if(btnLogin) { btnLogin.classList.remove('flex'); btnLogin.classList.add('hidden'); }
          
          const btnLogout = document.getElementById('btnLogout'); 
          if(btnLogout) { btnLogout.classList.remove('hidden'); btnLogout.classList.add('flex'); }
          
          closeLoginModal(); 
          switchPage('dashboard'); 
          renderTablePage(); 
      } else { 
          const err = document.getElementById('loginErrorMsg');
          if(err) err.classList.remove('hidden'); 
          inputs.forEach(input => input.value = ''); 
          if(inputs.length > 0) inputs[0].focus(); 
      } 
  } 
};

window.logoutAdmin = function() { 
  isAdmin = false; 
  document.body.classList.remove('is-admin'); 
  
  const btnLogin = document.getElementById('btnLogin');
  if(btnLogin) { btnLogin.classList.remove('hidden'); btnLogin.classList.add('flex'); }
  
  const btnLogout = document.getElementById('btnLogout'); 
  if(btnLogout) { btnLogout.classList.remove('flex'); btnLogout.classList.add('hidden'); }
  
  switchPage('report'); 
  renderTablePage(); 
};

window.switchPage = function(pageId) {
  const pages = ['dashboard', 'search', 'timeline', 'import', 'report', 'project'];
  pages.forEach(p => {
    const section = document.getElementById(`page-${p}`);
    if (section) { 
      section.classList.toggle('hidden', p !== pageId); 
      section.classList.toggle('block', p === pageId); 
    }
    const btn = document.getElementById(`nav-btn-${p}`);
    if (btn) {
      if(p === 'report') {
        btn.classList.toggle('bg-blue-50/50', p === pageId); 
        btn.classList.toggle('text-blue-600', p === pageId); 
        btn.classList.toggle('font-bold', p === pageId); 
        btn.classList.toggle('text-slate-500', p !== pageId); 
        btn.classList.toggle('font-medium', p !== pageId);
      } else {
        btn.classList.toggle('border-blue-600', p === pageId); 
        btn.classList.toggle('text-blue-600', p === pageId); 
        btn.classList.toggle('font-bold', p === pageId); 
        btn.classList.toggle('border-transparent', p !== pageId); 
        btn.classList.toggle('text-slate-500', p !== pageId); 
        btn.classList.toggle('font-medium', p !== pageId);
      }
    }
  });
  if (pageId === 'timeline' && globalFiltersMaster) {
    renderTimeline(globalFiltersMaster.relations, globalFiltersMaster.years, globalFiltersMaster.courses);
  }
};

window.switchImportMode = function(mode) {
  const btnBulk = document.getElementById('tab-import-bulk'); 
  const btnSingle = document.getElementById('tab-import-single'); 
  const btnSettings = document.getElementById('tab-import-settings');
  const secBulk = document.getElementById('importModeBulk'); 
  const secSingle = document.getElementById('importModeSingle'); 
  const secSettings = document.getElementById('importModeSettings');
  
  [btnBulk, btnSingle, btnSettings].forEach(b => { 
    if(b) b.className = "pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700 font-medium text-sm transition px-4 flex items-center gap-2" + (b.id === 'tab-import-settings' ? ' ml-auto' : ''); 
  });
  
  [secBulk, secSingle, secSettings].forEach(s => { 
    if(s) { s.classList.remove('block'); s.classList.add('hidden'); } 
  });
  
  if(mode === 'bulk') { 
    if(btnBulk) { btnBulk.classList.add('border-blue-600', 'text-blue-600', 'font-bold'); btnBulk.classList.remove('border-transparent', 'text-slate-500', 'font-medium'); }
    if(secBulk) { secBulk.classList.remove('hidden'); secBulk.classList.add('block'); }
  } else if (mode === 'single') { 
    if(btnSingle) { btnSingle.classList.add('border-blue-600', 'text-blue-600', 'font-bold'); btnSingle.classList.remove('border-transparent', 'text-slate-500', 'font-medium'); }
    if(secSingle) { secSingle.classList.remove('hidden'); secSingle.classList.add('block'); }
  } else if (mode === 'settings') { 
    if(btnSettings) { btnSettings.classList.add('border-blue-600', 'text-blue-600', 'font-bold'); btnSettings.classList.remove('border-transparent', 'text-slate-500', 'font-medium'); }
    if(secSettings) { secSettings.classList.remove('hidden'); secSettings.classList.add('block'); }
  }
};

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
      if (!globalFiltersMaster) { 
        globalFiltersMaster = result.data.filters; 
        updateDropdownUI(); 
      }
      if(result.data.settings) { 
        globalSettings = result.data.settings; 
        const adminYearInput = document.getElementById('adminActiveYear');
        if(adminYearInput) adminYearInput.value = globalSettings.activeReportYear; 
        const srYearInput = document.getElementById('srActiveYear');
        if(srYearInput) srYearInput.value = globalSettings.activeReportYear; 
      }
      if(result.data.projectDetails) { 
        cachedProjectDetails = result.data.projectDetails; 
      } 
      
      updateDatalists(); 
      updateSelfReportDatalist(); 
      renderDashboard(result.data.stats); 
      drawCharts(result.data.filters.years, result.data.filters.groups); 
      currentFilteredData = result.data.list; 
      currentPage = 1; 
      updateSmartSummary(course, year, currentFilteredData.length); 
      renderTablePage();
    } else { 
      showErrorState(result.message); 
    }
  } catch (error) { 
    showErrorState('การเชื่อมต่อกับฐานข้อมูลขัดข้อง (กรุณาเช็ค API URL)'); 
  }
}

function updateDatalists() {
  if (!globalFiltersMaster) return; 
  let agencies = new Set(); 
  let groups = new Set(); 
  cachedPersonnelData.forEach(p => { 
    if(p.agency) agencies.add(p.agency); 
    if(p.group) groups.add(p.group); 
  });
  
  const agencyList = document.getElementById('dl-agencies'); 
  if(agencyList) agencyList.innerHTML = Array.from(agencies).sort().map(a => `<option value="${a}">`).join('');
  
  const groupList = document.getElementById('dl-groups'); 
  if(groupList) groupList.innerHTML = Array.from(groups).sort().map(g => `<option value="${g}">`).join('');
  
  const courseList = document.getElementById('dl-courses'); 
  if(courseList) courseList.innerHTML = globalFiltersMaster.courses.map(c => `<option value="${c}">`).join('');
  
  const pdCourse = document.getElementById('pdCourse'); 
  if(pdCourse) pdCourse.innerHTML = '<option value="">-- กรุณาเลือกหลักสูตรเพื่อจัดการข้อมูล --</option>' + globalFiltersMaster.courses.map(c => `<option value="${c}">${c}</option>`).join('');
  
  const yearList = document.getElementById('dl-years'); 
  if(yearList) yearList.innerHTML = globalFiltersMaster.years.map(y => `<option value="${y}">`).join('');
}

function drawCharts(allYears, allGroups) {
  Chart.register(ChartDataLabels);
  const sortedYears = [...allYears].sort((a,b)=>a-b); 
  const last5Years = sortedYears.slice(-5);
  
  const yearData = last5Years.map(y => { 
    let count = 0; 
    cachedPersonnelData.forEach(p => { 
      if(p.trainings && p.trainings.some(t => String(t.year) === String(y))) count++; 
    }); 
    return count; 
  });
  
  let maxVal = Math.max(...yearData);
  if (!isFinite(maxVal) || maxVal === 0) maxVal = 10;
  
  const ctxBar = document.getElementById('barChart');
  if(ctxBar) {
    if(barChartObj) barChartObj.destroy();
    barChartObj = new Chart(ctxBar.getContext('2d'), { 
      type: 'bar', 
      data: { 
        labels: last5Years.map(y => 'ปี '+y), 
        datasets: [{ label: 'ผู้ผ่านการอบรม', data: yearData, backgroundColor: '#3b82f6', borderRadius: 6 }] 
      }, 
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: { 
          legend: { display: false }, 
          datalabels: { color: '#334155', anchor: 'end', align: 'top', font: { weight: 'bold' } } 
        }, 
        scales: { 
          y: { beginAtZero: true, suggestedMax: maxVal * 1.2, grid: { display: false } }, 
          x: { grid: { display: false } } 
        } 
      } 
    });
  }

  let groupCounts = {}; 
  cachedPersonnelData.forEach(p => { 
    let g = p.group || 'ไม่ระบุ'; 
    groupCounts[g] = (groupCounts[g] || 0) + 1; 
  });
  
  let topGroups = Object.entries(groupCounts).sort((a,b)=>b[1]-a[1]).slice(0, 4); 
  let otherCount = Object.entries(groupCounts).sort((a,b)=>b[1]-a[1]).slice(4).reduce((sum, val) => sum + val[1], 0); 
  if(otherCount > 0) topGroups.push(['อื่นๆ', otherCount]);
  
  const ctxDonut = document.getElementById('donutChart');
  if(ctxDonut) {
    if(donutChartObj) donutChartObj.destroy();
    donutChartObj = new Chart(ctxDonut.getContext('2d'), { 
      type: 'doughnut', 
      data: { 
        labels: topGroups.map(g => g[0]), 
        datasets: [{ data: topGroups.map(g => g[1]), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#94a3b8'], hoverOffset: 4, borderWidth: 2 }] 
      }, 
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        cutout: '65%', 
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
}

function renderDashboard(stats) {
  const elTotal = document.getElementById('stat-total');
  const elYear = document.getElementById('stat-top-year');
  const elCourse = document.getElementById('stat-top-course');
  
  if(elTotal) elTotal.textContent = stats.totalPersonnel; 
  if(elYear) elYear.textContent = stats.topYear; 
  if(elCourse) elCourse.textContent = stats.topCourse;
  
  const tbody = document.getElementById('courseSummaryBody'); 
  if (!tbody) return;
  
  if (!stats.courseSummary || stats.courseSummary.length === 0) { 
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 font-medium">ไม่มีข้อมูลหลักสูตรในระบบ</td></tr>`; 
    return; 
  }

  tbody.innerHTML = stats.courseSummary.map((item, index) => {
    const retentionPercent = item.totalPeople > 0 ? Math.round((item.activePeople / item.totalPeople) * 100) : 0;
    const safeEncodedCourseName = utf8ToBase64(item.courseName);
    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="px-6 py-4 text-center font-mono text-xs text-slate-400">${index + 1}</td>
        <td class="px-6 py-4 font-bold text-slate-800">${item.courseName}</td>
        <td class="px-6 py-4 text-center"><span class="bg-slate-100 px-3 py-1 rounded-lg text-slate-600 text-xs">${item.yearsHeld}</span></td>
        <td class="px-6 py-4">
          <div class="flex justify-between text-xs mb-1.5">
            <span class="text-slate-500 font-medium">ยังทำงาน ${item.activePeople}/${item.totalPeople} คน</span>
            <span class="font-bold text-emerald-600">${retentionPercent}%</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2">
            <div class="bg-emerald-500 h-2 rounded-full" style="width: ${retentionPercent}%"></div>
          </div>
        </td>
        <td class="px-6 py-4 text-center">
          <button id="btn_report_${index}" onclick="openProposalReport('${safeEncodedCourseName}', 'btn_report_${index}')" class="bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 w-full max-w-[130px] mx-auto shadow-md">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path></svg>
            <span>สรุปผลสัมฤทธิ์</span>
          </button>
        </td>
      </tr>`;
  }).join('');
}

window.openMatrixReport = function() {
  if (!globalFiltersMaster) return; 
  matrixAvailableYears = [...globalFiltersMaster.years].sort((a, b) => a - b); 
  if(matrixAvailableYears.length === 0) { alert("ไม่พบข้อมูลปีการศึกษาในระบบ"); return; }
  
  const startSelect = document.getElementById('matrixStartYear'); 
  const endSelect = document.getElementById('matrixEndYear'); 
  startSelect.innerHTML = matrixAvailableYears.map(y => `<option value="${y}">${y}</option>`).join(''); 
  endSelect.innerHTML = matrixAvailableYears.map(y => `<option value="${y}">${y}</option>`).join(''); 
  const modal = document.getElementById('matrixModal');
  if(modal) modal.classList.remove('hidden'); 
  applyMatrixFilter('all');
};

window.applyMatrixFilter = function(type) {
  if (matrixAvailableYears.length === 0) return; 
  const minYear = matrixAvailableYears[0]; 
  const maxYear = matrixAvailableYears[matrixAvailableYears.length - 1]; 
  let startYear, endYear;
  
  if (type === '5') { startYear = Math.max(minYear, maxYear - 4); endYear = maxYear; } 
  else if (type === '10') { startYear = Math.max(minYear, maxYear - 9); endYear = maxYear; } 
  else if (type === 'all') { startYear = minYear; endYear = maxYear; } 
  else if (type === 'custom') { 
    startYear = parseInt(document.getElementById('matrixStartYear').value); 
    endYear = parseInt(document.getElementById('matrixEndYear').value); 
    if (startYear > endYear) { alert('⚠️ ปีเริ่มต้นต้องไม่มากกว่าปีสิ้นสุด'); return; } 
  }
  
  document.getElementById('matrixStartYear').value = startYear; 
  document.getElementById('matrixEndYear').value = endYear; 
  buildMatrixTable(startYear, endYear);
};

function buildMatrixTable(startYear, endYear) {
  const container = document.getElementById('matrixTableContainer'); 
  const textIndicator = document.getElementById('matrixYearRangeText'); 
  if(textIndicator) textIndicator.textContent = `(ระหว่างปี ${startYear} - ${endYear})`;
  
  const filteredYears = matrixAvailableYears.filter(y => y >= startYear && y <= endYear); 
  const courses = globalFiltersMaster.courses; 
  const courseCounts = globalFiltersMaster.courseYearCounts || {}; 
  const catMap = globalFiltersMaster.courseCategoryMap || {};
  
  let groupedCourses = {}; 
  courses.forEach(c => { 
    let cat = catMap[c] || 'อื่นๆ'; 
    if (!groupedCourses[cat]) groupedCourses[cat] = []; 
    groupedCourses[cat].push(c); 
  });
  
  let html = `
    <table class="w-full text-sm border-collapse border border-slate-800 text-slate-800 mt-4">
      <thead>
        <tr>
          <th rowspan="2" class="border border-slate-800 p-3 bg-slate-100 w-1/4">หลักสูตร</th>
          <th colspan="${filteredYears.length}" class="border border-slate-800 p-2 bg-slate-100 text-center">ปีที่อบรม (จำนวนบุคลากรกีฬา)</th>
          <th rowspan="2" class="border border-slate-800 p-3 bg-slate-100 text-center w-20">รวม</th>
        </tr>
        <tr>${filteredYears.map(y => `<th class="border border-slate-800 p-2 text-center bg-slate-50 font-bold">${y}</th>`).join('')}</tr>
      </thead>
      <tbody>`;
      
  let grandTotal = 0; 
  let yearTotals = {}; 
  filteredYears.forEach(y => yearTotals[y] = 0);
  
  for (const [category, courseList] of Object.entries(groupedCourses)) {
    html += `<tr><td colspan="${filteredYears.length + 2}" class="border border-slate-800 p-2 font-bold bg-slate-200/70">${category}</td></tr>`;
    courseList.forEach(course => {
      let rowTotal = 0; 
      let rowHtml = `<td class="border border-slate-800 p-2 font-medium">${course}</td>`;
      filteredYears.forEach(year => { 
        let count = (courseCounts[course] && courseCounts[course][year]) ? courseCounts[course][year] : 0; 
        if (count > 0) { 
          rowTotal += count; 
          yearTotals[year] += count; 
          rowHtml += `<td class="border border-slate-800 p-2 text-center">${count}</td>`; 
        } else { 
          rowHtml += `<td class="border border-slate-800 p-2 text-center bg-gray-400"></td>`; 
        } 
      });
      if (rowTotal > 0 || filteredYears.length === matrixAvailableYears.length) { 
        grandTotal += rowTotal; 
        html += `<tr>${rowHtml}<td class="border border-slate-800 p-2 text-center font-bold">${rowTotal}</td></tr>`; 
      } else { 
        html += `<tr>${rowHtml}<td class="border border-slate-800 p-2 text-center font-bold text-slate-400">0</td></tr>`; 
      }
    });
  }
  
  html += `</tbody>
    <tfoot>
      <tr class="bg-slate-100">
        <td class="border border-slate-800 p-3 text-right font-bold">รวมทั้งสิ้น</td>
        ${filteredYears.map(y => `<td class="border border-slate-800 p-2 text-center font-bold text-blue-700">${yearTotals[y] || 0}</td>`).join('')}
        <td class="border border-slate-800 p-3 text-center font-extrabold text-lg text-blue-700">${grandTotal}</td>
      </tr>
    </tfoot>
  </table>`;
  
  if(container) container.innerHTML = html;
}

window.closeMatrixReport = function() { 
  const modal = document.getElementById('matrixModal');
  if(modal) modal.classList.add('hidden'); 
};

window.printMatrixReport = function() { 
  const modal = document.getElementById('matrixModal');
  if(modal) modal.classList.add('print-modal-active'); 
  window.print(); 
  if(modal) modal.classList.remove('print-modal-active'); 
};

window.exportMatrixToExcel = function() { 
  const table = document.querySelector('#matrixTableContainer table'); 
  if(!table) return alert('ไม่พบข้อมูลตาราง กรุณาลองใหม่อีกครั้ง'); 
  const clonedTable = table.cloneNode(true); 
  const cells = clonedTable.querySelectorAll('td.bg-gray-400'); 
  cells.forEach(cell => cell.textContent = ''); 
  const wb = XLSX.utils.table_to_book(clonedTable, {sheet: "Matrix_Report"}); 
  XLSX.writeFile(wb, "รายงานสรุปตารางไขว้_Matrix.xlsx"); 
};

window.openProposalReport = function(encodedCourseName, btnId) {
  const btn = document.getElementById(btnId); 
  const originalBtnHTML = btn.innerHTML;
  btn.innerHTML = `<svg class="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> กำลังสร้างรายงาน...`;
  
  setTimeout(() => {
    currentReportCourseBase64 = encodedCourseName; 
    const courseName = base64ToUtf8(encodedCourseName);
    
    let availableYears = new Set();
    cachedPersonnelData.forEach(u => { 
      if(u.trainings) {
        u.trainings.forEach(t => { 
          if(t.course === courseName && t.year) availableYears.add(String(t.year)); 
        });
      }
    });
    
    const yearFilter = document.getElementById('reportYearFilter');
    if(yearFilter) {
      let optionsHtml = '<option value="all">รวมทุกปี</option>';
      Array.from(availableYears).sort((a,b)=>b-a).forEach(y => { 
        optionsHtml += `<option value="${y}">เฉพาะปี ${y}</option>`; 
      });
      yearFilter.innerHTML = optionsHtml;
      yearFilter.value = 'all'; 
    }

    renderReportData(); 

    btn.innerHTML = originalBtnHTML; 
    const modal = document.getElementById('proposalModal');
    if(modal) modal.classList.remove('hidden');
  }, 400); 
};

window.renderReportData = function() {
  if(!currentReportCourseBase64) return;
  const courseName = base64ToUtf8(currentReportCourseBase64);
  const selectedYear = document.getElementById('reportYearFilter') ? document.getElementById('reportYearFilter').value : 'all';

  let courseUsers = cachedPersonnelData.filter(u => u.trainings && u.trainings.some(t => t.course === courseName));
  if(selectedYear !== 'all') { 
    courseUsers = courseUsers.filter(u => u.trainings.some(t => t.course === courseName && String(t.year) === selectedYear)); 
  }

  let displayCourseName = courseName;
  if(cachedProjectDetails && cachedProjectDetails[courseName] && cachedProjectDetails[courseName].fullCourseName) {
    displayCourseName = cachedProjectDetails[courseName].fullCourseName;
  }

  const elCourseName = document.getElementById('reportCourseName');
  if(elCourseName) elCourseName.textContent = displayCourseName + (selectedYear === 'all' ? ' (ภาพรวมทั้งหมด)' : ` (รุ่นปี ${selectedYear})`);

  let projectTargets = {};
  let totalTargetCount = 0;
  
  const pdOverview = document.getElementById('reportProjectOverview');
  
  if(cachedProjectDetails && cachedProjectDetails[courseName]) {
     if(pdOverview) pdOverview.classList.remove('hidden');
     const d = cachedProjectDetails[courseName];
     
     if(d.targets) {
        let targetList = d.targets.includes('||') ? d.targets.split('||') : d.targets.split(',').map(t=>t.trim()+'|0');
        const elTargetGroups = document.getElementById('reportTargetGroups');
        if(elTargetGroups) {
          elTargetGroups.innerHTML = targetList.map(t => {
              let [tName, tCount] = t.split('|');
              let countBadge = parseInt(tCount) > 0 ? `<span class="bg-blue-100 text-blue-800 ml-1 px-1.5 py-0.5 rounded text-[10px]">เป้า: ${tCount} คน</span>` : '';
              if(parseInt(tCount) > 0) { 
                projectTargets[tName] = parseInt(tCount); 
                totalTargetCount += parseInt(tCount); 
              }
              return `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-semibold flex items-center">${tName} ${countBadge}</span>`;
          }).join('');
        }
     } else { 
        const elTargetGroups = document.getElementById('reportTargetGroups');
        if(elTargetGroups) elTargetGroups.innerHTML = '-'; 
     }
     
     if(document.getElementById('titleStatSec')) document.getElementById('titleStatSec').textContent = "2. ข้อมูลสถิติและกลุ่มเป้าหมาย (Target Group Breakdown)";
     if(document.getElementById('titleImpSec')) document.getElementById('titleImpSec').textContent = "3. การติดตามการนำความรู้ไปปฏิบัติหน้าที่ (Implementation Tracking)";
     if(document.getElementById('titleExecSec')) document.getElementById('titleExecSec').textContent = "4. บทสรุปผู้บริหารและการวิเคราะห์ภาพรวม (Executive Summary)";
  } else {
     if(pdOverview) pdOverview.classList.add('hidden');
     if(document.getElementById('titleStatSec')) document.getElementById('titleStatSec').textContent = "1. ข้อมูลสถิติและกลุ่มเป้าหมาย (Target Group Breakdown)";
     if(document.getElementById('titleImpSec')) document.getElementById('titleImpSec').textContent = "2. การติดตามการนำความรู้ไปปฏิบัติหน้าที่ (Implementation Tracking)";
     if(document.getElementById('titleExecSec')) document.getElementById('titleExecSec').textContent = "3. บทสรุปผู้บริหารและการวิเคราะห์ภาพรวม (Executive Summary)";
  }

  const totalPeople = courseUsers.length; 
  const activePeople = courseUsers.filter(u => u.status !== 'พ้นสภาพ').length; 
  const retentionPercent = totalPeople > 0 ? Math.round((activePeople/totalPeople)*100) + '%' : '0%';
  
  if(document.getElementById('reportTotal')) document.getElementById('reportTotal').textContent = totalPeople; 
  if(document.getElementById('reportActive')) document.getElementById('reportActive').textContent = activePeople; 
  if(document.getElementById('reportRetention')) document.getElementById('reportRetention').textContent = retentionPercent;

  let groupStats = {}; 
  courseUsers.forEach(u => { 
    let g = u.group || 'ไม่ระบุกลุ่มหน่วยงาน'; 
    if(!groupStats[g]) groupStats[g] = { total: 0, active: 0 }; 
    groupStats[g].total++; 
    if(u.status !== 'พ้นสภาพ') groupStats[g].active++; 
  });
  
  let allGroupNames = new Set([...Object.keys(groupStats), ...Object.keys(projectTargets)]);
  let groupHtml = Array.from(allGroupNames).map(gName => {
      let stat = groupStats[gName] || { total: 0, active: 0 };
      let target = projectTargets[gName] || 0;
      let ret = stat.total > 0 ? Math.round((stat.active/stat.total)*100) : 0;
      
      let targetBadge = target > 0 ? `<span class="text-xs text-slate-500 mr-3">เป้าหมาย: <span class="font-bold text-slate-700">${target}</span></span>` : '';
      let actualBadge = `<span class="font-bold text-slate-800">${stat.total}</span> คน`;
      let achievePercent = target > 0 ? Math.round((stat.total/target)*100) : 0;
      let achieveBadge = target > 0 ? `<span class="text-[10px] ml-2 ${achievePercent >= 100 ? 'text-emerald-600' : 'text-amber-600'}">(${achievePercent}% ของเป้า)</span>` : '';

      return `
      <div class="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
        <span class="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-blue-500"></span> ${gName}
        </span>
        <div class="text-sm flex items-center">
          ${targetBadge}
          <span>เข้าร่วมจริง: ${actualBadge} ${achieveBadge}</span>
          <span class="text-[11px] font-bold text-emerald-600 ml-3 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">ทำงานต่อ ${stat.active} (${ret}%)</span>
        </div>
      </div>`;
  }).join('');
  
  if(document.getElementById('reportGroupBreakdown')) document.getElementById('reportGroupBreakdown').innerHTML = groupHtml || '<p class="text-sm text-slate-400">ไม่มีข้อมูลกลุ่มเป้าหมาย</p>';

  let roleStats = {}; let sportStats = {}; let recentEvents = [];
  courseUsers.forEach(u => { 
    if(u.duties && u.duties.length > 0) { 
      u.duties.forEach(d => { 
        let r = d.role || 'ไม่ระบุ'; 
        let s = d.sport || 'ไม่ระบุ'; 
        roleStats[r] = (roleStats[r] || 0) + 1; 
        sportStats[s] = (sportStats[s] || 0) + 1; 
        if(d.event) recentEvents.push(`${d.event} (ปี ${d.year || 'ไม่ระบุ'})`); 
      }); 
    } 
  });
  
  let sortedRoles = Object.entries(roleStats).sort((a,b)=>b[1]-a[1]); 
  let sortedSports = Object.entries(sportStats).sort((a,b)=>b[1]-a[1]); 
  
  let topRole = (sortedRoles.length > 0 && sortedRoles[0][0]) ? sortedRoles[0][0] : 'หลายบทบาท'; 
  let topSport = (sortedSports.length > 0 && sortedSports[0][0]) ? sortedSports[0][0] : 'หลายชนิดกีฬา';
  
  let implHtml = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
        <h4 class="text-xs font-bold text-slate-500 mb-3 uppercase flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg> 
          บทบาทหน้าที่หลัก (Top Roles)
        </h4>
        <ul class="text-sm space-y-2">
          ${sortedRoles.slice(0,3).map(r => `<li class="flex justify-between border-b border-slate-200 border-dashed pb-1"><span class="font-medium text-slate-700">${r[0]}</span> <span class="text-blue-600 font-bold">${r[1]} คน</span></li>`).join('') || '<li class="text-slate-400 italic">ยังไม่มีข้อมูลลงพื้นที่ปฏิบัติหน้าที่</li>'}
        </ul>
      </div>
      <div class="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
        <h4 class="text-xs font-bold text-slate-500 mb-3 uppercase flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> 
          ชนิดกีฬาที่ปฏิบัติงาน (Top Sports)
        </h4>
        <ul class="text-sm space-y-2">
          ${sortedSports.slice(0,3).map(s => `<li class="flex justify-between border-b border-slate-200 border-dashed pb-1"><span class="font-medium text-slate-700">${s[0]}</span> <span class="text-blue-600 font-bold">${s[1]} ครั้ง</span></li>`).join('') || '<li class="text-slate-400 italic">ยังไม่มีข้อมูลลงพื้นที่ปฏิบัติหน้าที่</li>'}
        </ul>
      </div>
    </div>`;
    
  if(recentEvents.length > 0) { 
    const uniqueEvents = [...new Set(recentEvents)].slice(0, 3); 
    implHtml += `<div class="mt-4 text-sm text-slate-600"><strong>ตัวอย่างการปฏิบัติงาน:</strong> ${uniqueEvents.join(', ')}</div>`; 
  }
  
  if(document.getElementById('reportImplementation')) document.getElementById('reportImplementation').innerHTML = implHtml;

  let feedbacks = []; 
  courseUsers.forEach(u => { if (u.evals) u.evals.forEach(e => feedbacks.push(e.feedback)); }); 
  let recentFeedbacks = feedbacks.slice(-3);
  
  let summaryText = `จากข้อมูลในระบบทะเบียนบุคลากรกีฬาพบว่า ผู้ผ่านการอบรมหลักสูตร <span class="font-bold text-blue-600">${displayCourseName}</span> `;
  if(selectedYear !== 'all') {
    summaryText += `(เฉพาะผู้ที่อบรมในปี <span class="font-bold text-blue-600">${selectedYear}</span>) `;
  }
  
  if(totalTargetCount > 0) {
      let achievePct = Math.round((totalPeople / totalTargetCount) * 100);
      summaryText += `มีผู้เข้าร่วมจริง <span class="font-bold text-blue-600">${totalPeople}</span> คน (คิดเป็น ${achievePct}% จากเป้าหมายรวม ${totalTargetCount} คน) `;
  } else { 
      summaryText += `มีผู้เข้าร่วมจริง <span class="font-bold text-blue-600">${totalPeople}</span> คน `; 
  }

  summaryText += `และมีอัตราการปฏิบัติหน้าที่คงอยู่ในระบบภาพรวมที่ <span class="font-bold text-emerald-600">${retentionPercent}</span> `;
  
  if(sortedRoles.length > 0) { 
    summaryText += `โดยส่วนใหญ่นำความรู้ไปประยุกต์ใช้ในหน้าที่ <span class="font-bold text-blue-600">${topRole}</span> เป็นหลัก และมีการกระจายตัวลงพื้นที่ปฏิบัติงานในชนิดกีฬา <span class="font-bold text-blue-600">${topSport}</span> มากที่สุด `; 
  } else { 
    summaryText += `อย่างไรก็ตาม ขณะนี้ยังอยู่ในช่วงการติดตามเก็บสถิติการลงพื้นที่ปฏิบัติงานจริงของกลุ่มเป้าหมายเพื่อตอบชี้วัดของโครงการต่อไป `; 
  }
  
  summaryText += recentFeedbacks.length > 0 ? `นอกจากนี้ ข้อคิดเห็นและข้อเสนอแนะเชิงธรรมาภิบาลจากผู้ใช้งานระบบได้ระบุประเด็นที่น่าสนใจดังนี้:` : `(ยังไม่มีการประเมินหรือข้อเสนอแนะเพิ่มเติมในขณะนี้)`;

  let summaryHtml = `<p class="text-sm leading-relaxed text-slate-800 bg-blue-50/70 p-5 rounded-xl border border-blue-200 shadow-sm">${summaryText}</p>`;
  if (recentFeedbacks.length > 0) { 
    summaryHtml += `<div class="mt-4 space-y-3">` + recentFeedbacks.map(f => `<div class="text-sm italic text-slate-600 border-l-4 border-blue-400 bg-slate-50 pl-4 py-2 shadow-sm rounded-r-lg">"${f}"</div>`).join('') + `</div>`; 
  }
  
  if(document.getElementById('reportExecutiveSummary')) document.getElementById('reportExecutiveSummary').innerHTML = summaryHtml;
};

window.closeProposalReport = function() { 
  const modal = document.getElementById('proposalModal');
  if(modal) modal.classList.add('hidden'); 
  currentReportCourseBase64 = null; 
};

window.printProposalReport = function() { 
  const modal = document.getElementById('proposalModal');
  if(modal) modal.classList.add('print-modal-active'); 
  window.print(); 
  if(modal) modal.classList.remove('print-modal-active'); 
};

function updateSmartSummary(course, year, totalCount) { 
  const badge = document.getElementById('smartInsightBadge'); 
  const textEl = document.getElementById('smartInsightText'); 
  
  if (!course && !year) { 
    if(badge) badge.classList.add('hidden'); 
    return; 
  } 
  
  if(badge) { badge.classList.remove('hidden'); badge.classList.add('flex'); }
  
  if(textEl) {
    if (course && year) { 
      textEl.innerHTML = `สรุปข้อมูล: หลักสูตร <span class="font-bold">${course}</span> ประจำปี <span class="font-bold">${year}</span> มีผู้ผ่านการอบรม <span class="font-bold text-lg mx-1">${totalCount}</span> คน`; 
    } else if (course) { 
      textEl.innerHTML = `สรุปข้อมูล: หลักสูตร <span class="font-bold">${course}</span> มีผู้ผ่านการอบรมรวม <span class="font-bold text-lg mx-1">${totalCount}</span> คน`; 
    } else if (year) { 
      textEl.innerHTML = `สรุปข้อมูล: ภาพรวมปี <span class="font-bold">${year}</span> มีผู้ผ่านการอบรมรวม <span class="font-bold text-lg mx-1">${totalCount}</span> คน`; 
    } 
  }
}

function renderTablePage() {
  const tbody = document.getElementById('tableBody'); 
  const paginationInfo = document.getElementById('tablePaginationInfo');
  
  if (currentFilteredData.length === 0) { 
    if(tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-slate-500 font-medium">ไม่พบข้อมูล</td></tr>`; 
    if (paginationInfo) paginationInfo.innerHTML = `ไม่มีรายการแสดงผล`; 
    renderPaginationNav(0); 
    return; 
  }
  
  const totalItems = currentFilteredData.length; 
  const totalPages = Math.ceil(totalItems / itemsPerPage); 
  const startIndex = (currentPage - 1) * itemsPerPage; 
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems); 
  const pageData = currentFilteredData.slice(startIndex, endIndex);

  if(tbody) {
    tbody.innerHTML = pageData.map(item => {
      const initials = item.fullName.substring(0, 2).toUpperCase() || 'U';
      const isResigned = item.status === 'พ้นสภาพ';
      
      let statusBadge = '';
      if (isAdmin) {
        statusBadge = `
        <select onchange="updatePersonnelStatus('${item.uid}', this.value, this)" class="text-xs font-bold bg-white border ${isResigned ? 'border-slate-300 text-slate-500' : 'border-amber-300 text-amber-600'} rounded-full px-2 py-1.5 outline-none cursor-pointer shadow-sm text-center w-[110px] mx-auto block transition-colors">
          <option value="ปฏิบัติงาน" ${!isResigned ? 'selected' : ''}>🟢 ปฏิบัติงาน</option>
          <option value="พ้นสภาพ" ${isResigned ? 'selected' : ''}>⚪ พ้นสภาพ</option>
        </select>`;
      } else {
        statusBadge = isResigned ? 
          `<span class="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-medium border border-slate-300 text-slate-500 bg-white w-[110px]"><span class="w-1.5 h-1.5 rounded-full mr-2 bg-slate-400"></span>พ้นสภาพ</span>` : 
          `<span class="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-medium border border-amber-300 text-amber-600 bg-white w-[110px]"><span class="w-1.5 h-1.5 rounded-full mr-2 bg-amber-500"></span>ปฏิบัติงาน</span>`;
      }

      const btnText = isAdmin ? 
        `<svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> จัดการ` : 
        `<svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> ดูประวัติ`;

      return `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="px-6 py-4 text-blue-600 font-medium text-sm">${item.uid}</td>
          <td class="px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">${initials}</div>
              <div class="text-slate-700 font-medium text-sm">${item.fullName}</div>
            </div>
          </td>
          <td class="px-6 py-4 text-slate-600 text-sm truncate max-w-[200px]">${item.agency}</td>
          <td class="px-6 py-4 text-center">${statusBadge}</td>
          <td class="px-6 py-4 text-center">
            <button onclick="viewProfile('${item.uid}')" class="${isAdmin?'text-amber-500 hover:bg-amber-50':'text-blue-500 hover:bg-blue-50'} p-2 rounded-lg font-bold text-xs flex items-center justify-center mx-auto transition-colors cursor-pointer">
              ${btnText}
            </button>
          </td>
        </tr>`;
    }).join('');
  }
  
  if (paginationInfo) paginationInfo.innerHTML = `แสดงรายการที่ <span class="font-bold text-slate-800 mx-1">${startIndex + 1} - ${endIndex}</span> จากทั้งหมด <span class="font-bold text-slate-800 mx-1">${totalItems}</span> รายการ`; 
  
  renderPaginationNav(totalPages);
}

function renderPaginationNav(totalPages) {
  const nav = document.getElementById('paginationNav'); 
  if (!nav || totalPages === 0) { 
    if(nav) nav.innerHTML = ''; 
    return; 
  }
  
  nav.innerHTML = `
    <button type="button" onclick="changePage(${currentPage - 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPage === 1 ? 'disabled' : ''}>
      <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg> ก่อนหน้า
    </button>
    <span class="text-sm font-semibold text-blue-600 px-4">หน้า ${currentPage}/${totalPages}</span>
    <button type="button" onclick="changePage(${currentPage + 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPage === totalPages ? 'disabled' : ''}>
      ถัดไป <svg class="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
    </button>`;
}

window.changePage = function(newPage) { 
  const totalPages = Math.ceil(currentFilteredData.length / itemsPerPage); 
  if (newPage >= 1 && newPage <= totalPages) { 
    currentPage = newPage; 
    renderTablePage(); 
  } 
};

function renderTimeline(relations, years, courses) {
  const container = document.getElementById('timelineCardsContainer'); 
  if (!container) return;
  
  if (!courses || courses.length === 0) { 
    container.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">ไม่พบข้อมูลหลักสูตรสำหรับสร้างไทม์ไลน์</div>`; 
    return; 
  }
  
  container.innerHTML = courses.map((course, idx) => {
    const activeYearsMap = relations.courseToYears[course] || {}; 
    const activeYears = Object.keys(activeYearsMap).map(y => parseInt(y)).sort((a, b) => a - b);
    
    if (activeYears.length === 0) return ''; 
    
    const firstYear = activeYears[0]; 
    const lastYear = activeYears[activeYears.length - 1]; 
    let missingYears = []; 
    
    for (let y = firstYear; y <= lastYear; y++) { 
      if (!activeYearsMap[y]) missingYears.push(y); 
    }
    
    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow space-y-5">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-4">
          <div>
            <span class="text-xs font-semibold text-blue-600 uppercase tracking-wider">หลักสูตรที่ #${idx + 1}</span>
            <h3 class="text-lg font-bold text-slate-800 mt-0.5">${course}</h3>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg">ช่วงเวลา: <span class="text-blue-600">${firstYear} - ${lastYear}</span></span>
            <span class="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-100">จัดทั้งหมด ${activeYears.length} ปี</span>
          </div>
        </div>
        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">✅ ปีที่มีการเปิดอบรม:</p>
          <div class="flex flex-wrap gap-2">
            ${activeYears.map(y => `<div class="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-sm"><svg class="w-3.5 h-3.5 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4.5 12.75l6 6 9-13.5" /></svg>ปี ${y}</div>`).join('')}
          </div>
        </div>
        ${missingYears.length > 0 ? `
        <div class="pt-3 border-t border-slate-100">
          <p class="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">⚠️ ปีที่เว้นช่วงการจัด (Gap):</p>
          <div class="flex flex-wrap gap-2">
            ${missingYears.map(my => `<span class="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1 rounded-lg">ปี ${my} (งดจัด)</span>`).join('')}
          </div>
        </div>` : `
        <div class="pt-3 border-t border-slate-100 text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
          <span>✨ จัดอบรมต่อเนื่องทุกปีโดยไม่มีช่วงว่าง</span>
        </div>`}
      </div>`;
  }).join('');
}

function formatThaiName(rawPrefix, rawName) {
  let prefix = String(rawPrefix || '').trim(); 
  let name = String(rawName || '').trim();
  
  name = name.replace(/[\u200B-\u200D\uFEFF\r\n]/g, ''); 
  prefix = prefix.replace(/[\u200B-\u200D\uFEFF\r\n]/g, '');
  
  const prefixList = ["ว่าที่ ร.ต.", "ว่าที่ร.ต.", "พล.ต.อ.", "พล.ต.ท.", "พล.ต.ต.", "พ.ต.อ.", "พ.ต.ท.", "พ.ต.ต.", "ร.ต.อ.", "ร.ต.ท.", "ร.ต.ต.", "ศ.ดร.", "รศ.ดร.", "ผศ.ดร.", "ดร.", "ศ.", "รศ.", "ผศ.", "นางสาว", "น.ส.", "นาย", "นาง", "พลฯ", "จ.ส.อ.", "จ.ส.ท.", "จ.ส.ต.", "ส.อ.", "ส.ท.", "ส.ต."];
  
  for (let p of prefixList) { 
    if (name.startsWith(p)) { 
      prefix = p; 
      name = name.substring(p.length).trim(); 
      break; 
    } 
  }
  
  if (prefix === "น.ส.") prefix = "นางสาว"; 
  name = name.split(/\s+/).join(' ');
  return { prefix: prefix, fullName: name };
}

function isSmartMatch(importName, existingName) {
  let cleanImp = String(importName).replace(/[\u200B-\u200D\uFEFF\r\n]/g, '').toLowerCase(); 
  let cleanExt = String(existingName).replace(/[\u200B-\u200D\uFEFF\r\n]/g, '').toLowerCase();
  
  let noSpaceImp = cleanImp.replace(/\s+/g, ''); 
  let noSpaceExt = cleanExt.replace(/\s+/g, '');
  
  if (noSpaceImp === noSpaceExt) return true;
  
  let impKeywords = cleanImp.split(/\s+/).filter(k => k.length > 2); 
  let extKeywords = cleanExt.split(/\s+/).filter(k => k.length > 2);
  
  if (impKeywords.length > 0 && extKeywords.length > 0) { 
    if (impKeywords.every(kw => noSpaceExt.includes(kw)) || extKeywords.every(kw => noSpaceImp.includes(kw))) return true; 
  }
  
  return false;
}

function calculateSimilarity(str1, str2) {
  let s1 = String(str1).toLowerCase().replace(/\s+/g, '').trim(); 
  let s2 = String(str2).toLowerCase().replace(/\s+/g, '').trim();
  
  if (s1 === s2) return 1.0; 
  let longer = s1; 
  let shorter = s2; 
  if (s1.length < s2.length) { longer = s2; shorter = s1; } 
  let longerLength = longer.length; 
  if (longerLength === 0) return 1.0;
  
  let costs = new Array();
  for (let i = 0; i <= s1.length; i++) { 
    let lastValue = i; 
    for (let j = 0; j <= s2.length; j++) { 
      if (i === 0) { 
        costs[j] = j; 
      } else { 
        if (j > 0) { 
          let newValue = costs[j - 1]; 
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) { 
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1; 
          } 
          costs[j - 1] = lastValue; 
          lastValue = newValue; 
        } 
      } 
    } 
    if (s2.length > 0) costs[s2.length] = lastValue; 
  }
  return (longerLength - costs[s2.length]) / longerLength;
}

function setupDragAndDrop() {
  const dropZone = document.getElementById('dragDropZone'); 
  if(!dropZone) return;
  
  dropZone.addEventListener('dragover', (e) => { 
    e.preventDefault(); 
    dropZone.classList.add('border-blue-500', 'bg-blue-50'); 
  }); 
  dropZone.addEventListener('dragleave', () => { 
    dropZone.classList.remove('border-blue-500', 'bg-blue-50'); 
  }); 
  dropZone.addEventListener('drop', (e) => { 
    e.preventDefault(); 
    dropZone.classList.remove('border-blue-500', 'bg-blue-50'); 
    if(e.dataTransfer.files.length > 0) processExcelFile(e.dataTransfer.files[0], null); 
  });
}

function processExcelFile(file, inputElement) {
  if (!file) return; 
  const reader = new FileReader();
  
  reader.onload = function(event) {
    try {
      const data = new Uint8Array(event.target.result); 
      const workbook = XLSX.read(data, {type: 'array'}); 
      const jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      
      if (jsonRows.length > 0 && !('ชื่อ-นามสกุล' in jsonRows[0])) { 
        alert("❌ โครงสร้างไฟล์ผิดพลาด กรุณาใช้ไฟล์ Template มาตรฐาน"); 
        if(inputElement) inputElement.value = ''; 
        return; 
      }
      if (jsonRows.length === 0) { 
        alert("⚠️ ไม่พบข้อมูลในไฟล์ Excel"); 
        if(inputElement) inputElement.value = ''; 
        return; 
      }

      let cleanedRows = jsonRows.map((row, index) => {
        let formatted = formatThaiName(row['คำนำหน้า'], row['ชื่อ-นามสกุล']); 
        let matchedExisting = null; 
        let matchType = 'new'; 
        
        let smartFound = cachedPersonnelData.find(p => isSmartMatch(formatted.fullName, p.fullName));
        
        if (smartFound) { 
          matchedExisting = smartFound; 
          matchType = 'exact'; 
        } else { 
          for (let p of cachedPersonnelData) { 
            let sim = calculateSimilarity(p.fullName, formatted.fullName); 
            if (sim >= 0.75 && sim < 1.0) { 
              matchedExisting = p; 
              matchType = 'fuzzy'; 
              break; 
            } 
          } 
        }
        
        return { 
          originalIndex: index, 
          'คำนำหน้า': formatted.prefix, 
          'ชื่อ-นามสกุล': formatted.fullName, 
          'กลุ่มหน่วยงาน': row['กลุ่มหน่วยงาน'] || '', 
          'หน่วยงาน': String(row['หน่วยงาน'] || '').replace(/\s+/g, ' ').trim(), 
          'สถานะ': row['สถานะ'] || 'ปฏิบัติงาน', 
          'ชื่อหลักสูตร': row['ชื่อหลักสูตร'] || '', 
          'ปีที่อบรม': row['ปีที่อบรม'] || '', 
          matchType: matchType, 
          matchedUser: matchedExisting, 
          actionType: matchType === 'exact' ? 'merge' : 'auto' 
        };
      });
      
      pendingImportData = cleanedRows; 
      showPreviewSection();
    } catch (error) { 
      alert("❌ เกิดข้อผิดพลาดในการอ่านไฟล์"); 
    } 
    if(inputElement) inputElement.value = ''; 
  };
  reader.readAsArrayBuffer(file);
}

window.submitSingleEntry = function() {
  const pPrefix = document.getElementById('singlePrefix').value; 
  const pName = document.getElementById('singleFullName').value; 
  const pGroup = document.getElementById('singleGroup').value; 
  const pAgency = document.getElementById('singleAgency').value; 
  const pCourse = document.getElementById('singleCourse').value; 
  const pYear = document.getElementById('singleYear').value;
  
  if(!pName || !pAgency) { alert('⚠️ กรุณากรอก ชื่อ-นามสกุล และ หน่วยงาน ให้ครบถ้วน'); return; }

  let formatted = formatThaiName(pPrefix, pName); 
  let matchedExisting = null; 
  let matchType = 'new'; 
  let smartFound = cachedPersonnelData.find(p => isSmartMatch(formatted.fullName, p.fullName));
  
  if (smartFound) { 
    matchedExisting = smartFound; 
    matchType = 'exact'; 
  } else { 
    for (let p of cachedPersonnelData) { 
      let sim = calculateSimilarity(p.fullName, formatted.fullName); 
      if (sim >= 0.75 && sim < 1.0) { 
        matchedExisting = p; 
        matchType = 'fuzzy'; 
        break; 
      } 
    } 
  }

  pendingImportData = [{ 
    originalIndex: 0, 
    'คำนำหน้า': formatted.prefix, 
    'ชื่อ-นามสกุล': formatted.fullName, 
    'กลุ่มหน่วยงาน': pGroup, 
    'หน่วยงาน': pAgency, 
    'สถานะ': 'ปฏิบัติงาน', 
    'ชื่อหลักสูตร': pCourse, 
    'ปีที่อบรม': pYear, 
    matchType: matchType, 
    matchedUser: matchedExisting, 
    actionType: matchType === 'exact' ? 'merge' : 'auto' 
  }];
  
  document.getElementById('singlePrefix').value = ''; 
  document.getElementById('singleFullName').value = ''; 
  document.getElementById('singleGroup').value = ''; 
  document.getElementById('singleAgency').value = ''; 
  document.getElementById('singleCourse').value = ''; 
  document.getElementById('singleYear').value = ''; 
  
  showPreviewSection();
};

function showPreviewSection() { 
  document.getElementById('importUploadSection').classList.add('hidden'); 
  document.getElementById('importPreviewSection').classList.remove('hidden'); 
  currentPreviewPage = 1; 
  renderPreviewTablePage(); 
}

function renderPreviewTablePage() {
  const tbody = document.getElementById('previewTableBody'); 
  const previewInfo = document.getElementById('previewPaginationInfo');
  const totalItems = pendingImportData.length; 
  const totalPages = Math.ceil(totalItems / previewItemsPerPage); 
  const startIndex = (currentPreviewPage - 1) * previewItemsPerPage; 
  const endIndex = Math.min(startIndex + previewItemsPerPage, totalItems); 
  const pageData = pendingImportData.slice(startIndex, endIndex);

  if(document.getElementById('previewTotalText')) document.getElementById('previewTotalText').innerHTML = `พบข้อมูลที่รอยืนยัน <span class="font-bold text-blue-600">${totalItems}</span> รายการ`;
  
  if(tbody) {
    tbody.innerHTML = pageData.map((row, idx) => {
      let badgeHtml = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold">✨ บุคคลใหม่</span>`; 
      let targetUidVal = '';
      
      if (row.matchType === 'exact') { 
        badgeHtml = `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold">🔄 อัปเดตคนเดิม (${row.matchedUser.fullName})</span>`; 
        targetUidVal = row.matchedUser.uid; 
      } else if (row.matchType === 'fuzzy') { 
        badgeHtml = `
        <div class="space-y-1.5">
          <span class="inline-block bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded text-[11px] font-semibold">⚠️ ชื่อคล้าย: ${row.matchedUser.fullName}</span>
          <select onchange="updateImportAction(${startIndex + idx}, this.value)" class="w-full text-xs bg-slate-50 border border-slate-300 rounded p-1.5 outline-none font-medium text-slate-700">
            <option value="auto" ${row.actionType === 'auto' ? 'selected' : ''}>-- กรุณาเลือก --</option>
            <option value="merge" ${row.actionType === 'merge' ? 'selected' : ''}>🔗 รวมประวัติคนเดิม</option>
            <option value="new" ${row.actionType === 'new' ? 'selected' : ''}>➕ สร้างใหม่แยก</option>
          </select>
        </div>`; 
        targetUidVal = row.matchedUser.uid; 
      }
      
      return `
        <tr class="hover:bg-slate-50 align-top border-b border-slate-100">
          <td class="px-4 py-3.5 border-r border-slate-100 text-center font-mono text-xs text-slate-400">${startIndex + idx + 1}</td>
          <td class="px-4 py-3.5 border-r border-slate-100 font-medium text-slate-800">${row['คำนำหน้า']} ${row['ชื่อ-นามสกุล']}</td>
          <td class="px-4 py-3.5 border-r border-slate-100 truncate max-w-[180px]">${row['หน่วยงาน'] || '-'}</td>
          <td class="px-4 py-3.5 border-r border-slate-100 text-center"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">${row['สถานะ']}</span></td>
          <td class="px-4 py-3.5 border-r border-slate-100">${row['ชื่อหลักสูตร'] || '-'} <span class="text-xs text-slate-400">(${row['ปีที่อบรม'] || '-'})</span></td>
          <td class="px-4 py-3.5 text-center">
            <input type="hidden" id="targetUid_${startIndex + idx}" value="${targetUidVal}">
            ${badgeHtml}
          </td>
        </tr>`;
    }).join('');
  }
  
  if (previewInfo) previewInfo.innerHTML = `แสดงรายการที่ <span class="font-bold text-slate-800 mx-1">${startIndex + 1} - ${endIndex}</span> จากทั้งหมด <span class="font-bold text-slate-800 mx-1">${totalItems}</span> รายการ`; 
  renderPreviewPaginationNav(totalPages);
}

window.updateImportAction = function(absoluteIndex, choice) { 
  if (pendingImportData[absoluteIndex]) { 
    pendingImportData[absoluteIndex].actionType = choice; 
  } 
};

function renderPreviewPaginationNav(totalPages) {
  const nav = document.getElementById('previewPaginationNav'); 
  if (!nav || totalPages === 0) { if(nav) nav.innerHTML = ''; return; }
  
  nav.innerHTML = `
    <button type="button" onclick="changePreviewPage(${currentPreviewPage - 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPreviewPage === 1 ? 'disabled' : ''}>
      <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg> ก่อนหน้า
    </button>
    <span class="text-sm font-semibold text-blue-600 px-4">หน้า ${currentPreviewPage}/${totalPages}</span>
    <button type="button" onclick="changePreviewPage(${currentPreviewPage + 1})" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm" ${currentPreviewPage === totalPages ? 'disabled' : ''}>
      ถัดไป <svg class="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
    </button>`;
}

window.changePreviewPage = function(newPage) { 
  const totalPages = Math.ceil(pendingImportData.length / previewItemsPerPage); 
  if (newPage >= 1 && newPage <= totalPages) { 
    currentPreviewPage = newPage; 
    renderPreviewTablePage(); 
  } 
};

window.cancelImport = function() { 
  pendingImportData = []; 
  const pSection = document.getElementById('importPreviewSection');
  if(pSection) pSection.classList.add('hidden'); 
  const uSection = document.getElementById('importUploadSection');
  if(uSection) uSection.classList.remove('hidden'); 
};

window.confirmImport = async function() {
  if (!pendingImportData || pendingImportData.length === 0) return;
  
  const processedRows = pendingImportData.map((row, idx) => { 
    const targetUidInput = document.getElementById(`targetUid_${idx}`); 
    return { ...row, targetUid: targetUidInput ? targetUidInput.value : '' }; 
  });
  
  const btn = document.getElementById('btnConfirmImport'); 
  if(!btn) return;
  const originalText = btn.innerHTML; 
  btn.innerHTML = `กำลังบันทึก...`; 
  btn.disabled = true;
  
  try {
    const response = await fetch(API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ action: 'bulkImport', rows: processedRows }), 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' } 
    });
    const result = await response.json();
    if (result.status === 'success') { 
      alert(`✅ ${result.message}`); 
      globalFiltersMaster = null; 
      fetchData(); 
      cancelImport(); 
      switchPage('search'); 
    } else { 
      alert(`❌ เกิดข้อผิดพลาด: ${result.message}`); 
    }
  } catch (error) { 
    alert("❌ การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง"); 
  }
  
  btn.innerHTML = originalText; 
  btn.disabled = false;
};

function showLoadingState() { 
  const tbody = document.getElementById('tableBody'); 
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-blue-500 font-medium">กำลังโหลดข้อมูล...</td></tr>`; 
}

function showErrorState(message) { 
  const tbody = document.getElementById('tableBody'); 
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-16 text-center text-red-400 font-medium">❌ ${message}</td></tr>`; 
  
  const elTotal = document.getElementById('stat-total');
  const elYear = document.getElementById('stat-top-year');
  const elCourse = document.getElementById('stat-top-course');
  
  if(elTotal) elTotal.textContent = 'Err';
  if(elYear) elYear.textContent = 'Err';
  if(elCourse) elCourse.textContent = message;
}
