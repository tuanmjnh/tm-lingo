import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Square,
  Volume2,
} from 'lucide-react';
import type {
  LearnerProfile,
  LocaleConfig,
  StoryBook,
  VoiceProfile,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';
import { apiClient } from '../../shared/apiClient';
import {
  getFirestoreStoryPosition,
  saveFirestoreStoryPosition,
} from '../../shared/firestoreService';
import { speakText, stopSpeaking } from '../../audio/speechPlayer';
import { AssetImage } from '../../components/AssetImage';

interface StoryReaderProps {
  parentUid: string | null;
  learner: LearnerProfile;
  languages: LocaleConfig[];
  messages: UiMessages;
}

export function StoryReader({
  parentUid,
  learner,
  languages,
  messages,
}: StoryReaderProps) {
  const [story, setStory] = useState<StoryBook | null>(null);
  const [narrationLocale, setNarrationLocale] = useState(
    learner.preferences.narrationLocale
  );
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [speed, setSpeed] = useState(learner.preferences.audioSpeed);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setNarrationLocale(learner.preferences.narrationLocale);
  }, [learner.preferences.narrationLocale]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getStory('story-fruit-market', learner.id)
      .then(async (res) => {
        if (cancelled) return;
        setStory(res.story);
        if (parentUid) {
          const cloudPos = await getFirestoreStoryPosition(
            parentUid,
            learner.id,
            res.story.id
          ).catch(() => null);
          if (!cancelled && cloudPos) {
            setSegmentIndex(
              Math.min(cloudPos.segmentIndex, res.story.segments.length - 1)
            );
            return;
          }
        }
        if (res.readingPosition) {
          setSegmentIndex(
            Math.min(res.readingPosition.segmentIndex, res.story.segments.length - 1)
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, [learner.id, parentUid]);

  // Fetch voices filtered strictly by narrationLocale from server Voice Registry
  useEffect(() => {
    let cancelled = false;
    apiClient
      .getVoices(narrationLocale)
      .then((res) => {
        if (cancelled) return;
        setVoices(res.voices);
        setSelectedVoiceId(res.voices[0]?.voiceId ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          setVoices([]);
          setSelectedVoiceId('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [narrationLocale]);

  if (!story) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        Loading story...
      </div>
    );
  }

  const segment = story.segments[segmentIndex] ?? story.segments[0];
  const explanationLocale = learner.preferences.explanationLocale;
  const segmentText =
    segment.textByLocale[narrationLocale] ?? segment.textByLocale.en;
  const segmentExplanation =
    segment.explanationByLocale[explanationLocale] ??
    segment.explanationByLocale.vi;
  const activeVoice =
    voices.find((v) => v.voiceId === selectedVoiceId) ?? null;

  const persistPosition = async (nextIndex: number, nextLocale: string) => {
    try {
      if (parentUid) {
        await saveFirestoreStoryPosition(parentUid, {
          learnerId: learner.id,
          storyId: story.id,
          narrationLocale: nextLocale,
          segmentIndex: nextIndex,
        });
      } else {
        await apiClient.saveStoryPosition(story.id, {
          learnerId: learner.id,
          narrationLocale: nextLocale,
          segmentIndex: nextIndex,
        });
      }
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch {
      // ignore non-blocking save error
    }
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }
    speakText({
      text: segmentText,
      locale: narrationLocale,
      rate: speed,
      voiceProfile: activeVoice,
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false),
    });
  };

  const goToSegment = (nextIndex: number) => {
    stopSpeaking();
    setIsPlaying(false);
    setSegmentIndex(nextIndex);
    void persistPosition(nextIndex, narrationLocale);
  };

  const getLocaleLabel = (code: string) => {
    const found = languages.find((l) => l.locale === code);
    return found ? `${found.nativeName} (${found.locale})` : code;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left/Primary Zone: Picture Book Stage */}
      <section className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="aspect-[16/10] w-full bg-slate-50 overflow-hidden border-b border-slate-100">
          <AssetImage
            assetRef={segment.assetRef}
            altOverride={story.titles[narrationLocale] ?? story.titles.en}
            className="w-full h-full object-contain bg-[#FAF8F2]"
          />
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
            <span>
              {story.titles[narrationLocale] ?? story.titles.en} ·{' '}
              {messages.story.pageOf} {segmentIndex + 1}/{story.segments.length}
            </span>
            {savedNotice && (
              <span className="text-emerald-700 font-medium">
                {messages.story.positionSaved}
              </span>
            )}
          </div>

          {showCaptions && (
            <div
              className={`rounded-xl p-5 border transition-colors ${
                isPlaying
                  ? 'border-sky-300 bg-sky-50/70'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <p className="text-2xl sm:text-3xl font-semibold text-slate-900 leading-snug">
                {segmentText}
              </p>
              {showTranslation && (
                <p className="mt-3 text-base text-slate-600 leading-relaxed">
                  {segmentExplanation}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <button
              type="button"
              disabled={segmentIndex === 0}
              onClick={() => goToSegment(segmentIndex - 1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span className="whitespace-nowrap">
                {messages.story.previousPage}
              </span>
            </button>

            <button
              type="button"
              disabled={voices.length === 0}
              onClick={handlePlayToggle}
              className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <Square className="w-4 h-4 fill-current" aria-hidden="true" />
              ) : (
                <Volume2 className="w-5 h-5" aria-hidden="true" />
              )}
              <span className="whitespace-nowrap">
                {isPlaying
                  ? messages.story.stopAudio
                  : messages.story.playSegment}
              </span>
            </button>

            <button
              type="button"
              disabled={segmentIndex + 1 >= story.segments.length}
              onClick={() => goToSegment(segmentIndex + 1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              <span className="whitespace-nowrap">{messages.story.nextPage}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Right Zone: Narration & Capability Controls */}
      <aside className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">
            {messages.story.heading}
          </h2>
          <p className="text-sm text-slate-600">
            {story.summaries[explanationLocale] ?? story.summaries.vi}
          </p>
        </div>

        <div className="space-y-4 pt-2 border-t border-slate-100">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">
              {messages.story.narrationLanguage}
            </span>
            <select
              value={narrationLocale}
              onChange={(e) => {
                const nextLocale = e.target.value;
                stopSpeaking();
                setIsPlaying(false);
                setNarrationLocale(nextLocale);
                void persistPosition(segmentIndex, nextLocale);
              }}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
            >
              {story.availableLocales.map((loc) => (
                <option key={loc} value={loc}>
                  {getLocaleLabel(loc)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">
              {messages.story.voiceSelect}
            </span>
            {voices.length > 0 ? (
              <select
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
              >
                {voices.map((voice) => (
                  <option key={voice.voiceId} value={voice.voiceId}>
                    {voice.displayName} · {voice.voiceStyleTags.join(', ')}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-amber-700">
                {messages.story.noVoiceAvailable}
              </p>
            )}
          </label>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 tabular-nums">
              <span>{messages.story.speedLabel}</span>
              <span>{speed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.75}
              max={1.15}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-sky-600"
            />
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer">
              <span>{messages.story.captionsToggle}</span>
              <input
                type="checkbox"
                checked={showCaptions}
                onChange={(e) => setShowCaptions(e.target.checked)}
                className="w-4 h-4 accent-sky-600"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer">
              <span>{messages.story.translationToggle}</span>
              <input
                type="checkbox"
                checked={showTranslation}
                onChange={(e) => setShowTranslation(e.target.checked)}
                className="w-4 h-4 accent-sky-600"
              />
            </label>
          </div>
        </div>
      </aside>
    </div>
  );
}
