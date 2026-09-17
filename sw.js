// อัปเดตเวอร์ชัน Cache เป็น v2 เพื่อบังคับให้เบราว์เซอร์ล้างข้อมูลเก่าที่มีปัญหาทิ้ง
const CACHE_NAME = 'sports-hr-cache-v2';
const DATA_CACHE_NAME = 'sports-hr-data-cache-v2';

// ไฟล์ที่ต้องการให้โหลดแบบออฟไลน์และแสดงผลทันที (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/main.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0'
];

// 1. Install Event: ติดตั้ง Service Worker และแคชไฟล์ UI เริ่มต้น
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker v2...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching App Shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event: ล้าง Cache รุ่น v1 ทิ้งทั้งหมดเพื่อป้องกันบั๊ก
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker v2...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== DATA_CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. Fetch Event: ดักจับการส่ง Request
self.addEventListener('fetch', (event) => {
  // 🌟 สำหรับ API ฐานข้อมูล: เปลี่ยนมาใช้กลยุทธ์ "Network First, falling back to cache"
  if (event.request.url.includes('script.google.com') && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // ดักจับ: ถ้าตอบกลับมาสมบูรณ์ (200) ค่อยเอาใส่ Cache
          if (networkResponse && networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(event.request, clonedResponse);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // ถ้าเน็ตหลุด หรือดึงจาก Network ไม่สำเร็จ ค่อยควักข้อมูลจาก Cache ออกมาใช้
          console.warn('[Service Worker] Network failed, fetching from cache...');
          return caches.match(event.request);
        })
    );
  } else {
    // 🌟 สำหรับไฟล์หน้าตาเว็บ (HTML, CSS, JS): ใช้กลยุทธ์ "Cache First" ตามเดิมเพื่อความรวดเร็ว
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});
