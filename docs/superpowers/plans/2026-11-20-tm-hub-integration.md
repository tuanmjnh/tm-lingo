# TM-Lingo v2.0 — Kế hoạch Tích hợp TM-Hub, Firebase Auth & Tự chủ Providers

**Ngày lập:** 2026-11-20  
**Tham chiếu kiến trúc:** [TM-Lingo Architecture v2.0](../../TM-Lingo-Architecture-v2.0.md)  
**Tiền đề đã hoàn tất:** [Next.js 15 Migration Plan](./2026-11-20-nextjs-migration.md)  
**Trạng thái:** Ready for Execution (6 pha độc lập)

---

## 1. Mục tiêu & Ranh giới triển khai

Kế hoạch này hướng dẫn từng bước chuyển đổi TM-Lingo từ trạng thái hiện tại (Next.js 15 + Supabase Auth/Storage + catch-all API + seed admin cục bộ) sang kiến trúc **TM-Lingo v2.0** tinh gọn:

- **TM-Hub (`@tuanmjnh/tm-hub-client`)**: chỉ sử dụng cho **Staff IAM, RBAC/Capabilities, Quản trị nhân sự và Audit Logs**.
- **Firebase Auth**: xác thực **Phụ huynh (`parent`)** bằng Google Sign-In (`signInWithPopup`) và tùy chọn Email/Mật khẩu; xác minh ID Token ở backend Next.js không cần quyền IAM Firebase.
- **TM-Lingo tự chủ 100% AI Providers**: dùng **`@tuanmjnh/tm-ai-client`** (`createMongoAIConfigStore`) lưu trong MongoDB `ai_connections` mã hóa AES-256-GCM (`AI_CONFIG_SECRET`) + env fallback.
- **TM-Lingo tự chủ 100% Storage Providers**: lưu cấu hình **Cloudflare R2 / S3-compatible** trong MongoDB `storage_connections` mã hóa AES-256-GCM (`AI_CONFIG_SECRET`) + env fallback, sau đó **gỡ bỏ hoàn toàn `@supabase/supabase-js`**.
- **Thông báo gia đình**: giữ 100% nội bộ TM-Lingo (MongoDB + W3C Web Push VAPID), không cần cầu nối đồng bộ 2 chiều với TM-Hub ở Giai đoạn 1.

---

## 2. Điều kiện chuẩn bị trước khi bắt đầu

1. **Trên TM-Hub**:
   - Đảm bảo đã tạo app với `appId = "tm-lingo"` trên TM-Hub.
   - Chuẩn bị `HUB_BASE_URL` và cặp xác thực ứng dụng (`HUB_DEVICE_ID` + `HUB_DEVICE_SECRET` hoặc `HUB_APP_SECRET`).
   - Khai báo các capability của TM-Lingo cho vai trò `admin`, `teacher`, `content_editor`, `reviewer`, `publisher` (hoặc cấp `*` cho tài khoản Super Admin thử nghiệm):
     - `tm-lingo.content.read`, `tm-lingo.content.write`, `tm-lingo.content.review`, `tm-lingo.content.publish`
     - `tm-lingo.media.write`
     - `tm-lingo.notifications.manage`
     - `tm-lingo.providers.manage`
2. **Trên Firebase**:
   - Dự án Firebase đã được cấp sẵn trong `firebase-applet-config.json` với Google Sign-In khả dụng.
   - *(Tùy chọn)* Nếu muốn phụ huynh có thêm tùy chọn đăng nhập Email/Mật khẩu ngoài Google, bật **Email/Password** trong Firebase Console → Authentication → Sign-in method.
3. **Biến môi trường (Settings → Secrets / `.env`)**:
   - Sinh khóa 32-byte base64 cho `AI_CONFIG_SECRET` (`openssl rand -base64 32`).
   - Chuẩn bị thông tin Cloudflare R2 (hoặc S3-compatible): `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`, `OBJECT_STORAGE_PUBLIC_BASE_URL`.

---

## 3. Phân rã chi tiết 6 Pha triển khai

### Pha 1 — Cài đặt SDK, Chuẩn hóa Env & Tách Domain Route Handlers

**Mục tiêu:** Loại bỏ file catch-all API 666 dòng (`src/app/api/v1/[...route]/route.ts`), thiết lập khung guard chuẩn `401` / `403`, cài hai thư viện nền từ `tm-platform`.

- [x] **Bước 1.1**: Cài đặt `@tuanmjnh/tm-hub-client` và `@tuanmjnh/tm-ai-client` vào `package.json`.
- [x] **Bước 1.2**: Cập nhật `server/config/env.ts` và `.env.example` bổ sung:
  - `AI_CONFIG_SECRET`
  - `HUB_BASE_URL`, `HUB_APP_ID` (default `'tm-lingo'`), `HUB_DEVICE_ID`, `HUB_DEVICE_SECRET`, `HUB_APP_SECRET`
  - `OBJECT_STORAGE_PUBLIC_BASE_URL`
- [x] **Bước 1.3**: Tạo helper chuẩn hóa response lỗi và wrapper guard:
  - `withParentAuth(handler, { allowGuest?: boolean })`: luôn trả `401` khi thiếu/sai token ở route bắt buộc.
  - `withStaffCapability(capability, handler)`: trả `401` khi chưa có phiên nhân sự, trả `403` khi đã đăng nhập nhưng thiếu capability.
- [x] **Bước 1.4**: Tách các endpoint hiện có khỏi catch-all thành Domain Route Handlers:
  - `src/app/api/v1/health/route.ts`
  - `src/app/api/v1/languages/route.ts` & `src/app/api/v1/voices/route.ts`
  - `src/app/api/v1/learners/route.ts` & `src/app/api/v1/learners/[learnerId]/preferences/route.ts`
  - `src/app/api/v1/packages/route.ts`, `src/app/api/v1/lessons/[lessonId]/route.ts`, `src/app/api/v1/lessons/[lessonId]/progress/route.ts`
  - `src/app/api/v1/activities/[activityId]/answer/route.ts` & `src/app/api/v1/progress/route.ts`
  - `src/app/api/v1/stories/route.ts`, `src/app/api/v1/stories/[storyId]/route.ts`, `src/app/api/v1/stories/[storyId]/position/route.ts`
  - `src/app/api/v1/notifications/*`
  - `src/app/api/v1/admin/*`
- [x] **Bước 1.5**: Xóa file `src/app/api/v1/[...route]/route.ts` sau khi mọi route mới pass kiểm thử.

**Tiêu chí nghiệm thu Pha 1:**
- `tsc --noEmit` và `next build` đạt 0 lỗi.
- Toàn bộ endpoint consumer trả `200`; mọi endpoint `/api/v1/admin/*` trả đúng `401` khi chưa đăng nhập và `403` khi thiếu quyền.

---

### Pha 2 — Chuyển xác thực Phụ huynh sang Firebase Auth

**Mục tiêu:** Thay Supabase Auth bằng Firebase Auth cho toàn bộ khu vực Phụ huynh và Hộp thư thông báo, đảm bảo cách ly hoàn toàn với quyền quản trị.

- [x] **Bước 2.1**: Tạo `server/auth/firebaseAuth.ts` xác minh Firebase ID Token ở server (xác minh chữ ký RS256 qua Google JWKS `securetoken@system.gserviceaccount.com` + kiểm tra `aud === projectId`, `iss`, `exp` — không cần quyền IAM Firebase).
- [x] **Bước 2.2**: Gắn `withParentAuth` vào `/api/v1/learners*`, `/api/v1/progress*`, `/api/v1/stories/*/position`, `/api/v1/notifications/inbox` và `/api/v1/auth/me` (chỉ trả `role: 'parent'`). Tự động upsert bản ghi tối thiểu vào MongoDB `accounts` theo `firebaseUid`.
- [x] **Bước 2.3**: Cập nhật `src/lib/firebaseAuth.ts` (client) dùng `getAuth` + `GoogleAuthProvider` + `signInWithPopup` (kèm tùy chọn `signInWithEmailAndPassword` / `createUserWithEmailAndPassword` khi Firebase Console bật Email/Password) và `auth.currentUser.getIdToken()`.
- [x] **Bước 2.4**: Cập nhật `src/shared/apiClient.ts` gửi `Authorization: Bearer <firebaseIdToken>` cho các API gia đình, đồng thời cập nhật `ParentPanel.tsx` và `App.tsx` gỡ phụ thuộc đăng nhập Supabase ở khu vực phụ huynh.
- [x] **Bước 2.5**: Xóa trang `/auth/callback` của Supabase OAuth sau khi xác nhận popup Google của Firebase chạy ổn định.

**Tiêu chí nghiệm thu Pha 2:**
- Phụ huynh đăng nhập Google 1 chạm bằng Firebase Auth, tạo/chỉnh hồ sơ bé và lưu tiến độ vào MongoDB `accounts` / `learner_profiles` / `learning_progress`.
- Dùng Firebase ID Token gọi vào bất kỳ route `/api/v1/admin/*` nào đều bị từ chối (`401`/`403`).

---

### Pha 3 — Nối Cổng Quản trị & RBAC / Audit Logs sang TM-Hub IAM

**Mục tiêu:** Chuyển toàn bộ luồng đăng nhập, kiểm quyền, quản trị nhân sự và Audit Logs trong Cổng quản trị TM-Lingo sang TM-Hub qua `@tuanmjnh/tm-hub-client`, gỡ bỏ tài khoản seed admin cục bộ.

- [x] **Bước 3.1**: Tạo `server/auth/hubClient.ts` khởi tạo server-side `createHubClient({ baseUrl: HUB_BASE_URL, appId: HUB_APP_ID, ... })` kèm cơ chế cache JWKS (`hub.auth.jwks()`) và xác minh token nhân sự.
- [x] **Bước 3.2**: Xây dựng Next.js BFF Auth routes cho nhân sự:
  - `POST /api/v1/admin/auth/login`: gọi `hub.auth.login()`, set cookie `HttpOnly, SameSite=Lax, Secure` (`tm_lingo_staff_token`, `tm_lingo_staff_refresh`), trả `{ user, capabilities }`.
  - `POST /api/v1/admin/auth/logout`: gọi `hub.auth.logout()` và xóa cookie.
  - `GET /api/v1/admin/auth/me`: xác minh cookie (tự refresh 1 lần khi 401), gọi `hub.auth.permissions()`, trả `{ user, capabilities }`.
- [x] **Bước 3.3**: Xây dựng proxy quản trị nhân sự & kiểm toán:
  - `GET /api/v1/admin/staff/users` & `PATCH /api/v1/admin/staff/users/[id]` → gọi `hub.users.*` (yêu cầu `users.read` / `users.write`).
  - `GET /api/v1/admin/staff/roles` → gọi `hub.roles.list()`.
  - `GET /api/v1/admin/audit-logs` → gọi `hub.logs.list()` (yêu cầu `logs.read`).
- [x] **Bước 3.4**: Cập nhật `AdminLoginView.tsx` gọi `/api/v1/admin/auth/login` (đăng nhập bằng tài khoản TM-Hub) và cập nhật `AdminWorkspace.tsx` hiển thị phân hệ dựa trên danh sách `capabilities` thực tế từ TM-Hub (bổ sung tab xem **Audit Logs**).
- [x] **Bước 3.5**: Gỡ bỏ `server/auth/roleStore.ts` (`ensureSeededAdminAccount`) và `SEED_ADMIN_*` sau khi xác thực TM-Hub chạy ổn định.

**Tiêu chí nghiệm thu Pha 3:**
- Tài khoản quản trị trên TM-Hub đăng nhập vào Cổng quản trị TM-Lingo thành công, cookie `HttpOnly` không đọc được từ `document.cookie`.
- Tài khoản giáo viên chỉ có `tm-lingo.content.*` không thấy tab **Cấu hình Providers** hay **Nhân sự & Audit Logs**, và gọi thẳng API sẽ nhận `403`.

---

### Pha 4 — Tự quản trị AI Providers trong TM-Lingo (`@tuanmjnh/tm-ai-client`)

**Mục tiêu:** Cho phép Admin của TM-Lingo tự quản trị đầy đủ kết nối AI & model catalogue ngay trong MongoDB của dự án mà không cần TM-Hub.

- [x] **Bước 4.1**: Tạo `server/providers/aiManager.ts`:
  - Khởi tạo `createMongoAIConfigStore(db, 'tm-lingo-system')` từ `@tuanmjnh/tm-ai-client`.
  - Mã hóa API key bằng `sealSecret(AI_CONFIG_SECRET, apiKey)` trước khi `upsertConnection`, giải mã bằng `openSecret` chỉ tại runtime server khi gọi AI.
  - Cài đặt fallback mềm sang `process.env.GEMINI_API_KEY` khi `ai_connections` chưa có kết nối nào.
  - Bọc thêm interface `ImageGenerationProvider` và `TtsProvider` dùng cùng cấu hình kết nối đã giải mã.
- [x] **Bước 4.2**: Tạo Domain Route Handlers (`tm-lingo.providers.manage`):
  - `GET /api/v1/admin/providers/ai` (chỉ trả `hasKey`, provider, models, trạng thái — không bao giờ trả `apiKeyCipher` hay plaintext).
  - `POST /api/v1/admin/providers/ai` & `DELETE /api/v1/admin/providers/ai/[id]`.
  - `POST /api/v1/admin/providers/ai/[id]/test` (kiểm tra kết nối trực tiếp tới provider và cập nhật danh sách model).
  - `PATCH /api/v1/admin/providers/ai/[id]/models` (bật/tắt model & chọn model mặc định theo tác vụ `text | structured | image | tts`).
- [x] **Bước 4.3**: Xây tab **AI Providers** trong `AdminWorkspace.tsx` (danh sách kết nối, form thêm/cập nhật khóa một chiều, nút **Kiểm tra kết nối**, chọn model khả dụng, đủ 4 trạng thái loading/empty/error/success).

**Tiêu chí nghiệm thu Pha 4:**
- Admin thêm API key Gemini/OpenAI/Anthropic trong UI → kiểm tra MongoDB `ai_connections` xác nhận lưu dạng `apiKeyCipher` đã mã hóa (không có plaintext).
- Nhấn **Kiểm tra kết nối** trả kết quả thành công/thất bại rõ ràng; API response không chứa khóa gốc.

---

### Pha 5 — Tự quản trị Storage Providers (Cloudflare R2 / S3) & Gỡ Supabase

**Mục tiêu:** Chuyển toàn bộ kho học liệu ảnh/audio sang Storage Providers tự quản trị trong MongoDB (`storage_connections`), mặc định Cloudflare R2 ($0 egress), và gỡ bỏ hoàn toàn Supabase khỏi dự án.

- [x] **Bước 5.1**: Cài `@aws-sdk/client-s3` (nhẹ, chuẩn cho Cloudflare R2 và AWS S3).
- [x] **Bước 5.2**: Tạo `server/providers/storageManager.ts`:
  - `StorageConfigStore` thao tác trên MongoDB `storage_connections`, mã hóa `{ accessKeyId, secretAccessKey }` bằng cùng `sealSecret` / `openSecret` (`AI_CONFIG_SECRET`).
  - `S3CompatibleStorageAdapter` hỗ trợ `PutObject`, `DeleteObject`, `HeadBucket` (dùng chung cho Cloudflare R2, AWS S3, MinIO/Tigris).
  - Env fallback sang `OBJECT_STORAGE_*` khi `storage_connections` còn trống.
- [x] **Bước 5.3**: Tạo Domain Route Handlers (`tm-lingo.providers.manage` & `tm-lingo.media.write`):
  - `GET/POST/DELETE /api/v1/admin/providers/storage` + `POST /api/v1/admin/providers/storage/[id]/test` + `POST /api/v1/admin/providers/storage/[id]/default`.
  - Cập nhật `GET/POST/DELETE /api/v1/admin/media` ghi vào Active Default Storage Provider và lưu manifest `learning_assets` (`storageConnectionId`, `objectKey`, `publicUrl`, `locale`, `kind`, `sizeBytes`).
- [x] **Bước 5.4**: Xây tab **Storage Providers** trong `AdminWorkspace.tsx` (cấu hình R2/S3, kiểm tra kết nối bucket, đặt provider mặc định).
- [x] **Bước 5.5**: Dọn dẹp hoàn toàn Supabase:
  - Gỡ `@supabase/supabase-js` khỏi `package.json`.
  - Xóa `src/lib/supabase.ts`, `server/auth/supabaseAuth.ts`, các biến `SUPABASE_*` / `VITE_SUPABASE_*` cũ khỏi `next.config.ts` và `.env.example`.

**Tiêu chí nghiệm thu Pha 5:**
- Admin cấu hình Cloudflare R2 trong UI → kiểm tra kết nối thành công → tải lên ảnh/audio ở **Thư viện học liệu** và phát lại ngay trên trình duyệt.
- Không còn bất kỳ import hay biến môi trường Supabase nào trong codebase; `tsc --noEmit` và `next build` đạt 0 lỗi.

---

### Pha 6 — CMS Học liệu, Truyện kể & AI Content Studio trên 12 Collection MongoDB

**Mục tiêu:** Đưa toàn bộ nội dung bài học và truyện từ seed tĩnh lên MongoDB (`learning_packages`, `stories`, `publication_snapshots`) để giáo viên/admin biên soạn trực tiếp và xuất bản ra ứng dụng của bé.

- [x] **Bước 6.1**: Khởi tạo schema Zod & migration seed 1 lần đưa dữ liệu mẫu Fruits (`lp-fruits-a1`) và truyện *Fruit Market* vào MongoDB `learning_packages`, `stories`, `publication_snapshots` (idempotent).
- [x] **Bước 6.2**: Xây dựng API và UI quản trị **Bài học & Từ vựng đa ngôn ngữ** (thêm/sửa concept theo từng locale, gắn ảnh/audio từ `learning_assets`, chọn chế độ trải nghiệm tương thích).
- [x] **Bước 6.3**: Xây dựng API và UI quản trị **Truyện kể đa ngôn ngữ** (thêm/sửa phân đoạn theo locale, gắn giọng đọc từ Voice Registry).
- [x] **Bước 6.4**: Xây dựng **AI Content Studio (Quick Production)** gọi `aiManager` nội bộ của TM-Lingo → tạo `generation_jobs` → sinh bản nháp có kiểm định Zod → preview → duyệt (`review`) → tạo `publication_snapshots` bất biến.

**Tiêu chí nghiệm thu Pha 6:**
- Giáo viên tạo mới hoặc dùng AI sinh một bài học mới (ví dụ chủ đề *Animals*) ở trạng thái `draft`, chỉnh sửa bản dịch `en`/`vi`, duyệt và xuất bản → bài học xuất hiện ngay ở giao diện học của bé mà không cần sửa code.

---

## 4. Chiến lược kiểm thử & An toàn chuyển đổi

- **Không làm gián đoạn trải nghiệm học hiện tại**: Mỗi pha đều kết thúc ở trạng thái xanh (`tsc --noEmit` + `next build` + smoke test các endpoint cốt lõi).
- **Kiểm thử bảo mật bắt buộc sau Pha 2 & Pha 3**:
  - Request không có token → `401` trên mọi route cần đăng nhập.
  - Firebase Parent token gọi `/api/v1/admin/*` → bị chặn tuyệt đối.
  - TM-Hub Teacher token gọi `/api/v1/admin/providers/*` → `403`.
  - API `/api/v1/admin/providers/*` không bao giờ trả `apiKey`, `secretAccessKey` hay `cipher` ra JSON response.
- **Khả năng rollback**: Các bản phát hành nội dung dùng `publication_snapshots` bất biến, cho phép quay lại phiên bản đã duyệt trước đó tức thì nếu phát hiện lỗi nội dung.
