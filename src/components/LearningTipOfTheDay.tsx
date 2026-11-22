'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Heart,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { getTodayDateKey } from '../lib/learnerRewards';

interface LearningTipItem {
  id: string;
  category: 'routine' | 'listening' | 'family' | 'encouragement';
  titleVi: string;
  titleEn: string;
  bodyVi: string;
  bodyEn: string;
  audienceVi: string;
  audienceEn: string;
}

const LEARNING_TIPS: LearningTipItem[] = [
  {
    id: 'tip-echo-twice',
    category: 'listening',
    titleVi: 'Nghe 2 lần, nhắc lại 1 lần',
    titleEn: 'Listen twice, echo once',
    bodyVi:
      'Khuyến khích bé bấm nghe phát âm từ mới hai lần rồi đọc to theo. Việc lặp lại tự nhiên giúp tai làm quen ngữ điệu mà không cần ép học thuộc.',
    bodyEn:
      'Invite your child to tap the audio twice and echo the word aloud once. Natural repetition trains the ear without feeling like a drill.',
    audienceVi: 'Mẹo cho Phụ huynh & Bé',
    audienceEn: 'Parent & Child Tip',
  },
  {
    id: 'tip-mini-teacher',
    category: 'family',
    titleVi: 'Đổi vai: Bé làm "cô giáo nhí"',
    titleEn: 'Role reversal: Let your child teach you',
    bodyVi:
      'Sau buổi học hôm nay, hãy nhờ bé dạy lại cho bố mẹ 3 từ vựng bé thích nhất. Trẻ nhớ lâu gấp đôi khi được tự tin giải thích lại cho người khác!',
    bodyEn:
      'After today’s session, ask your child to teach you 3 words they learned. Kids retain twice as much when they get to be the teacher!',
    audienceVi: 'Gắn kết gia đình',
    audienceEn: 'Family Activity',
  },
  {
    id: 'tip-short-daily',
    category: 'routine',
    titleVi: '10 phút đều đặn hơn 1 giờ dồn cuối tuần',
    titleEn: '10 daily minutes beat a 1-hour weekend marathon',
    bodyVi:
      'Não bộ trẻ em ghi nhớ ngôn ngữ tốt nhất qua những phiên học ngắn, vui vẻ mỗi ngày. Chỉ cần giữ nhịp đều đặn là vốn từ sẽ tăng lên rõ rệt.',
    bodyEn:
      'Young brains absorb language best through short, joyful daily bursts. Staying consistent each day builds lasting vocabulary effortlessly.',
    audienceVi: 'Thói quen học tốt',
    audienceEn: 'Daily Habit',
  },
  {
    id: 'tip-real-world-hunt',
    category: 'family',
    titleVi: 'Trò chơi "Tìm từ quanh nhà"',
    titleEn: 'Play "Word Hunt" around the house',
    bodyVi:
      'Khi vào bếp hoặc đi siêu thị, hãy cùng bé gọi tên trái cây, màu sắc hay đồ vật bằng ngôn ngữ đang học để biến bài học thành đời thực.',
    bodyEn:
      'In the kitchen or at the market, point out fruits, colors, or everyday objects in the target language to bring lessons into real life.',
    audienceVi: 'Học qua đời sống',
    audienceEn: 'Real-World Practice',
  },
  {
    id: 'tip-celebrate-effort',
    category: 'encouragement',
    titleVi: 'Khen ngợi sự cố gắng của bé hôm nay',
    titleEn: 'Celebrate effort, not just perfection',
    bodyVi:
      'Một câu khen cụ thể như "Con đọc câu này rất rõ ràng!" giúp bé yêu thích việc thử nói từ mới và không ngại mắc lỗi khi phát âm.',
    bodyEn:
      'Specific praise like "You tried that tricky word so bravely!" builds confidence and makes kids excited to speak out loud.',
    audienceVi: 'Lời động viên',
    audienceEn: 'Encouragement',
  },
  {
    id: 'tip-bedtime-story',
    category: 'routine',
    titleVi: 'Một câu chuyện song ngữ trước giờ ngủ',
    titleEn: 'One bilingual story before bedtime',
    bodyVi:
      'Nghe kể chuyện song ngữ 5 phút buổi tối giúp bé thư giãn, liên kết hình ảnh với câu hoàn chỉnh và ngủ ngon hơn sau một ngày khám phá.',
    bodyEn:
      'Listening to a 5-minute bilingual story in the evening pairs pictures with full sentences and turns language time into cozy bonding.',
    audienceVi: 'Giờ kể chuyện',
    audienceEn: 'Storytime Tip',
  },
  {
    id: 'tip-switch-accents',
    category: 'listening',
    titleVi: 'Thử đổi giọng đọc vùng miền để luyện tai',
    titleEn: 'Try switching accents to train the ear',
    bodyVi:
      'Trong trình học và kể chuyện, bố mẹ có thể đổi giữa giọng Anh - Mỹ, Anh - Anh hoặc Anh - Úc để bé nghe quen nhiều ngữ điệu tự nhiên.',
    bodyEn:
      'Inside the Lesson Player or Story Reader, try switching between US, UK, and Australian voices so your child adapts to natural accents early.',
    audienceVi: 'Luyện nghe linh hoạt',
    audienceEn: 'Listening Boost',
  },
  {
    id: 'tip-point-and-act',
    category: 'encouragement',
    titleVi: 'Học từ mới bằng cử chỉ vui nhộn',
    titleEn: 'Act out new words with gestures',
    bodyVi:
      'Kết hợp từ vựng với hành động — như vẫy tay, nhảy lên hay giả tiếng con vật — giúp bé ghi nhớ qua vận động nhanh hơn rất nhiều.',
    bodyEn:
      'Pairing new words with playful actions—like waving, hopping, or mimicking animal sounds—anchors vocabulary through movement.',
    audienceVi: 'Mẹo cho Phụ huynh & Bé',
    audienceEn: 'Parent & Child Tip',
  },
  {
    id: 'tip-offline-ready',
    category: 'routine',
    titleVi: 'Học mọi lúc kể cả khi đi xa',
    titleEn: 'Keep learning smoothly on the go',
    bodyVi:
      'Mở trước một gói bài học yêu thích khi có Wi-Fi để ứng dụng lưu sẵn ngoại tuyến — bé vẫn có thể ôn từ vựng trên xe hoặc lúc mất mạng.',
    bodyEn:
      'Open a favorite lesson package while on Wi-Fi so it caches offline—your child can keep practicing smoothly even on car rides.',
    audienceVi: 'Mẹo tiện ích',
    audienceEn: 'Smart Study Tip',
  },
  {
    id: 'tip-curious-questions',
    category: 'family',
    titleVi: 'Đặt một câu hỏi mở sau mỗi trang truyện',
    titleEn: 'Ask one curious question per story page',
    bodyVi:
      'Hỏi bé "Con thấy mấy quả táo trong tranh?" hoặc "Bạn nhỏ đang cảm thấy thế nào?" để kích thích tư duy và giúp bé dùng từ vựng chủ động.',
    bodyEn:
      'Ask "What color is the hat?" or "What do you think happens next?" to spark curiosity and turn passive listening into active thinking.',
    audienceVi: 'Tương tác đọc hiểu',
    audienceEn: 'Active Reading',
  },
];

function getDayOfYearIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDayMs = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor(diff / oneDayMs));
}

function getDismissStorageKey(learnerId: string, dateKey: string): string {
  return `tm_lingo_tip_dismissed_v1:${learnerId || 'guest'}:${dateKey}`;
}

interface LearningTipOfTheDayProps {
  learnerId: string;
  learnerName?: string;
  interfaceLocale: string;
  reducedMotion?: boolean;
}

export function LearningTipOfTheDay({
  learnerId,
  learnerName,
  interfaceLocale,
  reducedMotion = false,
}: LearningTipOfTheDayProps) {
  const isVi = interfaceLocale === 'vi';
  const todayKey = getTodayDateKey();
  const baseIndex = getDayOfYearIndex() % LEARNING_TIPS.length;

  const [offset, setOffset] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Restore dismissal state cleanly per learner & calendar day
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(
        getDismissStorageKey(learnerId, todayKey)
      );
      setDismissed(stored === '1');
    } catch {
      setDismissed(false);
    }
    setOffset(0);
  }, [learnerId, todayKey]);

  if (dismissed) {
    return null;
  }

  const tip = LEARNING_TIPS[(baseIndex + offset) % LEARNING_TIPS.length];

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          getDismissStorageKey(learnerId, todayKey),
          '1'
        );
      } catch {
        // ignore storage errors
      }
    }
  };

  const handleNextTip = () => {
    setOffset((prev) => (prev + 1) % LEARNING_TIPS.length);
  };

  const CategoryIcon =
    tip.category === 'listening'
      ? Volume2
      : tip.category === 'family'
        ? Heart
        : tip.category === 'routine'
          ? BookOpen
          : Sparkles;

  return (
    <motion.section
      aria-label={isVi ? 'Mẹo học tập hôm nay' : 'Learning Tip of the Day'}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0.05 : 0.25, ease: 'easeOut' }}
      className="relative rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-r from-amber-50/90 via-white to-sky-50/60 dark:from-amber-950/35 dark:via-slate-900 dark:to-sky-950/30 p-4 sm:p-5 shadow-xs"
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        <div
          aria-hidden="true"
          className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 border border-amber-200/80 dark:border-amber-700/50 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5"
        >
          <Lightbulb className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <CategoryIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isVi ? 'Mẹo học hôm nay' : 'Learning Tip of the Day'}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-slate-300 dark:text-slate-600 text-xs"
            >
              ·
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isVi ? tip.audienceVi : tip.audienceEn}
              {learnerName ? ` · ${learnerName}` : ''}
            </span>
          </div>

          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {isVi ? tip.titleVi : tip.titleEn}
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
            {isVi ? tip.bodyVi : tip.bodyEn}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleNextTip}
            title={isVi ? 'Xem mẹo khác' : 'Show another tip'}
            aria-label={isVi ? 'Xem mẹo học khác' : 'Show another learning tip'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:border-amber-300 dark:hover:border-amber-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {isVi ? 'Mẹo khác' : 'Next tip'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            title={isVi ? 'Ẩn mẹo hôm nay' : 'Dismiss tip for today'}
            aria-label={
              isVi ? 'Ẩn mẹo học hôm nay' : 'Dismiss learning tip for today'
            }
            className="p-1.5 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.section>
  );
}
