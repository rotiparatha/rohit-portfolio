// Browser text-to-speech that reads one sentence at a time, so captions can follow along
// and Chrome's habit of cutting off long utterances is avoided.

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  return clean.match(/[^.!?…]+[.!?…]+["'”’)]*|[^.!?…]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];
}

export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!speechSupported()) return resolve([]);
    const now = window.speechSynthesis.getVoices();
    if (now.length) return resolve(now);
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      clearTimeout(timer);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);
    const timer = setTimeout(done, timeoutMs);
  });
}

/** Ranks voices by how natural they usually sound (neural/online voices first). */
export function rankVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (/^en([-_]|$)/i.test(v.lang)) s += 100;
    if (/natural|neural/i.test(v.name)) s += 50;
    if (/premium|enhanced/i.test(v.name)) s += 40;
    if (/google/i.test(v.name)) s += 30;
    if (/online/i.test(v.name)) s += 10;
    if (!v.localService) s += 5;
    // Indian English first among equally natural voices (the site owner is India-based);
    // too small a bonus to beat a natural voice with an old robotic one.
    if (/[-_]IN$/i.test(v.lang)) s += 8;
    if (/\bAna\b/.test(v.name)) s -= 60; // Edge's child voice
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a));
}

export function pickVoice(voices: SpeechSynthesisVoice[], preferred: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  if (preferred) {
    const exact = voices.find((v) => v.name === preferred);
    if (exact) return exact;
  }
  return rankVoices(voices)[0] ?? null;
}

/**
 * iOS Safari only allows speech that starts inside a user gesture. Call this
 * synchronously in the click handler, before any await.
 */
export function primeSpeech() {
  if (!speechSupported()) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

/** Cuts off the sentence being spoken right now. */
export function silenceNow() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export type SpeakOptions = {
  voice: string;
  rate: number;
  pitch: number;
  // Checked per sentence; muted sentences still run (silently) so captions keep their timing.
  muted?: () => boolean;
  // Sentence to start from, e.g. to continue an intro that was stopped part-way.
  startAt?: number;
  onSentence?: (sentence: string, index: number) => void;
  onEnd?: () => void;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Narrator {
  private stopped = false;
  // Chrome can garbage-collect a queued utterance and never fire its events; hold references.
  private live = new Set<SpeechSynthesisUtterance>();

  async speak(text: string, opts: SpeakOptions) {
    this.stopped = false;
    const sentences = splitSentences(text);
    const voices = await loadVoices();
    const voice = pickVoice(voices, opts.voice);
    const canSpeak = speechSupported() && voices.length > 0;
    if (canSpeak) window.speechSynthesis.cancel();
    for (let i = Math.max(0, opts.startAt ?? 0); i < sentences.length; i++) {
      if (this.stopped) return;
      opts.onSentence?.(sentences[i], i);
      if (canSpeak) await this.say(sentences[i], voice, opts);
      else await wait(400 + sentences[i].length * 55); // no voices: captions only
    }
    if (!this.stopped) opts.onEnd?.();
  }

  private say(sentence: string, voice: SpeechSynthesisVoice | null, opts: SpeakOptions): Promise<void> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(sentence);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      u.rate = opts.rate;
      u.pitch = opts.pitch;
      u.volume = opts.muted?.() ? 0 : 1;
      this.live.add(u);
      const done = () => {
        clearTimeout(fallback);
        this.live.delete(u);
        resolve();
      };
      // Some engines never fire "end"; don't let the captions stall.
      const fallback = setTimeout(done, 2500 + (sentence.length * 110) / opts.rate);
      u.onend = u.onerror = done;
      const synth = window.speechSynthesis;
      if (synth.paused) synth.resume(); // Chrome occasionally leaves the queue paused
      synth.speak(u);
    });
  }

  stop() {
    this.stopped = true;
    if (speechSupported()) window.speechSynthesis.cancel();
  }
}
