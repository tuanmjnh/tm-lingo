'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Eye,
  GripVertical,
  Languages,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import type {
  AgeGroupConfig,
  CmsLearningPackage,
  LearningLevel,
  MediaAssetRecord,
  StoryBook,
  StorySegment,
  VocabularyConcept,
} from '../../../packages/contracts/types';
import { apiClient } from '../../shared/apiClient';
import { ASSET_REGISTRY } from '../../shared/assetRegistry';
import { AssetImage } from '../../components/AssetImage';
import { speakText, stopSpeaking } from '../../audio/speechPlayer';

const BUILTIN_ASSET_KEYS = Object.keys(ASSET_REGISTRY);

interface PackageEditorProps {
  pkg: CmsLearningPackage;
  isVi: boolean;
  ageGroups: AgeGroupConfig[];
  mediaAssets: MediaAssetRecord[];
  onClose: () => void;
  onSaved: (updated: CmsLearningPackage) => void;
  onMediaChanged: () => void;
}

export function PackageEditorModal({
  pkg,
  isVi,
  ageGroups,
  mediaAssets,
  onClose,
  onSaved,
  onMediaChanged,
}: PackageEditorProps) {
  const imageAssets = mediaAssets.filter((a) => a.kind === 'image');
  const audioAssets = mediaAssets.filter((a) => a.kind === 'audio');

  const locales = Array.from(
    new Set([
      ...pkg.learningLocales,
      ...pkg.explanationLocales,
      ...Object.keys(pkg.titles),
      'en',
      'vi',
    ])
  );

  const [editLocale, setEditLocale] = useState(pkg.learningLocales[0] || 'en');
  const [titles, setTitles] = useState<Record<string, string>>({ ...pkg.titles });
  const [summaries, setSummaries] = useState<Record<string, string>>({
    ...pkg.summaries,
  });
  const [selectedAgeBands, setSelectedAgeBands] = useState<string[]>(
    pkg.ageBand?.length > 0 ? pkg.ageBand : ['3-5']
  );
  const [learningLevel, setLearningLevel] = useState<LearningLevel>(
    pkg.learningLevel || 'starter'
  );
  const [concepts, setConcepts] = useState<VocabularyConcept[]>(() =>
    pkg.concepts.map((c) => ({
      ...c,
      localizations: Object.fromEntries(
        Object.entries(c.localizations).map(([k, v]) => [k, { ...v }])
      ),
    }))
  );
  const [ttsVoice, setTtsVoice] = useState<'Kore' | 'Puck' | 'Zephyr'>('Kore');
  const [ttsBusyKey, setTtsBusyKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragConceptIdx, setDragConceptIdx] = useState<number | null>(null);

  const updateConceptLoc = (
    idx: number,
    locale: string,
    patch: Partial<VocabularyConcept['localizations'][string]>
  ) => {
    setConcepts((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const current = c.localizations[locale] ?? {
          term: '',
          example: '',
          explanation: '',
        };
        return {
          ...c,
          localizations: {
            ...c.localizations,
            [locale]: { ...current, ...patch },
          },
        };
      })
    );
  };

  const handleAddConcept = () => {
    const nextIdx = concepts.length + 1;
    setConcepts((prev) => [
      ...prev,
      {
        conceptId: `${pkg.id}.concept-${Date.now().toString(36)}-${nextIdx}`,
        schemaVersion: 1,
        assetRef: BUILTIN_ASSET_KEYS[nextIdx % BUILTIN_ASSET_KEYS.length],
        localizations: {
          en: {
            term: `Word ${nextIdx}`,
            example: `This is word ${nextIdx}.`,
            explanation: 'Short friendly description.',
          },
          vi: {
            term: `Từ mới ${nextIdx}`,
            example: `Đây là từ mới ${nextIdx}.`,
            explanation: 'Giải thích ngắn gọn dễ hiểu cho bé.',
          },
        },
      },
    ]);
  };

  const handleRemoveConcept = (idx: number) => {
    if (concepts.length <= 1) return;
    setConcepts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDuplicateConcept = (idx: number) => {
    const source = concepts[idx];
    if (!source) return;
    const clone: VocabularyConcept = {
      ...source,
      conceptId: `${pkg.id}.copy-${Date.now().toString(36)}-${idx + 1}`,
      localizations: Object.fromEntries(
        Object.entries(source.localizations).map(([k, v]) => [k, { ...v }])
      ),
    };
    setConcepts((prev) => [
      ...prev.slice(0, idx + 1),
      clone,
      ...prev.slice(idx + 1),
    ]);
  };

  const handleDropConcept = (targetIdx: number) => {
    if (dragConceptIdx === null || dragConceptIdx === targetIdx) {
      setDragConceptIdx(null);
      return;
    }
    setConcepts((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragConceptIdx, 1);
      if (moved) next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragConceptIdx(null);
  };

  const handleGenerateTts = async (idx: number, locale: string) => {
    const concept = concepts[idx];
    const loc = concept?.localizations[locale];
    const text = (loc?.term || '').trim();
    if (!text) {
      setError(
        isVi
          ? 'Hãy nhập từ vựng trước khi tạo giọng đọc AI.'
          : 'Enter a vocabulary term before generating AI voice.'
      );
      return;
    }
    const busyKey = `${idx}:${locale}`;
    setTtsBusyKey(busyKey);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.generateCmsTts({
        text: loc?.example ? `${text}. ${loc.example}` : text,
        locale,
        title: `${text} (${locale.toUpperCase()})`,
        voiceName: ttsVoice,
      });
      updateConceptLoc(idx, locale, { audioUrl: res.asset.publicUrl });
      onMediaChanged();
      setNotice(
        isVi
          ? `Đã tạo giọng đọc AI cho "${text}". Nhớ bấm Lưu thay đổi.`
          : `Generated AI voice for "${text}". Remember to save changes.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice generation failed');
    } finally {
      setTtsBusyKey(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.updateCmsPackage(pkg.id, {
        titles,
        summaries,
        ageBand: selectedAgeBands.length > 0 ? selectedAgeBands : ['3-5'],
        learningLevel,
        concepts,
      });
      onSaved(res.package);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save package');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Chỉnh sửa gói bài học' : 'Edit learning package'}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-mono text-slate-500">{pkg.id}</p>
            <h2 className="text-lg font-bold text-slate-900 truncate">
              {isVi ? 'Chỉnh sửa gói bài học' : 'Edit Learning Package'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={editLocale}
              onChange={(e) => setEditLocale(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
              aria-label="Edit locale"
            >
              {locales.map((loc) => (
                <option key={loc} value={loc}>
                  Locale: {loc.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              value={ttsVoice}
              onChange={(e) =>
                setTtsVoice(e.target.value as 'Kore' | 'Puck' | 'Zephyr')
              }
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
              aria-label={isVi ? 'Giọng đọc AI' : 'AI voice'}
            >
              <option value="Kore">{isVi ? 'Giọng Kore (Ấm áp)' : 'Voice: Kore (Warm)'}</option>
              <option value="Puck">{isVi ? 'Giọng Puck (Vui tươi)' : 'Voice: Puck (Cheerful)'}</option>
              <option value="Zephyr">{isVi ? 'Giọng Zephyr (Dịu dàng)' : 'Voice: Zephyr (Gentle)'}</option>
            </select>
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {notice && (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}
          {error && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Tiêu đề gói' : 'Package Title'} ({editLocale.toUpperCase()})
              </span>
              <input
                type="text"
                value={titles[editLocale] ?? ''}
                onChange={(e) =>
                  setTitles((prev) => ({ ...prev, [editLocale]: e.target.value }))
                }
                className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Mô tả ngắn' : 'Summary'} ({editLocale.toUpperCase()})
              </span>
              <input
                type="text"
                value={summaries[editLocale] ?? ''}
                onChange={(e) =>
                  setSummaries((prev) => ({
                    ...prev,
                    [editLocale]: e.target.value,
                  }))
                }
                className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="md:col-span-8 space-y-2">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Nhóm tuổi áp dụng' : 'Target Age Groups'}
              </span>
              <div className="flex flex-wrap gap-2">
                {ageGroups.map((g) => {
                  const checked = selectedAgeBands.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() =>
                        setSelectedAgeBands((prev) =>
                          prev.includes(g.id)
                            ? prev.length > 1
                              ? prev.filter((x) => x !== g.id)
                              : prev
                            : [...prev, g.id]
                        )
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                        checked
                          ? 'border-sky-600 bg-sky-50 text-sky-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {isVi ? g.shortLabels.vi : g.shortLabels.en}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="md:col-span-4 block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Mức độ học tập' : 'Learning Level'}
              </span>
              <select
                value={learningLevel}
                onChange={(e) =>
                  setLearningLevel(e.target.value as LearningLevel)
                }
                className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"
              >
                <option value="starter">Starter (Pre-A1)</option>
                <option value="foundation">Foundation (A1)</option>
                <option value="elementary">Elementary (A1–A2)</option>
                <option value="intermediate">Intermediate (A2–B1)</option>
                <option value="upper_intermediate">Upper-Int (B1–B2)</option>
                <option value="advanced">Advanced (B2+)</option>
              </select>
            </label>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-slate-900 tabular-nums">
                {isVi ? 'Danh sách từ vựng' : 'Vocabulary Concepts'} (
                {concepts.length})
              </h3>
              <button
                type="button"
                onClick={handleAddConcept}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isVi ? 'Thêm từ vựng' : 'Add Concept'}</span>
              </button>
            </div>

            {concepts.map((concept, idx) => {
              const loc = concept.localizations[editLocale] ?? {
                term: '',
                example: '',
                explanation: '',
                pronunciationGuide: '',
                audioUrl: '',
              };
              const busyKey = `${idx}:${editLocale}`;
              return (
                <div
                  key={concept.conceptId}
                  draggable
                  onDragStart={() => setDragConceptIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropConcept(idx)}
                  onDragEnd={() => setDragConceptIdx(null)}
                  className={`rounded-xl border p-4 space-y-3 transition-colors ${
                    dragConceptIdx === idx
                      ? 'border-sky-400 bg-sky-50/40'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 cursor-grab">
                      <GripVertical
                        className="w-3.5 h-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <span>
                        #{idx + 1} · {concept.conceptId}
                      </span>
                    </span>
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleDuplicateConcept(idx)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-sky-700 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isVi ? 'Nhân bản' : 'Duplicate'}</span>
                      </button>
                      {concepts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveConcept(idx)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isVi ? 'Xóa thẻ' : 'Remove'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    <div className="md:col-span-3 space-y-2">
                      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-white">
                        <AssetImage
                          assetRef={concept.assetRef}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <select
                        value={
                          BUILTIN_ASSET_KEYS.includes(concept.assetRef) ||
                          imageAssets.some((a) => a.publicUrl === concept.assetRef)
                            ? concept.assetRef
                            : ''
                        }
                        onChange={(e) => {
                          if (!e.target.value) return;
                          setConcepts((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, assetRef: e.target.value } : c
                            )
                          );
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800"
                      >
                        <option value="">
                          {isVi ? '-- Chọn ảnh minh họa --' : '-- Pick image --'}
                        </option>
                        <optgroup label="Built-in illustrations">
                          {BUILTIN_ASSET_KEYS.map((key) => (
                            <option key={key} value={key}>
                              {key}
                            </option>
                          ))}
                        </optgroup>
                        {imageAssets.length > 0 && (
                          <optgroup label="Media Library">
                            {imageAssets.map((asset) => (
                              <option key={asset.id} value={asset.publicUrl}>
                                {asset.title}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div className="md:col-span-9 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-slate-700">
                            {isVi ? 'Từ vựng' : 'Term'} ({editLocale.toUpperCase()})
                          </span>
                          <input
                            type="text"
                            value={loc.term}
                            onChange={(e) =>
                              updateConceptLoc(idx, editLocale, {
                                term: e.target.value,
                              })
                            }
                            className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-slate-700">
                            {isVi ? 'Phát âm gợi ý' : 'Pronunciation guide'}
                          </span>
                          <input
                            type="text"
                            value={loc.pronunciationGuide ?? ''}
                            onChange={(e) =>
                              updateConceptLoc(idx, editLocale, {
                                pronunciationGuide: e.target.value,
                              })
                            }
                            placeholder="/ˈæp.əl/"
                            className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                          />
                        </label>
                      </div>

                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-slate-700">
                          {isVi ? 'Câu ví dụ' : 'Example sentence'}
                        </span>
                        <input
                          type="text"
                          value={loc.example}
                          onChange={(e) =>
                            updateConceptLoc(idx, editLocale, {
                              example: e.target.value,
                            })
                          }
                          className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-slate-700">
                          {isVi ? 'Giải thích cho bé / phụ huynh' : 'Explanation'}
                        </span>
                        <input
                          type="text"
                          value={loc.explanation}
                          onChange={(e) =>
                            updateConceptLoc(idx, editLocale, {
                              explanation: e.target.value,
                            })
                          }
                          className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                        />
                      </label>

                      <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={loc.audioUrl ?? ''}
                          onChange={(e) =>
                            updateConceptLoc(idx, editLocale, {
                              audioUrl: e.target.value || undefined,
                            })
                          }
                          placeholder={
                            isVi
                              ? 'URL âm thanh (hoặc bấm Tạo giọng AI)'
                              : 'Audio URL (or click Generate Voice)'
                          }
                          className="flex-1 min-w-[180px] min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-mono"
                        />
                        {audioAssets.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                updateConceptLoc(idx, editLocale, {
                                  audioUrl: e.target.value,
                                });
                              }
                            }}
                            className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                          >
                            <option value="">
                              {isVi ? 'Chọn audio sẵn...' : 'Pick audio...'}
                            </option>
                            {audioAssets.map((a) => (
                              <option key={a.id} value={a.publicUrl}>
                                {a.title}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          disabled={ttsBusyKey === busyKey}
                          onClick={() => void handleGenerateTts(idx, editLocale)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {ttsBusyKey === busyKey
                              ? isVi
                                ? 'Đang tạo...'
                                : 'Generating...'
                              : isVi
                                ? 'Tạo giọng AI'
                                : 'Generate Voice'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            speakText({
                              text: loc.term,
                              locale: editLocale,
                              audioUrl: loc.audioUrl,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isVi ? 'Nghe' : 'Play'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              onClose();
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isVi ? 'Đóng' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>
              {saving
                ? isVi
                  ? 'Đang lưu...'
                  : 'Saving...'
                : isVi
                  ? 'Lưu thay đổi'
                  : 'Save Changes'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface StoryEditorProps {
  story: StoryBook;
  isVi: boolean;
  ageGroups: AgeGroupConfig[];
  mediaAssets: MediaAssetRecord[];
  onClose: () => void;
  onSaved: (updated: StoryBook) => void;
  onMediaChanged: () => void;
}

export function StoryEditorModal({
  story,
  isVi,
  ageGroups,
  mediaAssets,
  onClose,
  onSaved,
  onMediaChanged,
}: StoryEditorProps) {
  const imageAssets = mediaAssets.filter((a) => a.kind === 'image');
  const audioAssets = mediaAssets.filter((a) => a.kind === 'audio');

  const locales = Array.from(
    new Set([...story.availableLocales, ...Object.keys(story.titles), 'en', 'vi'])
  );

  const [editLocale, setEditLocale] = useState(
    story.availableLocales[0] || 'en'
  );
  const [titles, setTitles] = useState<Record<string, string>>({
    ...story.titles,
  });
  const [summaries, setSummaries] = useState<Record<string, string>>({
    ...story.summaries,
  });
  const [selectedAgeBands, setSelectedAgeBands] = useState<string[]>(
    story.ageBands?.length > 0 ? story.ageBands : ['3-5']
  );
  const [coverAssetRef, setCoverAssetRef] = useState(story.coverAssetRef);
  const [segments, setSegments] = useState<StorySegment[]>(() =>
    story.segments.map((s) => ({
      ...s,
      textByLocale: { ...s.textByLocale },
      explanationByLocale: { ...s.explanationByLocale },
      audioUrlByLocale: { ...(s.audioUrlByLocale ?? {}) },
    }))
  );
  const [ttsVoice, setTtsVoice] = useState<'Kore' | 'Puck' | 'Zephyr'>('Zephyr');
  const [ttsBusyKey, setTtsBusyKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragSegIdx, setDragSegIdx] = useState<number | null>(null);

  const handleAddSegment = () => {
    const order = segments.length + 1;
    setSegments((prev) => [
      ...prev,
      {
        id: `seg-${Date.now().toString(36)}-${order}`,
        order,
        assetRef: BUILTIN_ASSET_KEYS[order % BUILTIN_ASSET_KEYS.length],
        textByLocale: {
          en: `Page ${order} story sentence.`,
          vi: `Câu chuyện trang ${order}.`,
        },
        explanationByLocale: {
          en: 'Gentle note for parents.',
          vi: 'Gợi ý đọc cùng bé.',
        },
        audioUrlByLocale: {},
      },
    ]);
  };

  const handleRemoveSegment = (idx: number) => {
    if (segments.length <= 1) return;
    setSegments((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((seg, i) => ({ ...seg, order: i + 1 }))
    );
  };

  const handleDuplicateSegment = (idx: number) => {
    const source = segments[idx];
    if (!source) return;
    const clone: StorySegment = {
      ...source,
      id: `seg-copy-${Date.now().toString(36)}-${idx + 1}`,
      textByLocale: { ...source.textByLocale },
      explanationByLocale: { ...source.explanationByLocale },
      audioUrlByLocale: { ...(source.audioUrlByLocale ?? {}) },
    };
    setSegments((prev) =>
      [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)].map((s, i) => ({
        ...s,
        order: i + 1,
      }))
    );
  };

  const handleDropSegment = (targetIdx: number) => {
    if (dragSegIdx === null || dragSegIdx === targetIdx) {
      setDragSegIdx(null);
      return;
    }
    setSegments((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragSegIdx, 1);
      if (moved) next.splice(targetIdx, 0, moved);
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
    setDragSegIdx(null);
  };

  const handleGenerateTts = async (idx: number, locale: string) => {
    const seg = segments[idx];
    const text = (seg?.textByLocale[locale] || '').trim();
    if (!text) {
      setError(
        isVi
          ? 'Hãy nhập nội dung trang truyện trước khi tạo giọng AI.'
          : 'Enter page narration text before generating AI voice.'
      );
      return;
    }
    const busyKey = `${idx}:${locale}`;
    setTtsBusyKey(busyKey);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.generateCmsTts({
        text,
        locale,
        title: `${titles[locale] || story.id} p${idx + 1} (${locale.toUpperCase()})`,
        voiceName: ttsVoice,
      });
      setSegments((prev) =>
        prev.map((s, i) =>
          i === idx
            ? {
                ...s,
                audioUrlByLocale: {
                  ...(s.audioUrlByLocale ?? {}),
                  [locale]: res.asset.publicUrl,
                },
              }
            : s
        )
      );
      onMediaChanged();
      setNotice(
        isVi
          ? `Đã tạo giọng đọc AI cho trang ${idx + 1}. Nhớ bấm Lưu thay đổi.`
          : `Generated AI narration for page ${idx + 1}. Remember to save changes.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice generation failed');
    } finally {
      setTtsBusyKey(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.updateCmsStory(story.id, {
        titles,
        summaries,
        ageBands: selectedAgeBands.length > 0 ? selectedAgeBands : ['3-5'],
        coverAssetRef,
        segments,
      });
      onSaved(res.story);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save story');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Chỉnh sửa truyện kể' : 'Edit picture story'}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-mono text-slate-500">{story.id}</p>
            <h2 className="text-lg font-bold text-slate-900 truncate">
              {isVi ? 'Chỉnh sửa truyện kể' : 'Edit Picture Story'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={editLocale}
              onChange={(e) => setEditLocale(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              {locales.map((loc) => (
                <option key={loc} value={loc}>
                  Locale: {loc.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              value={ttsVoice}
              onChange={(e) =>
                setTtsVoice(e.target.value as 'Kore' | 'Puck' | 'Zephyr')
              }
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              <option value="Zephyr">{isVi ? 'Giọng Zephyr (Dịu dàng)' : 'Voice: Zephyr (Gentle)'}</option>
              <option value="Kore">{isVi ? 'Giọng Kore (Ấm áp)' : 'Voice: Kore (Warm)'}</option>
              <option value="Puck">{isVi ? 'Giọng Puck (Vui tươi)' : 'Voice: Puck (Cheerful)'}</option>
            </select>
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {notice && (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}
          {error && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
            <span className="text-xs font-semibold text-slate-700">
              {isVi ? 'Nhóm tuổi áp dụng' : 'Target Age Groups'}
            </span>
            <div className="flex flex-wrap gap-2">
              {ageGroups.map((g) => {
                const checked = selectedAgeBands.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setSelectedAgeBands((prev) =>
                        prev.includes(g.id)
                          ? prev.length > 1
                            ? prev.filter((x) => x !== g.id)
                            : prev
                          : [...prev, g.id]
                      )
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      checked
                        ? 'border-sky-600 bg-sky-50 text-sky-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {isVi ? g.shortLabels.vi : g.shortLabels.en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Tên truyện' : 'Title'} ({editLocale.toUpperCase()})
              </span>
              <input
                type="text"
                value={titles[editLocale] ?? ''}
                onChange={(e) =>
                  setTitles((prev) => ({ ...prev, [editLocale]: e.target.value }))
                }
                className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Tóm tắt' : 'Summary'} ({editLocale.toUpperCase()})
              </span>
              <input
                type="text"
                value={summaries[editLocale] ?? ''}
                onChange={(e) =>
                  setSummaries((prev) => ({
                    ...prev,
                    [editLocale]: e.target.value,
                  }))
                }
                className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">
                {isVi ? 'Ảnh bìa' : 'Cover asset'}
              </span>
              <select
                value={coverAssetRef}
                onChange={(e) => setCoverAssetRef(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-xs"
              >
                {BUILTIN_ASSET_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
                {imageAssets.map((a) => (
                  <option key={a.id} value={a.publicUrl}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-slate-900 tabular-nums">
                {isVi ? 'Các trang truyện' : 'Story Segments'} ({segments.length})
              </h3>
              <button
                type="button"
                onClick={handleAddSegment}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isVi ? 'Thêm trang' : 'Add Page'}</span>
              </button>
            </div>

            {segments.map((seg, idx) => {
              const audioUrl = seg.audioUrlByLocale?.[editLocale] ?? '';
              const busyKey = `${idx}:${editLocale}`;
              return (
                <div
                  key={seg.id}
                  draggable
                  onDragStart={() => setDragSegIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropSegment(idx)}
                  onDragEnd={() => setDragSegIdx(null)}
                  className={`rounded-xl border p-4 space-y-3 transition-colors ${
                    dragSegIdx === idx
                      ? 'border-sky-400 bg-sky-50/40'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 tabular-nums cursor-grab">
                      <GripVertical
                        className="w-3.5 h-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <span>
                        {isVi ? `Trang ${idx + 1}` : `Page ${idx + 1}`}
                      </span>
                    </span>
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleDuplicateSegment(idx)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-sky-700 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{isVi ? 'Nhân bản' : 'Duplicate'}</span>
                      </button>
                      {segments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSegment(idx)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isVi ? 'Xóa trang' : 'Remove'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    <div className="md:col-span-3 space-y-2">
                      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-white">
                        <AssetImage
                          assetRef={seg.assetRef}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <select
                        value={seg.assetRef}
                        onChange={(e) =>
                          setSegments((prev) =>
                            prev.map((s, i) =>
                              i === idx ? { ...s, assetRef: e.target.value } : s
                            )
                          )
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      >
                        {BUILTIN_ASSET_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                        {imageAssets.map((a) => (
                          <option key={a.id} value={a.publicUrl}>
                            {a.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-9 space-y-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-slate-700">
                          {isVi ? 'Lời kể' : 'Narration text'} (
                          {editLocale.toUpperCase()})
                        </span>
                        <textarea
                          rows={2}
                          value={seg.textByLocale[editLocale] ?? ''}
                          onChange={(e) =>
                            setSegments((prev) =>
                              prev.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      textByLocale: {
                                        ...s.textByLocale,
                                        [editLocale]: e.target.value,
                                      },
                                    }
                                  : s
                              )
                            )
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-slate-700">
                          {isVi ? 'Dịch / giải thích' : 'Explanation'} (
                          {editLocale.toUpperCase()})
                        </span>
                        <input
                          type="text"
                          value={seg.explanationByLocale[editLocale] ?? ''}
                          onChange={(e) =>
                            setSegments((prev) =>
                              prev.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      explanationByLocale: {
                                        ...s.explanationByLocale,
                                        [editLocale]: e.target.value,
                                      },
                                    }
                                  : s
                              )
                            )
                          }
                          className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                        />
                      </label>

                      <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={audioUrl}
                          onChange={(e) =>
                            setSegments((prev) =>
                              prev.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      audioUrlByLocale: {
                                        ...(s.audioUrlByLocale ?? {}),
                                        [editLocale]: e.target.value,
                                      },
                                    }
                                  : s
                              )
                            )
                          }
                          placeholder={
                            isVi
                              ? 'URL audio trang truyện'
                              : 'Page audio URL (optional)'
                          }
                          className="flex-1 min-w-[180px] min-h-[36px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-mono"
                        />
                        {audioAssets.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              if (!e.target.value) return;
                              setSegments((prev) =>
                                prev.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        audioUrlByLocale: {
                                          ...(s.audioUrlByLocale ?? {}),
                                          [editLocale]: e.target.value,
                                        },
                                      }
                                    : s
                                )
                              );
                            }}
                            className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                          >
                            <option value="">
                              {isVi ? 'Chọn audio sẵn...' : 'Pick audio...'}
                            </option>
                            {audioAssets.map((a) => (
                              <option key={a.id} value={a.publicUrl}>
                                {a.title}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          disabled={ttsBusyKey === busyKey}
                          onClick={() => void handleGenerateTts(idx, editLocale)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {ttsBusyKey === busyKey
                              ? isVi
                                ? 'Đang tạo...'
                                : 'Generating...'
                              : isVi
                                ? 'Tạo giọng AI'
                                : 'Generate Voice'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            speakText({
                              text: seg.textByLocale[editLocale] ?? '',
                              locale: editLocale,
                              audioUrl: audioUrl || undefined,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isVi ? 'Nghe' : 'Play'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              onClose();
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {isVi ? 'Đóng' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>
              {saving
                ? isVi
                  ? 'Đang lưu...'
                  : 'Saving...'
                : isVi
                  ? 'Lưu thay đổi'
                  : 'Save Changes'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface DraftPreviewModalProps {
  isVi: boolean;
  target:
    | { kind: 'package'; item: CmsLearningPackage }
    | { kind: 'story'; item: StoryBook };
  onClose: () => void;
}

export function DraftPreviewModal({
  isVi,
  target,
  onClose,
}: DraftPreviewModalProps) {
  const [step, setStep] = useState(0);
  const locales =
    target.kind === 'package'
      ? target.item.learningLocales
      : target.item.availableLocales;
  const [previewLocale, setPreviewLocale] = useState(locales[0] || 'en');
  const [showBilingual, setShowBilingual] = useState(true);
  const [slowVoice, setSlowVoice] = useState(false);

  const totalSteps =
    target.kind === 'package'
      ? target.item.concepts.length
      : target.item.segments.length;

  const currentConcept =
    target.kind === 'package' ? target.item.concepts[step] : null;
  const currentSegment =
    target.kind === 'story' ? target.item.segments[step] : null;

  const locConcept =
    currentConcept?.localizations[previewLocale] ??
    currentConcept?.localizations.en ??
    (currentConcept ? Object.values(currentConcept.localizations)[0] : null);

  const primaryText =
    target.kind === 'package'
      ? locConcept?.term ?? ''
      : currentSegment?.textByLocale[previewLocale] ??
        currentSegment?.textByLocale.en ??
        '';

  const secondaryText =
    target.kind === 'package'
      ? locConcept?.example ?? ''
      : currentSegment?.explanationByLocale.vi ??
        currentSegment?.explanationByLocale.en ??
        '';

  const explanationText =
    target.kind === 'package'
      ? currentConcept?.localizations.vi?.term
        ? `${currentConcept.localizations.vi.term} — ${currentConcept.localizations.vi.explanation ?? ''}`
        : locConcept?.explanation ?? ''
      : '';

  const assetRef =
    target.kind === 'package'
      ? currentConcept?.assetRef ?? 'img-apple'
      : currentSegment?.assetRef ?? 'img-story-fruit-market';

  const audioUrl =
    target.kind === 'package'
      ? locConcept?.audioUrl
      : currentSegment?.audioUrlByLocale?.[previewLocale];

  const targetBands =
    target.kind === 'package' ? target.item.ageBand : target.item.ageBands;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Xem thử góc nhìn học sinh' : 'Live Learner Preview'}
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Eye className="w-4 h-4 text-sky-600" aria-hidden="true" />
              <span>
                {isVi
                  ? 'Xem thử trực tiếp như học sinh'
                  : 'Live Learner Preview'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isVi ? 'Nhóm tuổi:' : 'Target ages:'} {targetBands.join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBilingual((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                showBilingual
                  ? 'border-sky-300 bg-sky-50 text-sky-900'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <Languages className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Song ngữ' : 'Bilingual'}</span>
            </button>
            <select
              value={previewLocale}
              onChange={(e) => setPreviewLocale(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold"
            >
              {Array.from(new Set([...locales, 'en', 'vi'])).map((loc) => (
                <option key={loc} value={loc}>
                  {loc.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 bg-[#FAF8F2]/60">
          {/* Stepping-stone progress bar */}
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: Math.max(1, totalSteps) }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  stopSpeaking();
                  setStep(idx);
                }}
                aria-label={`Step ${idx + 1}`}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === step
                    ? 'w-8 bg-sky-600'
                    : idx < step
                      ? 'w-2.5 bg-emerald-500'
                      : 'w-2.5 bg-slate-300'
                }`}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
            <div className="aspect-[16/10] w-full rounded-xl overflow-hidden border border-slate-100 bg-[#FAF8F2]">
              <AssetImage
                assetRef={assetRef}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-center space-y-2">
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                {primaryText}
              </p>
              {secondaryText && (
                <p className="text-base text-slate-700">{secondaryText}</p>
              )}
              {showBilingual && explanationText && (
                <p className="text-sm text-sky-800 bg-sky-50/70 rounded-xl px-3.5 py-2 inline-block">
                  {explanationText}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  speakText({
                    text: primaryText,
                    locale: previewLocale,
                    rate: slowVoice ? 0.78 : 0.96,
                    audioUrl,
                  })
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" aria-hidden="true" />
                <span>
                  {audioUrl
                    ? isVi
                      ? 'Phát giọng thu sẵn'
                      : 'Play attached audio'
                    : isVi
                      ? 'Nghe đọc mẫu'
                      : 'Listen'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSlowVoice((v) => !v)}
                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold tabular-nums cursor-pointer ${
                  slowVoice
                    ? 'border-sky-300 bg-sky-50 text-sky-900'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {slowVoice
                  ? isVi
                    ? 'Chậm (0.8x)'
                    : 'Slow (0.8x)'
                  : isVi
                    ? 'Bình thường (1.0x)'
                    : 'Normal (1.0x)'}
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => {
                stopSpeaking();
                setStep((s) => Math.max(0, s - 1));
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isVi ? 'Thẻ trước' : 'Previous'}</span>
            </button>
            <span className="text-xs font-semibold text-slate-500 tabular-nums">
              {step + 1} / {Math.max(1, totalSteps)}
            </span>
            <button
              type="button"
              disabled={step + 1 >= totalSteps}
              onClick={() => {
                stopSpeaking();
                setStep((s) => Math.min(totalSteps - 1, s + 1));
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              <span>{isVi ? 'Thẻ tiếp' : 'Next'}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
