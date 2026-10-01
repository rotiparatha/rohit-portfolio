'use client';

import type { ReactNode } from 'react';
import styles from './admin.module.css';

type TextProps = {
  label: string;
  value: string;
  onChange(v: string): void;
  placeholder?: string;
  hint?: string;
  rows?: number;
  type?: string;
};

export function Text({ label, value, onChange, placeholder, hint, rows, type = 'text' }: TextProps) {
  return (
    <label className={styles.label}>
      {label}
      {rows ? (
        <textarea
          className={styles.input}
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className={styles.input} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

/** One item per line, e.g. bullet points. */
export function Lines({ label, value, onChange, rows = 4 }: { label: string; value: string[]; onChange(v: string[]): void; rows?: number }) {
  return (
    <Text
      label={label}
      rows={rows}
      value={value.join('\n')}
      hint="One per line"
      onChange={(v) =>
        onChange(
          v
            .split('\n')
            .map((x) => x.trimStart())
            .filter((x, i, all) => x || i === all.length - 1),
        )
      }
    />
  );
}

/** Comma-separated list, e.g. a tech stack. */
export function CommaList({ label, value, onChange }: { label: string; value: string[]; onChange(v: string[]): void }) {
  return (
    <Text
      label={label}
      value={value.join(', ')}
      hint="Separate with commas"
      onChange={(v) => onChange(v.split(',').map((x) => x.trimStart()))}
    />
  );
}

type ListProps<T> = {
  title: string;
  items: T[];
  onChange(items: T[]): void;
  make(): T;
  itemTitle(item: T): string;
  render(item: T, update: (patch: Partial<T>) => void): ReactNode;
};

export function ListEditor<T extends { id: string }>({ title, items, onChange, make, itemTitle, render }: ListProps<T>) {
  const update = (i: number, patch: Partial<T>) => onChange(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupTitle}>
        {title} <span className={styles.badge}>{items.length}</span>
      </legend>
      {items.map((item, i) => (
        <details key={item.id} className={styles.item}>
          <summary className={styles.itemHead}>
            <span>{itemTitle(item) || 'Untitled'}</span>
            <span className={styles.itemTools}>
              <button type="button" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === items.length - 1}>
                ↓
              </button>
              <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Remove">
                ✕
              </button>
            </span>
          </summary>
          <div className={styles.itemBody}>{render(item, (patch) => update(i, patch))}</div>
        </details>
      ))}
      <button type="button" className={styles.ghost} onClick={() => onChange([...items, make()])}>
        + Add
      </button>
    </fieldset>
  );
}
