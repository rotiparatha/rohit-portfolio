'use client';

import { useRef, useState, type DragEvent } from 'react';
import { mergeResume, prettifyRepoName } from '@/lib/content';
import type { GithubSettings, ParseResult, SiteContent } from '@/lib/types';
import ContentEditor from './ContentEditor';
import NarrationEditor from './NarrationEditor';
import ProjectsEditor from './ProjectsEditor';
import styles from './admin.module.css';

type Tab = 'resume' | 'content' | 'narration' | 'projects';
type Toast = { ok: boolean; text: string } | null;

const TABS: { id: Tab; label: string }[] = [
  { id: 'resume', label: 'Resume' },
  { id: 'content', label: 'Content' },
  { id: 'narration', label: 'Narration' },
  { id: 'projects', label: 'Projects' },
];

/** Copies the resume-derived fields (and headline/about) from one content object onto another. */
function withResumeFields(base: SiteContent, from: SiteContent): SiteContent {
  return {
    ...base,
    profile: from.profile,
    experience: from.experience,
    education: from.education,
    skills: from.skills,
    projects: from.projects,
    achievements: from.achievements,
    responsibilities: from.responsibilities,
  };
}

export default function AdminDashboard({ initial, email }: { initial: SiteContent; email: string }) {
  const [content, setContent] = useState(initial);
  const [tab, setTab] = useState<Tab>('resume');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  async function save(next: SiteContent, file?: File): Promise<boolean> {
    setBusy(true);
    setToast(null);
    try {
      const form = new FormData();
      form.set('content', JSON.stringify(next));
      if (file) form.set('resume', file);
      const res = await fetch('/api/admin/content', { method: 'PUT', body: form });
      const body = (await res.json()) as { content?: SiteContent; warning?: string; error?: string };
      if (!res.ok || !body.content) throw new Error(body.error || 'Save failed');
      setContent(body.content);
      setToast(body.warning ? { ok: false, text: body.warning } : { ok: true, text: 'Saved. Your site is updated.' });
      return true;
    } catch (err) {
      setToast({ ok: false, text: (err as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.reload();
  }

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <div>
          <p className={styles.brand}>Portfolio admin</p>
          <p className={styles.muted}>
            Signed in as {email} ·{' '}
            {content.updatedAt ? `last published ${new Date(content.updatedAt).toLocaleString()}` : 'nothing published yet'}
          </p>
        </div>
        <div className={styles.row}>
          <a href="/" target="_blank" rel="noreferrer" className={styles.ghost}>
            View site ↗
          </a>
          <button type="button" className={styles.ghost} onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Admin sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={styles.tab} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {toast && (
        <p className={toast.ok ? styles.toastOk : styles.error} role="status">
          {toast.text}
        </p>
      )}

      <section className={styles.panelBody}>
        {tab === 'resume' && <ResumePanel content={content} busy={busy} save={save} />}
        {tab === 'content' && <ContentPanel key={content.updatedAt} content={content} busy={busy} save={save} />}
        {tab === 'narration' && (
          <NarrationEditor
            key={content.updatedAt}
            content={content}
            busy={busy}
            onSave={(narration) => save({ ...content, narration })}
          />
        )}
        {tab === 'projects' && (
          <ProjectsEditor
            key={`${content.updatedAt}-${content.github.syncedAt}`}
            content={content}
            busy={busy}
            onSynced={(github: GithubSettings) => setContent({ ...content, github })}
            onSave={(featured, hidden) => save({ ...content, github: { ...content.github, featured, hidden } })}
          />
        )}
      </section>
    </div>
  );
}

type PanelProps = { content: SiteContent; busy: boolean; save(next: SiteContent, file?: File): Promise<boolean> };

function ContentPanel({ content, busy, save }: PanelProps) {
  const [work, setWork] = useState(content);
  const dirty = JSON.stringify(work) !== JSON.stringify(content);
  return (
    <>
      <ContentEditor value={work} onChange={setWork} />
      <div className={styles.saveBar}>
        <span className={styles.muted}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
        <button type="button" className={styles.ghost} disabled={!dirty || busy} onClick={() => setWork(content)}>
          Undo changes
        </button>
        <button type="button" className={styles.primary} disabled={!dirty || busy} onClick={() => void save(withResumeFields(content, work))}>
          Save changes
        </button>
      </div>
    </>
  );
}

function ResumePanel({ content, busy, save }: PanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [over, setOver] = useState(false);

  async function read(f: File) {
    setError('');
    setWarnings([]);
    setDraft(null);
    if (f.type && f.type !== 'application/pdf') {
      setError('Please choose a PDF.');
      return;
    }
    setReading(true);
    setFile(f);
    try {
      const form = new FormData();
      form.set('file', f);
      const res = await fetch('/api/admin/parse-resume', { method: 'POST', body: form });
      const body = (await res.json()) as ParseResult & { error?: string };
      if (!res.ok) throw new Error(body.error || 'Could not read the PDF');
      setWarnings(body.warnings);
      setDraft(mergeResume(content, body.data));
    } catch (err) {
      setError((err as Error).message);
      setFile(null);
    } finally {
      setReading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) void read(f);
  }

  async function publish() {
    if (!draft || !file) return;
    const sameAccount = draft.github.username === content.github.username;
    const next: SiteContent = {
      ...withResumeFields(content, draft),
      github: {
        ...content.github,
        username: draft.github.username,
        featured: draft.github.featured,
        repos: sameAccount ? content.github.repos : [],
        syncedAt: sameAccount ? content.github.syncedAt : '',
      },
    };
    if (await save(next, file)) {
      setDraft(null);
      setFile(null);
      setWarnings([]);
    }
  }

  const counts = draft && [
    `${draft.experience.length} roles`,
    `${draft.education.length} schools`,
    `${draft.projects.length} projects`,
    `${draft.skills.reduce((n, g) => n + g.items.length, 0)} skills`,
    `${draft.achievements.length} wins`,
  ];

  return (
    <div className={styles.editor}>
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Current resume</legend>
        {content.resume ? (
          <p>
            <b>{content.resume.fileName}</b>{' '}
            <span className={styles.muted}>uploaded {new Date(content.resume.uploadedAt).toLocaleString()}</span> ·{' '}
            <a href="/resume" target="_blank" rel="noreferrer" className={styles.link}>
              Open ↗
            </a>
          </p>
        ) : (
          <p className={styles.muted}>No resume uploaded yet.</p>
        )}
      </fieldset>

      <div
        className={`${styles.drop} ${over ? styles.dropOver : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <p className={styles.dropTitle}>{reading ? 'Reading your resume…' : 'Drop a new resume PDF here'}</p>
        <p className={styles.muted}>Your role, experience, projects and GitHub links are read from it. You review everything before it goes live.</p>
        <button type="button" className={styles.ghost} onClick={() => input.current?.click()} disabled={reading}>
          Choose PDF
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void read(f);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {draft && (
        <>
          <div className={styles.summary}>
            <p>
              <b>Found:</b> {counts?.join(' · ')}
            </p>
            <p>
              <b>Highlighted projects</b> (repos linked in the resume):{' '}
              {draft.github.featured.length ? draft.github.featured.map(prettifyRepoName).join(', ') : 'none found'}
            </p>
            {warnings.length > 0 && (
              <ul className={styles.warnings}>
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <p className={styles.muted}>Check the details below, fix anything that was misread, then publish.</p>
          </div>
          <ContentEditor value={draft} onChange={setDraft} />
          <div className={styles.saveBar}>
            <span className={styles.muted}>Not live yet</span>
            <button type="button" className={styles.ghost} onClick={() => setDraft(null)} disabled={busy}>
              Discard
            </button>
            <button type="button" className={styles.primary} onClick={() => void publish()} disabled={busy}>
              {busy ? 'Publishing…' : 'Publish to site'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
