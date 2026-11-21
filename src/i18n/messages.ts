export interface UiMessages {
  nav: {
    learn: string;
    stories: string;
    parents: string;
    admin: string;
    startLesson: string;
    languageSwitchLabel: string;
  };
  hero: {
    greeting: string;
    subtitle: string;
    learningMeta: string;
    explanationMeta: string;
    ageBand: string;
    continueButton: string;
    openStoryButton: string;
  };
  modes: {
    heading: string;
    description: string;
    guided: string;
    flashcards: string;
    listening: string;
    game: string;
    explore: string;
    story: string;
  };
  player: {
    stepOf: string;
    listenButton: string;
    replayButton: string;
    repeatPrompt: string;
    saidItButton: string;
    saidItDone: string;
    nextButton: string;
    previousButton: string;
    finishButton: string;
    restartButton: string;
    greatJob: string;
    tryAgain: string;
    lessonCompleteTitle: string;
    lessonCompleteBody: string;
    showExplanation: string;
    hideExplanation: string;
    matchWordPrompt: string;
    matchPicPrompt: string;
    matchedCount: string;
    checkpointSaved: string;
  };
  story: {
    heading: string;
    narrationLanguage: string;
    voiceSelect: string;
    speedLabel: string;
    captionsToggle: string;
    translationToggle: string;
    playSegment: string;
    stopAudio: string;
    previousPage: string;
    nextPage: string;
    pageOf: string;
    positionSaved: string;
    noVoiceAvailable: string;
  };
  parent: {
    heading: string;
    subtitle: string;
    profilesHeading: string;
    addLearner: string;
    nicknameLabel: string;
    ageLabel: string;
    createButton: string;
    cancelButton: string;
    languageHeading: string;
    languageNote: string;
    interfaceLocale: string;
    learningLocale: string;
    explanationLocale: string;
    narrationLocale: string;
    accessibilityHeading: string;
    reducedMotion: string;
    dailyLimit: string;
    minutesUnit: string;
    progressHeading: string;
    noProgressYet: string;
    completedLabel: string;
    inProgressLabel: string;
    registryHeading: string;
    statusReady: string;
    statusPlanned: string;
    savedNotice: string;
    accountHeading: string;
    accountGuestNote: string;
    accountSignedInNote: string;
    emailLabel: string;
    passwordLabel: string;
    displayNameLabel: string;
    signInTab: string;
    signUpTab: string;
    signInButton: string;
    signUpButton: string;
    signInGoogle: string;
    orWithEmail: string;
    signOutButton: string;
    signUpCheckEmail: string;
    mediaHeading: string;
    mediaSubtitle: string;
    mediaSignInHint: string;
    mediaTitleLabel: string;
    mediaFileLabel: string;
    mediaUploadButton: string;
    mediaUploading: string;
    mediaEmpty: string;
    mediaDelete: string;
    openAdminTitle: string;
    openAdminDesc: string;
    openAdminButton: string;
    roleParent: string;
    roleTeacher: string;
    roleAdmin: string;
  };
  footer: {
    adminPortal: string;
  };
}

const VI_MESSAGES: UiMessages = {
  nav: {
    learn: 'Học bài',
    stories: 'Truyện kể',
    parents: 'Phụ huynh',
    admin: 'Quản trị',
    startLesson: 'Bắt đầu học',
    languageSwitchLabel: 'Ngôn ngữ hiển thị',
  },
  hero: {
    greeting: 'Chào bé',
    subtitle:
      'Khám phá tiếng Anh qua âm thanh, hình ảnh vẽ tay, ghép cặp nhẹ nhàng và truyện kể ngắn dành riêng cho lứa tuổi 3–5.',
    learningMeta: 'Đang học',
    explanationMeta: 'Giải thích',
    ageBand: 'Độ tuổi 3–5',
    continueButton: 'Vào bài học ngay',
    openStoryButton: 'Mở thư viện truyện kể',
  },
  modes: {
    heading: 'Chọn cách trải nghiệm cho cùng một gói bài học',
    description:
      'Một gói kiến thức duy nhất có thể học theo nhiều chế độ khác nhau mà không sao chép nội dung gốc.',
    guided: 'Có hướng dẫn',
    flashcards: 'Thẻ từ vựng',
    listening: 'Nghe & chọn',
    game: 'Ghép cặp',
    explore: 'Nghe & đọc theo',
    story: 'Đọc truyện',
  },
  player: {
    stepOf: 'Hoạt động',
    listenButton: 'Nghe phát âm',
    replayButton: 'Nghe lại',
    repeatPrompt: 'Bé nghe mẫu rồi cùng đọc to theo thật chậm và vui vẻ nhé!',
    saidItButton: 'Con đã đọc theo!',
    saidItDone: 'Tuyệt vời! Con đọc to rất hay.',
    nextButton: 'Tiếp theo',
    previousButton: 'Quay lại',
    finishButton: 'Hoàn thành',
    restartButton: 'Học lại bài này',
    greatJob: 'Đúng rồi! Bé làm tốt lắm.',
    tryAgain: 'Chưa đúng rồi, bé nghe lại và chọn thử hình khác nhé.',
    lessonCompleteTitle: 'Bé đã hoàn thành bài học hôm nay!',
    lessonCompleteBody:
      'Tuyệt vời quá! Bé đã hoàn thành tất cả các hoạt động trong gói bài học này. Phụ huynh có thể chuyển chế độ trải nghiệm hoặc mở truyện kể tiếp theo.',
    showExplanation: 'Hiện giải thích',
    hideExplanation: 'Ẩn giải thích',
    matchWordPrompt: '1. Chọn một từ',
    matchPicPrompt: '2. Chọn bức tranh tương ứng',
    matchedCount: 'Đã ghép đúng',
    checkpointSaved: 'Đã lưu tiến độ',
  },
  story: {
    heading: 'Thư viện truyện đa ngôn ngữ',
    narrationLanguage: 'Ngôn ngữ đọc truyện',
    voiceSelect: 'Giọng đọc khả dụng',
    speedLabel: 'Tốc độ đọc',
    captionsToggle: 'Hiện phụ đề',
    translationToggle: 'Hiện giải thích',
    playSegment: 'Đọc đoạn này',
    stopAudio: 'Dừng đọc',
    previousPage: 'Trang trước',
    nextPage: 'Trang tiếp',
    pageOf: 'Đoạn',
    positionSaved: 'Đã ghi nhớ vị trí đọc',
    noVoiceAvailable: 'Chưa có giọng đọc cho ngôn ngữ này',
  },
  parent: {
    heading: 'Khu vực phụ huynh & cài đặt ngôn ngữ',
    subtitle:
      'Quản lý hồ sơ trẻ, tách biệt ngôn ngữ giao diện, ngôn ngữ học, ngôn ngữ giải thích và theo dõi tiến độ nhẹ nhàng không áp lực.',
    profilesHeading: 'Hồ sơ trẻ em',
    addLearner: 'Thêm hồ sơ bé',
    nicknameLabel: 'Tên gọi ở nhà (nickname)',
    ageLabel: 'Độ tuổi (3–5)',
    createButton: 'Tạo hồ sơ',
    cancelButton: 'Hủy',
    languageHeading: 'Cấu hình đa ngôn ngữ độc lập',
    languageNote:
      'Thay đổi ngôn ngữ giao diện không làm thay đổi ngôn ngữ bé đang học.',
    interfaceLocale: 'Ngôn ngữ giao diện',
    learningLocale: 'Ngôn ngữ đang học',
    explanationLocale: 'Ngôn ngữ giải thích',
    narrationLocale: 'Ngôn ngữ đọc truyện',
    accessibilityHeading: 'Trợ năng & thời lượng học',
    reducedMotion: 'Giảm chuyển động',
    dailyLimit: 'Thời lượng khuyến nghị mỗi ngày',
    minutesUnit: 'phút',
    progressHeading: 'Tiến độ học tập của bé',
    noProgressYet: 'Bé chưa hoàn thành hoạt động nào trong phiên này.',
    completedLabel: 'Đã hoàn thành',
    inProgressLabel: 'Đang học dở',
    registryHeading: 'Ngôn ngữ đang hỗ trợ',
    statusReady: 'Sẵn sàng',
    statusPlanned: 'Đang phát triển',
    savedNotice: 'Đã lưu cài đặt',
    accountHeading: 'Tài khoản phụ huynh',
    accountGuestNote:
      'Đăng nhập bằng Google hoặc email để lưu hồ sơ bé, đồng bộ tiến độ học và nhận thông báo nhắc học.',
    accountSignedInNote:
      'Đã đăng nhập · Hồ sơ và tiến độ học được đồng bộ tự động.',
    emailLabel: 'Email phụ huynh',
    passwordLabel: 'Mật khẩu (tối thiểu 6 ký tự)',
    displayNameLabel: 'Tên hiển thị',
    signInTab: 'Đăng nhập',
    signUpTab: 'Đăng ký mới',
    signInButton: 'Đăng nhập',
    signUpButton: 'Tạo tài khoản',
    signInGoogle: 'Đăng nhập nhanh bằng Google',
    orWithEmail: 'hoặc dùng email & mật khẩu',
    signOutButton: 'Đăng xuất',
    signUpCheckEmail: 'Đã tạo tài khoản phụ huynh thành công.',
    mediaHeading: 'Thư viện học liệu',
    mediaSubtitle:
      'Quản trị viên và giáo viên tải lên tranh minh họa và file thu âm giọng đọc (tối đa 10MB).',
    mediaSignInHint:
      'Chỉ tài khoản Quản trị viên hoặc Giáo viên mới có quyền quản lý học liệu.',
    mediaTitleLabel: 'Tên học liệu',
    mediaFileLabel: 'Chọn ảnh (PNG/JPG/WEBP) hoặc âm thanh (MP3/WAV/M4A)',
    mediaUploadButton: 'Tải lên',
    mediaUploading: 'Đang tải lên...',
    mediaEmpty: 'Chưa có học liệu nào được tải lên.',
    mediaDelete: 'Xóa',
    openAdminTitle: 'Quản trị hệ thống',
    openAdminDesc:
      'Quản lý bài học, truyện kể, học liệu, thông báo, ngôn ngữ và phân quyền nhân sự.',
    openAdminButton: 'Mở quản trị hệ thống',
    roleParent: 'Phụ huynh',
    roleTeacher: 'Giáo viên',
    roleAdmin: 'Quản trị viên',
  },
  footer: {
    adminPortal: 'Cổng quản trị',
  },
};

const EN_MESSAGES: UiMessages = {
  nav: {
    learn: 'Learn',
    stories: 'Stories',
    parents: 'Parents',
    admin: 'Admin',
    startLesson: 'Start Lesson',
    languageSwitchLabel: 'Display language',
  },
  hero: {
    greeting: 'Hello',
    subtitle:
      'Discover English through clear voice audio, hand-painted illustrations, gentle matching, and short stories crafted for ages 3–5.',
    learningMeta: 'Learning',
    explanationMeta: 'Explanation',
    ageBand: 'Ages 3–5',
    continueButton: 'Start Learning',
    openStoryButton: 'Open Picture Stories',
  },
  modes: {
    heading: 'Choose an experience mode for this learning package',
    description:
      'A single learning package powers multiple experiences without duplicating underlying vocabulary content.',
    guided: 'Guided',
    flashcards: 'Flashcards',
    listening: 'Listening',
    game: 'Match Game',
    explore: 'Listen & Say',
    story: 'Story',
  },
  player: {
    stepOf: 'Activity',
    listenButton: 'Listen',
    replayButton: 'Replay',
    repeatPrompt: 'Listen carefully and say the word aloud together — no rush, no scores!',
    saidItButton: 'I said it aloud!',
    saidItDone: 'Awesome voice! Ready for the next word.',
    nextButton: 'Next',
    previousButton: 'Back',
    finishButton: 'Finish',
    restartButton: 'Play Again',
    greatJob: 'Wonderful! You did a great job.',
    tryAgain: 'Good try! Listen once more and tap another picture.',
    lessonCompleteTitle: 'You finished today’s lesson!',
    lessonCompleteBody:
      'Well done! You completed every activity in this learning package. Switch experience modes or open a picture story anytime.',
    showExplanation: 'Show explanation',
    hideExplanation: 'Hide explanation',
    matchWordPrompt: '1. Tap a word',
    matchPicPrompt: '2. Tap the matching picture',
    matchedCount: 'Matched',
    checkpointSaved: 'Progress saved',
  },
  story: {
    heading: 'Multilingual Story Reader',
    narrationLanguage: 'Narration language',
    voiceSelect: 'Available voice',
    speedLabel: 'Reading speed',
    captionsToggle: 'Show text',
    translationToggle: 'Show explanation',
    playSegment: 'Read aloud',
    stopAudio: 'Stop',
    previousPage: 'Previous',
    nextPage: 'Next',
    pageOf: 'Segment',
    positionSaved: 'Reading position saved',
    noVoiceAvailable: 'No voice available for this locale',
  },
  parent: {
    heading: 'Parent controls & language configuration',
    subtitle:
      'Manage learner profiles, configure interface, learning, explanation, and narration locales independently, and review gentle progress.',
    profilesHeading: 'Learner profiles',
    addLearner: 'Add learner',
    nicknameLabel: 'Nickname',
    ageLabel: 'Age (3–5)',
    createButton: 'Create profile',
    cancelButton: 'Cancel',
    languageHeading: 'Independent locale settings',
    languageNote:
      'Switching interface language never alters the child’s learning language.',
    interfaceLocale: 'Interface language',
    learningLocale: 'Learning language',
    explanationLocale: 'Explanation language',
    narrationLocale: 'Narration language',
    accessibilityHeading: 'Accessibility & session rhythm',
    reducedMotion: 'Reduced motion',
    dailyLimit: 'Suggested daily duration',
    minutesUnit: 'min',
    progressHeading: 'Learner progress',
    noProgressYet: 'No lesson activity saved yet for this learner.',
    completedLabel: 'Completed',
    inProgressLabel: 'In progress',
    registryHeading: 'Supported languages',
    statusReady: 'Ready',
    statusPlanned: 'Planned',
    savedNotice: 'Settings saved',
    accountHeading: 'Parent account',
    accountGuestNote:
      'Sign in with Google or email to save learner profiles, sync progress across devices, and receive study reminders.',
    accountSignedInNote:
      'Signed in · Learner profiles and progress sync automatically.',
    emailLabel: 'Parent email',
    passwordLabel: 'Password (min 6 characters)',
    displayNameLabel: 'Display name',
    signInTab: 'Sign in',
    signUpTab: 'Create account',
    signInButton: 'Sign in',
    signUpButton: 'Create account',
    signInGoogle: 'Continue with Google',
    orWithEmail: 'or use email & password',
    signOutButton: 'Sign out',
    signUpCheckEmail: 'Parent account created successfully.',
    mediaHeading: 'Learning Media Library',
    mediaSubtitle:
      'Administrators and teachers upload curriculum illustrations and narration audio (up to 10MB).',
    mediaSignInHint:
      'Only Administrator or Teacher accounts can manage system learning media.',
    mediaTitleLabel: 'Asset title',
    mediaFileLabel: 'Choose image (PNG/JPG/WEBP) or audio (MP3/WAV/M4A)',
    mediaUploadButton: 'Upload',
    mediaUploading: 'Uploading...',
    mediaEmpty: 'No custom media uploaded yet.',
    mediaDelete: 'Delete',
    openAdminTitle: 'System Administration',
    openAdminDesc:
      'Manage lessons, stories, media library, notifications, languages, and staff permissions.',
    openAdminButton: 'Open System Admin',
    roleParent: 'Parent',
    roleTeacher: 'Teacher',
    roleAdmin: 'Administrator',
  },
  footer: {
    adminPortal: 'Admin Portal',
  },
};

const MESSAGE_BUNDLES: Record<string, UiMessages> = {
  vi: VI_MESSAGES,
  en: EN_MESSAGES,
};

export function getUiMessages(interfaceLocale: string): UiMessages {
  return MESSAGE_BUNDLES[interfaceLocale] ?? VI_MESSAGES;
}
