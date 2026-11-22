'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Mic,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { playGentleTryAgain, playSuccessChime } from '../audio/soundEffects';

interface PronunciationPracticeBarProps {
  targetText: string;
  spokenLocale: string;
  accent?: string;
  isVi: boolean;
  onPlayModel: () => void;
  onPronunciationSuccess?: (score: number) => void;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: {
      isFinal?: boolean;
      [altIndex: number]: {
        transcript?: string;
        confidence?: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function resolveRecognitionLang(locale: string, accent?: string): string {
  if (accent && /^[a-z]{2}-[A-Z]{2}$/.test(accent)) return accent;
  const base = locale.toLowerCase().split(/[-_]/)[0];
  if (base === 'vi') return 'vi-VN';
  if (base === 'en') return 'en-US';
  if (base === 'ja') return 'ja-JP';
  if (base === 'ko') return 'ko-KR';
  if (base === 'fr') return 'fr-FR';
  if (base === 'es') return 'es-ES';
  if (base === 'zh') return 'zh-CN';
  return locale || 'en-US';
}

function normalizePhrase(input: string, stripDiacritics: boolean): string {
  let out = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripDiacritics) {
    out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  return out;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

function scorePronunciation(
  target: string,
  spoken: string,
  locale: string
): number {
  const isViTarget = locale.toLowerCase().startsWith('vi');
  const tExact = normalizePhrase(target, false);
  const sExact = normalizePhrase(spoken, false);
  if (!tExact || !sExact) return 0;
  if (tExact === sExact) return 100;

  const tBase = normalizePhrase(target, !isViTarget);
  const sBase = normalizePhrase(spoken, !isViTarget);
  if (tBase === sBase) return 96;

  // Token overlap score (forgiving for young learners speaking short sentences)
  const targetTokens = tBase.split(' ').filter(Boolean);
  const spokenTokens = sBase.split(' ').filter(Boolean);
  const matchedTokens = targetTokens.filter((tok) =>
    spokenTokens.some(
      (sTok) =>
        sTok === tok ||
        (tok.length >= 3 && levenshteinDistance(tok, sTok) <= 1)
    )
  ).length;
  const tokenRatio =
    targetTokens.length > 0 ? matchedTokens / targetTokens.length : 0;

  // Character-level Levenshtein similarity
  const maxLen = Math.max(tBase.length, sBase.length);
  const charSim =
    maxLen > 0 ? 1 - levenshteinDistance(tBase, sBase) / maxLen : 0;

  // Diacritic-relaxed boost for Vietnamese learners still mastering tones
  let relaxedBoost = 0;
  if (isViTarget) {
    const tNoTone = normalizePhrase(target, true);
    const sNoTone = normalizePhrase(spoken, true);
    if (tNoTone === sNoTone) {
      relaxedBoost = 0.12;
    }
  }

  const combined = Math.min(
    1,
    tokenRatio * 0.55 + charSim * 0.45 + relaxedBoost
  );
  return Math.max(0, Math.min(100, Math.round(combined * 100)));
}

export function PronunciationPracticeBar({
  targetText,
  spokenLocale,
  accent,
  isVi,
  onPlayModel,
  onPronunciationSuccess,
}: PronunciationPracticeBarProps) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'recording'>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [playingRecording, setPlayingRecording] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const onSuccessRef = useRef(onPronunciationSuccess);
  onSuccessRef.current = onPronunciationSuccess;

  const stopAllCapture = () => {
    if (recordTimerRef.current) {
      window.clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (recordedAudioRef.current) {
      recordedAudioRef.current.pause();
      recordedAudioRef.current = null;
    }
    setPlayingRecording(false);
    setStatus('idle');
  };

  useEffect(() => {
    return () => {
      stopAllCapture();
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
        recordedUrlRef.current = null;
      }
    };
  }, []);

  const startSelfCheckRecording = async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setErrorMsg(
        isVi
          ? 'Trình duyệt hiện tại chưa hỗ trợ micro để luyện nói.'
          : 'This browser does not support microphone capture.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          if (recordedUrlRef.current) {
            URL.revokeObjectURL(recordedUrlRef.current);
          }
          const nextUrl = URL.createObjectURL(blob);
          recordedUrlRef.current = nextUrl;
          setRecordedUrl(nextUrl);
          playSuccessChime();
        }
        setStatus('idle');
      };

      recorder.start();
      setStatus('recording');
      recordTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 4500);
    } catch {
      setStatus('idle');
      setErrorMsg(
        isVi
          ? 'Chưa được cấp quyền micro. Hãy cho phép micro trên trình duyệt rồi thử lại.'
          : 'Microphone permission was denied. Please allow mic access and try again.'
      );
    }
  };

  const handleToggleSpeak = () => {
    if (status === 'listening' || status === 'recording') {
      stopAllCapture();
      return;
    }

    setErrorMsg(null);
    setTranscript(null);
    setScore(null);

    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      void startSelfCheckRecording();
      return;
    }

    try {
      const recognition = new RecognitionCtor();
      recognition.lang = resolveRecognitionLang(spokenLocale, accent);
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;
      recognition.continuous = false;
      recognitionRef.current = recognition;

      let receivedResult = false;

      recognition.onstart = () => {
        setStatus('listening');
      };

      recognition.onresult = (event) => {
        receivedResult = true;
        const firstResult = event.results?.[0];
        if (!firstResult) return;

        // Evaluate top alternatives and pick the best match (helpful for children's voices)
        let bestTranscript = '';
        let bestScore = -1;
        for (let i = 0; i < 3; i += 1) {
          const alt = firstResult[i];
          if (!alt?.transcript) continue;
          const candidateScore = scorePronunciation(
            targetText,
            alt.transcript,
            spokenLocale
          );
          if (candidateScore > bestScore) {
            bestScore = candidateScore;
            bestTranscript = alt.transcript;
          }
        }

        if (bestTranscript) {
          const finalScore = Math.max(0, bestScore);
          setTranscript(bestTranscript);
          setScore(finalScore);
          if (finalScore >= 72) {
            playSuccessChime();
            onSuccessRef.current?.(finalScore);
          } else {
            playGentleTryAgain();
          }
        }
      };

      recognition.onerror = (ev) => {
        const code = ev.error ?? '';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setErrorMsg(
            isVi
              ? 'Chưa được cấp quyền micro. Hãy cho phép micro trên trình duyệt để luyện phát âm.'
              : 'Microphone access was blocked. Allow mic permission to practice speaking.'
          );
        } else if (code === 'no-speech') {
          setErrorMsg(
            isVi
              ? 'Chưa nghe rõ giọng bé. Hãy bấm lại nút micro và đọc to hơn một chút nhé!'
              : 'No voice detected. Tap the mic again and speak a little louder!'
          );
        } else if (code !== 'aborted') {
          // Fall back gracefully to voice recording self-check
          recognitionRef.current = null;
          setStatus('idle');
          void startSelfCheckRecording();
          return;
        }
        setStatus('idle');
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setStatus('idle');
        if (!receivedResult) {
          // Keep any existing error message
        }
      };

      recognition.start();
    } catch {
      void startSelfCheckRecording();
    }
  };

  const handlePlayRecording = () => {
    if (!recordedUrl) return;
    if (recordedAudioRef.current) {
      recordedAudioRef.current.pause();
      recordedAudioRef.current = null;
      setPlayingRecording(false);
      return;
    }
    const audio = new Audio(recordedUrl);
    recordedAudioRef.current = audio;
    audio.onended = () => {
      recordedAudioRef.current = null;
      setPlayingRecording(false);
    };
    audio.onerror = () => {
      recordedAudioRef.current = null;
      setPlayingRecording(false);
    };
    setPlayingRecording(true);
    void audio.play().catch(() => {
      setPlayingRecording(false);
    });
  };

  const isActive = status === 'listening' || status === 'recording';
  const isGreat = score !== null && score >= 72;
  const isClose = score !== null && score >= 45 && score < 72;

  return (
    <div
      aria-label={isVi ? 'Luyện phát âm đọc to' : 'Pronunciation practice'}
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isActive
                ? 'bg-rose-500 text-white'
                : isGreat
                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400'
                  : 'bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400'
            }`}
          >
            <Mic className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {isVi ? 'Đọc to luyện phát âm' : 'Say It Aloud Practice'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {isVi ? 'Mẫu câu:' : 'Phrase:'}{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                “{targetText}”
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPlayModel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
            <span>{isVi ? 'Nghe mẫu' : 'Hear model'}</span>
          </button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={handleToggleSpeak}
            aria-pressed={isActive}
            className={`inline-flex items-center gap-2 px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              isActive
                ? 'bg-rose-600 text-white hover:bg-rose-700 ring-4 ring-rose-200 dark:ring-rose-900/60'
                : 'btn-accent'
            }`}
          >
            {isActive ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>
                  {status === 'recording'
                    ? isVi
                      ? 'Đang ghi âm... (Dừng)'
                      : 'Recording... (Stop)'
                    : isVi
                      ? 'Đang lắng nghe...'
                      : 'Listening...'}
                </span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {score !== null
                    ? isVi
                      ? 'Đọc lại'
                      : 'Try again'
                    : isVi
                      ? 'Bấm để nói'
                      : 'Tap to speak'}
                </span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Speech Recognition Score Result */}
      {transcript && score !== null && (
        <div
          role="status"
          className={`rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs ${
            isGreat
              ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
              : isClose
                ? 'border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                : 'border-sky-200 dark:border-sky-800/70 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {isGreat ? (
              <CheckCircle2
                className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
            ) : (
              <Sparkles
                className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
            )}
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold">
                {isGreat
                  ? isVi
                    ? 'Phát âm rất rõ ràng! Tuyệt vời!'
                    : 'Clear pronunciation! Great job!'
                  : isClose
                    ? isVi
                      ? 'Gần đúng rồi! Thử đọc chậm và rõ thêm chút nữa nhé.'
                      : 'So close! Try saying it once more nice and clearly.'
                    : isVi
                      ? 'Hãy bấm "Nghe mẫu" rồi đọc theo cùng bé nhé!'
                      : 'Tap "Hear model" and try repeating aloud together!'}
              </p>
              <p className="opacity-85">
                {isVi ? 'Hệ thống nghe được:' : 'Heard:'}{' '}
                <span className="font-semibold">“{transcript}”</span>
              </p>
            </div>
          </div>

          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/80 font-extrabold tabular-nums shrink-0">
            {score}%
          </span>
        </div>
      )}

      {/* Self-Check Recording Playback Fallback */}
      {recordedUrl && !transcript && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-950/40 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200"
        >
          <span className="font-semibold">
            {isVi
              ? 'Đã ghi lại giọng đọc của bé! Bấm nghe lại và so với giọng mẫu nhé.'
              : 'Voice recorded! Play it back and compare with the model voice.'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePlayRecording}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 cursor-pointer"
            >
              {playingRecording ? (
                <Square className="w-3 h-3 fill-current" aria-hidden="true" />
              ) : (
                <Play className="w-3 h-3 fill-current" aria-hidden="true" />
              )}
              <span>
                {playingRecording
                  ? isVi
                    ? 'Dừng'
                    : 'Stop'
                  : isVi
                    ? 'Nghe giọng bé'
                    : 'Play my voice'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRecordedUrl(null);
                handleToggleSpeak();
              }}
              aria-label={isVi ? 'Ghi âm lại' : 'Record again'}
              className="p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl px-3 py-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </p>
      )}
    </div>
  );
}
