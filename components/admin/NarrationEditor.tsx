'use client';

import { useEffect, useRef, useState } from 'react';
import { suggestNarration } from '@/lib/content';
import { loadVoices, Narrator, primeSpeech, rankVoices, splitSentences } from '@/lib/narrator';
import type { Narration, SiteContent } from '@/lib/types';
import styles from './admin.module.css';

type Props = { content: SiteContent; busy: boolean; onSave(narration: Narration): Promise<boolean> };

export default function NarrationEditor({ content, busy, onSave }: Props) {
  const [n, setN] = useState<Narration>(content.narration);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [line, setLine] = useState('');
  const [playing, setPlaying] = useState(false);
  const narrator = useRef<Narrator | null>(null);

  useEffect(() => {
    loadVoices(3000).then((v) => setVoices(rankVoices(v)));
    return () => narrator.current?.stop();
  }, []);

  const words = n.text.trim() ? n.text.trim().split(/\s+/).length : 0;
  const seconds = Math.round(words / (2.6 * n.rate));
  const dirty = JSON.stringify(n) !== JSON.stringify(content.narration);
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const listed = english.length ? english : voices;
  const chosenMissing = n.voice && !voices.some((v) => v.name === n.voice);

  const preview = () => {
    primeSpeech();
    narrator.current?.stop();
    const r = new Narrator();
    narrator.current = r;
    setPlaying(true);
    void r.speak(n.text, {
      voice: n.voice,
      rate: n.rate,
      pitch: n.pitch,
      onSentence: (s) => setLine(s),
      onEnd: () => {
        setPlaying(false);
        setLine('');
      },
    });
  };

  const stop = () => {
    narrator.current?.stop();
    setPlaying(false);
    setLine('');
  };

  return (
    <div className={styles.editor}>
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>What the narrator says</legend>
        <label className={styles.label}>
          Script
          <textarea className={styles.input} rows={6} value={n.text} onChange={(e) => setN({ ...n, text: e.target.value })} />
          <span className={styles.hint}>
            {words} words · about {seconds}s · {splitSentences(n.text).length} caption lines (one per sentence)
          </span>
        </label>
        <div className={styles.row}>
          <button type="button" className={styles.ghost} onClick={() => setN({ ...n, text: suggestNarration(content) })}>
            Write one from my resume
          </button>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Voice</legend>
        <label className={styles.label}>
          Preferred voice
          <select className={styles.input} value={n.voice} onChange={(e) => setN({ ...n, voice: e.target.value })}>
            <option value="">Auto: most natural voice on the visitor&apos;s device</option>
            {chosenMissing && <option value={n.voice}>{n.voice} (not on this device)</option>}
            {listed.map((v, i) => (
              <option key={v.name} value={v.name}>
                {i < 3 ? '★ ' : ''}
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <span className={styles.hint}>
            Voices come from each visitor&apos;s browser. If they don&apos;t have this one, the most natural voice they do have
            is used. Edge&apos;s “Online (Natural)” and Chrome&apos;s “Google” voices sound best.
          </span>
        </label>
        <div className={styles.cols}>
          <label className={styles.label}>
            Speed · {n.rate.toFixed(2)}×
            <input type="range" min={0.6} max={1.4} step={0.05} value={n.rate} onChange={(e) => setN({ ...n, rate: Number(e.target.value) })} />
          </label>
          <label className={styles.label}>
            Pitch · {n.pitch.toFixed(2)}
            <input type="range" min={0.6} max={1.4} step={0.05} value={n.pitch} onChange={(e) => setN({ ...n, pitch: Number(e.target.value) })} />
          </label>
        </div>
        <div className={styles.row}>
          {playing ? (
            <button type="button" className={styles.ghost} onClick={stop}>
              ■ Stop
            </button>
          ) : (
            <button type="button" className={styles.ghost} onClick={preview}>
              ▶ Preview
            </button>
          )}
          {line && <span className={styles.previewLine}>“{line}”</span>}
        </div>
      </fieldset>

      <div className={styles.saveBar}>
        <span className={styles.muted}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
        <button type="button" className={styles.primary} disabled={!dirty || busy} onClick={() => void onSave(n)}>
          Save narration
        </button>
      </div>
    </div>
  );
}
