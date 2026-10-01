'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import SpiderRunner, { type RunnerHandle } from '@/components/game/SpiderRunner';
import type { GameMode } from '@/components/game/engine';
import { Narrator, primeSpeech, silenceNow } from '@/lib/narrator';
import type { Narration } from '@/lib/types';
import styles from './Landing.module.css';

type Props = {
  firstName: string;
  name: string;
  headline: string;
  narration: Narration;
  children: ReactNode;
};

const pad = (n: number) => String(n).padStart(5, '0');

const COARSE = '(pointer: coarse)';
const subscribeCoarse = (cb: () => void) => {
  const mq = window.matchMedia(COARSE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Narrator sound on/off, remembered per browser (in memory only if storage is blocked).
const SOUND_KEY = 'rp-narrator-sound';
let soundPref: boolean | null = null;
const soundListeners = new Set<() => void>();

function readSound(): boolean {
  if (soundPref === null) {
    try {
      soundPref = localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      soundPref = true;
    }
  }
  return soundPref;
}

function writeSound(on: boolean) {
  soundPref = on;
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable; the choice lasts until the page is closed
  }
  soundListeners.forEach((l) => l());
}

const subscribeSound = (cb: () => void) => {
  soundListeners.add(cb);
  return () => {
    soundListeners.delete(cb);
  };
};

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {on ? (
        <>
          <path d="M16.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19.5 5.5a9 9 0 0 1 0 13" />
        </>
      ) : (
        <path d="M17 9l5 6M22 9l-5 6" />
      )}
    </svg>
  );
}

export default function Landing({ firstName, name, headline, narration, children }: Props) {
  const runner = useRef<RunnerHandle>(null);
  const heroRef = useRef<HTMLElement>(null);
  const narrator = useRef<Narrator | null>(null);
  const narratedOnce = useRef(false);
  const modeRef = useRef<GameMode>('menu');
  const sentenceIdx = useRef(0);
  // Where a paused run's intro stopped, so Resume can pick it up again.
  const resumeAt = useRef<number | null>(null);

  const [mode, setMode] = useState<GameMode>('menu');
  const [result, setResult] = useState<{ score: number; best: number } | null>(null);
  const [narrating, setNarrating] = useState(false);
  const [caption, setCaption] = useState<{ text: string; i: number } | null>(null);
  const [hint, setHint] = useState(false);
  const touch = useSyncExternalStore(subscribeCoarse, () => window.matchMedia(COARSE).matches, () => false);
  const soundOn = useSyncExternalStore(subscribeSound, readSound, () => true);

  // Latest versions of the narration helpers, for use inside long-lived listeners.
  const narrationFns = useRef<{ start: (startAt: number) => void; halt: (remember: boolean) => void }>({
    start: () => {},
    halt: () => {},
  });
  const playRef = useRef<() => void>(() => {});

  const onModeChange = useCallback((m: GameMode) => {
    const prev = modeRef.current;
    modeRef.current = m;
    setMode(m);
    if (prev === 'paused' && m === 'playing' && resumeAt.current !== null) {
      const at = resumeAt.current;
      resumeAt.current = null;
      narrationFns.current.start(at);
    }
  }, []);

  const slideToPortfolio = useCallback(() => {
    document.getElementById('portfolio')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, []);

  // The page always scrolls. As the portfolio slides up over the game, the game panel
  // shrinks and dims. Leaving the game pauses a run (or ends the intro run) and stops the narration.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    let raf = 0;
    const update = () => {
      const p = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      hero.style.setProperty('--p', p.toFixed(3));
      if (p > 0.35) {
        const m = modeRef.current;
        // A run's intro keeps its place (Resume / Play again continue it); the Know-about intro closes.
        if (narrator.current) narrationFns.current.halt(m === 'playing' || m === 'over');
        if (m === 'playing') runner.current?.pause();
        if (m === 'autopilot') runner.current?.toMenu();
      }
      runner.current?.setInView(p < 0.98);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Near the top: Space on the menu starts the game; any downward scroll or ↓ / Page Down
  // glides straight to the portfolio.
  useEffect(() => {
    const nearTop = () => window.scrollY < window.innerHeight * 0.25;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0 && nearTop()) {
        e.preventDefault();
        slideToPortfolio();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!nearTop()) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.code === 'Space' && modeRef.current === 'menu') {
        // A focused button or link keeps its own Space behaviour (keyboard users).
        if (el && (el.tagName === 'BUTTON' || el.tagName === 'A')) return;
        e.preventDefault();
        playRef.current();
        return;
      }
      if (e.code !== 'ArrowDown' && e.code !== 'PageDown') return;
      e.preventDefault();
      slideToPortfolio();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [slideToPortfolio]);

  useEffect(() => () => narrator.current?.stop(), []);

  const startNarration = (startAt = 0) => {
    narrator.current?.stop();
    const n = new Narrator();
    narrator.current = n;
    narratedOnce.current = true;
    sentenceIdx.current = startAt;
    setNarrating(true);
    setCaption(null);
    void n.speak(narration.text, {
      voice: narration.voice,
      rate: narration.rate,
      pitch: narration.pitch,
      startAt,
      muted: () => !readSound(),
      onSentence: (text, i) => {
        sentenceIdx.current = i;
        setCaption({ text, i });
      },
      onEnd: () => {
        if (narrator.current !== n) return;
        narrator.current = null;
        setNarrating(false);
        setCaption(null);
      },
    });
  };

  /** Stops the intro (voice and captions); `remember` keeps its place for Resume. */
  const haltNarration = (remember: boolean) => {
    if (!narrator.current) return;
    resumeAt.current = remember ? sentenceIdx.current : null;
    narrator.current.stop();
    narrator.current = null;
    setNarrating(false);
    setCaption(null);
  };

  // Play: the intro is narrated over the first run of the visit; replays don't restart it,
  // but they do continue an intro that was stopped part-way by leaving the game.
  const play = () => {
    const continueAt = resumeAt.current;
    resumeAt.current = null;
    if (!narratedOnce.current || continueAt !== null) primeSpeech(); // must run inside the click for iOS
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    setResult(null);
    runner.current?.start();
    setHint(true);
    window.setTimeout(() => setHint(false), 4200);
    if (!narratedOnce.current) startNarration();
    else if (continueAt !== null) startNarration(continueAt);
  };

  // Know about Rohit: Spider-Man runs on autopilot while the intro plays from the start.
  const aboutMe = () => {
    primeSpeech();
    resumeAt.current = null;
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    setResult(null);
    runner.current?.autopilot();
    startNarration();
  };

  // Keep the long-lived listeners pointing at the latest versions of these helpers.
  useEffect(() => {
    narrationFns.current = { start: startNarration, halt: haltNarration };
    playRef.current = play;
  });

  const toggleSound = () => {
    const next = !soundOn;
    writeSound(next);
    if (!next && narrating) silenceNow(); // the rest of the intro continues as captions only
  };

  const onGameOver = useCallback((score: number, best: number) => {
    setResult({ score, best });
  }, []);

  const showMenu = mode === 'menu';
  const showOutro = mode === 'autopilot' && !narrating;

  return (
    <div className={styles.root}>
      <section ref={heroRef} className={styles.hero} aria-label={`${name}: Spider-Man runner`}>
        <div className={styles.stage}>
          <SpiderRunner ref={runner} className={styles.canvas} onModeChange={onModeChange} onGameOver={onGameOver} />
          <div className={styles.dim} aria-hidden="true" />

          {showMenu && (
            <div className={styles.menu}>
              <p className={styles.kicker}>Your friendly neighbourhood</p>
              <h1 className={styles.title}>{name}</h1>
              {headline && <p className={styles.role}>{headline}</p>}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnYellow}`}
                  onClick={(e) => {
                    e.currentTarget.blur(); // so a later Space press plays instead of re-clicking this
                    slideToPortfolio();
                  }}
                >
                  Know about {firstName}
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnRed}`} onClick={play}>
                  ▶ Play game
                </button>
              </div>
              <p className={styles.controls}>
                {touch ? (
                  <>Tap right to jump · tap left to duck</>
                ) : (
                  <>
                    <kbd>Space</kbd> play &amp; web-jump · <kbd>S</kbd> duck · <kbd>↓</kbd> my work
                  </>
                )}
              </p>
              <p className={styles.soundNote}>
                <SpeakerIcon on={soundOn} />
                {soundOn ? 'Sound on: I introduce myself while you play' : 'Narrator muted: captions only'}
              </p>
            </div>
          )}

          {narrating && (
            <div className={styles.narration}>
              <p key={caption?.i ?? -1} className={styles.caption} aria-live="polite">
                {caption?.text ?? '…'}
              </p>
              {mode === 'autopilot' && (
                <p className={styles.narrationBar}>{touch ? 'Tap the game to take control' : 'Press Space to take control'}</p>
              )}
            </div>
          )}

          {mode === 'playing' && hint && (
            <p className={styles.hint}>
              {touch ? 'Tap right to jump · tap left to duck' : 'Space / ↑ web-jump · S duck · ↓ my work'}
            </p>
          )}

          {mode === 'paused' && (
            <div className={styles.panel} role="dialog" aria-label="Paused">
              <p className={styles.over}>Paused</p>
              <div className={styles.actions}>
                {/* no autoFocus: the run pauses while the visitor is down in the portfolio, and focusing would scroll them back up */}
                <button type="button" className={`${styles.btn} ${styles.btnRed}`} onClick={() => runner.current?.resume()}>
                  ▶ Resume
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnYellow}`} onClick={slideToPortfolio}>
                  See my work ↓
                </button>
              </div>
            </div>
          )}

          {mode === 'over' && (
            <div className={styles.panel} role="dialog" aria-label="Game over">
              <p className={styles.over}>Game over</p>
              {result && (
                <p className={styles.score}>
                  Score <b>{pad(result.score)}</b> · Best <b>{pad(result.best)}</b>
                </p>
              )}
              <div className={styles.actions}>
                <button type="button" className={`${styles.btn} ${styles.btnRed}`} onClick={play} autoFocus>
                  Play again
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnYellow}`} onClick={slideToPortfolio}>
                  See my work ↓
                </button>
              </div>
              {!narrating && (
                <button type="button" className={styles.linkBtn} onClick={aboutMe}>
                  or hear who&apos;s behind the mask
                </button>
              )}
            </div>
          )}

          {showOutro && (
            <div className={styles.panel}>
              <p className={styles.over}>That&apos;s me!</p>
              <div className={styles.actions}>
                <button type="button" className={`${styles.btn} ${styles.btnRed}`} onClick={play}>
                  ▶ Play yourself
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnYellow}`} onClick={slideToPortfolio}>
                  See my work ↓
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className={styles.sound}
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Mute the narrator' : 'Unmute the narrator'}
            title={soundOn ? 'Mute the narrator' : 'Unmute the narrator'}
          >
            <SpeakerIcon on={soundOn} />
            <span>{soundOn ? 'Sound on' : 'Muted'}</span>
          </button>

          <button type="button" className={styles.down} onClick={slideToPortfolio}>
            <span>Portfolio</span>
            <i aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </i>
          </button>
        </div>
      </section>
      <div id="portfolio" className={styles.portfolio}>
        {children}
      </div>
    </div>
  );
}
