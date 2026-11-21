'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  STICKER_CATALOG,
  loadLearnerRewards,
  saveLearnerRewards,
  type PlacedSticker,
} from '../lib/learnerRewards';
import { playCardFlip, playSuccessChime } from '../audio/soundEffects';
import { AssetImage } from './AssetImage';

interface StickerBookModalProps {
  learnerId: string;
  learnerName: string;
  isVi: boolean;
  onClose: () => void;
}

export function StickerBookModal({
  learnerId,
  learnerName,
  isVi,
  onClose,
}: StickerBookModalProps) {
  const [rewardState, setRewardState] = useState(() =>
    loadLearnerRewards(learnerId)
  );
  const [selectedStickerId, setSelectedStickerId] = useState<string>(
    () => loadLearnerRewards(learnerId).unlockedStickerIds[0] ?? 'sticker-apple'
  );

  const unlockedSet = new Set(rewardState.unlockedStickerIds);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!unlockedSet.has(selectedStickerId)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = Math.max(
      10,
      Math.min(90, ((e.clientX - rect.left) / rect.width) * 100)
    );
    const yPercent = Math.max(
      14,
      Math.min(86, ((e.clientY - rect.top) / rect.height) * 100)
    );

    const placed: PlacedSticker = {
      instanceId: `ps-${Date.now().toString(36)}`,
      stickerId: selectedStickerId,
      xPercent,
      yPercent,
    };

    const next = {
      ...rewardState,
      placedStickers: [...rewardState.placedStickers.slice(-15), placed],
    };
    setRewardState(next);
    saveLearnerRewards(learnerId, next);
    playSuccessChime();
  };

  const handleRemovePlaced = (instanceId: string) => {
    const next = {
      ...rewardState,
      placedStickers: rewardState.placedStickers.filter(
        (p) => p.instanceId !== instanceId
      ),
    };
    setRewardState(next);
    saveLearnerRewards(learnerId, next);
    playCardFlip();
  };

  const handleClearCanvas = () => {
    const next = { ...rewardState, placedStickers: [] };
    setRewardState(next);
    saveLearnerRewards(learnerId, next);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Sổ sưu tập Sticker' : 'Sticker Book'}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-amber-700 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {isVi ? 'Sổ sưu tập nhãn dán' : 'Sticker Collection'} ·{' '}
                {unlockedSet.size}/{STICKER_CATALOG.length}
              </span>
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              {isVi
                ? `Trang Sticker của ${learnerName}`
                : `${learnerName}'s Sticker Board`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label={isVi ? 'Đóng' : 'Close'}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Interactive Scenic Sticker Canvas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-600">
                {isVi
                  ? 'Chọn một nhãn dán đã mở khóa bên dưới rồi chạm vào khu vườn để dán nhé!'
                  : 'Pick an unlocked sticker below, then tap anywhere on the meadow to place it!'}
              </p>
              {rewardState.placedStickers.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isVi ? 'Dán lại từ đầu' : 'Clear board'}</span>
                </button>
              )}
            </div>

            <div
              onClick={handleCanvasClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  const placed: PlacedSticker = {
                    instanceId: `ps-${Date.now().toString(36)}`,
                    stickerId: selectedStickerId,
                    xPercent: 25 + ((rewardState.placedStickers.length * 17) % 55),
                    yPercent: 30 + ((rewardState.placedStickers.length * 19) % 45),
                  };
                  const next = {
                    ...rewardState,
                    placedStickers: [
                      ...rewardState.placedStickers.slice(-15),
                      placed,
                    ],
                  };
                  setRewardState(next);
                  saveLearnerRewards(learnerId, next);
                  playSuccessChime();
                }
              }}
              className="relative h-60 sm:h-72 rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-100 via-sky-50 to-emerald-100 overflow-hidden cursor-crosshair select-none"
            >
              {/* Soft horizon hills */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-emerald-200/70 rounded-t-[100%]" />
              <div className="absolute right-8 top-6 w-12 h-12 rounded-full bg-amber-200/90" />

              {rewardState.placedStickers.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6 text-center">
                  <p className="text-sm font-medium text-sky-900/70">
                    {isVi
                      ? 'Chạm vào đây để dán nhãn dán đầu tiên của bé'
                      : 'Tap anywhere here to place your first sticker'}
                  </p>
                </div>
              )}

              {rewardState.placedStickers.map((item) => {
                const def = STICKER_CATALOG.find((s) => s.id === item.stickerId);
                if (!def) return null;
                return (
                  <motion.button
                    key={item.instanceId}
                    type="button"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      handleRemovePlaced(item.instanceId);
                    }}
                    title={
                      isVi
                        ? 'Chạm để gỡ nhãn dán này'
                        : 'Tap to remove this sticker'
                    }
                    style={{
                      left: `${item.xPercent}%`,
                      top: `${item.yPercent}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl border-2 border-white bg-white shadow-md overflow-hidden hover:scale-105 transition-transform cursor-pointer"
                  >
                    <AssetImage
                      assetRef={def.assetRef}
                      altOverride={isVi ? def.labelVi : def.labelEn}
                      className="w-full h-full object-cover"
                    />
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Sticker Tray */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900">
              {isVi ? 'Bộ sưu tập theo chủ đề' : 'Themed Sticker Tray'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STICKER_CATALOG.map((sticker) => {
                const isUnlocked = unlockedSet.has(sticker.id);
                const isSelected = selectedStickerId === sticker.id && isUnlocked;
                return (
                  <button
                    key={sticker.id}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => {
                      setSelectedStickerId(sticker.id);
                      playCardFlip();
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50/70'
                        : isUnlocked
                          ? 'border-slate-200 bg-white hover:border-sky-300 cursor-pointer'
                          : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0">
                      <AssetImage
                        assetRef={sticker.assetRef}
                        altOverride={isVi ? sticker.labelVi : sticker.labelEn}
                        className={`w-full h-full object-cover ${
                          isUnlocked ? '' : 'grayscale opacity-40'
                        }`}
                      />
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20">
                          <Lock className="w-4 h-4 text-slate-700" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {isVi ? sticker.labelVi : sticker.labelEn}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {isUnlocked
                          ? isVi
                            ? 'Đã mở khóa'
                            : 'Unlocked'
                          : isVi
                            ? 'Hoàn thành thêm bài để mở'
                            : 'Complete a lesson to unlock'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
