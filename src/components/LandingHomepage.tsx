'use client';

import { ArrowRight } from 'lucide-react';
import type { AgeGroupConfig } from '../../packages/contracts/types';

interface LandingHomepageProps {
  interfaceLocale: string;
  ageGroups: AgeGroupConfig[];
  onCreateAccount: (preferredAgeBand?: string) => void;
  onSignIn: () => void;
}

export function LandingHomepage({
  interfaceLocale,
  ageGroups,
  onCreateAccount,
  onSignIn,
}: LandingHomepageProps) {
  const isVi = interfaceLocale === 'vi';

  const pillars = isVi
    ? [
        {
          index: '01.',
          title: 'Lộ trình cá nhân hóa theo đúng lứa tuổi',
          body: 'Ngay khi tạo tài khoản và chọn độ tuổi từ 3 đến 18 (Mầm non – Lớp 12), giao diện, tốc độ phát âm, thời lượng học và danh sách bài học tự động điều chỉnh vừa sức.',
        },
        {
          index: '02.',
          title: 'Thư viện truyện kể đa nguồn kèm phát âm',
          body: 'Khám phá truyện cổ tích, ngụ ngôn, khoa học và văn học kinh điển theo danh mục; tải về đọc ngay với chế độ tô sáng từng từ, chạm tra nghĩa và chế độ đọc trước khi ngủ.',
        },
        {
          index: '03.',
          title: 'Học đa giác quan không gây quá tải',
          body: 'Kết hợp thẻ từ vựng có hình ảnh minh họa rõ ràng, luyện nghe – nói, trò chơi lật thẻ ghi nhớ và chế độ tập trung yên tĩnh không quảng cáo.',
        },
        {
          index: '04.',
          title: 'Không gian đồng hành minh bạch cho gia đình',
          body: 'Quản lý nhiều hồ sơ con trên cùng một tài khoản, giới hạn thời lượng màn hình mỗi ngày, theo dõi lịch học 7 ngày và bảo vệ cài đặt bằng cổng phụ huynh.',
        },
      ]
    : [
        {
          index: '01.',
          title: 'Age-matched curriculum from Pre-K to Grade 12',
          body: 'Select the learner’s exact age and grade when creating an account so typography, pacing, audio speed, and lesson decks adapt automatically.',
        },
        {
          index: '02.',
          title: 'Multi-source storybooks with read-along audio',
          body: 'Browse fables, nature, bedtime, and classic literature by category, save favorites to your bookshelf, and read with word-by-word highlighting and Bedtime Mode.',
        },
        {
          index: '03.',
          title: 'Calm multisensory practice without distractions',
          body: 'Move gently across guided lessons, illustrated flashcards, listening drills, and memory match games inside an ad-free focus stage.',
        },
        {
          index: '04.',
          title: 'Transparent family & parent controls',
          body: 'Manage multiple sibling profiles under one account, set gentle daily screen limits, review 7-day learning calendars, and lock settings with a parental gate.',
        },
      ];

  return (
    <div className="space-y-20 sm:space-y-24 pb-8">
      {/* 1. Editorial Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch pt-2 sm:pt-4">
        <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{isVi ? 'Mầm non – Lớp 12' : 'Pre-K to Grade 12'}</span>
            <span aria-hidden="true">·</span>
            <span>{isVi ? 'Đa ngôn ngữ' : 'Multilingual'}</span>
            <span aria-hidden="true">·</span>
            <span>{isVi ? 'Không quảng cáo' : 'Ad-free'}</span>
          </div>

          <h1
            className="font-display font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.08] [text-wrap:balance]"
            style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
          >
            {isVi
              ? 'Học ngoại ngữ tự nhiên theo từng giai đoạn trưởng thành.'
              : 'Calm multilingual learning built for every stage of growth.'}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
            {isVi
              ? 'TM-Lingo kết hợp bài học tương tác, phát âm chuẩn và thư viện truyện kể song ngữ. Tạo tài khoản gia đình, chọn đúng độ tuổi và để hệ thống sắp xếp bài học phù hợp nhất.'
              : 'TM-Lingo brings together structured vocabulary lessons, spoken stories, and calm parent controls. Create an account, select your learner’s age, and start with lessons tailored to their level.'}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => onCreateAccount()}
              className="inline-flex items-center gap-2 px-6 py-3 min-h-[46px] rounded-xl btn-accent text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>
                {isVi ? 'Tạo tài khoản miễn phí' : 'Create free account'}
              </span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-3 min-h-[46px] text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white underline-offset-4 hover:underline transition-colors whitespace-nowrap cursor-pointer"
            >
              {isVi ? 'Đã có tài khoản? Đăng nhập' : 'Sign in to existing account'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="h-full min-h-[280px] sm:min-h-[360px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
            <img
              src="/images/hero_tmlingo_editorial_1795256602555.jpg"
              alt={
                isVi
                  ? 'Không gian học ngoại ngữ và đọc truyện tranh TM-Lingo cho gia đình'
                  : 'Calm family reading and language study space with TM-Lingo'
              }
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* 2. K-12 Age Group Pathways (Live from DB catalog, zero demo user data) */}
      <section id="pathways" className="space-y-8 scroll-mt-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-accent">
              {isVi ? 'Lộ trình theo độ tuổi' : 'Age-Matched Curriculum'}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {isVi
                ? 'Chọn đúng độ tuổi khi đăng ký — bài học tự động điều chỉnh.'
                : 'Five structured pathways from age 3 to 18.'}
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            {isVi
              ? 'Mỗi cấp học có mật độ hình ảnh, tốc độ giọng đọc và thời lượng khuyến nghị riêng.'
              : 'Each stage adjusts visual density, speech speed, and daily study duration automatically.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {ageGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onCreateAccount(group.id)}
              className="group text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 flex flex-col justify-between gap-4 hover:border-accent transition-colors cursor-pointer"
            >
              <div className="space-y-2.5">
                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>
                    {group.minAge}–{group.maxAge} {isVi ? 'tuổi' : 'yrs'}
                  </span>
                  <span className="mx-1.5" aria-hidden="true">
                    ·
                  </span>
                  <span>{group.cefrRange}</span>
                </div>

                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {isVi ? group.gradeRange.vi : group.gradeRange.en}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                  {isVi ? group.descriptions.vi : group.descriptions.en}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-accent">
                <span className="tabular-nums">
                  {group.uiProfile.defaultDailyMinutes}{' '}
                  {isVi ? 'phút / ngày' : 'min / day'}
                </span>
                <ArrowRight
                  className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Core Capabilities — Editorial Split + Showcase Visual */}
      <section id="method" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start scroll-mt-24">
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-accent">
              {isVi ? 'Phương pháp & Trải nghiệm' : 'Method & Experience'}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {isVi
                ? 'Thiết kế cho sự tập trung và niềm vui đọc mỗi ngày.'
                : 'Built for steady daily habits and joyful reading.'}
            </h2>
          </div>

          <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
            <img
              src="/images/showcase_bilingual_reading_1795256602911.jpg"
              alt={
                isVi
                  ? 'Truyện tranh song ngữ và sổ ghi chú từ vựng TM-Lingo'
                  : 'Bilingual storybooks and language study notebooks'
              }
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="lg:col-span-7 divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
          {pillars.map((item) => (
            <div key={item.index} className="py-6 sm:py-7 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-6">
              <div className="sm:col-span-2 font-display text-sm font-bold text-accent tabular-nums">
                {item.index}
              </div>
              <div className="sm:col-span-10 space-y-2">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Focused Conversion Band */}
      <section
        id="start"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div className="space-y-2 max-w-2xl">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {isVi
              ? 'Sẵn sàng thiết lập lộ trình riêng cho gia đình bạn?'
              : 'Ready to set up a personalized path for your family?'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            {isVi
              ? 'Đăng ký tài khoản trong chưa đầy một phút, chọn độ tuổi của học viên và bắt đầu ngay với các bài học tương ứng.'
              : 'Create your account in under a minute, pick your learner’s age band, and begin immediately with matched lessons and stories.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onCreateAccount()}
            className="inline-flex items-center gap-2 px-6 py-3 min-h-[46px] rounded-xl btn-accent text-sm font-semibold whitespace-nowrap cursor-pointer"
          >
            <span>{isVi ? 'Bắt đầu tạo tài khoản' : 'Get started'}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
