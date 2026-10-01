// Pure helpers shared by the server and the admin UI (no Node imports here).
import type {
  Achievement,
  EducationItem,
  ExperienceItem,
  ExtraLink,
  GithubSettings,
  Narration,
  Profile,
  Repo,
  Responsibility,
  ResumeData,
  ResumeProject,
  SiteContent,
  SkillGroup,
} from './types';

export const MAX_FEATURED = 3;

export const DEFAULT_NARRATION =
  "Hey, I'm Rohit Parashar. I'm a product analyst at Dashverse in Bangalore, where I dig through user funnels for DashReels and Frameo AI, find where people drop off, and turn that into product fixes. Before this, I built category dashboards for a quick-commerce startup, FirstClub. I'm an NIT Jamshedpur grad, a quizzer, and clearly a Spider-Man fan. Dodge a few villains, or scroll down to see my work.";

export function emptyProfile(): Profile {
  return {
    name: '',
    headline: '',
    about: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    otherLinks: [],
  };
}

export function defaultContent(): SiteContent {
  return {
    version: 1,
    profile: { ...emptyProfile(), name: 'Rohit Parashar' },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    achievements: [],
    responsibilities: [],
    narration: { text: DEFAULT_NARRATION, voice: '', rate: 1, pitch: 1 },
    github: { username: '', featured: [], hidden: [], repos: [], syncedAt: '' },
    resume: null,
    updatedAt: '',
  };
}

// ---------- small utils ----------

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function makeId(prefix: string, index: number, label: string): string {
  return `${prefix}-${index}-${slug(label) || 'item'}`;
}

/** Only http(s) and mailto links survive; anything else becomes "". */
export function safeUrl(input: unknown): string {
  if (typeof input !== 'string') return '';
  const raw = input.trim();
  if (!raw) return '';
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(raw)) return `mailto:${raw}`;
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') return u.toString();
  } catch {
    // not a URL
  }
  return '';
}

export function emailFromMailto(url: string): string {
  return url.startsWith('mailto:') ? url.slice('mailto:'.length) : url;
}

/** "Dashverse India Private Limited" -> "Dashverse" */
export function companyShort(company: string): string {
  return company
    .replace(/\b(india\s+)?(private|pvt\.?)\s+(limited|ltd\.?)\b/gi, '')
    .replace(/\b(limited|ltd\.?|inc\.?|llp|llc)\b/gi, '')
    .replace(/[\s,]+$/g, '')
    .trim();
}

/** "Neptune_Attacks_Final" -> "Neptune Attacks Final", "ECOMM_DASHBOARD" -> "Ecomm Dashboard" */
export function prettifyRepoName(name: string): string {
  const words = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_\s.]+/)
    .filter(Boolean);
  return words
    .map((w) => {
      if (w.length <= 3 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w; // keep acronyms like "AI", "SQL"
      if (w === w.toUpperCase()) return w.charAt(0) + w.slice(1).toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    const [owner, repo] = u.pathname.split('/').filter(Boolean);
    if (!owner) return null;
    return { owner, repo: (repo ?? '').replace(/\.git$/i, '') };
  } catch {
    return null;
  }
}

export function repoNameFromUrl(url: string): string {
  return parseGithubUrl(url)?.repo ?? '';
}

export function currentRole(content: Pick<SiteContent, 'experience'>): ExperienceItem | null {
  return content.experience.find((e) => e.current) ?? content.experience[0] ?? null;
}

export function suggestHeadline(experience: ExperienceItem[]): string {
  const now = experience.find((e) => e.current) ?? experience[0];
  if (!now) return '';
  const company = companyShort(now.company);
  return company ? `${now.role} at ${company}` : now.role;
}

export function suggestAbout(data: Pick<ResumeData, 'experience' | 'education'>): string {
  const parts: string[] = [];
  const now = data.experience.find((e) => e.current) ?? data.experience[0];
  if (now) {
    const company = companyShort(now.company);
    parts.push(`${now.role}${company ? ` at ${company}` : ''}${now.location ? `, ${now.location.replace(/\s*\(.*\)$/, '')}` : ''}.`);
  }
  const prev = data.experience.find((e) => e !== now);
  if (prev) parts.push(`Previously ${prev.role} at ${companyShort(prev.company)}.`);
  const college = data.education[0];
  if (college) parts.push(`${college.degree ? `${college.degree}, ` : ''}${college.school}.`);
  return parts.join(' ');
}

/** A plain, template-based narration built from resume data. */
export function suggestNarration(content: Pick<SiteContent, 'profile' | 'experience' | 'education'>): string {
  const name = content.profile.name || 'Rohit';
  const out: string[] = [`Hey, I'm ${name}.`];
  const now = content.experience.find((e) => e.current) ?? content.experience[0];
  if (now) {
    const company = companyShort(now.company);
    const city = now.location.replace(/\s*\(.*\)$/, '').trim();
    out.push(`Right now I'm a ${now.role}${company ? ` at ${company}` : ''}${city ? ` in ${city}` : ''}.`);
  }
  const prev = content.experience.find((e) => e !== now);
  if (prev) out.push(`Before that, I was a ${prev.role} at ${companyShort(prev.company)}.`);
  const college = content.education[0];
  if (college) out.push(`I studied at ${college.school}.`);
  out.push('Dodge a few villains, or scroll down to see my work.');
  return out.join(' ');
}

// ---------- sanitising (used for stored content and admin saves) ----------

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const arr = <T>(v: unknown, map: (x: unknown, i: number) => T | null, max = 60): T[] =>
  Array.isArray(v) ? v.slice(0, max).map(map).filter((x): x is T => x !== null) : [];
const strList = (v: unknown, maxItems = 40, maxLen = 600): string[] =>
  arr(v, (x) => str(x, maxLen) || null, maxItems);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

function sanitizeProfile(v: unknown): Profile {
  const o = obj(v);
  return {
    name: str(o.name, 120),
    headline: str(o.headline, 200),
    about: str(o.about, 1200),
    email: str(o.email, 200),
    phone: str(o.phone, 40),
    location: str(o.location, 120),
    linkedin: safeUrl(o.linkedin),
    github: safeUrl(o.github),
    otherLinks: arr(o.otherLinks, (x): ExtraLink | null => {
      const l = obj(x);
      const url = safeUrl(l.url);
      return url ? { label: str(l.label, 60) || 'Link', url } : null;
    }, 10),
  };
}

function sanitizeExperience(v: unknown): ExperienceItem[] {
  return arr(v, (x, i) => {
    const o = obj(x);
    const role = str(o.role, 160);
    const company = str(o.company, 160);
    if (!role && !company) return null;
    return {
      id: str(o.id, 80) || makeId('exp', i, role || company),
      role,
      company,
      location: str(o.location, 120),
      start: str(o.start, 40),
      end: str(o.end, 40),
      current: Boolean(o.current),
      bullets: strList(o.bullets, 12),
    };
  }, 20);
}

function sanitizeEducation(v: unknown): EducationItem[] {
  return arr(v, (x, i) => {
    const o = obj(x);
    const school = str(o.school, 160);
    if (!school) return null;
    return {
      id: str(o.id, 80) || makeId('edu', i, school),
      school,
      degree: str(o.degree, 160),
      score: str(o.score, 40),
      location: str(o.location, 120),
      start: str(o.start, 40),
      end: str(o.end, 40),
    };
  }, 10);
}

function sanitizeSkills(v: unknown): SkillGroup[] {
  return arr(v, (x, i) => {
    const o = obj(x);
    const items = strList(o.items, 40, 80);
    if (!items.length) return null;
    const label = str(o.label, 80);
    return { id: str(o.id, 80) || makeId('skill', i, label), label, items };
  }, 12);
}

function sanitizeProjects(v: unknown): ResumeProject[] {
  return arr(v, (x, i) => {
    const o = obj(x);
    const name = str(o.name, 160);
    if (!name) return null;
    return {
      id: str(o.id, 80) || makeId('proj', i, name),
      name,
      url: safeUrl(o.url),
      stack: strList(o.stack, 20, 60),
      bullets: strList(o.bullets, 10),
    };
  }, 20);
}

function sanitizeAchievements(v: unknown): Achievement[] {
  return arr(v, (x, i) => {
    const o = obj(x);
    const text = str(o.text, 600);
    if (!text) return null;
    return { id: str(o.id, 80) || makeId('ach', i, text), text, url: safeUrl(o.url) };
  }, 20);
}

function sanitizeResponsibilities(v: unknown): Responsibility[] {
  return arr(v, (x, i) => {
    const o = obj(x);
    const title = str(o.title, 160);
    const text = str(o.text, 600);
    if (!title && !text) return null;
    return { id: str(o.id, 80) || makeId('pos', i, title || text), title, text };
  }, 20);
}

function sanitizeNarration(v: unknown, fallback: Narration): Narration {
  const o = obj(v);
  return {
    text: str(o.text, 1500) || fallback.text,
    voice: str(o.voice, 200),
    rate: num(o.rate, 1, 0.6, 1.4),
    pitch: num(o.pitch, 1, 0.6, 1.4),
  };
}

export function sanitizeRepo(x: unknown): Repo | null {
  const o = obj(x);
  const name = str(o.name, 120);
  const url = safeUrl(o.url);
  if (!name || !url) return null;
  return {
    name,
    url,
    description: str(o.description, 400),
    summary: str(o.summary, 400),
    language: str(o.language, 40),
    stars: num(o.stars, 0, 0, 1e7),
    forks: num(o.forks, 0, 0, 1e7),
    pushedAt: str(o.pushedAt, 40),
    homepage: safeUrl(o.homepage),
    topics: strList(o.topics, 20, 50),
    fork: Boolean(o.fork),
    archived: Boolean(o.archived),
  };
}

function sanitizeGithub(v: unknown): GithubSettings {
  const o = obj(v);
  return {
    username: str(o.username, 60).replace(/[^A-Za-z0-9-]/g, ''),
    featured: strList(o.featured, MAX_FEATURED, 120),
    hidden: strList(o.hidden, 200, 120),
    repos: arr(o.repos, sanitizeRepo, 200),
    syncedAt: str(o.syncedAt, 40),
  };
}

export function sanitizeContent(input: unknown): SiteContent {
  const o = obj(input);
  const base = defaultContent();
  const resume = obj(o.resume);
  return {
    version: 1,
    profile: { ...sanitizeProfile(o.profile), name: str(obj(o.profile).name, 120) || base.profile.name },
    experience: sanitizeExperience(o.experience),
    education: sanitizeEducation(o.education),
    skills: sanitizeSkills(o.skills),
    projects: sanitizeProjects(o.projects),
    achievements: sanitizeAchievements(o.achievements),
    responsibilities: sanitizeResponsibilities(o.responsibilities),
    narration: sanitizeNarration(o.narration, base.narration),
    github: sanitizeGithub(o.github),
    resume: str(resume.fileName) ? { fileName: str(resume.fileName, 200), uploadedAt: str(resume.uploadedAt, 40) } : null,
    updatedAt: str(o.updatedAt, 40),
  };
}

/**
 * Builds the draft shown for review after a resume upload: every resume-derived
 * field is replaced, while the about text, narration and GitHub snapshot are kept.
 */
export function mergeResume(current: SiteContent, data: ResumeData): SiteContent {
  const username = data.githubUsername || current.github.username;
  // Only repos on the user's own account can be highlighted (a teammate's repo has no stats here).
  const featuredFromResume = data.repoLinks
    .map((url) => parseGithubUrl(url))
    .filter((gh) => gh?.repo && gh.owner.toLowerCase() === username.toLowerCase())
    .map((gh) => gh!.repo)
    .filter((name, i, all) => all.indexOf(name) === i)
    .slice(0, MAX_FEATURED);
  return {
    ...current,
    profile: {
      ...data.profile,
      name: data.profile.name || current.profile.name,
      headline: suggestHeadline(data.experience) || current.profile.headline,
      about: current.profile.about || suggestAbout(data),
    },
    experience: data.experience,
    education: data.education,
    skills: data.skills,
    projects: data.projects,
    achievements: data.achievements,
    responsibilities: data.responsibilities,
    github: {
      ...current.github,
      username,
      featured: featuredFromResume.length ? featuredFromResume : current.github.featured,
      // A different GitHub account makes the old snapshot meaningless.
      repos: username === current.github.username ? current.github.repos : [],
      syncedAt: username === current.github.username ? current.github.syncedAt : '',
    },
  };
}
