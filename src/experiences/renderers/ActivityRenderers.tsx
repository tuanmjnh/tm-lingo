import { useState } from 'react';
import { Check, RotateCcw, Volume2 } from 'lucide-react';
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
      <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-white">
        {cardOption && (
          <AssetImage
            assetRef={cardOption.assetRef}
            altOverride={activity.promptText}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h3 className="text-4xl font-bold tracking-tight text-slate-900">
          {activity.promptText}
        </h3>
        {cardOption && (
          <p className="text-lg font-medium text-slate-700">{cardOption.label}</p>
        )}
        {showExplanation && (
          <p className="text-sm text-slate-500">{activity.promptExplanation}</p>
        )}
      </div>

      <button
        type="button"
        onClick={handleListen}
        className="inline-flex items-center gap-2.5 px-6 py-3.5 min-h-[48px] rounded-xl bg-sky-600 text-white font-semibold text-base hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 transition-colors cursor-pointer"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-slate-900">{activity.promptText}</h3>
          {showExplanation && (
            <p className="text-sm text-slate-600">{activity.promptExplanation}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSpeak(activity.spokenText, activity.spokenLocale)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 transition-colors shrink-0 cursor-pointer"
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
              className={`group text-left rounded-2xl border bg-white p-3 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 cursor-pointer ${
                isCorrectChoice
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : isRetryChoice
                    ? 'border-amber-500 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:border-sky-400'
              }`}
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-50 mb-3">
                <AssetImage
                  assetRef={option.assetRef}
                  altOverride={option.label}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-base font-semibold text-slate-900">
                  {option.label}
                </span>
                {isCorrectChoice && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <Check className="w-4 h-4" aria-hidden="true" />
                  </span>
                )}
              </div>
              {showExplanation && (
                <p className="px-1 text-xs text-slate-500 mt-0.5">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-slate-900">{activity.promptText}</h3>
          {showExplanation && (
            <p className="text-sm text-slate-600">{activity.promptExplanation}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600 tabular-nums shrink-0">
          <span>
            {messages.player.matchedCount}: {matchedIds.length}/{pairs.length}
          </span>
          {matchedIds.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">
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
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : isSelected
                        ? 'bg-sky-50 border-sky-600 text-sky-900'
                        : 'bg-white border-slate-200 text-slate-900 hover:border-sky-400'
                  }`}
                >
                  <span>{pair.term}</span>
                  {isMatched ? (
                    <Check className="w-5 h-5 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-slate-400" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">
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
                  className={`rounded-xl border p-2 bg-white transition-all cursor-pointer disabled:cursor-default ${
                    isMatched
                      ? 'border-emerald-400 opacity-75'
                      : isWrong
                        ? 'border-amber-500 ring-2 ring-amber-500/20'
                        : selectedWordId
                          ? 'border-sky-300 hover:border-sky-600'
                          : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-slate-50">
                    <AssetImage
                      assetRef={pair.assetRef}
                      altOverride={pair.term}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {isMatched && (
                    <div className="mt-1.5 flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700">
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
  'listen-and-select': ListenAndSelectRenderer,
  'picture-choice': PictureChoiceRenderer,
  'match-pair': MatchPairRenderer,
};
