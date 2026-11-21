import { useState } from 'react';
import { Check, MessageCircle, RotateCcw, Volume2 } from 'lucide-react';
import type {
  ActivityAnswerResponse,
  ActivityRendererType,
  PublicActivity,
} from '../../../packages/contracts/types';
import type { UiMessages } from '../../i18n/messages';
import { AssetImage } from '../../components/AssetImage';

export interface ActivityRendererProps {
  activity: PublicActivity;
  messages: UiMessages;
  showExplanation: boolean;
  isSpeaking: boolean;
  feedback: ActivityAnswerResponse | null;
  onSpeak: (text: string, locale: string) => void;
  onSubmitChoice: (selectedId: string) => void;
  onSubmitMatch: (pairs: Array<{ wordId: string; imageId: string }>) => void;
}

export function FlashcardRenderer({
  activity,
  messages,
  showExplanation,
  isSpeaking,
  onSpeak,
  onSubmitChoice,
}: ActivityRendererProps) {
  const cardOption = activity.options[0];
  const [heardOnce, setHeardOnce] = useState(false);

  const handleListen = () => {
    setHeardOnce(true);
    onSpeak(activity.spokenText, activity.spokenLocale);
    onSubmitChoice(activity.conceptId ?? activity.id);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
        {cardOption && (
          <AssetImage
            assetRef={cardOption.assetRef}
            altOverride={activity.promptText}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h3 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {activity.promptText}
        </h3>
        {cardOption && (
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
            {cardOption.label}
          </p>
        )}
        {activity.pronunciationGuide && (
          <p className="text-xs font-mono tracking-wide text-accent">
            /{activity.pronunciationGuide}/
          </p>
        )}
        {showExplanation && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {activity.promptExplanation}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleListen}
        className="inline-flex items-center gap-2.5 px-6 py-3.5 min-h-[48px] rounded-xl btn-accent font-semibold text-base transition-colors cursor-pointer"
      >
        <Volume2 className="w-5 h-5" aria-hidden="true" />
        <span className="whitespace-nowrap">
          {isSpeaking
            ? messages.player.replayButton
            : heardOnce
              ? messages.player.replayButton
              : messages.player.listenButton}
        </span>
      </button>
    </div>
  );
}

export function RepeatAfterMeRenderer({
  activity,
  messages,
  showExplanation,
  isSpeaking,
  onSpeak,
  onSubmitChoice,
}: ActivityRendererProps) {
  const cardOption = activity.options[0];
  const [saidAloud, setSaidAloud] = useState(false);

  const handleListen = () => {
    onSpeak(activity.spokenText, activity.spokenLocale);
  };

  const handleConfirmSpoken = () => {
    setSaidAloud(true);
    onSubmitChoice(activity.conceptId ?? activity.id);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
        {cardOption && (
          <AssetImage
            assetRef={cardOption.assetRef}
            altOverride={activity.promptText}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="text-center space-y-2 max-w-md">
        <p className="text-xs font-medium text-accent">
          {messages.player.repeatPrompt}
        </p>
        <h3 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {activity.promptText}
        </h3>
        {activity.pronunciationGuide && (
          <p className="text-sm font-mono font-medium text-slate-600 dark:text-slate-400">
            /{activity.pronunciationGuide}/
          </p>
        )}
        {cardOption && (
          <p className="text-base font-medium text-slate-700 dark:text-slate-300">
            {cardOption.label}
          </p>
        )}
        {showExplanation && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {activity.promptExplanation}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleListen}
          className="inline-flex items-center gap-2.5 px-6 py-3.5 min-h-[48px] rounded-xl btn-accent font-semibold text-base transition-colors cursor-pointer"
        >
          <Volume2 className="w-5 h-5" aria-hidden="true" />
          <span className="whitespace-nowrap">
            {isSpeaking
              ? messages.player.replayButton
              : messages.player.listenButton}
          </span>
        </button>

        <button
          type="button"
          onClick={handleConfirmSpoken}
          className={`inline-flex items-center gap-2.5 px-6 py-3.5 min-h-[48px] rounded-xl border font-semibold text-base transition-colors cursor-pointer ${
            saidAloud
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-accent hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          {saidAloud ? (
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <MessageCircle className="w-5 h-5 text-accent" aria-hidden="true" />
          )}
          <span className="whitespace-nowrap">
            {saidAloud
              ? messages.player.saidItDone
              : messages.player.saidItButton}
          </span>
        </button>
      </div>
    </div>
  );
}

export function ListenAndSelectRenderer({
  activity,
  messages,
  showExplanation,
  feedback,
  onSpeak,
  onSubmitChoice,
}: ActivityRendererProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (optionId: string) => {
    setSelectedId(optionId);
    onSubmitChoice(optionId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {activity.promptText}
          </h3>
          {showExplanation && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {activity.promptExplanation}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSpeak(activity.spokenText, activity.spokenLocale)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl btn-accent font-semibold transition-colors shrink-0 cursor-pointer"
        >
          <Volume2 className="w-5 h-5" aria-hidden="true" />
          <span className="whitespace-nowrap">{messages.player.listenButton}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {activity.options.map((option) => {
          const isChosen = selectedId === option.id;
          const isCorrectChoice = isChosen && feedback?.correct;
          const isRetryChoice = isChosen && feedback && !feedback.correct;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              className={`group text-left rounded-2xl border bg-white dark:bg-slate-950 p-3 transition-all cursor-pointer ${
                isCorrectChoice
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : isRetryChoice
                    ? 'border-amber-500 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-accent'
              }`}
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 mb-3">
                <AssetImage
                  assetRef={option.assetRef}
                  altOverride={option.label}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {option.label}
                </span>
                {isCorrectChoice && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="w-4 h-4" aria-hidden="true" />
                  </span>
                )}
              </div>
              {showExplanation && (
                <p className="px-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {option.explanationLabel}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PictureChoiceRenderer(props: ActivityRendererProps) {
  return <ListenAndSelectRenderer {...props} />;
}

export function MatchPairRenderer({
  activity,
  messages,
  showExplanation,
  onSpeak,
  onSubmitMatch,
}: ActivityRendererProps) {
  const pairs = activity.pairs ?? [];
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [wrongFlashId, setWrongFlashId] = useState<string | null>(null);

  // Deterministic shuffled display order for picture cards
  const orderedImages = [...pairs].reverse();

  const handleWordClick = (wordId: string, term: string) => {
    if (matchedIds.includes(wordId)) return;
    setSelectedWordId(wordId);
    setWrongFlashId(null);
    onSpeak(term, activity.spokenLocale);
  };

  const handleImageClick = (imageId: string) => {
    if (!selectedWordId || matchedIds.includes(imageId)) return;
    if (selectedWordId === imageId) {
      const nextMatched = [...matchedIds, imageId];
      setMatchedIds(nextMatched);
      setSelectedWordId(null);
      setWrongFlashId(null);
      if (nextMatched.length === pairs.length) {
        onSubmitMatch(nextMatched.map((id) => ({ wordId: id, imageId: id })));
      }
    } else {
      setWrongFlashId(imageId);
    }
  };

  const handleReset = () => {
    setMatchedIds([]);
    setSelectedWordId(null);
    setWrongFlashId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {activity.promptText}
          </h3>
          {showExplanation && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {activity.promptExplanation}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
          <span>
            {messages.player.matchedCount}: {matchedIds.length}/{pairs.length}
          </span>
          {matchedIds.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {messages.player.matchWordPrompt}
          </p>
          <div className="space-y-3">
            {pairs.map((pair) => {
              const isMatched = matchedIds.includes(pair.id);
              const isSelected = selectedWordId === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  disabled={isMatched}
                  onClick={() => handleWordClick(pair.id, pair.term)}
                  className={`w-full flex items-center justify-between px-5 py-4 min-h-[56px] rounded-xl border text-left font-semibold text-lg transition-colors cursor-pointer disabled:cursor-default ${
                    isMatched
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : isSelected
                        ? 'bg-accent-soft border-accent'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-accent'
                  }`}
                >
                  <span>{pair.term}</span>
                  {isMatched ? (
                    <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-slate-400" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {messages.player.matchPicPrompt}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {orderedImages.map((pair) => {
              const isMatched = matchedIds.includes(pair.id);
              const isWrong = wrongFlashId === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  disabled={isMatched}
                  onClick={() => handleImageClick(pair.id)}
                  className={`rounded-xl border p-2 bg-white dark:bg-slate-950 transition-all cursor-pointer disabled:cursor-default ${
                    isMatched
                      ? 'border-emerald-400 dark:border-emerald-700 opacity-75'
                      : isWrong
                        ? 'border-amber-500 ring-2 ring-amber-500/20'
                        : selectedWordId
                          ? 'border-accent'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900">
                    <AssetImage
                      assetRef={pair.assetRef}
                      altOverride={pair.term}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {isMatched && (
                    <div className="mt-1.5 flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{pair.term}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Trusted Renderer Registry: database records select a renderer key, never arbitrary HTML/JS.
export const RENDERER_REGISTRY: Record<
  ActivityRendererType,
  (props: ActivityRendererProps) => React.JSX.Element
> = {
  flashcard: FlashcardRenderer,
  'repeat-after-me': RepeatAfterMeRenderer,
  'listen-and-select': ListenAndSelectRenderer,
  'picture-choice': PictureChoiceRenderer,
  'match-pair': MatchPairRenderer,
};
