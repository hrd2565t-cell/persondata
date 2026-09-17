// ชื่อและเวอร์ชันของ Cache (หากมีการเปลี่ยนโครงสร้างไฟล์ ให้เปลี่ยนเลข v1 เป็น v2)
const CACHE_NAME = 'sports-hr-cache-v1';
const DATA_CACHE_NAME = 'sports-hr-data-cache-v1';

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
  console.log('[Service Worker] Installing Service Worker ...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching App Shell');
        // ใช้ addAll เพื่อโหลดไฟล์ UI มาเก็บไว้ในเครื่อง
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event: ล้าง Cache เก่าทิ้งเมื่อมีการอัปเดตเวอร์ชัน
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker ...');
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

// 3. Fetch Event: ดักจับการส่ง Request ทุกครั้ง
self.addEventListener('fetch', (event) => {
  // ดักจับเฉพาะ Request ที่เป็นการเรียก API ไปที่ Google Apps Script (GET requests)
  if (event.request.url.includes('script.google.com') && event.request.method === 'GET') {
    event.respondWith(
      // 🌟 ใช้กลยุทธ์ "Stale-While-Revalidate" สำหรับข้อมูล API
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchedResponse = fetch(event.request).then((networkResponse) => {
            // อัปเดต Cache เงียบๆ เมื่อได้ข้อมูลใหม่จาก Network
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          // คืนค่า Cache ทันทีถ้ามี (ไวมาก) หรือรอ Network ถ้ายังไม่มี Cache
          return cachedResponse || fetchedResponse;
        });
      })
    );
  } else {
    // 🌟 ใช้กลยุทธ์ "Cache First, falling back to network" สำหรับไฟล์ UI ทั่วไป
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});
