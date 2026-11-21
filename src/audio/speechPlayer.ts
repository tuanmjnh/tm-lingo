import type { VoiceProfile } from '../../packages/contracts/types';

const BCP47_MAP: Record<string, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  es: 'es-ES',
  zh: 'zh-CN',
};

let activeAudioEl: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  if (activeAudioEl) {
    try {
      activeAudioEl.pause();
      activeAudioEl.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudioEl = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakText(options: {
  text: string;
  locale: string;
  audioUrl?: string;
  rate?: number;
  voiceProfile?: VoiceProfile | null;
  onStart?: () => void;
  onEnd?: () => void;
}): void {
  stopSpeaking();

  const playWebSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options.onStart?.();
      setTimeout(() => options.onEnd?.(), 600);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(options.text);
    const langTag = BCP47_MAP[options.locale] ?? options.locale;
    utterance.lang = langTag;
    utterance.rate = options.rate ?? options.voiceProfile?.defaultRate ?? 0.9;
    utterance.pitch = options.voiceProfile?.pitch ?? 1.04;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase() === langTag.toLowerCase()) ??
      voices.find((v) =>
        v.lang.toLowerCase().startsWith(options.locale.toLowerCase())
      );

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onEnd?.();

    window.speechSynthesis.speak(utterance);
  };

  if (typeof window !== 'undefined' && options.audioUrl?.trim()) {
    try {
      const audio = new Audio(options.audioUrl.trim());
      audio.playbackRate = Math.min(1.5, Math.max(0.6, options.rate ?? 1));
      activeAudioEl = audio;
      audio.onplay = () => options.onStart?.();
      audio.onended = () => {
        if (activeAudioEl === audio) activeAudioEl = null;
        options.onEnd?.();
      };
      audio.onerror = () => {
        if (activeAudioEl === audio) activeAudioEl = null;
        playWebSpeech();
      };
      void audio.play().catch(() => {
        if (activeAudioEl === audio) activeAudioEl = null;
        playWebSpeech();
      });
      return;
    } catch {
      // fall through to Web Speech API
    }
  }

  playWebSpeech();
}
