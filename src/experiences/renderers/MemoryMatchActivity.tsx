'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import type { VoiceProfile } from '../../../packages/contracts/types';
import { AssetImage } from '../../components/AssetImage';
import { speakText } from '../../audio/speechPlayer';
import {
  playCardFlip,
  playCelebrationFanfare,
  playGentleTryAgain,
  playSuccessChime,
} from '../../audio/soundEffects';

export interface MemoryPairItem {
  id: string;
  term: string;
  translation?: string;
  assetRef: string;
  audioUrl?: string;
}

interface MemoryCard {
  uid: string;
  pairId: string;
  variant: 'image' | 'word';
  term: string;
  translation?: string;
  assetRef: string;
  audioUrl?: string;
}

interface MemoryMatchActivityProps {
  items: MemoryPairItem[];
  learningLocale: string;
  isVi: boolean;
  audioSpeed?: number;
  voiceProfile?: VoiceProfile | null;
  accent?: string;
  preschoolAssist?: boolean;
  onComplete?: (moves: number) => void;
}

function buildDeck(items: MemoryPairItem[], seed: number): MemoryCard[] {
  const usable = items.slice(0, 6);
  const raw: MemoryCard[] = [];
  for (const item of usable) {
    raw.push({
      uid: `${item.id}-img`,
      pairId: item.id,
      variant: 'image',
      term: item.term,
      translation: item.translation,
      assetRef: item.assetRef,
      audioUrl: item.audioUrl,
    });
    raw.push({
      uid: `${item.id}-word`,
      pairId: item.id,
      variant: 'word',
      term: item.term,
      translation: item.translation,
      assetRef: item.assetRef,
      audioUrl: item.audioUrl,
    });
  }
  // Deterministic shuffle per round seed
  const copy = [...raw];
  let s = seed + 17;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    s = (s * 9301 + 49297) % 233280;
    const j = s % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function MemoryMatchActivity({
  items,
  learningLocale,
  isVi,
  audioSpeed = 0.9,
  voiceProfile = null,
  accent,
  preschoolAssist = true,
  onComplete,
}: MemoryMatchActivityProps) {
  const [roundSeed, setRoundSeed] = useState(1);
  const [flippedUids, setFlippedUids] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const [completedNotified, setCompletedNotified] = useState(false);

  const deck = useMemo(
    () => buildDeck(items, roundSeed),
    [items, roundSeed]
  );

  const totalPairs = Math.min(items.length, 6);
  const allMatched = totalPairs > 0 && matchedPairIds.length >= totalPairs;

  useEffect(() => {
    if (allMatched && !completedNotified) {
      setCompletedNotified(true);
      playCelebrationFanfare();
      onComplete?.(moves);
    }
  }, [allMatched, completedNotified, moves, onComplete]);

  const handleRestart = () => {
    setRoundSeed((s) => s + 1);
    setFlippedUids([]);
    setMatchedPairIds([]);
    setMoves(0);
    setLocked(false);
    setCompletedNotified(false);
  };

  const handleCardTap = (card: MemoryCard) => {
    if (locked) return;
    if (matchedPairIds.includes(card.pairId)) return;
    if (flippedUids.includes(card.uid)) return;

    playCardFlip();
    speakText({
      text: card.term,
      locale: learningLocale,
      accent,
      rate: audioSpeed,
      audioUrl: card.audioUrl,
      voiceProfile,
    });

    const nextFlipped = [...flippedUids, card.uid];
    setFlippedUids(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves((m) => m + 1);
      const firstCard = deck.find((c) => c.uid === nextFlipped[0]);
      if (firstCard && firstCard.pairId === card.pairId) {
        playSuccessChime();
        setMatchedPairIds((prev) =>
          prev.includes(card.pairId) ? prev : [...prev, card.pairId]
        );
        setFlippedUids([]);
      } else {
        setLocked(true);
        setTimeout(() => {
          playGentleTryAgain();
          setFlippedUids([]);
          setLocked(false);
        }, 850);
      }
    }
  };

  if (totalPairs < 2) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        {isVi
          ? 'Bài học này cần ít nhất 2 từ vựng để chơi trò lật thẻ ghi nhớ.'
          : 'This lesson needs at least 2 words to play Memory Match.'}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            {isVi ? 'Trò chơi lật thẻ ghi nhớ' : 'Memory Match'}
          </h3>
          <p className="text-sm text-slate-600">
            {isVi
              ? 'Chạm vào hai thẻ để ghép hình minh họa với từ vựng tương ứng.'
              : 'Tap two cards to match each picture with its word.'}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 tabular-nums">
          <span>
            {isVi ? 'Đã ghép:' : 'Matched:'} {matchedPairIds.length}/{totalPairs}
          </span>
          <span>
            {isVi ? 'Lượt lật:' : 'Moves:'} {moves}
          </span>
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isVi ? 'Chơi lại' : 'Play again'}</span>
          </button>
        </div>
      </div>

      {allMatched && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-emerald-900">
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-bold">
                {isVi
                  ? 'Tuyệt vời! Con đã ghép đúng tất cả các thẻ!'
                  : 'Wonderful! You matched every pair!'}
              </p>
              <p className="text-xs text-emerald-800 tabular-nums">
                {isVi
                  ? `Hoàn thành trong ${moves} lượt lật và đã mở thêm phần thưởng học tập.`
                  : `Finished in ${moves} moves and recorded your practice reward.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRestart}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
          >
            {isVi ? 'Chơi ván mới' : 'New round'}
          </button>
        </motion.div>
      )}

      <div
        className={`grid gap-3 sm:gap-4 ${
          totalPairs <= 3
            ? 'grid-cols-2 sm:grid-cols-3'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
        }`}
      >
        {deck.map((card, index) => {
          const isMatched = matchedPairIds.includes(card.pairId);
          const isRevealed = isMatched || flippedUids.includes(card.uid);

          return (
            <motion.button
              key={card.uid}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => handleCardTap(card)}
              disabled={isMatched}
              aria-label={
                isRevealed
                  ? card.term
                  : isVi
                    ? `Thẻ số ${index + 1}`
                    : `Card ${index + 1}`
              }
              className={`relative min-h-[144px] sm:min-h-[164px] rounded-2xl border-2 p-3 text-center transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer ${
                isMatched
                  ? 'border-emerald-300 bg-emerald-50/70'
                  : isRevealed
                    ? 'border-sky-400 bg-white'
                    : 'border-slate-200 bg-[#F8FAFC] hover:border-sky-300 hover:bg-sky-50/40'
              }`}
            >
              {!isRevealed ? (
                <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm font-bold text-sky-600 tabular-nums">
                    {index + 1}
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {isVi ? 'Chạm để mở' : 'Tap to flip'}
                  </span>
                </div>
              ) : card.variant === 'image' ? (
                <>
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#FAF8F2] border border-slate-100">
                    <AssetImage
                      assetRef={card.assetRef}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                  {preschoolAssist && (
                    <span className="text-xs font-semibold text-slate-700">
                      {card.term}
                    </span>
                  )}
                </>
              ) : (
                <div className="space-y-1.5 px-1">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sky-50 text-sky-600">
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                    {card.term}
                  </p>
                  {card.translation && (
                    <p className="text-xs text-slate-500">{card.translation}</p>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
