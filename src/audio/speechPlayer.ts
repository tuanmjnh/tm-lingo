import type { VoiceProfile } from '../../packages/contracts/types';

const BCP47_MAP: Record<string, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  ja: 'ja-JP',
};

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakText(options: {
  text: string;
  locale: string;
  rate?: number;
  voiceProfile?: VoiceProfile | null;
  onStart?: () => void;
  onEnd?: () => void;
}): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onStart?.();
    setTimeout(() => options.onEnd?.(), 600);
    return;
  }

  window.speechSynthesis.cancel();

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
}
