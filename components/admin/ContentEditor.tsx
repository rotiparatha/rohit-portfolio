'use client';

import type { SiteContent } from '@/lib/types';
import { CommaList, Lines, ListEditor, Text } from './fields';
import styles from './admin.module.css';

type Props = { value: SiteContent; onChange(next: SiteContent): void };

const newId = (p: string) => `${p}-${Date.now().toString(36)}`;

/** Editor for everything that comes from the resume (plus headline and about). */
export default function ContentEditor({ value, onChange }: Props) {
  const set = <K extends keyof SiteContent>(key: K, v: SiteContent[K]) => onChange({ ...value, [key]: v });
  const p = value.profile;
  const setProfile = (patch: Partial<SiteContent['profile']>) => set('profile', { ...p, ...patch });

  return (
    <div className={styles.editor}>
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Profile</legend>
        <div className={styles.cols}>
          <Text label="Name" value={p.name} onChange={(v) => setProfile({ name: v })} />
          <Text label="Headline" value={p.headline} onChange={(v) => setProfile({ headline: v })} hint="Shown under your name, e.g. “Product Analyst Intern at Dashverse”" />
        </div>
        <Text label="About" rows={3} value={p.about} onChange={(v) => setProfile({ about: v })} hint="A short paragraph about you; kept when you upload a new resume" />
        <div className={styles.cols}>
          <Text label="Email" value={p.email} onChange={(v) => setProfile({ email: v })} />
          <Text label="Location" value={p.location} onChange={(v) => setProfile({ location: v })} />
          <Text label="LinkedIn URL" value={p.linkedin} onChange={(v) => setProfile({ linkedin: v })} />
          <Text label="GitHub URL" value={p.github} onChange={(v) => setProfile({ github: v })} />
        </div>
        <p className={styles.hint}>Your phone number is read from the resume but never shown on the site.</p>
      </fieldset>

      <ListEditor
        title="Experience"
        items={value.experience}
        onChange={(v) => set('experience', v)}
        make={() => ({ id: newId('exp'), role: '', company: '', location: '', start: '', end: '', current: false, bullets: [] })}
        itemTitle={(e) => [e.role, e.company].filter(Boolean).join(' · ')}
        render={(e, up) => (
          <>
            <div className={styles.cols}>
              <Text label="Role" value={e.role} onChange={(v) => up({ role: v })} />
              <Text label="Company" value={e.company} onChange={(v) => up({ company: v })} />
              <Text label="Location" value={e.location} onChange={(v) => up({ location: v })} />
              <Text label="Start" value={e.start} onChange={(v) => up({ start: v })} placeholder="Sept 2026" />
              <Text label="End" value={e.end} onChange={(v) => up({ end: v })} placeholder="Present" />
              <label className={styles.check}>
                <input type="checkbox" checked={e.current} onChange={(ev) => up({ current: ev.target.checked })} />
                This is my current role
              </label>
            </div>
            <Lines label="Bullet points" value={e.bullets} onChange={(v) => up({ bullets: v })} />
          </>
        )}
      />

      <ListEditor
        title="Education"
        items={value.education}
        onChange={(v) => set('education', v)}
        make={() => ({ id: newId('edu'), school: '', degree: '', score: '', location: '', start: '', end: '' })}
        itemTitle={(e) => e.school}
        render={(e, up) => (
          <div className={styles.cols}>
            <Text label="School / college" value={e.school} onChange={(v) => up({ school: v })} />
            <Text label="Degree" value={e.degree} onChange={(v) => up({ degree: v })} />
            <Text label="Score" value={e.score} onChange={(v) => up({ score: v })} hint="Up to 10 shows as CGPA, above 10 as %" />
            <Text label="Location" value={e.location} onChange={(v) => up({ location: v })} />
            <Text label="Start" value={e.start} onChange={(v) => up({ start: v })} />
            <Text label="End" value={e.end} onChange={(v) => up({ end: v })} />
          </div>
        )}
      />

      <ListEditor
        title="Projects (from resume)"
        items={value.projects}
        onChange={(v) => set('projects', v)}
        make={() => ({ id: newId('proj'), name: '', url: '', stack: [], bullets: [] })}
        itemTitle={(pr) => pr.name}
        render={(pr, up) => (
          <>
            <div className={styles.cols}>
              <Text label="Name" value={pr.name} onChange={(v) => up({ name: v })} />
              <Text label="Link" value={pr.url} onChange={(v) => up({ url: v })} hint="A GitHub repo link ties this text to that repo's card" />
            </div>
            <CommaList label="Tech stack" value={pr.stack} onChange={(v) => up({ stack: v })} />
            <Lines label="Bullet points" value={pr.bullets} onChange={(v) => up({ bullets: v })} />
          </>
        )}
      />

      <ListEditor
        title="Skills"
        items={value.skills}
        onChange={(v) => set('skills', v)}
        make={() => ({ id: newId('skill'), label: '', items: [] })}
        itemTitle={(s) => s.label || s.items.slice(0, 3).join(', ')}
        render={(s, up) => (
          <>
            <Text label="Group name" value={s.label} onChange={(v) => up({ label: v })} />
            <CommaList label="Skills" value={s.items} onChange={(v) => up({ items: v })} />
          </>
        )}
      />

      <ListEditor
        title="Wins (achievements)"
        items={value.achievements}
        onChange={(v) => set('achievements', v)}
        make={() => ({ id: newId('ach'), text: '', url: '' })}
        itemTitle={(a) => a.text}
        render={(a, up) => (
          <>
            <Text label="Text" rows={2} value={a.text} onChange={(v) => up({ text: v })} />
            <Text label="Link" value={a.url} onChange={(v) => up({ url: v })} />
          </>
        )}
      />

      <ListEditor
        title="Off the clock (positions of responsibility)"
        items={value.responsibilities}
        onChange={(v) => set('responsibilities', v)}
        make={() => ({ id: newId('pos'), title: '', text: '' })}
        itemTitle={(r) => r.title || r.text}
        render={(r, up) => (
          <>
            <Text label="Title" value={r.title} onChange={(v) => up({ title: v })} />
            <Text label="Text" rows={2} value={r.text} onChange={(v) => up({ text: v })} />
          </>
        )}
      />
    </div>
  );
}
