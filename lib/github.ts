import { prettifyRepoName, repoNameFromUrl, MAX_FEATURED } from './content';
import type { Repo, SiteContent } from './types';

const API = 'https://api.github.com';
// The public page re-checks GitHub at most every 6 hours (60 unauthenticated calls/hour are allowed).
const LIVE_REVALIDATE_SECONDS = 6 * 60 * 60;

type ApiRepo = {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string | null;
  homepage: string | null;
  topics?: string[];
  fork: boolean;
  archived: boolean;
};

function headers(accept = 'application/vnd.github+json'): Record<string, string> {
  const h: Record<string, string> = {
    Accept: accept,
    'User-Agent': 'rohit-portfolio',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

function toRepo(r: ApiRepo): Repo {
  return {
    name: r.name,
    url: r.html_url,
    description: r.description ?? '',
    summary: '',
    language: r.language ?? '',
    stars: r.stargazers_count,
    forks: r.forks_count,
    pushedAt: r.pushed_at ?? '',
    homepage: r.homepage ?? '',
    topics: r.topics ?? [],
    fork: r.fork,
    archived: r.archived,
  };
}

async function fetchRepos(username: string, revalidate?: number): Promise<Repo[]> {
  const url = `${API}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed&type=owner`;
  const res = await fetch(url, revalidate ? { headers: headers(), next: { revalidate } } : { headers: headers(), cache: 'no-store' });
  if (!res.ok) {
    const hint = res.status === 403 || res.status === 429 ? ' (rate limited; set GITHUB_TOKEN to raise the limit)' : '';
    throw new Error(`GitHub returned ${res.status} for ${username}${hint}`);
  }
  return ((await res.json()) as ApiRepo[]).map(toRepo);
}

/** First real paragraph of a README, stripped of markdown, as a one-line summary. */
export function excerptFromMarkdown(md: string, max = 220): string {
  const text = md
    .replace(/\r/g, '')
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  const toPlain = (p: string) =>
    p
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[*_`~]+/g, '')
      .replace(/\\(?=\s|$)/g, '') // markdown hard line breaks
      .replace(/^\s*(?:[-*+•▪◦]|\d+\.)\s*/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  const plain = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !/^(#|\||>|[-*_]{3,}$|\[!\[)/.test(p))
    .map(toPlain)
    // Skip one-liners like "Dashboard Link"; a summary needs a real sentence.
    .find((p) => p.replace(/[^A-Za-z]/g, '').length >= 40 && p.split(' ').length >= 7);
  if (!plain) return '';
  if (plain.length <= max) return plain;
  return `${plain.slice(0, plain.lastIndexOf(' ', max)).replace(/[,;:.\s]+$/, '')}…`;
}

async function fetchReadmeExcerpt(owner: string, repo: string): Promise<string> {
  try {
    const res = await fetch(`${API}/repos/${owner}/${repo}/readme`, {
      headers: headers('application/vnd.github.raw'),
      cache: 'no-store',
    });
    return res.ok ? excerptFromMarkdown(await res.text()) : '';
  } catch {
    return '';
  }
}

/** Admin sync: the repo list plus README summaries for repos without a description. */
export async function syncRepos(username: string): Promise<Repo[]> {
  const repos = await fetchRepos(username);
  await Promise.all(
    repos
      .filter((r) => !r.fork && !r.description)
      .map(async (r) => {
        r.summary = await fetchReadmeExcerpt(username, r.name);
      }),
  );
  return repos;
}

export type ProjectCard = {
  key: string;
  title: string;
  url: string;
  description: string;
  points: string[];
  stack: string[];
  language: string;
  stars: number;
  pushedAt: string;
};

export type PublicProjects = { featured: ProjectCard[]; others: ProjectCard[]; profileUrl: string; live: boolean };

/**
 * Projects for the public page. Uses a cached live repo list when GitHub answers
 * (so new repos show up without an admin sync) and the stored snapshot otherwise.
 */
export async function getPublicProjects(content: SiteContent): Promise<PublicProjects> {
  const { github } = content;
  let repos = github.repos;
  let live = false;
  if (github.username) {
    try {
      const fresh = await fetchRepos(github.username, LIVE_REVALIDATE_SECONDS);
      const summaries = new Map(github.repos.map((r) => [r.name, r.summary]));
      repos = fresh.map((r) => ({ ...r, summary: summaries.get(r.name) ?? '' }));
      live = true;
    } catch {
      // Offline or rate limited: keep the snapshot.
    }
  }

  const byName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
  const resumeByRepo = new Map<string, { title: string; points: string[]; stack: string[] }>();
  for (const p of content.projects) {
    const name = repoNameFromUrl(p.url).toLowerCase();
    if (name) resumeByRepo.set(name, { title: p.name, points: p.bullets, stack: p.stack });
  }
  for (const a of content.achievements) {
    const name = repoNameFromUrl(a.url).toLowerCase();
    if (name && !resumeByRepo.has(name)) resumeByRepo.set(name, { title: '', points: [a.text], stack: [] });
  }

  const card = (name: string): ProjectCard | null => {
    const key = name.toLowerCase();
    const repo = byName.get(key);
    const fromResume = resumeByRepo.get(key);
    if (!repo && !fromResume) return null;
    const url = repo?.url ?? `https://github.com/${github.username}/${name}`;
    return {
      key,
      title: fromResume?.title || prettifyRepoName(repo?.name ?? name),
      url,
      // Resume text is the better pitch; the GitHub summary is only a fallback (they often say the same thing).
      description: fromResume?.points.length ? '' : repo?.description || repo?.summary || '',
      points: fromResume?.points ?? [],
      stack: fromResume?.stack.length ? fromResume.stack : repo?.language ? [repo.language] : [],
      language: repo?.language ?? '',
      stars: repo?.stars ?? 0,
      pushedAt: repo?.pushedAt ?? '',
    };
  };

  const featured = github.featured
    .slice(0, MAX_FEATURED)
    .map(card)
    .filter((c): c is ProjectCard => c !== null);
  const featuredKeys = new Set(featured.map((c) => c.key));
  const hidden = new Set(github.hidden.map((h) => h.toLowerCase()));
  const others = repos
    .filter((r) => !r.fork && !featuredKeys.has(r.name.toLowerCase()) && !hidden.has(r.name.toLowerCase()))
    .sort((a, b) => (b.pushedAt || '').localeCompare(a.pushedAt || ''))
    .map((r) => card(r.name))
    .filter((c): c is ProjectCard => c !== null);

  return {
    featured,
    others,
    profileUrl: content.profile.github || (github.username ? `https://github.com/${github.username}` : ''),
    live,
  };
}
