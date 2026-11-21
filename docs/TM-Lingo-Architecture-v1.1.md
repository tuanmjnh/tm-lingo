# TM-Lingo — Kiến trúc sản phẩm & kỹ thuật chính thức

> **Lưu ý:** Tài liệu v1.1 này được lưu giữ làm bản tham chiếu lịch sử. Kiến trúc chính thức hiện hành (Next.js 15 App Router, 12 collection MongoDB, Dual Auth TM-Hub + Firebase, tự chủ AI & Storage Providers) đã được nâng cấp sang **[TM-Lingo-Architecture-v2.0.md](./TM-Lingo-Architecture-v2.0.md)**.

**Phiên bản:** 1.1 (Archived)  
**Ngày cập nhật:** 2026-11-19  
**Trạng thái:** Superseded by v2.0  
**Tên dự án chính thức:** `TM-Lingo`  
**Định vị:** Nền tảng học đa ngôn ngữ dành cho trẻ em  
**Độ tuổi khởi đầu:** 3–5 tuổi  
**Ngôn ngữ học đầu tiên:** English (`en`)  
**Ngôn ngữ giao diện và giải thích ban đầu:** Tiếng Việt (`vi`)

---

## 1. Quyết định định hướng chính thức

Tên dự án được đổi từ `TM-Kids-English` thành **`TM-Lingo`**. Từ thời điểm này, tên cũ chỉ được xem là tên định hướng ban đầu, không dùng làm tên sản phẩm, package, collection, route hoặc tài liệu mới.

### 1.1. Tầm nhìn

TM-Lingo là nền tảng giúp trẻ làm quen, tiếp xúc và phát triển khả năng sử dụng nhiều ngôn ngữ thông qua bài học ngắn, trò chơi, hình ảnh, âm thanh, hoạt hình, hội thoại và truyện kể.

Nền tảng không được thiết kế như một ứng dụng chỉ học tiếng Anh rồi bổ sung bản dịch. Ngay từ kiến trúc đầu tiên, ngôn ngữ phải là một chiều cấu hình xuyên suốt từ nội dung, giao diện, giải thích, âm thanh, giọng đọc, tìm kiếm, tiến độ học đến AI Content Studio.

### 1.2. Các quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Tên sản phẩm | TM-Lingo |
| Đối tượng ban đầu | Trẻ 3–5 tuổi |
| Định hướng | Đa ngôn ngữ, mở rộng theo locale |
| Ngôn ngữ học đầu tiên | English (`en`) |
| Giao diện / giải thích ban đầu | Vietnamese (`vi`) |
| Phong cách trải nghiệm | Hybrid: học có hướng dẫn, khám phá, trò chơi, truyện, nghe-nói |
| AI Content Studio | Cả Quick Production và Advanced AI Production Studio |
| Story Reader | Đọc truyện đa ngôn ngữ, chọn ngôn ngữ và voice theo khả năng hỗ trợ |
| Cơ sở dữ liệu chính | MongoDB |
| AI ban đầu | Gemini qua provider adapter |
| Client | Web responsive + PWA |
| Android | Đóng gói bằng Capacitor sau khi web app ổn định |
| Nội dung | Một learning package, nhiều locale và nhiều experience composition |
| Phát hành nội dung AI | Draft → Review → Approve → Publish; không tự động public |

### 1.3. Nguyên tắc sản phẩm

> Một mục tiêu học tập – nhiều ngôn ngữ – nhiều cách trải nghiệm – nhiều phương thức sản xuất nội dung.

Không nhân bản toàn bộ khóa học chỉ để hỗ trợ ngôn ngữ mới. Không gắn cứng tiếng Anh vào schema, component, route hoặc logic nghiệp vụ.

---

## 2. Mô hình đa ngôn ngữ: phân biệt các loại ngôn ngữ

TM-Lingo phải phân biệt rõ ngôn ngữ người dùng nhìn thấy, ngôn ngữ trẻ đang học và ngôn ngữ của nội dung âm thanh.

### 2.1. Các locale độc lập

- `interfaceLocale`: ngôn ngữ giao diện ứng dụng.
- `learningLocale`: ngôn ngữ trẻ đang học trong chương trình hoặc phiên học.
- `explanationLocale`: ngôn ngữ dùng để giải thích cho trẻ hoặc phụ huynh.
- `contentLocale`: locale của một phiên bản nội dung cụ thể.
- `narrationLocale`: ngôn ngữ đọc truyện / thuyết minh.
- `voiceLocale`: locale mà voice provider hỗ trợ.
- `sourceLocale`: ngôn ngữ nguồn khi dịch hoặc chuyển thể nội dung.
- `targetLocale`: ngôn ngữ đích khi dịch hoặc tạo nội dung.

Ví dụ một phiên học:

```json
{
  "interfaceLocale": "vi",
  "learningLocale": "en",
  "explanationLocale": "vi",
  "narrationLocale": "en",
  "voiceLocale": "en-US"
}
```

Không suy ra `learningLocale` từ `interfaceLocale`. Trẻ dùng giao diện tiếng Việt vẫn có thể học tiếng Anh, tiếng Nhật hoặc tiếng Pháp.

### 2.2. Quy ước locale

- Dùng mã BCP-47 chuẩn hóa, ví dụ `en`, `en-US`, `en-GB`, `vi`, `ja`, `ko`, `fr`, `es`.
- Phân biệt language và locale/region khi thực sự cần thiết.
- Không hard-code danh sách ngôn ngữ trong component.
- Danh sách locale được bật lấy từ cấu hình hệ thống và khả năng thực tế của content/AI/voice provider.
- Không hiển thị một ngôn ngữ hoặc voice là “được hỗ trợ” nếu chưa có capability và nội dung phù hợp.
- Lưu nguyên mã locale trong dữ liệu; chỉ định dạng tên hiển thị ở UI.

### 2.3. Nguyên tắc fallback

Fallback phải có quy tắc rõ ràng và minh bạch. Ví dụ:

1. Nội dung đúng `contentLocale`.
2. Locale fallback được khai báo trong cấu hình sản phẩm.
3. `explanationLocale` nếu trường đó cho phép dùng bản giải thích thay thế.
4. Nếu không có bản phù hợp, thông báo chưa hỗ trợ; không âm thầm đưa nội dung sai ngôn ngữ.

Không tự động dùng tiếng Việt làm bản dịch cho mọi locale. Fallback khác nhau tùy loại trường: nội dung học, giải thích, caption, voice và UI.

---

## 3. Thiết kế học tập cho trẻ 3–5 tuổi

Đây là nguyên tắc thiết kế nội dung, không phải tiêu chuẩn y khoa hoặc cam kết kết quả học tập.

### 3.1. Mục tiêu ban đầu

- Làm quen âm thanh và ngữ điệu của ngôn ngữ.
- Nghe và nhận diện từ vựng quen thuộc.
- Liên kết từ với hình ảnh, vật thể và hành động.
- Bắt chước từ/cụm từ ngắn khi trẻ sẵn sàng.
- Hiểu chỉ dẫn đơn giản.
- Nghe truyện ngắn và nhận biết nhân vật/sự kiện.
- Học qua lặp lại có chủ đích, không tạo áp lực điểm số.

### 3.2. Thiết kế phiên học

- Một hoạt động nhỏ có thể kéo dài khoảng 1–3 phút.
- Một micro-lesson có thể được biên soạn khoảng 5–8 phút, nhưng phải cho phép dừng và tiếp tục.
- Ưu tiên thao tác chạm lớn, âm thanh rõ, hình ảnh dễ hiểu.
- Tránh yêu cầu trẻ đọc văn bản dài hoặc nhập liệu phức tạp.
- Tránh phạt, xếp hạng công khai, streak gây áp lực hoặc cơ chế khiến trẻ sợ thất bại.
- Hỗ trợ phụ huynh điều chỉnh thời lượng và nội dung.

### 3.3. Không đặt mục tiêu sai cho MVP

MVP không cần ưu tiên ngữ pháp hình thức, bài kiểm tra dài, chấm điểm phát âm mang tính kết luận hoặc hội thoại mở không kiểm soát. Tập trung vào nghe, nhận diện, tương tác và kể chuyện.

---

## 4. Kiến trúc nội dung: tách Learning Content khỏi Experience

Đây là quyết định kiến trúc quan trọng nhất của TM-Lingo.

### 4.1. Ba lớp độc lập

1. **Learning Content** — kiến thức và mục tiêu học tập: chủ đề, từ vựng, câu mẫu, ngữ cảnh, giải thích, truyện, câu hỏi, đáp án.
2. **Experience Composition** — cách tổ chức nội dung thành một trải nghiệm: thứ tự màn hình, hoạt động, nhịp độ, tương tác, checkpoint.
3. **Experience Preset** — cấu hình phong cách trình bày: guided, story, explore, game, read-aloud, listening, speaking; animation, sound, pacing, visual density, reduced motion.

Một learning package có thể được hiển thị qua nhiều experience mà không sao chép kiến thức gốc.

### 4.2. Experience modes

- `guided`: học có hướng dẫn.
- `explore`: khám phá tự do có giới hạn.
- `game`: trò chơi củng cố.
- `story`: học thông qua truyện.
- `flashcards`: thẻ từ vựng.
- `read_aloud`: nghe đọc truyện.
- `listening`: nghe và nhận diện.
- `speaking`: bắt chước / luyện nói có kiểm soát.

Không phải lesson nào cũng cần hỗ trợ mọi mode. Hệ thống phải khai báo mode nào tương thích với content package.

### 4.3. Renderer registry an toàn

Renderer là các component được lập trình và kiểm thử trước, ví dụ:

- `VocabularyCardRenderer`
- `PictureChoiceRenderer`
- `ListenAndSelectRenderer`
- `MatchPairRenderer`
- `StorySegmentRenderer`
- `FlashcardRenderer`
- `RepeatAfterMeRenderer`

Database chỉ lưu loại renderer và dữ liệu có schema. Tuyệt đối không tải và thực thi JavaScript, HTML tùy ý hoặc component code từ MongoDB.

---

## 5. Cấu trúc sản phẩm và điều hướng

### 5.1. Khu vực trẻ em

- Home / chọn chương trình.
- Chọn ngôn ngữ học.
- Continue learning.
- Chủ đề và lesson.
- Lesson Player.
- Story Library / Story Reader.
- Games & activities.
- Kết quả tiến độ ở dạng thân thiện, không gây áp lực.

### 5.2. Khu vực phụ huynh

- Hồ sơ trẻ và độ tuổi.
- Ngôn ngữ giao diện, ngôn ngữ học, ngôn ngữ giải thích.
- Quản lý chương trình được phép truy cập.
- Thời lượng và lịch học.
- Quyền riêng tư, consent, tải xuống và xóa dữ liệu.
- Theo dõi tiến độ ở mức phù hợp.

### 5.3. Khu vực quản trị / Content Studio

- Curriculum Manager.
- Content Library.
- Language & Localization Manager.
- Story Studio.
- Voice Library.
- Asset Library.
- AI Content Studio.
- Review Queue.
- Publishing.
- Provider Configuration.
- Audit & Analytics.

### 5.4. Vai trò

- `parent`: chủ tài khoản và quản lý hồ sơ trẻ.
- `learner`: hồ sơ trẻ, không phải tài khoản công khai độc lập trong MVP.
- `content_editor`: tạo và sửa nội dung.
- `reviewer`: kiểm tra ngôn ngữ, sư phạm, hình ảnh, âm thanh và an toàn.
- `publisher`: xuất bản nội dung.
- `admin`: cấu hình hệ thống và phân quyền.

Phải kiểm tra quyền ở backend. Không tin role, `parentId` hoặc quyền do client gửi lên.

---

## 6. Kiến trúc kỹ thuật đề xuất

### 6.1. Nguyên tắc

- Web-first, API-first, modular monolith trước khi tách microservices.
- TypeScript end-to-end cho ứng dụng và backend nếu scaffold hỗ trợ tốt.
- MongoDB Atlas là primary database.
- Media lưu trong object storage/CDN, không lưu binary lớn trong MongoDB.
- AI provider được bọc sau adapter.
- Nội dung có version, schema validation và publication snapshot.
- Tất cả tác vụ AI/audio/media dài chạy qua job queue.
- UI không truy cập trực tiếp MongoDB hoặc chứa secret của provider.

### 6.2. Stack khuyến nghị

| Lớp | Công nghệ / hướng chọn |
|---|---|
| Web app | React + TypeScript, theo scaffold ổn định của Google AI Studio |
| Build | Vite hoặc cấu hình scaffold sinh ra, không thay đổi nếu chưa có lý do |
| UI | Component system thống nhất, responsive, design tokens |
| Styling | Tailwind CSS hoặc CSS architecture hiện có của scaffold |
| Routing | React Router hoặc router đã được scaffold hỗ trợ |
| Server state | TanStack Query |
| Local UI state | Zustand hoặc React Context có kiểm soát |
| Validation | Zod |
| Forms | React Hook Form |
| Animation | Motion/Framer Motion; Lottie/Rive dùng có chọn lọc |
| Audio | HTMLAudioElement/Web Audio API; Howler nếu cần abstraction |
| Backend | Node.js + TypeScript modular monolith |
| API | REST `/api/v1`, OpenAPI/typed contracts |
| Database | MongoDB Atlas; chọn Mongoose hoặc official driver và thống nhất |
| Jobs | Queue adapter; có thể bắt đầu bằng Mongo-backed jobs hoặc dịch vụ queue phù hợp |
| Media | Object storage + CDN |
| AI | Gemini adapter ban đầu |
| Android | Capacitor sau khi web app ổn định |
| PWA | Service Worker + IndexedDB/cache có chiến lược |

Không cần cài tất cả thư viện ngay ở Phase 0. AI coding agent phải kiểm tra scaffold và chọn phiên bản tương thích trước khi thêm dependency.

---

## 7. Kiến trúc tổng thể

```text
┌──────────────────────────────────────────────────────┐
│                  TM-Lingo Clients                     │
│       Web App / PWA / Android (Capacitor)             │
└──────────────────────────┬───────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼───────────────────────────┐
│                    API Gateway                        │
│ Auth · Validation · Rate Limit · Authorization       │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│             Modular Monolith: Domain Modules          │
│                                                      │
│ Accounts · Learners · Consent · Languages             │
│ Curriculum · Lessons · Activities · Experiences       │
│ Stories · Voices · Progress · Rewards                 │
│ AI Studio · Generation Jobs · Review · Publishing    │
│ Media · Analytics · Admin · Audit                     │
└───────────────┬───────────────────┬──────────────────┘
                │                   │
       ┌────────▼────────┐  ┌───────▼────────────────┐
       │ MongoDB Atlas   │  │ Provider / Job Layer  │
       │ Domain records  │  │ Gemini · TTS · Images │
       │ Versions        │  │ Object Storage · Queue│
       └─────────────────┘  └────────────────────────┘
```

### 7.1. Backend modules

Mỗi module có controller/API, service, repository/schema, validation và tests riêng. Không tạo một service khổng lồ chứa toàn bộ nghiệp vụ.

### 7.2. Ranh giới module

- `identity`: accounts, sessions, roles.
- `learners`: child profiles.
- `consent`: parental consent and privacy preferences.
- `languages`: locales, capabilities, fallback policies.
- `curriculum`: programs, courses, units.
- `content`: learning packages, lessons, vocabulary.
- `activities`: activity definitions and evaluation.
- `experiences`: compositions, presets, renderer registry metadata.
- `stories`: story books, chapters, segments, translations.
- `voices`: voice catalog and provider capability.
- `media`: asset metadata and storage.
- `progress`: learning state and events.
- `ai-studio`: briefs, generation workflows and artifacts.
- `review`: editorial and safety review.
- `publishing`: version snapshots and release.
- `analytics`: aggregated product metrics.
- `audit`: sensitive administrative actions.

---

## 8. Hệ thống ngôn ngữ và localization

### 8.1. Language Registry

Không hard-code locale trong dropdown. Tạo `Language Registry` làm nguồn dữ liệu chuẩn.

Mỗi locale có thể có:

- `locale`: BCP-47 code.
- `languageCode`: ISO language subtag nếu cần.
- `displayName`: tên bản địa.
- `nativeName`: tên tự gọi.
- `direction`: `ltr` hoặc `rtl`.
- `enabled`: có được bật trong sản phẩm không.
- `learningEnabled`: có thể chọn làm ngôn ngữ học không.
- `uiEnabled`: có bản dịch UI không.
- `ttsEnabled`: có voice phù hợp không.
- `speechRecognitionEnabled`: có speech recognition không.
- `contentStatus`: mức độ nội dung đã sẵn sàng.
- `fallbackLocale`: fallback đã phê duyệt.

Các capability có thể thay đổi theo provider và model; không gộp tất cả thành một cờ `supported`.

### 8.2. Translation model

Nội dung có thể có nhiều bản locale. Ví dụ một vocabulary concept:

```json
{
  "conceptId": "fruit.apple",
  "translations": {
    "en": {
      "term": "apple",
      "example": "I see an apple."
    },
    "vi": {
      "term": "quả táo",
      "example": "Con nhìn thấy một quả táo."
    },
    "ja": {
      "term": "りんご",
      "example": "りんごがあります。"
    }
  }
}
```

Đây là ví dụ minh họa. Production schema nên dùng document/collection phù hợp với truy vấn, versioning và kiểm duyệt. Không giả định mọi concept đều có mọi locale.

### 8.3. Bản dịch không phải lúc nào cũng là bản tương đương

Với trẻ nhỏ, dịch máy từng chữ có thể tạo câu không tự nhiên hoặc sai ngữ cảnh. Cần phân biệt:

- `translation`: bản dịch có kiểm duyệt.
- `adaptation`: bản chuyển thể tự nhiên cho ngôn ngữ/độ tuổi.
- `transliteration`: phiên âm/chuyển tự khi phù hợp.
- `pronunciationGuide`: hướng dẫn phát âm đã được kiểm tra.
- `explanation`: giải thích khái niệm bằng ngôn ngữ khác.

Mỗi loại cần metadata và quy trình review riêng.

---

## 9. MongoDB data model

MongoDB linh hoạt nhưng không đồng nghĩa schema-free. Mỗi collection phải có schema version, validation, ownership, indexes và quy tắc migration.

### 9.1. Collections đề xuất

| Collection | Mục đích |
|---|---|
| `accounts` | Tài khoản phụ huynh |
| `learner_profiles` | Hồ sơ trẻ |
| `consents` | Consent và lịch sử thay đổi |
| `language_configs` | Language Registry và capability snapshot |
| `programs` | Chương trình học |
| `courses` | Khóa học |
| `units` | Chủ đề / nhóm bài |
| `learning_packages` | Gói nội dung độc lập ngôn ngữ hoặc có liên kết locale |
| `lessons` | Bài học |
| `activities` | Hoạt động học |
| `experience_compositions` | Bố cục trải nghiệm |
| `experience_presets` | Preset giao diện/trải nghiệm |
| `stories` | Truyện |
| `story_localizations` | Các bản ngôn ngữ của truyện |
| `voice_profiles` | Voice persona/config |
| `provider_capabilities` | Khả năng provider/model |
| `learning_assets` | Metadata ảnh, audio, video |
| `learning_progress` | Tiến độ hiện tại |
| `learning_events` | Event log có giới hạn lưu trữ |
| `assessment_results` | Kết quả đánh giá phù hợp lứa tuổi |
| `achievements` | Thành tựu |
| `learner_achievements` | Thành tựu của hồ sơ trẻ |
| `generation_jobs` | Job AI |
| `generation_artifacts` | Output trung gian AI |
| `content_versions` | Version nội dung |
| `review_tasks` | Review workflow |
| `publication_snapshots` | Bản phát hành bất biến |
| `audit_logs` | Audit trail |
| `provider_configs` | Cấu hình provider không chứa secret plaintext |

### 9.2. Quy tắc schema

Mọi domain document quan trọng nên có:

```json
{
  "_id": "stable-id",
  "schemaVersion": 1,
  "status": "draft",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

Các trường ownership, visibility, locale, version và status phải có kiểu rõ ràng. Dùng Zod hoặc validator tương đương ở API boundary; có thể dùng MongoDB JSON Schema validation cho các collection quan trọng.

### 9.3. Ví dụ learning package

```json
{
  "_id": "lp-fruits-a1",
  "schemaVersion": 1,
  "topicId": "topic.fruits",
  "ageBand": ["3-5"],
  "learningLevel": "starter",
  "learningLocales": ["en"],
  "explanationLocales": ["vi"],
  "objectives": [
    "recognize_fruit_words",
    "listen_and_select"
  ],
  "conceptRefs": [
    "fruit.apple",
    "fruit.banana",
    "fruit.orange"
  ],
  "availableExperienceModes": [
    "guided",
    "story",
    "game",
    "flashcards",
    "listening"
  ],
  "status": "draft"
}
```

### 9.4. Ví dụ lesson locale config

```json
{
  "_id": "lesson-fruits-01",
  "schemaVersion": 1,
  "learningPackageId": "lp-fruits-a1",
  "localeVariants": {
    "en": {
      "title": "Fruit Time",
      "instructions": [
        "Listen and choose the fruit."
      ]
    }
  },
  "explanationVariants": {
    "vi": {
      "summary": "Bé nghe từ tiếng Anh và chọn hình ảnh đúng."
    }
  },
  "status": "draft"
}
```

### 9.5. Index gợi ý

- `learner_profiles`: `{ parentAccountId: 1, status: 1 }`
- `learning_progress`: unique `{ learnerId: 1, lessonId: 1, learningLocale: 1 }`
- `stories`: `{ status: 1, ageBands: 1, topicTags: 1 }`
- `story_localizations`: unique `{ storyId: 1, locale: 1, version: 1 }`
- `generation_jobs`: `{ status: 1, createdAt: 1 }`
- `review_tasks`: `{ status: 1, assignedTo: 1, createdAt: 1 }`
- `publication_snapshots`: unique `{ contentId: 1, version: 1 }`

Index thực tế phải dựa trên query patterns và explain plans; không tạo index tràn lan.

---

## 10. Lesson Engine và Activity schema

### 10.1. Activity types MVP

- `tap-to-select`
- `picture-choice`
- `listen-and-select`
- `match-pair`
- `flashcard`
- `story-segment`
- `repeat-after-me`

Mỗi activity có `type`, `schemaVersion`, `prompt`, `assets`, `localeRefs`, `interactionConfig`, `evaluationPolicy` và `completionRule`.

### 10.2. Ví dụ activity

```json
{
  "id": "activity-fruit-listen-01",
  "type": "listen-and-select",
  "schemaVersion": 1,
  "prompt": {
    "textRef": "concept.fruit.apple.term",
    "audioAssetRef": "audio-en-apple"
  },
  "options": [
    { "id": "apple", "imageAssetRef": "img-apple" },
    { "id": "banana", "imageAssetRef": "img-banana" },
    { "id": "orange", "imageAssetRef": "img-orange" }
  ],
  "evaluationPolicy": {
    "mode": "single-choice",
    "answerRef": "protected-answer-key"
  }
}
```

Đáp án và logic chấm điểm không nên lộ trong payload public nếu có thể bị khai thác. Server có thể đánh giá kết quả hoặc dùng payload đã ký/được kiểm soát.

### 10.3. Player requirements

- Resume lesson.
- Checkpoint sau activity.
- Hỗ trợ audio replay.
- Có captions khi cần.
- Hỗ trợ reduced motion.
- Lưu progress an toàn khi offline và đồng bộ sau.
- Không gửi thông tin định danh trẻ vào telemetry không cần thiết.

---

## 11. Story Reader đa ngôn ngữ

Story Reader là một module sản phẩm riêng, không chỉ là nút phát audio trên trang truyện.

### 11.1. Tính năng

- Chọn ngôn ngữ truyện từ danh sách locale có bản nội dung.
- Chọn narration locale độc lập nếu bản truyện hỗ trợ.
- Chọn voice profile dựa trên capability thực tế.
- Chọn phong cách đọc: `warm`, `playful`, `calm`, `adventurous`, `teacher-like` nếu provider hỗ trợ.
- Điều chỉnh tốc độ trong phạm vi được provider/player hỗ trợ.
- Pause, resume, replay câu/đoạn.
- Highlight câu đang đọc nếu có alignment dữ liệu.
- Caption và bật/tắt bản dịch.
- Chuyển chapter/segment.
- Ghi nhớ vị trí đọc.
- Tải audio offline nếu license và chính sách cho phép.

### 11.2. Voice Registry

Không gắn cứng “giọng nam/nữ” hoặc tên voice theo một provider. Dữ liệu voice nên mô tả:

- `voiceId`
- `providerId`
- `supportedLocales`
- `displayName`
- `voiceStyleTags`
- `ageAppropriate`
- `sampleAssetRef`
- `capabilities`
- `availability`
- `licenseMetadata`

Không suy diễn giới tính, độ tuổi hoặc tính cách thật của người nói từ voice label. Chỉ hiển thị đặc tính mà provider công bố và sản phẩm đã kiểm tra.

### 11.3. TTS pipeline

1. Chọn text segment và locale.
2. Kiểm tra quyền sử dụng nội dung.
3. Chọn provider/model/voice theo capability.
4. Chuẩn hóa prompt và pronunciation hints.
5. Tạo audio qua job queue.
6. Kiểm tra audio duration, format, lỗi và nội dung.
7. Lưu file vào object storage.
8. Lưu metadata và liên kết với story segment.
9. Review trước khi publish nếu là nội dung dành cho trẻ.

Gemini TTS có thể là provider ban đầu, nhưng phải nằm sau `TtsProvider` interface. Không thiết kế domain schema phụ thuộc riêng Gemini.

---

## 12. AI Content Studio

AI Content Studio có hai chế độ sản xuất, cùng sử dụng một bộ domain service và pipeline.

### 12.1. Quick Production

Dành cho người muốn tạo nội dung nhanh:

1. Nhập chủ đề.
2. Chọn nhóm tuổi.
3. Chọn ngôn ngữ học.
4. Chọn ngôn ngữ giải thích.
5. Chọn mục tiêu học tập.
6. Chọn experience modes.
7. Chọn có tạo truyện, ảnh và voice hay không.
8. AI đề xuất curriculum / learning package.
9. AI tạo lesson, activity, story, media brief và audio jobs.
10. Preview, review, sửa và publish.

Quick Production tự động hóa nhiều công đoạn nhưng kết quả luôn ở trạng thái draft/review. Không auto-publish.

### 12.2. Advanced AI Production Studio

Cho phép người biên tập kiểm soát từng bước:

- Brief & learning goals.
- Curriculum / lesson outline.
- Vocabulary & concept map.
- Script / dialogue.
- Localization & adaptation.
- Story structure.
- Character design.
- Storyboard.
- Image generation.
- Voice / TTS.
- Activity authoring.
- Experience composition.
- Preview.
- Content QA.
- Safety review.
- Approval & publishing.

Mỗi stage phải cho phép regenerate một phần, sửa thủ công, xem diff, lưu version và quay lại phiên bản trước.

### 12.3. Multilingual production workflow

Pipeline phải hỗ trợ ba hướng:

- Tạo nội dung gốc trực tiếp bằng locale đích.
- Dịch nội dung đã có sang locale mới.
- Chuyển thể nội dung theo độ tuổi/ngữ cảnh văn hóa.

Không dùng một pipeline “dịch tất cả” cho cả ba. Mỗi artifact lưu `sourceLocale`, `targetLocale`, `operationType`, `provider`, `model`, `promptVersion`, `reviewStatus` và provenance.

### 12.4. Pipeline chuẩn

```text
Brief
  → Learning Goals
  → Curriculum / Package
  → Source Content
  → Localization / Adaptation
  → Story & Activities
  → Image / Audio Generation
  → Experience Composition
  → Automated QA
  → Human Review
  → Approval
  → Immutable Publication Snapshot
```

### 12.5. Output có cấu trúc

- Dùng JSON schema / structured output.
- Validate trước khi ghi database.
- Lưu prompt template version.
- Lưu model/provider/version và generation metadata.
- Retry có giới hạn, idempotency key.
- Không để AI tự tạo route, code hoặc renderer được thực thi.
- Không coi output AI là đúng chỉ vì parse thành công.

---

## 13. AI Provider Architecture

Định nghĩa interface độc lập với vendor:

```ts
interface TextGenerationProvider {
  generateText(input: TextGenerationInput): Promise<TextGenerationResult>;
}

interface StructuredGenerationProvider {
  generateStructured<T>(
    input: StructuredGenerationInput,
    schema: JsonSchema
  ): Promise<T>;
}

interface ImageGenerationProvider {
  generateImage(input: ImageGenerationInput): Promise<GeneratedAsset>;
}

interface TtsProvider {
  getCapabilities(): Promise<TtsCapabilities>;
  synthesize(input: TtsInput): Promise<GeneratedAudio>;
}

interface SpeechRecognitionProvider {
  transcribe(input: SpeechInput): Promise<TranscriptResult>;
}

interface SafetyReviewProvider {
  review(input: SafetyReviewInput): Promise<SafetyReviewResult>;
}
```

Có thể bổ sung pronunciation assessment sau khi đã đánh giá độ tin cậy và phù hợp với trẻ nhỏ.

### 13.1. Capability-based routing

Không chọn provider chỉ theo tên. Chọn theo:

- locale.
- task type.
- output format.
- voice/style support.
- latency.
- cost.
- availability.
- safety requirements.
- data residency / privacy requirements.

Nếu provider không hỗ trợ locale hoặc voice style, UI phải ẩn lựa chọn đó hoặc thông báo rõ.

### 13.2. Secrets

API key chỉ nằm ở server-side secret manager / environment variables. Không gửi secret đến browser, không commit `.env`, không lưu plaintext trong MongoDB.

---

## 14. Audio, speech và pronunciation

### 14.1. MVP

- Phát audio có sẵn.
- Replay từ/câu/đoạn.
- Điều chỉnh âm lượng/tốc độ trong giới hạn.
- Captions.
- Nghe rồi chọn hình.
- Story narration.

### 14.2. Ghi âm giọng trẻ

Tắt mặc định trong MVP. Chỉ triển khai sau khi:

- Có mục đích rõ ràng.
- Có parental consent riêng, có thể rút lại.
- Có chính sách retention và deletion.
- Có xử lý an toàn và giới hạn truy cập.
- Không sử dụng cho huấn luyện model nếu chưa có consent riêng, rõ ràng và hợp pháp.
- Có đánh giá pháp lý theo thị trường triển khai.

Không đồng nhất speech-to-text với chấm điểm phát âm. Không hiển thị điểm phát âm có vẻ chính xác nhưng thiếu căn cứ. Không làm trẻ xấu hổ hoặc tạo áp lực.

---

## 15. API design

Prefix: `/api/v1`

### 15.1. API chính

```text
POST   /auth/session
GET    /me
GET    /languages
GET    /languages/capabilities

GET    /learners
POST   /learners
PATCH  /learners/:learnerId
GET    /learners/:learnerId/preferences
PATCH  /learners/:learnerId/preferences

GET    /programs
GET    /programs/:programId
GET    /lessons/:lessonId
POST   /lessons/:lessonId/start
POST   /lessons/:lessonId/progress
POST   /activities/:activityId/answer

GET    /stories
GET    /stories/:storyId
GET    /stories/:storyId/localizations
GET    /voices?locale=en-US
POST   /stories/:storyId/audio-jobs

POST   /studio/quick-jobs
GET    /studio/jobs/:jobId
POST   /studio/advanced-projects
POST   /studio/projects/:projectId/stages/:stageId/run
PATCH  /studio/projects/:projectId/artifacts/:artifactId
POST   /studio/projects/:projectId/review
POST   /studio/projects/:projectId/publish

GET    /parent/dashboard
GET    /parent/consents
PATCH  /parent/preferences
POST   /parent/data-export
POST   /parent/data-deletion
```

Đây là route proposal, cần điều chỉnh theo auth model và scaffold thực tế.

### 15.2. API rules

- Validate request/response.
- AuthN/AuthZ ở server.
- Ownership checks cho mọi learner resource.
- Rate limit và abuse protection.
- Pagination cho danh sách.
- Idempotency cho generation jobs và progress writes.
- Không trả answer key hoặc internal prompt.
- Không trả stack trace/secret trong lỗi.
- Version API và schema độc lập.

---

## 16. Privacy, child safety và security

TM-Lingo là sản phẩm hướng đến trẻ em, vì vậy privacy và safety là điều kiện phát hành, không phải phần bổ sung sau.

### 16.1. Nguyên tắc dữ liệu tối thiểu

- Hồ sơ trẻ dùng nickname/avatar; tránh thu thập tên thật nếu không cần.
- Không yêu cầu vị trí chính xác.
- Không có open chat với người lạ.
- Không có public social feed trong MVP.
- Không có quảng cáo nhắm mục tiêu trẻ em.
- Không dùng dữ liệu trẻ để huấn luyện AI theo mặc định.
- Hạn chế telemetry và analytics có thể định danh.
- Có quy trình export, correction và deletion phù hợp.

### 16.2. Parental consent

- Tài khoản phụ huynh quản lý learner profiles.
- Consent phải theo mục đích, phiên bản, thời điểm và trạng thái.
- Consent cho xử lý dữ liệu cơ bản không tự động bao gồm consent ghi âm.
- Consent cho ghi âm không tự động bao gồm consent huấn luyện model.
- Cho phép rút consent và thực hiện deletion workflow.
- Lưu audit record tối thiểu cần thiết.

### 16.3. Security checklist

- Secure session/cookie strategy.
- CSRF protection nếu dùng cookie auth.
- Rate limit.
- Input validation.
- Output encoding.
- Upload MIME/size scanning.
- Signed media URLs khi cần.
- Secrets server-side.
- Encryption in transit và at rest theo dịch vụ sử dụng.
- Role-based authorization.
- Audit log cho hành động quản trị.
- Dependency scanning và security updates.
- Backup/restore test.

Cần legal review trước khi triển khai tại Việt Nam và từng thị trường khác, đặc biệt với dữ liệu cá nhân trẻ em, consent, lưu trữ và xử lý xuyên biên giới.

---

## 17. Offline, performance và accessibility

### 17.1. PWA

- Cache app shell.
- Cache metadata và nội dung đã được cấp quyền.
- IndexedDB cho progress queue/offline state.
- Đồng bộ có conflict policy.
- Không cache thông tin nhạy cảm không cần thiết.
- Parent có thể quản lý nội dung tải offline.

### 17.2. Performance

- Lazy load media.
- Responsive image variants.
- Audio streaming hoặc segment phù hợp.
- Preload có giới hạn.
- Không tải toàn bộ thư viện truyện/course.
- Tối ưu animation và tránh layout thrashing.
- Theo dõi Web Vitals và lỗi playback.

### 17.3. Accessibility

- Touch target lớn.
- Contrast đủ.
- Captions.
- Reduced motion.
- Không phụ thuộc duy nhất vào màu sắc.
- Có thể phát lại chỉ dẫn.
- Tránh hiệu ứng chớp nháy và âm thanh đột ngột.
- Hỗ trợ screen reader cho khu vực phụ huynh.

---

## 18. Android và triển khai

### 18.1. Chiến lược

Bắt đầu với web app responsive. Khi web app, API, auth, audio và offline ổn định, đóng gói bằng Capacitor cho Android.

Không duy trì hai codebase UI riêng biệt ở giai đoạn đầu trừ khi có yêu cầu native thực sự.

### 18.2. Capacitor

- Thêm Android platform sau khi PWA hoạt động ổn định.
- Kiểm thử WebView, audio focus, media playback, file download, keyboard, safe area và offline.
- Dùng native plugin chỉ khi Web API không đáp ứng.
- Giữ business logic và domain contracts ở web/shared layer.

### 18.3. Google AI Studio workflow

1. Dùng Build mode để scaffold web application theo hướng React + TypeScript nếu đó là lựa chọn phù hợp trong workspace.
2. Yêu cầu AI Studio tạo cấu trúc nhỏ, dễ hiểu, không sinh toàn bộ hệ thống trong một prompt.
3. Kiểm tra cấu trúc và package trước khi thêm thư viện.
4. Xây vertical slice end-to-end trước.
5. Kết nối MongoDB từ server runtime/API, không kết nối từ browser.
6. Thêm Gemini qua server-side adapter.
7. Export/sync GitHub sớm để có version control và review.
8. Chạy tests sau mỗi phase.
9. Tích hợp PWA và Capacitor sau khi web app ổn định.

Google AI Studio có thể cung cấp các workflow tạo ứng dụng web và các khả năng native Android riêng tùy chế độ/tài khoản. Với quyết định một codebase web-first của TM-Lingo, không chọn native Android generation làm kiến trúc chính. Kiểm tra khả năng và giới hạn hiện hành ngay trong workspace khi triển khai.

### 18.4. Environment variables

```env
NODE_ENV=development
APP_BASE_URL=http://localhost:3000

MONGODB_URI=
MONGODB_DATABASE=tm_lingo

GEMINI_API_KEY=
GEMINI_TEXT_MODEL=
GEMINI_IMAGE_MODEL=
GEMINI_TTS_MODEL=

OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=

SESSION_SECRET=
```

Chỉ đặt biến thực sự được dùng. Production secrets phải nằm trong secret manager của môi trường deploy.

---

## 19. Repository structure đề xuất

```text
tm-lingo/
├─ docs/
│  ├─ architecture/
│  ├─ product/
│  ├─ api/
│  └─ decisions/
├─ src/
│  ├─ app/
│  ├─ routes/
│  ├─ features/
│  │  ├─ parent/
│  │  ├─ learner/
│  │  ├─ curriculum/
│  │  ├─ lesson-player/
│  │  ├─ story-reader/
│  │  ├─ language-settings/
│  │  └─ content-studio/
│  ├─ components/
│  ├─ experiences/
│  │  ├─ renderers/
│  │  ├─ presets/
│  │  └─ registry/
│  ├─ i18n/
│  ├─ audio/
│  ├─ styles/
│  └─ shared/
├─ server/
│  ├─ api/
│  ├─ modules/
│  ├─ providers/
│  ├─ jobs/
│  ├─ database/
│  ├─ security/
│  └─ shared/
├─ packages/
│  └─ contracts/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ public/
└─ android/                 # tạo ở phase Capacitor
```

Điều chỉnh theo scaffold Google AI Studio hiện tại; không di chuyển file hàng loạt nếu không có lợi ích rõ ràng.

---

## 20. Design system và trải nghiệm giao diện

### 20.1. Hướng thiết kế

- Thân thiện, vui tươi, an toàn, ít gây quá tải.
- Hình ảnh rõ, typography dễ đọc.
- Có thể dùng màu sắc và chuyển động để tạo cảm xúc nhưng không biến mọi màn hình thành game.
- Khu vực phụ huynh và admin có mật độ thông tin cao hơn, nhưng dùng chung design tokens.
- Responsive cho điện thoại, tablet và desktop.

### 20.2. Hybrid experience

Không ép tất cả bài học vào một mẫu. Experience Preset quyết định cách trình bày, nhưng learning objective và nội dung có cấu trúc vẫn được giữ ổn định.

### 20.3. Cấu hình preset

```json
{
  "id": "preset-guided-playful",
  "mode": "guided",
  "visualDensity": "low",
  "animationLevel": "moderate",
  "audioGuidance": true,
  "showCaptions": true,
  "allowReplay": true,
  "reducedMotionCompatible": true,
  "interactionPacing": "child-led"
}
```

---

## 21. Analytics và progress

Chỉ thu thập dữ liệu cần thiết để cải thiện trải nghiệm và hỗ trợ phụ huynh.

Các event nội bộ có thể gồm:

- lesson_started
- lesson_paused
- lesson_completed
- activity_attempted
- activity_completed
- audio_replayed
- story_segment_completed
- locale_changed

Không ghi lại nội dung giọng nói thô hoặc dữ liệu nhạy cảm vào analytics. Dùng retention policy và aggregation. Parent dashboard nên giải thích tiến độ bằng ngôn ngữ tích cực, tránh xếp hạng trẻ với nhau.

---

## 22. Testing strategy

### 22.1. Unit tests

- Locale selection/fallback.
- Language capability filtering.
- Schema validators.
- Experience registry.
- Progress state transitions.
- Provider adapters.
- Permission checks.

### 22.2. Integration tests

- Mongo repositories.
- Auth and learner ownership.
- Lesson progress.
- Story localization retrieval.
- Voice capability filtering.
- Generation job lifecycle.
- Review/publish workflow.

### 22.3. E2E tests

- Parent tạo hồ sơ trẻ.
- Chọn English làm learning locale, Vietnamese làm explanation locale.
- Mở lesson.
- Nghe từ và chọn hình.
- Chuyển guided sang story/game nếu lesson hỗ trợ.
- Đọc truyện, đổi narration locale khi có bản phù hợp.
- Tiếp tục tiến độ sau reload/offline.
- Editor tạo nội dung draft, reviewer duyệt, publisher phát hành.

### 22.4. Content QA

- Đúng ngôn ngữ và locale.
- Ngữ pháp và cách diễn đạt tự nhiên.
- Phù hợp độ tuổi.
- Audio khớp text.
- Image khớp concept.
- Không có nội dung nguy hiểm, định kiến hoặc không phù hợp.
- Translation/adaptation được review.
- Không publish asset thiếu quyền hoặc thiếu metadata.

---

## 23. Roadmap triển khai

### Phase 0 — Foundation

- Tạo repo và cấu trúc.
- Thiết lập TypeScript, lint, format, tests.
- Thiết lập design tokens.
- Thiết lập API skeleton.
- MongoDB connection server-side.
- Contracts và schema validation.
- CI và environment setup.

**Exit criteria:** app chạy được, API health check, MongoDB kết nối an toàn, CI pass.

### Phase 1 — Identity, Parent & Learner

- Parent account/session.
- Learner profiles.
- Consent baseline.
- Parent settings.
- Authorization tests.

**Exit criteria:** phụ huynh tạo/quản lý hồ sơ; không truy cập chéo hồ sơ.

### Phase 2 — Language Registry & Content Core

- Language Registry.
- Locale preferences.
- Curriculum, packages, lessons, concepts.
- Localization model.
- Content validation.

**Exit criteria:** một lesson có English learning content và Vietnamese explanation; có thể bổ sung locale khác mà không sửa core lesson engine.

### Phase 3 — Lesson Engine

- Player shell.
- Activity renderers MVP.
- Progress/checkpoints.
- Resume.
- Audio replay.

**Exit criteria:** hoàn thành vertical slice Fruits.

### Phase 4 — Story Reader & Voice

- Story schema/localizations.
- Segment player.
- Voice Registry.
- TTS adapter.
- Captions/highlight nếu có alignment.
- Offline audio policy.

**Exit criteria:** truyện có ít nhất một locale hoạt động; UI chỉ hiển thị voice thực sự hỗ trợ locale đó.

### Phase 5 — Hybrid Experiences

- Guided.
- Story.
- Explore.
- Game.
- Flashcards.
- Listening.
- Experience presets.
- Reduced motion.

**Exit criteria:** cùng learning package có thể dùng nhiều experience modes mà không nhân bản nội dung gốc.

### Phase 6 — AI Quick Production

- Brief form.
- Generation pipeline.
- Structured outputs.
- Image/TTS jobs.
- Preview.
- Draft and review.

**Exit criteria:** tạo được learning package draft từ brief; không tự publish.

### Phase 7 — Advanced AI Production Studio

- Stage editor.
- Artifact versioning.
- Regenerate selected stage.
- Localization/adaptation workflow.
- Review queue.
- Approval and publishing.

**Exit criteria:** editor kiểm soát từng stage và truy vết được provenance.

### Phase 8 — Parent Dashboard & Product Quality

- Progress dashboard.
- Content assignment.
- Usage controls.
- Privacy/export/delete workflows.
- Performance and accessibility.

### Phase 9 — PWA & Android

- Offline strategy.
- Service worker.
- Capacitor Android.
- Device QA.
- Store readiness review.

### Phase 10 — Expand Languages

Chỉ bật locale mới khi có đủ:
- Language Registry entry.
- UI localization nếu cần.
- Learning content.
- Explanation/adaptation.
- Audio/voice capability nếu tính năng cần.
- QA và reviewer phù hợp.
- Parent-facing language information.

---

## 24. Definition of Done

Một tính năng chỉ được coi là hoàn thành khi:

- Có typed contracts và validation.
- Có authorization nếu dữ liệu thuộc learner/parent.
- Có loading, empty, error và retry states.
- Có unit/integration tests phù hợp.
- Có accessibility cơ bản.
- Có log không chứa secret hoặc dữ liệu trẻ không cần thiết.
- Có xử lý offline/error nếu feature liên quan.
- Có cập nhật docs.
- Không hard-code locale/provider.
- Không thực thi code từ database.
- Không bypass review/publishing policy.

Một locale mới chỉ được coi là hỗ trợ khi capability, nội dung và trải nghiệm thực tế đã được kiểm thử, không chỉ vì đã thêm mã locale vào dropdown.

---

## 25. Rủi ro và quyết định giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Tên/logic bị khóa vào English | Locale-first domain model |
| Bản dịch AI không tự nhiên | Review và adaptation workflow |
| Voice không hỗ trợ locale/style | Capability-based registry |
| AI sinh JSON sai | Structured output + schema validation |
| AI sinh nội dung không phù hợp trẻ | Safety QA + human review |
| Nội dung nhân bản theo từng ngôn ngữ | Shared concept/package + localized variants |
| MongoDB trở thành schema tùy tiện | Versioned schema, validation, migration |
| Audio/ảnh tốn chi phí | Cache, reuse, quota, job controls |
| Rò rỉ dữ liệu trẻ | Data minimization, access control, consent |
| Renderer thực thi nội dung không an toàn | Trusted renderer registry |
| Web/Android lệch hành vi | Web-first shared logic + device E2E |
| Publish nhầm nội dung AI | Draft/review/approve/publish separation |

---

## 26. Architecture Decision Records (ADR)

### ADR-001: Tên và phạm vi sản phẩm

Chọn `TM-Lingo` thay cho `TM-Kids-English` để phản ánh định hướng multilingual ngay từ đầu.

### ADR-002: Locale-first

Mọi domain liên quan ngôn ngữ dùng locale config; không gắn cứng English hoặc Vietnamese.

### ADR-003: Shared content, multiple experiences

Tách Learning Content khỏi Experience Composition và Experience Preset.

### ADR-004: MongoDB Atlas

Dùng MongoDB làm primary database với schema versioning, validation và migration.

### ADR-005: Web-first

Một codebase web/PWA trước; Android đóng gói bằng Capacitor khi phù hợp.

### ADR-006: AI provider adapters

Gemini là provider khởi đầu, không phải dependency của domain model.

### ADR-007: Human-reviewed publishing

AI output luôn là draft cho đến khi qua review và approval.

### ADR-008: Child privacy by design

Thu thập tối thiểu, parental consent, không open chat, không public social và không training trên dữ liệu trẻ theo mặc định.

---

## 27. Google AI Studio — Prompt triển khai tuần tự

Sử dụng từng prompt theo thứ tự. Không gửi tất cả cùng lúc. Sau mỗi bước, yêu cầu AI báo cáo file thay đổi, cách chạy, tests và các giả định.

### Prompt 1 — Project Foundation

```text
We are building TM-Lingo, a multilingual learning platform for children aged 3–5.
The first learning language is English (en), and the initial interface/explanation
language is Vietnamese (vi). The architecture must support more languages without
hard-coding English or Vietnamese.

Inspect the existing project before changing anything. Set up a clean, maintainable
React + TypeScript web application using the current supported scaffold. Establish
routing, design tokens, linting, formatting, and a minimal test setup. Do not build
the entire product yet. Do not add unnecessary dependencies. Report the resulting
structure and exact run/test commands.
```

### Prompt 2 — Domain Contracts & MongoDB

```text
Implement TM-Lingo domain contracts and server-side MongoDB access.
Create versioned schemas and validation for accounts, learner profiles, language
registry, learning packages, lessons, stories, experience compositions, progress,
and generation jobs. Keep MongoDB credentials server-only. Never connect to
MongoDB from browser code. Add repository/service boundaries and tests.
Do not hard-code English as the only learning language.
```

### Prompt 3 — Parent & Learner Experience

```text
Build the parent area and child profile flow for TM-Lingo. A parent can create
and manage learner profiles, choose interfaceLocale, learningLocale,
explanationLocale, and narrationLocale independently, and configure basic
learning preferences. Load selectable languages from the Language Registry.
Enforce ownership and authorization on the server. Use Vietnamese UI initially,
but keep all UI strings localizable.
```

### Prompt 4 — Content Core & Lesson Player

```text
Build the curriculum/content retrieval and Lesson Player. Implement the first
vertical slice: Fruits for age 3–5, English learning content and Vietnamese
explanations, with apple, banana, and orange concepts. Implement trusted activity
renderers for picture-choice, listen-and-select, flashcard, and match-pair.
Save progress and checkpoints. Do not execute HTML or JavaScript from database
content. Add unit, integration, and E2E tests.
```

### Prompt 5 — Hybrid Experience System

```text
Implement TM-Lingo's separation of Learning Content, Experience Composition,
and Experience Presets. Support guided, story, explore, game, flashcards,
read_aloud, listening, and speaking modes where compatible. One learning package
must be reusable across multiple experience modes without duplicating its core
content. Build a trusted renderer registry and reduced-motion support.
```

### Prompt 6 — Story Reader & Voice

```text
Build the multilingual Story Reader. The reader must select story localization,
narration locale, and voice from server-provided capabilities. Add segment playback,
pause/resume/replay, captions, translation toggle, reading position, and audio
asset metadata. Implement a provider-neutral TtsProvider interface and a Gemini
adapter on the server. Never expose API keys in the client. Do not display voices
that do not support the selected locale.
```

### Prompt 7 — AI Quick Production

```text
Build Quick Production for TM-Lingo AI Content Studio. Accept topic, age band,
learning locale, explanation locale, learning objectives, experience modes,
and optional story/image/audio generation. Run generation as background jobs.
Use structured outputs and schema validation. Store prompts, model/provider
metadata, artifacts, and versions. All generated content must remain draft and
must not be published automatically.
```

### Prompt 8 — Advanced AI Production Studio

```text
Build Advanced AI Production Studio using the same domain services and pipeline
as Quick Production. Provide editable stages for brief, curriculum, vocabulary,
script, localization/adaptation, story, storyboard, images, voice, activities,
experience composition, preview, QA, review, approval, and publishing. Support
regenerating one stage without overwriting unrelated approved artifacts. Add
version history, diff, audit events, and role-based review/publish permissions.
```

### Prompt 9 — Privacy, QA, PWA & Android Readiness

```text
Audit TM-Lingo for child privacy, authorization, data minimization, consent,
secrets handling, unsafe generated content, and untrusted rendering. Add tests
for parent/learner ownership and review/publish permissions. Improve accessibility,
reduced motion, offline progress synchronization, and PWA behavior. Prepare a
Capacitor Android integration plan, but do not add native complexity before the
web application passes its quality gates. Provide a risk report and remaining
release blockers.
```

---

## 28. Vertical slice đầu tiên: Fruits

Đây là mẫu kiểm chứng kiến trúc trước khi mở rộng.

### Learning package

- Topic: Fruits.
- Age band: 3–5.
- Learning locale: `en`.
- Explanation locale: `vi`.
- Concepts: apple, banana, orange.
- Objectives: recognize vocabulary, listen and select, match image to word.

### Experience modes

- Guided: nghe hướng dẫn và chọn hình.
- Story: truyện ngắn ở khu chợ trái cây.
- Game: tìm trái cây theo âm thanh.
- Flashcards: xem hình, nghe từ, phát lại.
- Listening: nghe từ và chọn đúng hình.

### Story Reader

- Bản truyện tiếng Anh.
- Bản giải thích tiếng Việt.
- Narration tiếng Anh nếu voice provider hỗ trợ.
- Có thể thêm narration locale khác sau khi có bản truyện và voice được kiểm duyệt.

### Acceptance criteria

- Một learning package có nhiều experience compositions.
- Đổi interface locale không làm đổi learning locale.
- Đổi narration locale không làm thay đổi lesson content.
- Không hiển thị voice không tương thích.
- Progress được lưu theo learner, lesson và learning locale.
- Nội dung AI được lưu draft và cần review trước khi publish.

---

## 29. Hướng dẫn làm việc cho AI coding agent

1. Đọc tài liệu này và kiểm tra codebase hiện tại trước khi sửa.
2. Không giả định repository trống; giữ lại phần đang hoạt động.
3. Triển khai theo roadmap và vertical slice, không tạo toàn bộ sản phẩm trong một lần.
4. Không tự ý đổi stack hoặc thêm microservices.
5. Không hard-code `en` hoặc `vi` trong domain logic.
6. Không dùng MongoDB từ client.
7. Không để API key trong frontend.
8. Không thực thi HTML/JS do AI hoặc database sinh ra.
9. Mọi output AI phải validate bằng schema.
10. Không tự publish nội dung AI.
11. Không thu âm trẻ trong MVP.
12. Mỗi phase phải có tests, docs và báo cáo file thay đổi.
13. Nếu yêu cầu mâu thuẫn với tài liệu, nêu rõ mâu thuẫn và đề xuất ADR trước khi thay đổi kiến trúc.
14. Không tuyên bố tính năng hoàn tất nếu chưa chạy tests hoặc chưa nêu rõ giới hạn kiểm thử.

---

## 30. Tài liệu tham khảo kỹ thuật

Các tài liệu chính thức cần kiểm tra lại phiên bản và khả năng truy cập tại thời điểm triển khai:

- Google AI Studio Build mode: https://ai.google.dev/gemini-api/docs/aistudio-build-mode
- Google AI Studio / Android development updates: https://developers.googleblog.com/en/build-full-stack-android-apps-with-gemini-in-google-ai-studio/
- Capacitor documentation: https://capacitorjs.com/docs
- Capacitor Android: https://capacitorjs.com/docs/android
- Gemini Text-to-Speech overview: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/overview
- Gemini TTS documentation: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts

Các tài liệu này là điểm bắt đầu nghiên cứu, không phải cam kết rằng mọi model, locale, voice hoặc tính năng đều có sẵn trong mọi tài khoản/khu vực. Kiểm tra capability thực tế trước khi bật tính năng.

---

## Kết luận

**TM-Lingo là nền tảng học đa ngôn ngữ cho trẻ em, không phải ứng dụng tiếng Anh được mở rộng bằng bản dịch.**

English là ngôn ngữ học đầu tiên; Vietnamese là ngôn ngữ giao diện và giải thích ban đầu. Tất cả lớp kiến trúc — content, locale, lesson, experience, story, voice, AI production, progress và API — phải được thiết kế để mở rộng thêm ngôn ngữ mà không cần viết lại core system.

Ưu tiên triển khai: Foundation → Language Registry & Content Core → Lesson Engine → Story Reader → Hybrid Experiences → AI Quick Production → Advanced Studio → Privacy/Quality → PWA/Android → mở rộng locale.
