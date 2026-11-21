# TM-Lingo — Hướng dẫn đóng gói Android (Capacitor) · Pha 7

> **Mục tiêu**: Đóng gói ứng dụng web Next.js 15 + PWA **TM-Lingo** thành ứng dụng Android (APK / AAB) sử dụng **Capacitor** mà không cần duy trì codebase UI thứ hai.

## 1. Kiến trúc đóng gói
- **Single Codebase**: Toàn bộ giao diện học tập cho trẻ (3–5 tuổi), Story Reader, Parent Panel và Offline IndexedDB Queue chạy thống nhất trên Next.js 15.
- **Hosted WebView Mode**: `capacitor.config.ts` trỏ `server.url` về URL production HTTPS (`CAPACITOR_SERVER_URL` hoặc `APP_BASE_URL`) để tận dụng toàn bộ Next.js API Routes (`/api/v1/*`), Firebase Auth và cập nhật học liệu từ CMS tức thì mà không phải nộp lại bản build lên Google Play mỗi khi thêm bài học mới.
- **Offline & Asset Resilience**: `src/lib/offlineQueue.ts` tự lưu cache bài học/truyện kể đã mở vào IndexedDB và đồng bộ tiến độ tự động khi thiết bị có mạng trở lại.

## 2. Yêu cầu môi trường build Android
- Node.js 20+
- JDK 17+
- Android Studio (Android SDK Platform 34+ & Build Tools)
- Firebase Android app SHA-1 / SHA-256 fingerprint (nếu bật đăng nhập Google trong WebView/Custom Tabs)

## 3. Các bước khởi tạo & build APK/AAB

```bash
# 1. Cài đặt Capacitor CLI & Android runtime (chỉ cần khi build mobile)
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli

# 2. Cấu hình URL backend/web production
export CAPACITOR_SERVER_URL="https://app.tm-lingo.app"

# 3. Thêm nền tảng Android và đồng bộ cấu hình từ capacitor.config.ts
npx cap add android
npx cap sync android

# 4. Mở dự án trong Android Studio để ký release keystore và xuất AAB/APK
npx cap open android
```

## 4. Cấu hình bảo mật & trải nghiệm trẻ em trên Android
1. **Firebase Auth**: Thêm domain production vào *Firebase Console → Authentication → Settings → Authorized domains*. `capacitor.config.ts` đã khai báo `allowNavigation` cho `*.firebaseapp.com` và `accounts.google.com`.
2. **Audio & TTS**: Android WebView hỗ trợ HTML5 `<audio>` cho file giọng đọc AI TTS (MP3/WAV lưu trên Cloudflare R2/S3) và `window.speechSynthesis` fallback.
3. **Icons & Splash**: Sử dụng sẵn bộ icon đạt chuẩn trong `/public/pwa-512x512.png` và `/public/pwa-maskable-512x512.png` (có safe zone 10–15% cho Adaptive Icons Android).
4. **Quyền tối thiểu (COPPA/GDPR-K)**: Không xin quyền `RECORD_AUDIO`, `CAMERA` hay `ACCESS_FINE_LOCATION` trong `AndroidManifest.xml`; chỉ dùng `INTERNET` và `POST_NOTIFICATIONS` (khi phụ huynh chủ động bật nhắc học).
