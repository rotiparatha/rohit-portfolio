'use client';

import { useMemo, useState } from 'react';
import type { ProjectCard } from '@/lib/github';
import { formatMonth } from './format';
import styles from './Portfolio.module.css';

type Props = { projects: ProjectCard[]; profileUrl: string };

export default function ProjectGrid({ projects, profileUrl }: Props) {
  const languages = useMemo(
    () => [...new Set(projects.map((p) => p.language).filter(Boolean))].sort(),
    [projects],
  );
  const [lang, setLang] = useState('All');
  const shown = lang === 'All' ? projects : projects.filter((p) => p.language === lang);

  if (!projects.length) return null;

  return (
    <div className={styles.more}>
      <div className={styles.moreHead}>
        <h3>
          Everything else on GitHub <span className={styles.count}>{projects.length}</span>
        </h3>
        {profileUrl && (
          <a href={profileUrl} target="_blank" rel="noreferrer" className={styles.textLink}>
            Open GitHub profile ↗
          </a>
        )}
      </div>
      {languages.length > 1 && (
        <div className={styles.filters} role="group" aria-label="Filter projects by language">
          {['All', ...languages].map((l) => (
            <button key={l} type="button" aria-pressed={l === lang} className={styles.filter} onClick={() => setLang(l)}>
              {l}
            </button>
          ))}
        </div>
      )}
      <ul className={styles.grid}>
        {shown.map((p) => (
          <li key={p.key}>
            <a href={p.url} target="_blank" rel="noreferrer" className={styles.repo}>
              <span className={styles.repoTitle}>{p.title}</span>
              <span className={styles.repoDesc}>{p.description || p.points[0] || 'No description yet: open it on GitHub.'}</span>
              <span className={styles.repoMeta}>
                {p.language && (
                  <span>
                    <i className={styles.langDot} aria-hidden="true" />
                    {p.language}
                  </span>
                )}
                {p.stars > 0 && <span>★ {p.stars}</span>}
                {p.pushedAt && <span>Updated {formatMonth(p.pushedAt)}</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
