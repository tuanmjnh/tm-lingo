export interface UiMessages {
  nav: {
    learn: string;
    stories: string;
    notifications: string;
    parents: string;
    startLesson: string;
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
    story: string;
  };
  player: {
    stepOf: string;
    listenButton: string;
    replayButton: string;
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
    signInGoogle: string;
    signOutButton: string;
  };
}

const VI_MESSAGES: UiMessages = {
  nav: {
    learn: 'Học bài',
    stories: 'Truyện kể',
    notifications: 'Thông báo',
    parents: 'Phụ huynh',
    startLesson: 'Bắt đầu học',
  },
  hero: {
    greeting: 'Chào bé',
    subtitle:
      'Khám phá tiếng Anh qua âm thanh, hình ảnh vẽ tay, ghép cặp nhẹ nhàng và truyện kể ngắn dành riêng cho lứa tuổi 3–5.',
    learningMeta: 'Đang học',
    explanationMeta: 'Giải thích',
    ageBand: 'Độ tuổi 3–5',
    continueButton: 'Vào bài học Trái cây',
    openStoryButton: 'Nghe truyện khu chợ',
  },
  modes: {
    heading: 'Chọn cách trải nghiệm cho cùng một gói bài học',
    description:
      'Một gói kiến thức Trái cây duy nhất có thể học theo nhiều chế độ mà không sao chép nội dung gốc.',
    guided: 'Có hướng dẫn',
    flashcards: 'Thẻ từ vựng',
    listening: 'Nghe & chọn',
    game: 'Ghép cặp',
    story: 'Đọc truyện',
  },
  player: {
    stepOf: 'Hoạt động',
    listenButton: 'Nghe phát âm',
    replayButton: 'Nghe lại',
    nextButton: 'Tiếp theo',
    previousButton: 'Quay lại',
    finishButton: 'Hoàn thành',
    restartButton: 'Học lại bài này',
    greatJob: 'Đúng rồi! Bé làm tốt lắm.',
    tryAgain: 'Chưa đúng rồi, bé nghe lại và chọn thử hình khác nhé.',
    lessonCompleteTitle: 'Bé đã hoàn thành bài học hôm nay!',
    lessonCompleteBody:
      'Tuyệt vời quá! Bé đã làm quen với quả táo, quả chuối và quả cam. Phụ huynh có thể chuyển chế độ trải nghiệm hoặc mở truyện kể tiếp theo.',
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
      'Thay đổi ngôn ngữ giao diện không làm thay đổi ngôn ngữ bé đang học. Danh sách được tải trực tiếp từ Language Registry.',
    interfaceLocale: 'Ngôn ngữ giao diện (interfaceLocale)',
    learningLocale: 'Ngôn ngữ đang học (learningLocale)',
    explanationLocale: 'Ngôn ngữ giải thích (explanationLocale)',
    narrationLocale: 'Ngôn ngữ đọc truyện (narrationLocale)',
    accessibilityHeading: 'Trợ năng & thời lượng học',
    reducedMotion: 'Giảm chuyển động (Reduced motion)',
    dailyLimit: 'Thời lượng khuyến nghị mỗi ngày',
    minutesUnit: 'phút',
    progressHeading: 'Tiến độ học tập của bé',
    noProgressYet: 'Bé chưa hoàn thành hoạt động nào trong phiên này.',
    completedLabel: 'Đã hoàn thành',
    inProgressLabel: 'Đang học dở',
    registryHeading: 'Language Registry (khả năng hệ thống)',
    statusReady: 'Sẵn sàng',
    statusPlanned: 'Đang phát triển',
    savedNotice: 'Đã lưu cài đặt',
    accountHeading: 'Tài khoản phụ huynh & đồng bộ đám mây',
    accountGuestNote:
      'Bạn đang ở chế độ dùng thử cục bộ. Đăng nhập Google để lưu hồ sơ bé, cài đặt ngôn ngữ và tiến độ học lên Firebase Firestore.',
    accountSignedInNote: 'Đang đồng bộ trực tiếp với Firebase Firestore.',
    signInGoogle: 'Đăng nhập bằng Google',
    signOutButton: 'Đăng xuất',
  },
};

const EN_MESSAGES: UiMessages = {
  nav: {
    learn: 'Learn',
    stories: 'Stories',
    notifications: 'Notifications',
    parents: 'Parents',
    startLesson: 'Start Lesson',
  },
  hero: {
    greeting: 'Hello',
    subtitle:
      'Discover English through clear voice audio, hand-painted illustrations, gentle matching, and short stories crafted for ages 3–5.',
    learningMeta: 'Learning',
    explanationMeta: 'Explanation',
    ageBand: 'Ages 3–5',
    continueButton: 'Open Fruits Lesson',
    openStoryButton: 'Read Market Story',
  },
  modes: {
    heading: 'Choose an experience mode for this learning package',
    description:
      'A single Fruits learning package powers multiple experiences without duplicating underlying vocabulary content.',
    guided: 'Guided',
    flashcards: 'Flashcards',
    listening: 'Listening',
    game: 'Match Game',
    story: 'Story',
  },
  player: {
    stepOf: 'Activity',
    listenButton: 'Listen',
    replayButton: 'Replay',
    nextButton: 'Next',
    previousButton: 'Back',
    finishButton: 'Finish',
    restartButton: 'Play Again',
    greatJob: 'Wonderful! You found the right fruit.',
    tryAgain: 'Good try! Listen once more and tap another picture.',
    lessonCompleteTitle: 'You finished today’s lesson!',
    lessonCompleteBody:
      'Well done! You practiced apple, banana, and orange. Switch experience modes or open the Fruit Market story anytime.',
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
      'Switching interface locale never alters the child’s learning locale. Options are loaded directly from the Language Registry.',
    interfaceLocale: 'Interface language (interfaceLocale)',
    learningLocale: 'Learning language (learningLocale)',
    explanationLocale: 'Explanation language (explanationLocale)',
    narrationLocale: 'Narration language (narrationLocale)',
    accessibilityHeading: 'Accessibility & session rhythm',
    reducedMotion: 'Reduced motion',
    dailyLimit: 'Suggested daily duration',
    minutesUnit: 'min',
    progressHeading: 'Learner progress',
    noProgressYet: 'No lesson activity saved yet for this learner.',
    completedLabel: 'Completed',
    inProgressLabel: 'In progress',
    registryHeading: 'Language Registry capabilities',
    statusReady: 'Ready',
    statusPlanned: 'Planned',
    savedNotice: 'Settings saved',
    accountHeading: 'Parent account & cloud sync',
    accountGuestNote:
      'You are in local preview mode. Sign in with Google to persist learner profiles, locale settings, and progress to Firebase Firestore.',
    accountSignedInNote: 'Synced live with Firebase Firestore.',
    signInGoogle: 'Sign in with Google',
    signOutButton: 'Sign out',
  },
};

const MESSAGE_BUNDLES: Record<string, UiMessages> = {
  vi: VI_MESSAGES,
  en: EN_MESSAGES,
};

export function getUiMessages(interfaceLocale: string): UiMessages {
  return MESSAGE_BUNDLES[interfaceLocale] ?? VI_MESSAGES;
}
