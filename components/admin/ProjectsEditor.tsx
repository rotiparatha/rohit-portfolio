'use client';

import { useState } from 'react';
import { MAX_FEATURED, prettifyRepoName } from '@/lib/content';
import type { GithubSettings, SiteContent } from '@/lib/types';
import styles from './admin.module.css';

type Props = {
  content: SiteContent;
  busy: boolean;
  onSynced(github: GithubSettings): void;
  onSave(featured: string[], hidden: string[]): Promise<boolean>;
};

export default function ProjectsEditor({ content, busy, onSynced, onSave }: Props) {
  const gh = content.github;
  const [username, setUsername] = useState(gh.username);
  const [featured, setFeatured] = useState<string[]>(gh.featured);
  const [hidden, setHidden] = useState<string[]>(gh.hidden);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const repos = gh.repos.filter((r) => !r.fork);
  const dirty = JSON.stringify([featured, hidden]) !== JSON.stringify([gh.featured, gh.hidden]);

  async function sync() {
    setSyncing(true);
    setError('');
    try {
      const res = await fetch('/api/admin/github-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const body = (await res.json()) as { github?: GithubSettings; error?: string };
      if (!res.ok || !body.github) throw new Error(body.error || 'Sync failed');
      onSynced(body.github);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const toggleFeatured = (name: string) => {
    setError('');
    if (featured.includes(name)) setFeatured(featured.filter((f) => f !== name));
    else if (featured.length >= MAX_FEATURED) setError(`You can highlight up to ${MAX_FEATURED}. Un-highlight one first.`);
    else setFeatured([...featured, name]);
  };

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= featured.length) return;
    const next = [...featured];
    [next[i], next[j]] = [next[j], next[i]];
    setFeatured(next);
  };

  return (
    <div className={styles.editor}>
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>GitHub account</legend>
        <div className={styles.row}>
          <input
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value.trim())}
            placeholder="GitHub username"
            aria-label="GitHub username"
          />
          <button type="button" className={styles.ghost} onClick={sync} disabled={syncing || !username}>
            {syncing ? 'Syncing…' : 'Sync from GitHub'}
          </button>
        </div>
        <p className={styles.hint}>
          {gh.syncedAt ? `Last synced ${new Date(gh.syncedAt).toLocaleString()}.` : 'Not synced yet.'} The public page also picks up
          new repos on its own every few hours; syncing also pulls README summaries for repos without a description.
        </p>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>
          Highlighted projects <span className={styles.badge}>{featured.length}/{MAX_FEATURED}</span>
        </legend>
        {featured.length === 0 && <p className={styles.muted}>None yet. Tick “Highlight” on up to three repos below.</p>}
        <ol className={styles.featuredList}>
          {featured.map((name, i) => (
            <li key={name}>
              <div>
              <span>{prettifyRepoName(name)}</span>
              <span className={styles.itemTools}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === featured.length - 1} aria-label="Move down">
                  ↓
                </button>
                <button type="button" onClick={() => toggleFeatured(name)} aria-label="Remove highlight">
                  ✕
                </button>
              </span>
              </div>
            </li>
          ))}
        </ol>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>
          All repos <span className={styles.badge}>{repos.length}</span>
        </legend>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Repo</th>
                <th>Language</th>
                <th>Highlight</th>
                <th>Hide</th>
              </tr>
            </thead>
            <tbody>
              {repos.map((r) => (
                <tr key={r.name}>
                  <td>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.name}
                    </a>
                    <span className={styles.hint}>{r.description || r.summary || 'No description'}</span>
                  </td>
                  <td>{r.language || '-'}</td>
                  <td>
                    <input type="checkbox" checked={featured.includes(r.name)} onChange={() => toggleFeatured(r.name)} aria-label={`Highlight ${r.name}`} />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={hidden.includes(r.name)}
                      onChange={() => setHidden(hidden.includes(r.name) ? hidden.filter((h) => h !== r.name) : [...hidden, r.name])}
                      aria-label={`Hide ${r.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      <div className={styles.saveBar}>
        <span className={styles.muted}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
        <button type="button" className={styles.primary} disabled={!dirty || busy} onClick={() => void onSave(featured, hidden)}>
          Save projects
        </button>
      </div>
    </div>
  );
}
