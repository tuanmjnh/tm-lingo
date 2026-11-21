# TM-Lingo — Kiến trúc sản phẩm & kỹ thuật chính thức (v2.0)

**Phiên bản:** 2.0  
**Ngày cập nhật:** 2026-11-20  
**Trạng thái:** Official Architecture Baseline (thay thế `TM-Lingo-Architecture-v1.1.md`)  
**Tên dự án chính thức:** `TM-Lingo` (`appId: "tm-lingo"` trong hệ sinh thái TM Platform)  
**Định vị:** Nền tảng học đa ngôn ngữ dành cho trẻ em  
**Độ tuổi khởi đầu:** 3–5 tuổi  
**Ngôn ngữ học đầu tiên:** English (`en`)  
**Ngôn ngữ giao diện và giải thích ban đầu:** Tiếng Việt (`vi`)

---

## 0. Tóm tắt thay đổi từ v1.1 lên v2.0

Phiên bản 2.0 đồng bộ hóa kiến trúc với codebase **Next.js 15 App Router** thực tế, tích hợp chọn lọc **TM-Hub Control Plane** (`@tuanmjnh/tm-hub-client`), tách rõ danh tính **Phụ huynh (Firebase Auth)** với **Nhân sự (TM-Hub IAM)**, trao quyền **tự chủ 100% cho TM-Lingo trong quản trị AI Providers (`@tuanmjnh/tm-ai-client`) và Storage Providers (R2/S3)**, đồng thời tinh gọn hệ thống cơ sở dữ liệu MongoDB từ 29 collection xuống 12 collection hướng tài liệu (document-first).

| Hạng mục | v1.1 (Baseline cũ) | v2.0 (Chính thức hiện tại) |
|---|---|---|
| Framework Web & API | Vite SPA + Express server riêng | **Next.js 15 App Router** thống nhất (Client + Domain Route Handlers `/api/v1/*`) |
| Xác thực Phụ huynh (`parent`) | Tự xây session / Supabase Auth thử nghiệm | **Firebase Auth** (`signInWithPopup` Google + tùy chọn Email/Password), xác minh ID Token server-side |
| Xác thực Nhân sự (`admin` / `teacher` / `editor`) | Tài khoản cục bộ / seed admin | **TM-Hub IAM** (`@tuanmjnh/tm-hub-client`: JWT/JWKS, RBAC Capabilities, Users/Roles, Audit Logs) qua Next.js HttpOnly BFF |
| Quản trị AI Providers | Key trực tiếp trong env hoặc phụ thuộc ngoài | **TM-Lingo tự chủ 100%**: `@tuanmjnh/tm-ai-client` (`createMongoAIConfigStore`) + AES-256-GCM (`AI_CONFIG_SECRET`) + env fallback |
| Quản trị Storage Providers | Supabase Storage / Object Storage đơn lẻ | **TM-Lingo tự chủ 100%**: MongoDB `storage_connections` (mã hóa AES-256-GCM) + `StorageProviderAdapter` (**Cloudflare R2** mặc định / S3-compatible); gỡ Supabase khỏi runtime |
| Thông báo & Web Push | Chưa chốt ranh giới với Hub | **Phụ huynh**: 100% nội bộ TM-Lingo (MongoDB + W3C Web Push VAPID); **Nhân sự**: mở rộng `hub.notifications.*` ở giai đoạn sau |
| Cơ sở dữ liệu chính | 29 MongoDB collections (chuẩn hóa kiểu SQL) | **12 MongoDB collections cốt lõi** (document-first, tải bài học/truyện trong 1 truy vấn) |
| Giao diện Quản trị & CMS | Gợi ý chung | **Bộ Admin & Content Studio UI riêng ngay trong TM-Lingo** (tối ưu cho giáo dục sớm, chỉ gọi TM-Hub ở phần IAM/Audit) |

---

## 1. Tầm nhìn & Nguyên tắc sản phẩm bất biến

### 1.1. Tầm nhìn

TM-Lingo giúp trẻ 3–5 tuổi làm quen, tiếp xúc và phát triển nhiều ngôn ngữ thông qua bài học ngắn, hình ảnh vẽ tay, âm thanh rõ ràng, trò chơi ghép cặp nhẹ nhàng và truyện kể đa ngôn ngữ.

> **Một mục tiêu học tập – nhiều ngôn ngữ – nhiều cách trải nghiệm – nhiều phương thức sản xuất nội dung.**

Không nhân bản khóa học để thêm ngôn ngữ mới. Không gắn cứng tiếng Anh (`en`) hay tiếng Việt (`vi`) vào schema, component, route hay logic nghiệp vụ.

### 1.2. Thiết kế học tập cho trẻ 3–5 tuổi

- Một hoạt động kéo dài 1–3 phút; một micro-lesson 5–8 phút, luôn cho phép dừng và tiếp tục (checkpoint).
- Ưu tiên thao tác chạm lớn (tối thiểu `44×44px`), âm thanh phát lại không giới hạn, hình ảnh tương phản rõ ràng.
- Không phạt, không bảng xếp hạng công khai, không streak gây áp lực, không yêu cầu trẻ nhập liệu phức tạp.
- Chế độ `reduced-motion` và giới hạn thời lượng học hằng ngày do phụ huynh chủ động thiết lập.
- MVP **không** bật ghi âm giọng trẻ mặc định và không chấm điểm phát âm mang tính kết luận.

---

## 2. Mô hình đa ngôn ngữ (Locale Independence)

TM-Lingo tách biệt tuyệt đối các chiều ngôn ngữ sau — mọi mã tuân thủ **BCP-47** (`vi`, `en`, `en-US`, `ja`, `ko`, `fr`, `es`):

| Trường locale | Vai trò |
|---|---|
| `interfaceLocale` | Ngôn ngữ giao diện ứng dụng (đổi không ảnh hưởng ngôn ngữ bé đang học) |
| `learningLocale` | Ngôn ngữ trẻ đang học trong bài học hiện tại |
| `explanationLocale` | Ngôn ngữ giải thích/hướng dẫn cho trẻ và phụ huynh |
| `contentLocale` | Locale thực tế của một phiên bản học liệu cụ thể |
| `narrationLocale` | Ngôn ngữ đọc truyện / thuyết minh trong Story Reader |
| `voiceLocale` | Locale mà một Voice Profile thực sự hỗ trợ |
| `sourceLocale` / `targetLocale` | Ngôn ngữ nguồn và đích trong quy trình biên soạn/chuyển thể AI Studio |

### Quy tắc Language Registry & Fallback

- Không hard-code danh sách ngôn ngữ trong UI; đọc trực tiếp từ collection `language_configs`.
- Mỗi locale khai báo độc lập từng năng lực: `uiEnabled`, `learningEnabled`, `explanationEnabled`, `ttsEnabled`, `speechRecognitionEnabled`, `contentStatus` (`ready | beta | planned`), `fallbackLocale`.
- Thứ tự fallback minh bạch: `contentLocale` khớp chính xác → `fallbackLocale` được cấu hình → `explanationLocale` (chỉ áp dụng cho trường giải thích) → hiển thị rõ trạng thái chưa hỗ trợ (không âm thầm hiển thị sai ngôn ngữ).
- Phân biệt rõ 5 loại bản địa hóa: `translation`, `adaptation`, `transliteration`, `pronunciationGuide`, `explanation`.

---

## 3. Kiến trúc nội dung: Tách Learning Content khỏi Experience

Ba lớp độc lập giữ nguyên làm lõi thiết kế của TM-Lingo:

1. **Learning Content**: mục tiêu học tập, khái niệm từ vựng (`concepts`), bản dịch/chuyển thể đa locale, kịch bản truyện, câu hỏi và đáp án bảo vệ ở server.
2. **Experience Composition**: cách ghép nội dung thành hành trình hoạt động, thứ tự bước và checkpoint.
3. **Experience Preset**: phong cách hiển thị (`guided`, `flashcards`, `listening`, `game`, `story`, `explore`, `read_aloud`, `speaking`), mật độ hình ảnh, âm thanh dẫn dắt và tương thích `reduced-motion`.

### Renderer Registry an toàn

Database chỉ lưu mã loại renderer và dữ liệu JSON đã validate bằng Zod — **tuyệt đối không lưu hay thực thi HTML/JavaScript tùy ý từ MongoDB hoặc output AI**. Các renderer được lập trình và kiểm thử sẵn:

- `VocabularyCardRenderer`
- `PictureChoiceRenderer`
- `ListenAndSelectRenderer`
- `MatchPairRenderer`
- `StorySegmentRenderer`
- `FlashcardRenderer`
- `RepeatAfterMeRenderer`

---

## 4. Kiến trúc tổng thể & Ranh giới hệ sinh thái TM Platform

TM-Lingo là **Satellite Application** độc lập cao (`appId: "tm-lingo"`), sử dụng **tối giản 2 hạ tầng lõi + TM-Hub**:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                     TM-Lingo Clients (Next.js 15 / PWA)                    │
│                                                                            │
│   ┌──────────────────────────────────┐  ┌──────────────────────────────┐   │
│   │  Khu vực Trẻ & Phụ huynh         │  │  TM-Lingo Admin & Studio UI  │   │
│   │  Learn · Stories · Parent Panel  │  │  Curriculum · Stories · AI   │   │
│   │  Family Inbox & Web Push (Bell)  │  │  AI & Storage Providers UI   │   │
│   └────────────────┬─────────────────┘  │  Notifications · Staff/Audit │   │
│                    │ Firebase ID Token  └──────────────┬───────────────┘   │
└────────────────────┼───────────────────────────────────┼───────────────────┘
                     │                                   │ TM-Hub Session
                     ▼                                   ▼ (HttpOnly Cookie)
┌────────────────────────────────────────────────────────────────────────────┐
│             TM-Lingo Next.js 15 Domain Route Handlers (/api/v1/*)          │
│                                                                            │
│  ┌──────────────────────────────┐    ┌──────────────────────────────────┐  │
│  │  withParentAuth Guard        │    │  withStaffCapability Guard       │  │
│  │  Verify Firebase ID Token    │    │  Verify TM-Hub JWT (JWKS /       │  │
│  │  → role = 'parent' cố định   │    │  introspect) + capabilities      │  │
│  └──────────────┬───────────────┘    └────────────────┬─────────────────┘  │
│                 │ (401)                               │ (401 / 403)        │
│  ┌──────────────▼─────────────────────────────────────▼─────────────────┐  │
│  │  Domain Modules: Learners · Languages · Packages · Stories · Progress│  │
│  │  Family Push (VAPID) · Publishing Snapshots · Review Workflow        │  │
│  └──────────┬──────────────────────┬───────────────────────┬────────────┘  │
│             │                      │                       │               │
│             │         ┌────────────▼────────────┐ ┌────────▼────────────┐  │
│             │         │  App-Local AI Manager   │ │ App-Local Storage   │  │
│             │         │  @tuanmjnh/tm-ai-client │ │ StorageConfigStore  │  │
│             │         │  AES-256-GCM + Fallback │ │ AES-256-GCM + R2/S3 │  │
│             │         └────────────┬────────────┘ └────────┬────────────┘  │
└─────────────┼──────────────────────┼───────────────────────┼───────────────┘
              │                      │                       │
              ▼                      ▼                       ▼
┌───────────────────────────┐  ┌───────────────────┐  ┌──────────────────────┐
│    MongoDB (12 Core Cols) │  │ Direct Providers  │  │ TM-Hub Control Plane │
│  Primary Data + Vaults    │  │ (Tự chủ 100%)     │  │ @tuanmjnh/           │
│                           │  │                   │  │ tm-hub-client        │
│  1. accounts (+consents)  │  │ · Gemini / OpenAI │  │                      │
│  2. learner_profiles      │  │   / Anthropic     │  │ · Staff Auth (IAM)   │
│  3. language_configs      │  │ · Cloudflare R2 / │  │ · Roles & RBAC       │
│  4. learning_packages     │  │   S3-Compatible   │  │ · Staff Users        │
│  5. stories (+locales)    │  └───────────────────┘  │ · Audit Logs         │
│  6. learning_assets       │                         │ · (Pha sau: Staff    │
│  7. learning_progress     │                         │    Notifications)    │
│  8. ai_connections        │                         └──────────────────────┘
│  9. storage_connections   │
│ 10. generation_jobs       │
│ 11. publication_snapshots │
│ 12. notification_campaigns│
│     & push_subscriptions  │
└───────────────────────────┘
```

### 4.1. Ma trận trách nhiệm (Không chồng chéo)

| Thành phần | Trách nhiệm duy nhất | Không làm gì |
|---|---|---|
| **TM-Lingo (Next.js 15 + MongoDB)** | Toàn bộ UI/UX trẻ em & phụ huynh, bộ UI Admin/Studio riêng, dữ liệu học tập, tự quản trị AI Providers & Storage Providers, Web Push gia đình | Không lưu mật khẩu nhân sự; không tự xây hệ thống IAM nhân sự cục bộ |
| **Firebase Auth** | Đăng nhập Phụ huynh (Google `signInWithPopup`, tùy chọn Email/Password) và phát hành ID Token | Không dùng Firestore làm DB chính; không cấp quyền Admin/Teacher |
| **TM-Hub (`@tuanmjnh/tm-hub-client`)** | Định danh nhân sự, phân quyền RBAC/Capabilities cho app `tm-lingo`, quản lý tài khoản nhân sự và Audit Logs | Không lưu trữ khóa AI/Storage của TM-Lingo; không quản lý danh sách phụ huynh gia đình |
| **Cloudflare R2 / S3-Compatible** | Lưu trữ ảnh minh họa và audio học liệu với chi phí egress tối ưu ($0 trên R2) | Không lưu trực tiếp dữ liệu học liệu dạng binary vào MongoDB |

---

## 5. Kiến trúc xác thực hai miền (Dual Auth & RBAC)

### 5.1. Miền Phụ huynh (`parent`) — Firebase Auth

- **Client**: Dùng `firebase/auth` với `signInWithPopup(auth, googleProvider)` (tương thích hoàn toàn môi trường iframe/preview và web chuẩn; cấu hình đọc từ `firebase-applet-config.json` hoặc `NEXT_PUBLIC_FIREBASE_*`). Nếu mở thêm Email/Mật khẩu, kích hoạt trực tiếp trong Firebase Console → Authentication → Sign-in method.
- **Server (`withParentAuth`)**:
  - Đọc `Authorization: Bearer <firebaseIdToken>`.
  - Xác minh chữ ký RS256 của Firebase ID Token (`verifyIdToken(token)` với `projectId`, **không cần quyền IAM Firebase** — hoạt động trên mọi gói Spark/Blaze/Starter).
  - Gắn cứng `role = 'parent'` và `parentAccountId = decoded.uid`. **Không bao giờ** cho phép token Firebase đi vào bất kỳ route `/api/v1/admin/*` hay `/api/v1/studio/*` nào.
  - Tự đồng bộ bản ghi tối thiểu vào MongoDB `accounts` theo `firebaseUid`.
  - Trả `401 Unauthorized` nếu thiếu hoặc sai token (khi route yêu cầu đăng nhập); chế độ dùng thử khách (`guest`) chỉ áp dụng trên các route học thử được cho phép rõ ràng.

### 5.2. Miền Nhân sự (`admin` / `teacher` / `content_editor` / `reviewer` / `publisher`) — TM-Hub IAM

- **BFF Session Pattern (Next.js Server)**:
  - Cổng quản trị gửi email/mật khẩu tới `POST /api/v1/admin/auth/login` trên Next.js server.
  - Server gọi `hub.auth.login({ email, password })` qua `@tuanmjnh/tm-hub-client` với `appId: 'tm-lingo'`.
  - Access Token và Refresh Token của TM-Hub được lưu trong **cookie `HttpOnly, SameSite=Lax, Secure`** (không lưu token quản trị trong `localStorage`).
- **Server Guard (`withStaffCapability(requiredCap)`)**:
  - Đọc token từ cookie phiên TM-Hub; xác minh chữ ký qua JWKS (`hub.auth.jwks()`) có cache hoặc `hub.auth.introspect(token)`.
  - Nếu token hết hạn, tự làm mới một lần bằng `hub.auth.refresh(refreshToken)` và cập nhật cookie; nếu vẫn không hợp lệ trả **`401 Unauthorized`**.
  - Kiểm tra capability qua `hub.auth.permissions()` / `hub.capabilities.has(requiredCap)`. Nếu thiếu quyền trả **`403 Forbidden`**.
- **Bộ Capability đề xuất đăng ký trên TM-Hub cho `tm-lingo`**:
  - `tm-lingo.content.read` / `tm-lingo.content.write` — biên soạn bài học, từ vựng, truyện kể (`teacher`, `content_editor`, `admin`).
  - `tm-lingo.content.review` / `tm-lingo.content.publish` — duyệt và xuất bản snapshot (`reviewer`, `publisher`, `admin`).
  - `tm-lingo.media.write` — tải lên và quản lý học liệu media (`teacher`, `content_editor`, `admin`).
  - `tm-lingo.notifications.manage` — quản trị chiến dịch nhắc học gia đình (`teacher`, `admin`).
  - `tm-lingo.providers.manage` — cấu hình AI Providers & Storage Providers (`admin`).
  - `users.read` / `users.write` / `logs.read` — dùng capability chuẩn của TM-Hub cho quản trị nhân sự & Audit Logs (`admin`).

---

## 6. Tự chủ hoàn toàn AI Providers & Storage Providers (App-Local)

TM-Lingo **không** dùng TM-Hub AI Relay hay TM-Hub Storage Gateway. Toàn bộ vòng đời cấu hình, mã hóa khóa, kiểm tra kết nối và thực thi nằm trọn trong server Next.js và MongoDB của TM-Lingo.

### 6.1. Cơ chế mã hóa thống nhất (Single Master Key)

- Sử dụng 1 master key server-only duy nhất: **`AI_CONFIG_SECRET`** (chuỗi base64 32 bytes).
- Tái sử dụng đúng module `secretBox` (**AES-256-GCM**: `sealSecret` / `openSecret`) từ package `@tuanmjnh/tm-ai-client` cho **cả hai** collection `ai_connections` và `storage_connections`.
- **Nguyên tắc bảo mật khóa**:
  - Tuyệt đối không lưu API key / secret key dạng plaintext trong MongoDB.
  - API trả về UI quản trị chỉ chứa metadata và cờ boolean `hasKey: true` / `hasCredentials: true` — không bao giờ trả lại khóa gốc ra trình duyệt.
  - **Env Fallback an toàn**: Khi collection `ai_connections` hoặc `storage_connections` chưa có bản ghi kích hoạt nào, runtime tự đọc biến môi trường mặc định (`GEMINI_API_KEY`, `OBJECT_STORAGE_*`) để môi trường phát triển/preview hoạt động ngay lập tức.

### 6.2. Tự quản trị AI Providers (`@tuanmjnh/tm-ai-client`)

- Sử dụng **`createMongoAIConfigStore(db, ownerId)`** từ `@tuanmjnh/tm-ai-client` (`ownerId = "tm-lingo-system"`) lưu vào collection `ai_connections`.
- Hỗ trợ đa nhà cung cấp sau các interface chuẩn độc lập vendor:
  - `TextGenerationProvider` / `StructuredGenerationProvider`: Gemini, OpenAI-compatible, Anthropic (qua `@tuanmjnh/tm-ai-client` adapters).
  - `ImageGenerationProvider`: sinh tranh minh họa bài học/truyện (Gemini Image hoặc provider tương thích).
  - `TtsProvider`: tổng hợp giọng đọc đa ngôn ngữ theo `Voice Registry` (Gemini TTS hoặc provider tương thích).
  - `SafetyReviewProvider`: kiểm tra an toàn nội dung trẻ em trước khi đưa vào hàng đợi duyệt.
- Giao diện **Admin → AI Providers** trong TM-Lingo cho phép: thêm/sửa/xóa kết nối, nhập API key một chiều, chạy **Test Connection**, đồng bộ danh sách model và chọn model mặc định cho từng tác vụ (`text`, `structured`, `image`, `tts`).

### 6.3. Tự quản trị Storage Providers (`storage_connections`)

- Lưu cấu hình kết nối tại collection `storage_connections` của MongoDB TM-Lingo:
  - `provider`: `'r2' | 's3'` (khuyến nghị mặc định **Cloudflare R2** với egress $0; có thể dùng bất kỳ S3-compatible endpoint nào; hỗ trợ adapter chuyển tiếp tạm thời nếu cần di chuyển dữ liệu cũ từ Supabase Storage).
  - `bucket`, `endpoint`, `region`, `publicBaseUrl`, `pathPrefix` (ví dụ `tm-lingo/`).
  - `credentialsCipher`: chuỗi mã hóa AES-256-GCM chứa `{ accessKeyId, secretAccessKey }`.
  - `isDefault`, `enabled`, `status`, `lastTestedAt`.
- Giao diện **Admin → Storage Providers** cho phép: thêm/sửa/xóa kết nối, chạy **Test Bucket Connection** (`HeadBucket`), đặt **Active Default Storage**, và theo dõi dung lượng/số lượng tệp trong `learning_assets`.
- Mọi ảnh/audio tải lên đi qua kiểm định MIME + giới hạn dung lượng (tối đa 10MB) tại Next.js Route Handler trước khi đẩy lên `StorageProviderAdapter`.

---

## 7. Mô hình dữ liệu MongoDB (12 Collection Document-First)

Thay vì chia nhỏ 29 collection theo kiểu bảng quan hệ SQL như v1.1, v2.0 gom các thực thể gắn kết chặt vào **12 collection cốt lõi**, đảm bảo tải một bài học hoặc một truyện kể chỉ trong **1 truy vấn duy nhất** và vẫn giữ `schemaVersion`, `status`, `createdAt`, `updatedAt` trên mọi document:

| # | Collection | Mục đích & Cấu trúc nhúng (Embedded) | Index chính |
|---|---|---|---|
| 1 | `accounts` | Tài khoản phụ huynh khóa theo `firebaseUid`, thông tin liên hệ tối thiểu + nhúng `consents[]` (lịch sử đồng ý quyền riêng tư theo phiên bản) | unique `{ firebaseUid: 1 }` |
| 2 | `learner_profiles` | Hồ sơ trẻ (nickname, tuổi 3–5, avatarTone) + nhúng `preferences` (4 locale độc lập, `reducedMotion`, `dailyMinutesLimit`, `audioSpeed`) | `{ parentAccountId: 1, status: 1 }` |
| 3 | `language_configs` | Language Registry (BCP-47, capability flags, `fallbackLocale`) + nhúng `voices[]` khả dụng theo locale | unique `{ locale: 1 }` |
| 4 | `learning_packages` | Gói bài học đa ngôn ngữ: `topicId`, `ageBand`, `concepts` (đa locale), `lessons[]` kèm `activities[]` và `experienceBindings` (chế độ tương thích), `status` (`draft \| in_review \| published`) | `{ status: 1, topicId: 1 }` |
| 5 | `stories` | Truyện đa ngôn ngữ + nhúng `localizations` theo locale (`title`, `segments[]`, `narrationAssets`, `explanationLocale` text), `status` | `{ status: 1, ageBands: 1 }` |
| 6 | `learning_assets` | Metadata học liệu ảnh/audio: `storageConnectionId`, `objectKey`, `publicUrl`, `kind`, `locale`, `title`, `sizeBytes`, `uploadedByHubUserId` | `{ kind: 1, locale: 1, createdAt: -1 }` |
| 7 | `learning_progress` | Tiến độ học theo bé + bài + `learningLocale` + `mode` (checkpoints, completedActivityIds) và vị trí đọc truyện (`storyPositions`) | unique `{ learnerId: 1, resourceType: 1, resourceId: 1, locale: 1 }` |
| 8 | `ai_connections` | Kết nối AI & model catalogue theo chuẩn `createMongoAIConfigStore` của `@tuanmjnh/tm-ai-client` (`apiKeyCipher` AES-256-GCM) | `{ ownerId: 1, provider: 1 }` |
| 9 | `storage_connections` | Kết nối R2 / S3-compatible (`credentialsCipher` AES-256-GCM, `isDefault`, `lastTestedAt`) | `{ isDefault: -1, enabled: 1 }` |
| 10 | `generation_jobs` | Tác vụ AI Content Studio (Quick & Advanced): brief, từng stage, `artifacts[]`, `provenance` (provider, model, promptVersion), `reviewStatus` | `{ status: 1, createdAt: -1 }` |
| 11 | `publication_snapshots` | Bản chụp bất biến (immutable snapshot) của gói bài học/truyện đã được duyệt & xuất bản — khu vực trẻ em chỉ đọc từ snapshot đã duyệt | unique `{ contentType: 1, contentId: 1, version: 1 }` |
| 12 | `notification_campaigns` & `push_subscriptions` | Quản lý chiến dịch nhắc học gia đình, lịch sử gửi (`deliveryLogs` nhúng hoặc giới hạn) và thiết bị Web Push gắn `parentAccountId` | `{ status: 1, updatedAt: -1 }` · unique `{ endpoint: 1 }` |

> *Ghi chú bảo mật đáp án:* `answerKey` của activity trong `learning_packages` / `publication_snapshots` không bao giờ trả xuống payload client của trẻ em; việc chấm đáp án thực hiện tại endpoint `POST /api/v1/activities/:activityId/answer`.

---

## 8. Kiến trúc API Next.js 15 (Domain Route Handlers)

Thay thế route catch-all đơn lẻ bằng các **Domain Route Handlers** gọn gàng trong `src/app/api/v1/`, áp dụng thống nhất hai guard: `withParentAuth` và `withStaffCapability`.

### 8.1. Nhóm Public & Consumer (Trẻ em & Phụ huynh)

| Method & Route | Auth Guard | Mô tả |
|---|---|---|
| `GET /api/v1/health` | Public | Trạng thái kết nối MongoDB, cấu hình Auth/Storage/AI/Push (không lộ secret) |
| `GET /api/v1/languages` | Public | Danh sách locale và capability từ Language Registry |
| `GET /api/v1/voices` | Public | Danh sách voice khả dụng lọc theo `?locale=` |
| `GET /api/v1/packages` · `GET /api/v1/lessons/:id` | Public / Guest | Lấy gói bài học & resolved lesson từ `publication_snapshots` (ẩn đáp án) |
| `POST /api/v1/activities/:id/answer` | Public / Parent | Đánh giá câu trả lời an toàn ở server |
| `GET /api/v1/stories` · `GET /api/v1/stories/:id` | Public / Parent | Danh sách & chi tiết truyện đa ngôn ngữ kèm vị trí đọc |
| `GET/POST /api/v1/learners` · `PATCH /api/v1/learners/:id/preferences` | Optional / `withParentAuth` | Quản lý hồ sơ trẻ và 4 locale độc lập (kiểm tra ownership theo `parentAccountId`) |
| `GET /api/v1/progress` · `POST /api/v1/lessons/:id/progress` | Optional / `withParentAuth` | Đọc và lưu checkpoint tiến độ học |
| `POST /api/v1/stories/:id/position` | Optional / `withParentAuth` | Lưu vị trí đoạn truyện đang đọc |
| `GET /api/v1/notifications/inbox` | `withParentAuth` (`401`) | Hộp thư thông báo nhắc học chỉ đọc của phụ huynh đã đăng nhập |
| `GET /api/v1/notifications/vapid-public-key` · `POST /api/v1/notifications/subscribe` | Public / `withParentAuth` | Đăng ký nhận Web Push nhắc học trên thiết bị phụ huynh |
| `POST /api/v1/parent/data-export` · `POST /api/v1/parent/data-deletion` | `withParentAuth` (`401`) | Xuất hoặc xóa toàn bộ dữ liệu hồ sơ trẻ theo yêu cầu phụ huynh |

### 8.2. Nhóm Staff Admin & Content Studio (TM-Hub IAM)

| Method & Route | Capability bắt buộc | Mô tả |
|---|---|---|
| `POST /api/v1/admin/auth/login` · `POST /logout` · `GET /me` | Public (login) / Staff Session | BFF đăng nhập TM-Hub, cấp cookie `HttpOnly`, trả profile + danh sách capabilities |
| `GET /api/v1/admin/staff/users` · `PATCH /roles` · `GET /audit-logs` | `users.read` / `users.write` / `logs.read` | Proxy sạch sang `hub.users.*`, `hub.roles.*`, `hub.logs.list()` |
| `GET/POST/PATCH/DELETE /api/v1/admin/providers/ai` · `POST /test` | `tm-lingo.providers.manage` | Tự quản trị kết nối AI & models trong MongoDB `ai_connections` (`@tuanmjnh/tm-ai-client`) |
| `GET/POST/PATCH/DELETE /api/v1/admin/providers/storage` · `POST /test` | `tm-lingo.providers.manage` | Tự quản trị kết nối Storage (R2/S3) trong MongoDB `storage_connections` |
| `GET /api/v1/admin/media` · `POST /upload` · `DELETE /:assetId` | `tm-lingo.media.write` | Tải lên/xóa học liệu ảnh & audio qua Active Storage Provider + lưu `learning_assets` |
| `GET/POST/PATCH /api/v1/admin/packages` · `POST /:id/publish` | `tm-lingo.content.write` / `publish` | Quản trị gói bài học, từ vựng đa locale và phát hành `publication_snapshots` |
| `GET/POST/PATCH /api/v1/admin/stories` · `POST /:id/publish` | `tm-lingo.content.write` / `publish` | Quản trị truyện đa ngôn ngữ và phân đoạn giọng đọc |
| `POST /api/v1/studio/quick-jobs` · `GET /jobs/:id` · `POST /jobs/:id/review` | `tm-lingo.content.write` / `review` | AI Content Studio (Quick & Advanced) dùng kết nối AI nội bộ, luôn xuất bản nháp (`draft`) |
| `GET/POST/PATCH/DELETE /api/v1/admin/notifications/campaigns` · `POST /:id/send` | `tm-lingo.notifications.manage` | Quản trị chiến dịch Web Push gia đình (lưu MongoDB, gửi qua VAPID) |

---

## 9. Quy trình AI Content Studio & Kiểm duyệt

Giữ nguyên 2 chế độ sản xuất trên cùng một pipeline dịch vụ và luôn tuân thủ quy tắc **không tự động publish**:

```text
Brief (Chủ đề · Tuổi 3–5 · learningLocale · explanationLocale)
  → Chọn AI Connection/Model từ ai_connections (TM-Lingo MongoDB)
  → Sinh cấu trúc có kiểm định Zod (Curriculum / Concepts / Story / Activities)
  → Sinh hoặc gắn ảnh & audio lưu vào Storage Provider (R2/S3)
  → Trạng thái DRAFT (Preview trên Lesson Player & Story Reader)
  → Human Review (ngôn ngữ, độ tuổi, an toàn trẻ em)
  → Approval → Immutable Publication Snapshot (xuất bản ra ứng dụng trẻ em)
```

Mỗi artifact AI lưu đủ `provenance`: `sourceLocale`, `targetLocale`, `operationType` (`origin | translate | adapt`), `connectionId`, `provider`, `model`, `promptVersion`, `reviewStatus`.

---

## 10. Quyền riêng tư trẻ em, Bảo mật & PWA / Android

### 10.1. Child Privacy & Security Baseline

- Hồ sơ trẻ chỉ dùng `nickname` + `avatarTone`; không thu thập tên thật, định vị GPS, quảng cáo hay chat mở.
- Consent của phụ huynh lưu theo mục đích và phiên bản trong `accounts.consents[]`; hỗ trợ xuất/xóa dữ liệu đầy đủ.
- Không có dữ liệu trẻ nào đi sang hệ thống huấn luyện AI; mọi yêu cầu AI Studio chỉ dùng ngữ liệu biên tập, không gửi định danh trẻ.
- Tách bạch hoàn toàn hai lớp xác thực (`withParentAuth` không bao giờ gọi được route staff); mọi thao tác quản trị quan trọng ghi sự kiện kiểm toán sang TM-Hub Audit Logs.
- Upload media kiểm tra MIME thực tế và giới hạn dung lượng (≤ 10MB); mọi bí mật (`AI_CONFIG_SECRET`, `MONGODB_URI`, `HUB_DEVICE_SECRET`, `VAPID_PRIVATE_KEY`) chỉ tồn tại ở server runtime.

### 10.2. PWA & Lộ trình Android (Capacitor)

- Giữ nguyên chuẩn PWA trên Next.js (`public/manifest.json`, `public/push-sw.js`, biểu tượng đa kích thước, `OfflineIndicator`).
- Đóng gói Android bằng **Capacitor** sau khi web app + audio + offline sync ổn định (không duy trì hai codebase UI riêng biệt). Firebase Auth Google Sign-In hỗ trợ chuyển tiếp mượt sang môi trường Capacitor sau này.

---

## 11. Biến môi trường chuẩn v2.0 (Tối giản)

Chỉ giữ đúng các biến thực sự cần dùng (khai báo mẫu không chứa secret trong `.env.example`):

```env
# Runtime
NODE_ENV=development
PORT=3000
APP_BASE_URL=http://localhost:3000

# Primary Database (server-only)
MONGODB_URI=
MONGODB_DATABASE=tm-lingo

# Master Encryption Key cho ai_connections & storage_connections (32-byte base64, server-only)
AI_CONFIG_SECRET=

# TM-Hub Control Plane — Staff IAM / RBAC / Audit Logs (server-only)
HUB_BASE_URL=
HUB_APP_ID=tm-lingo
HUB_DEVICE_ID=
HUB_DEVICE_SECRET=
# Fallback tùy chọn nếu chưa enroll device trên TM-Hub:
HUB_APP_SECRET=

# Parent Auth — Firebase (đọc từ firebase-applet-config.json hoặc biến public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Family Web Push (W3C VAPID — server-only private key)
VAPID_SUBJECT=mailto:admin@tm-lingo.app
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Env Fallbacks tùy chọn (chỉ dùng khi ai_connections / storage_connections trong DB còn trống)
GEMINI_API_KEY=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
OBJECT_STORAGE_PUBLIC_BASE_URL=
```

*(Các biến `VITE_SUPABASE_*`, `SUPABASE_*`, `SEED_ADMIN_*` sẽ được đánh dấu deprecated trong giai đoạn chuyển đổi và gỡ bỏ hoàn toàn sau Pha 5.)*

---

## 12. Cấu trúc Repository mục tiêu (Next.js 15)

```text
tm-lingo/
├─ docs/
│  ├─ TM-Lingo-Architecture-v2.0.md          # Tài liệu kiến trúc chính thức hiện hành
│  ├─ TM-Lingo-Architecture-v1.1.md          # Bản lưu trữ lịch sử
│  └─ superpowers/plans/
│     ├─ 2026-11-20-nextjs-migration.md      # Hoàn tất
│     ├─ 2026-11-20-tm-hub-integration.md    # Kế hoạch tích hợp 6 pha (Hoàn tất)
│     └─ 2026-11-20-capacitor-android.md     # Hướng dẫn đóng gói Android (Capacitor)
├─ capacitor.config.ts                       # Cấu hình đóng gói Android (Capacitor)
├─ packages/
│  └─ contracts/                             # Shared TypeScript DTOs & Zod contracts
├─ server/
│  ├─ auth/
│  │  ├─ firebaseAuth.ts                     # withParentAuth (verify Firebase ID Token)
│  │  └─ hubAuth.ts                          # withStaffCapability (@tuanmjnh/tm-hub-client)
│  ├─ config/env.ts                          # Zod env parser + runtime summary
│  ├─ db/mongo.ts                            # Pooled MongoDB singleton + indexes
│  ├─ providers/
│  │  ├─ aiManager.ts                        # @tuanmjnh/tm-ai-client + createMongoAIConfigStore
│  │  └─ storageManager.ts                   # storage_connections (AES-256-GCM) + R2/S3 adapter
│  └─ data/                                  # cmsRepository, voiceRepository, mongoStore, notificationRepository
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx · page.tsx
│  │  └─ api/v1/                             # Domain Route Handlers (health, learners, lessons, stories, voices, notifications, parent/*, admin/*)
│  ├─ features/
│  │  ├─ lesson-player/ · story-reader/ · parent/
│  │  └─ admin/                              # Bộ Admin & Studio UI (Sidebar 248px: CMS, Media, AI/Storage Providers, Notifications, Languages & Voices, Staff/Audit)
│  ├─ experiences/ · i18n/ · audio/ · components/ · lib/ · shared/
└─ public/                                   # manifest.json, push-sw.js, icons, images/
```

---

## 13. Roadmap triển khai v2.0

| Pha | Trọng tâm | Trạng thái & Tiêu chí hoàn tất (Exit Criteria) |
|---|---|---|
| **Pha 0 (Hoàn tất)** | Next.js 15 App Router, MongoDB, Fruits & Farm Friends Packs, Story Reader, Family Web Push | `tsc --noEmit`, `next build` pass; học bài, đọc truyện, lưu tiến độ và Web Push hoạt động |
| **Pha 1 (Hoàn tất)** | Tách Domain Route Handlers (`/api/v1/*`), chuẩn `401`/`403`, cài `@tuanmjnh/tm-hub-client` & `@tuanmjnh/tm-ai-client` | Đã xóa catch-all 666 dòng; 100% endpoint pass smoke test với đúng mã trạng thái |
| **Pha 2 (Hoàn tất)** | Chuyển Parent Auth sang **Firebase Auth** (`signInWithPopup` + `verifyIdToken`) | Phụ huynh đăng nhập Google/Email qua Firebase, đồng bộ hồ sơ & hộp thư vào MongoDB `accounts`; bị chặn tuyệt đối trên `/api/v1/admin/*` |
| **Pha 3 (Hoàn tất)** | Nối Cổng quản trị & RBAC/Users/Audit Logs sang **TM-Hub IAM** (HttpOnly cookie BFF) + Root-only Hard Delete | Nhân sự đăng nhập TM-Hub/Local Dev, menu lọc theo capability, Soft Archive/Restore toàn hệ thống và Hard Delete giới hạn riêng `root` |
| **Pha 4 (Hoàn tất)** | **Tự quản trị AI Providers** trong TM-Lingo Admin (`@tuanmjnh/tm-ai-client` + `ai_connections`) | Admin thêm/test/bật model Gemini/OpenAI/Anthropic mã hóa AES-256-GCM; chọn connection trong AI Studio; fallback env hoạt động khi DB trống |
| **Pha 5 (Hoàn tất)** | **Tự quản trị Storage Providers** (Cloudflare R2 / S3) + Media Library & gỡ `@supabase/supabase-js` | Admin cấu hình/test bucket R2/S3 mã hóa AES-256-GCM, tải/lưu trữ/xóa ảnh & audio trơn tru; gỡ hoàn toàn Supabase |
| **Pha 6 (Hoàn tất)** | CMS Giáo trình, Truyện kể, Language & Voice Registry + AI Content Studio (Generate, Adapt Locale, TTS, Safety Review, Snapshot Rollback) + Đủ 5 Renderer (`RepeatAfterMeRenderer` & `explore` mode) | Biên tập viên tạo/sửa/dịch AI/kiểm duyệt an toàn trẻ 3–5t, phát hành & rollback `publication_snapshots` bất biến |
| **Pha 7 (Hoàn tất)** | Child Privacy Consent/Export/Delete, Offline IndexedDB Queue, PWA Installability & Capacitor Android Packaging Config | Hoàn tất Privacy Consent/Export/Delete + Offline Queue + Daily Limit + PWA Manifest/SW + `capacitor.config.ts` & Runbook build APK/AAB |

---

## 14. Nguyên tắc làm việc cho AI Coding Agent

1. Đọc tài liệu này và kiểm tra codebase hiện tại trước mọi thay đổi.
2. Không hard-code `en` hoặc `vi` trong schema, API hay component.
3. Không trộn lẫn hai miền xác thực: `withParentAuth` (Firebase) và `withStaffCapability` (TM-Hub) luôn tách biệt cứng ở backend.
4. Không lưu khóa AI hay Storage dạng plaintext và không bao giờ trả khóa gốc ra client.
5. Không tạo lại kết nối sang TM-Hub AI Relay hoặc TM-Hub Storage Gateway — AI và Storage là miền tự quản trị của TM-Lingo.
6. Không tự động publish nội dung AI; mọi thay đổi học liệu đi qua `draft → in_review → publication_snapshots`.
7. Triển khai từng pha độc lập, kiểm chứng bằng `tsc --noEmit` + `next build` + smoke test API sau mỗi pha.
