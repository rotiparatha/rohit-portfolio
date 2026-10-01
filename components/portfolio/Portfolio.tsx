import { companyShort, currentRole } from '@/lib/content';
import type { PublicProjects } from '@/lib/github';
import type { SiteContent } from '@/lib/types';
import { displayUrl, formatMonth, formatScore } from './format';
import ProjectGrid from './ProjectGrid';
import Reveal from './Reveal';
import WebBackground from './WebBackground';
import styles from './Portfolio.module.css';

type Props = { content: SiteContent; projects: PublicProjects };

function SectionTitle({ kicker, title, id }: { kicker: string; title: string; id: string }) {
  return (
    <Reveal className={styles.sectionTitle}>
      <span className={styles.kicker}>{kicker}</span>
      <h2 id={id}>{title}</h2>
    </Reveal>
  );
}

export default function Portfolio({ content, projects }: Props) {
  const { profile } = content;
  const now = currentRole(content);
  const college = content.education[0];
  const year = new Date().getFullYear();
  const links = [
    profile.linkedin && { label: 'LinkedIn', href: profile.linkedin },
    profile.github && { label: 'GitHub', href: profile.github },
    profile.email && { label: 'Email', href: `mailto:${profile.email}` },
    content.resume && { label: 'Resume', href: '/resume' },
    ...profile.otherLinks.map((l) => ({ label: l.label, href: l.url })),
  ].filter((l): l is { label: string; href: string } => Boolean(l));

  return (
    <div className={styles.wrap}>
      <WebBackground />
      <main className={styles.main}>
        <section className={styles.intro} aria-labelledby="intro-title">
          <Reveal>
            <p className={styles.eyebrow}>Behind the mask</p>
          </Reveal>
          <Reveal delay={80}>
            <h2 id="intro-title" className={styles.name}>
              {profile.name}
            </h2>
          </Reveal>
          {profile.headline && (
            <Reveal delay={160}>
              <p className={styles.headline}>{profile.headline}</p>
            </Reveal>
          )}
          {profile.about && (
            <Reveal delay={240}>
              <p className={styles.about}>{profile.about}</p>
            </Reveal>
          )}
          {links.length > 0 && (
            <Reveal delay={320}>
              <nav className={styles.links} aria-label="Contact and profiles">
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    className={styles.pill}
                    {...(l.href.startsWith('http') || l.href === '/resume' ? { target: '_blank', rel: 'noreferrer' } : {})}
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
            </Reveal>
          )}
        </section>

        {(now || college) && (
          <section className={styles.nowRow} aria-label="Right now">
            {now && (
              <Reveal className={`${styles.card} ${styles.nowCard}`}>
                <span className={styles.live}>
                  <i aria-hidden="true" /> {now.current ? 'Right now' : 'Most recently'}
                </span>
                <h3 className={styles.nowRole}>{now.role}</h3>
                <p className={styles.meta}>
                  {[companyShort(now.company), now.location, now.start && `since ${now.start}`].filter(Boolean).join(' · ')}
                </p>
                {now.bullets.length > 0 && (
                  <ul className={styles.bullets}>
                    {now.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </Reveal>
            )}
            {college && (
              <Reveal delay={120} className={`${styles.card} ${styles.eduCard}`}>
                <span className={styles.cardLabel}>Education</span>
                <h3 className={styles.eduSchool}>{college.school}</h3>
                <p className={styles.meta}>
                  {[college.degree, college.score && formatScore(college.score), college.end].filter(Boolean).join(' · ')}
                </p>
                {content.education.slice(1).map((e) => (
                  <p key={e.id} className={styles.eduMore}>
                    {e.school} <span>{[e.degree, e.score && formatScore(e.score)].filter(Boolean).join(' · ')}</span>
                  </p>
                ))}
              </Reveal>
            )}
          </section>
        )}

        {content.experience.length > 0 && (
          <section className={styles.section} aria-labelledby="experience-title">
            <SectionTitle kicker="Chapter 1" title="Experience" id="experience-title" />
            <ol className={styles.timeline}>
              {content.experience.map((e, i) => (
                <li key={e.id} className={styles.job}>
                  <Reveal delay={i * 90}>
                    <div className={styles.jobDates}>{[e.start, e.end].filter(Boolean).join(' – ')}</div>
                    <div className={styles.card}>
                      <h3 className={styles.jobRole}>
                        {e.role}
                        {e.current && <span className={styles.nowBadge}>Now</span>}
                      </h3>
                      <p className={styles.meta}>{[e.company, e.location].filter(Boolean).join(' · ')}</p>
                      {e.bullets.length > 0 && (
                        <ul className={styles.bullets}>
                          {e.bullets.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </section>
        )}

        {(projects.featured.length > 0 || projects.others.length > 0) && (
          <section className={styles.section} aria-labelledby="projects-title">
            <SectionTitle kicker="Chapter 2" title="Projects" id="projects-title" />
            {projects.featured.length > 0 && (
              <div className={styles.featured}>
                {projects.featured.map((p, i) => (
                  <Reveal key={p.key} delay={i * 110} className={styles.featureWrap}>
                    <a href={p.url} target="_blank" rel="noreferrer" className={styles.feature}>
                      <span className={styles.featureNo}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={styles.featureTitle}>{p.title}</span>
                      {p.description && <span className={styles.featureDesc}>{p.description}</span>}
                      {p.points.length > 0 && (
                        <span className={styles.featurePoints}>
                          {p.points.slice(0, 2).map((pt) => (
                            <span key={pt}>{pt}</span>
                          ))}
                        </span>
                      )}
                      <span className={styles.featureFoot}>
                        <span className={styles.chips}>
                          {p.stack.slice(0, 5).map((s) => (
                            <span key={s} className={styles.chip}>
                              {s}
                            </span>
                          ))}
                        </span>
                        <span className={styles.featureLink}>
                          GitHub ↗{p.pushedAt && <small>{formatMonth(p.pushedAt)}</small>}
                        </span>
                      </span>
                    </a>
                  </Reveal>
                ))}
              </div>
            )}
            <ProjectGrid projects={projects.others} profileUrl={projects.profileUrl} />
          </section>
        )}

        {(content.skills.length > 0 || content.achievements.length > 0 || content.responsibilities.length > 0) && (
          <section className={styles.section} aria-labelledby="toolkit-title">
            <SectionTitle kicker="Chapter 3" title="Toolkit & wins" id="toolkit-title" />
            <div className={styles.twoCol}>
              {content.skills.length > 0 && (
                <Reveal className={styles.card}>
                  {content.skills.map((g) => (
                    <div key={g.id} className={styles.skillGroup}>
                      {g.label && <h3 className={styles.cardLabel}>{g.label}</h3>}
                      <div className={styles.chips}>
                        {g.items.map((s) => (
                          <span key={s} className={styles.chip}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </Reveal>
              )}
              <Reveal delay={120} className={styles.card}>
                {content.achievements.length > 0 && (
                  <>
                    <h3 className={styles.cardLabel}>Wins</h3>
                    <ul className={styles.wins}>
                      {content.achievements.map((a) => (
                        <li key={a.id}>
                          {a.url ? (
                            <a href={a.url} target="_blank" rel="noreferrer">
                              {a.text} <span aria-hidden="true">↗</span>
                            </a>
                          ) : (
                            a.text
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {content.responsibilities.length > 0 && (
                  <>
                    <h3 className={`${styles.cardLabel} ${styles.spaced}`}>Off the clock</h3>
                    <ul className={styles.wins}>
                      {content.responsibilities.map((r) => (
                        <li key={r.id}>
                          {r.title && <b>{r.title}. </b>}
                          {r.text}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Reveal>
            </div>
          </section>
        )}

        <footer className={styles.footer}>
          <Reveal>
            <p className={styles.footerBig}>Let&apos;s build something.</p>
            {profile.email && (
              <a href={`mailto:${profile.email}`} className={styles.footerMail}>
                {displayUrl(profile.email)}
              </a>
            )}
          </Reveal>
          <div className={styles.footerBar}>
            <span>
              © {year} {profile.name}. Spider-Man and related characters belong to Marvel; this is fan art, not
              affiliated.
            </span>
            <a href="/admin" className={styles.admin}>
              Admin login
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
