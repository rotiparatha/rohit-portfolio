// Reads a resume PDF into structured data. Tuned for single-column LaTeX/Word
// resumes (Jake's template and similar): small-caps or bold section headings,
// bold entry titles with right-aligned dates, italic subtitles and bullet lists.
import { getDocumentProxy } from 'unpdf';
import { emptyProfile, makeId, parseGithubUrl, safeUrl } from '../content';
import type {
  Achievement,
  EducationItem,
  ExperienceItem,
  ExtraLink,
  ParseResult,
  Profile,
  Responsibility,
  ResumeProject,
  SkillGroup,
} from '../types';

type FontInfo = { bold: boolean; italic: boolean; smallCaps: boolean };

type Item = FontInfo & { str: string; x: number; y: number; w: number; size: number };

type LinkRef = { url: string; text: string };

type Segment = { text: string; x: number; end: number; items: Item[] };

type Line = {
  y: number;
  segs: Segment[];
  text: string;
  // Left edge of the text, after any bullet glyph.
  x: number;
  size: number;
  bullet: boolean;
  links: LinkRef[];
  items: Item[];
};

type SectionKey =
  | 'header'
  | 'education'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'achievements'
  | 'responsibilities'
  | 'other';

type Bullet = { text: string; lead: string; links: LinkRef[]; bodyX: number };

type Block = { title: Line | null; subtitle: Line | null; extra: Line[]; bullets: Bullet[] };

type PdfTextItem = { str?: string; transform?: number[]; width?: number; height?: number; fontName?: string };
type PdfAnnotation = { subtype?: string; url?: string; unsafeUrl?: string; rect?: number[] };
type PdfFont = { name?: string; bold?: boolean; black?: boolean; italic?: boolean };
type PdfPage = {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
  getOperatorList(): Promise<unknown>;
  getAnnotations(): Promise<PdfAnnotation[]>;
  commonObjs: { get(id: string): PdfFont | undefined };
};

const MAX_PAGES = 4;
const COLUMN_GAP = 12; // a horizontal gap wider than this splits a line (e.g. right-aligned dates)
const SAME_LINE = 2.5; // baseline tolerance; bullet glyphs sit ~1.3pt above their text
const SINGLE_BULLETS = new Set(['•', '◦', '▪', '‣', '●', '■', '∙', '·', '–', '—', '*', '➢', '►', '▸', '○', '❖', '-']);
const LEADING_BULLET = /^[•◦▪‣●■∙➢►▸○❖]\s+/;
const ROLE_RE =
  /\b(intern|analyst|engineer|developer|manager|associate|lead|consultant|designer|scientist|specialist|coordinator|officer|head|founder|trainee|executive|assistant|researcher|fellow|director|architect|administrator|programmer|strategist)\b/i;
const LINK_LABEL_RE = /^(github|code|link|demo|live|repo|website|source|view|here|certificate)$/i;
const YEAR_RE = /\b(19|20)\d{2}\b/;
const CURRENT_RE = /\b(present|current|ongoing|now|till date|to date)\b/i;

// ---------- text helpers ----------

function clean(s: string): string {
  return s
    .replace(/ /g, ' ')
    .replace(/(^|[\s(])[”"]/g, '$1“')
    .replace(/[“"](?=$|[\s.,;:!?)])/g, '”')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function titleCaseIfShouting(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

function splitList(s: string): string[] {
  return s
    .split(/[,|;]/)
    .map((x) => x.trim().replace(/\.$/, ''))
    .filter(Boolean);
}

function dedupe<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export function isDateLike(s: string): boolean {
  return YEAR_RE.test(s) || CURRENT_RE.test(s);
}

export function parseDateRange(s: string): { start: string; end: string; current: boolean } {
  const t = clean(s);
  if (!t) return { start: '', end: '', current: false };
  const parts = t
    // "Nov 2022 - May 2026", "Mar – May 2026", "2022-2026", "January 2026-April 2026", "2025 to Present"
    .split(/\s*(?:–|—|\bto\b)\s*|\s+-\s+|(?<=\d{4})\s*-\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  let start = parts.length > 1 ? parts[0] : '';
  let end = parts.length > 1 ? parts.slice(1).join(' ') : parts[0] ?? '';
  const endYear = end.match(YEAR_RE)?.[0];
  if (start && !YEAR_RE.test(start) && endYear) start = `${start} ${endYear}`; // "Mar - May 2026"
  const current = CURRENT_RE.test(end);
  if (current) end = 'Present';
  return { start, end, current };
}

// ---------- PDF -> lines ----------

function fontInfo(page: PdfPage, fontName: string, cache: Map<string, FontInfo>): FontInfo {
  const hit = cache.get(fontName);
  if (hit) return hit;
  let name = '';
  let bold = false;
  let italic = false;
  try {
    const f = page.commonObjs.get(fontName);
    name = String(f?.name ?? '');
    bold = Boolean(f?.bold || f?.black);
    italic = Boolean(f?.italic);
  } catch {
    // Font not resolved; fall back to plain text.
  }
  const base = name.replace(/^[A-Z]{6}\+/, '');
  if (/bold|black|heavy|semibold|demibold/i.test(base) || /^(CMB|SFB)/i.test(base)) bold = true;
  if (/italic|oblique|^CMTI|^CMBXTI|^CMSL|^SFTI|^SFBI|-It$|BoldIt/i.test(base)) italic = true;
  const smallCaps = /^CMCSC|^SFCC|smallcaps|-SC$/i.test(base);
  const info = { bold, italic, smallCaps };
  cache.set(fontName, info);
  return info;
}

function charCount(items: Item[], pick: (i: Item) => boolean): number {
  return items.reduce((n, i) => n + (pick(i) ? i.str.replace(/\s/g, '').length : 0), 0);
}

function boldRatio(items: Item[]): number {
  const total = charCount(items, () => true);
  return total ? charCount(items, (i) => i.bold) / total : 0;
}

function boldLead(items: Item[]): string {
  let out = '';
  for (const it of items) {
    if (!it.bold) break;
    out += (out && !out.endsWith(' ') ? ' ' : '') + it.str;
  }
  return clean(out).replace(/[:\-–]\s*$/, '');
}

function toLine(y: number, raw: Item[], links: { url: string; x1: number; x2: number; y1: number; y2: number }[]): Line {
  const items = [...raw].sort((a, b) => a.x - b.x);
  let bullet = false;
  const first = items[0];
  if (first) {
    const t = first.str.trim();
    if (t.length === 1 && SINGLE_BULLETS.has(t) && items.length > 1) {
      bullet = true;
      items.shift();
    } else if (LEADING_BULLET.test(first.str.trimStart())) {
      bullet = true;
      items[0] = { ...first, str: first.str.trimStart().replace(LEADING_BULLET, ''), x: first.x + first.size * 0.6 };
    }
  }

  const segs: Segment[] = [];
  for (const it of items) {
    const seg = segs[segs.length - 1];
    const gap = seg ? it.x - seg.end : 0;
    if (!seg || gap > COLUMN_GAP) {
      segs.push({ text: it.str, x: it.x, end: it.x + it.w, items: [it] });
    } else {
      if (gap > 1 && !/\s$/.test(seg.text) && !/^\s/.test(it.str)) seg.text += ' ';
      seg.text += it.str;
      seg.end = Math.max(seg.end, it.x + it.w);
      seg.items.push(it);
    }
  }
  for (const s of segs) s.text = clean(s.text);

  const lineLinks: LinkRef[] = [];
  for (const l of links) {
    if (y < l.y1 - 3 || y > l.y2 + 3) continue;
    const covered = items.filter((i) => i.x < l.x2 && i.x + i.w > l.x1);
    if (covered.length) lineLinks.push({ url: l.url, text: clean(covered.map((i) => i.str).join(' ')) });
  }

  return {
    y,
    segs,
    text: segs.map((s) => s.text).join(' '),
    x: items[0]?.x ?? 0,
    size: items.reduce((m, i) => Math.max(m, i.size), 0),
    bullet,
    links: lineLinks,
    items,
  };
}

async function readLines(buf: Uint8Array): Promise<{ lines: Line[]; numPages: number }> {
  const pdf = await getDocumentProxy(buf, { verbosity: 0 });
  const fontCache = new Map<string, FontInfo>();
  const lines: Line[] = [];
  for (let p = 1; p <= Math.min(pdf.numPages, MAX_PAGES); p++) {
    const page = (await pdf.getPage(p)) as unknown as PdfPage;
    const content = await page.getTextContent();
    await page.getOperatorList(); // loads fonts into commonObjs so bold/italic can be read
    const items: Item[] = [];
    for (const raw of content.items) {
      if (typeof raw.str !== 'string' || !raw.str.trim() || !raw.transform) continue;
      const font = fontInfo(page, raw.fontName ?? '', fontCache);
      items.push({
        str: raw.str,
        x: raw.transform[4],
        y: raw.transform[5],
        w: raw.width ?? 0,
        size: raw.height || Math.abs(raw.transform[3]) || 10,
        ...font,
      });
    }
    const links = (await page.getAnnotations())
      .filter((a) => a.subtype === 'Link' && a.rect && (a.url || a.unsafeUrl))
      .map((a) => {
        const [ax1, ay1, ax2, ay2] = a.rect!;
        return {
          url: safeUrl(a.url || a.unsafeUrl),
          x1: Math.min(ax1, ax2),
          x2: Math.max(ax1, ax2),
          y1: Math.min(ay1, ay2),
          y2: Math.max(ay1, ay2),
        };
      })
      .filter((l) => l.url);

    const sorted = items.sort((a, b) => b.y - a.y || a.x - b.x);
    const groups: { y: number; items: Item[] }[] = [];
    for (const it of sorted) {
      const g = groups[groups.length - 1];
      if (g && Math.abs(g.y - it.y) <= SAME_LINE) g.items.push(it);
      else groups.push({ y: it.y, items: [it] });
    }
    for (const g of groups) lines.push(toLine(g.y, g.items, links));
  }
  return { lines, numPages: pdf.numPages };
}

// ---------- lines -> sections -> blocks ----------

function bodySizeOf(lines: Line[]): number {
  const sizes: number[] = [];
  for (const l of lines) for (const i of l.items) for (let k = 0; k < i.str.length; k += 4) sizes.push(i.size);
  sizes.sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)] ?? 10;
}

function sectionKeyFor(text: string): SectionKey | null {
  const t = text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || t.length > 50) return null;
  if (/responsib|leadership|extra ?curricular|volunteer|activities|\bclubs?\b|\bpositions?\b/.test(t)) return 'responsibilities';
  if (/achiev|award|certif|\bhonou?rs?\b|accomplish/.test(t)) return 'achievements';
  if (/project/.test(t)) return 'projects';
  // "\bexper" also catches misspellings such as "Expericence".
  if (/\bexper|employment|work history|\binternships?\b/.test(t)) return 'experience';
  if (/skill|technolog|\btools?\b|proficienc/.test(t)) return 'skills';
  if (/education|academic|qualification/.test(t)) return 'education';
  return null;
}

function headingKey(line: Line, bodySize: number): SectionKey | null {
  if (line.bullet || line.segs.length !== 1) return null;
  const text = line.text;
  if (text.length < 3 || text.length > 50) return null;
  const key = sectionKeyFor(text);
  if (line.items.every((i) => i.smallCaps)) return key ?? 'other';
  const allCaps = /[A-Z]/.test(text) && text === text.toUpperCase();
  const big = line.size >= bodySize + 1.2;
  if (key && (allCaps || big || boldRatio(line.items) > 0.8)) {
    // A bold entry title such as "Projects Intern at X" is not a heading.
    if (!allCaps && !big && text.split(' ').length > 4) return null;
    return key;
  }
  if (allCaps && big) return 'other';
  return null;
}

function isTitleLike(line: Line): boolean {
  return !line.bullet && boldRatio(line.segs[0]?.items ?? []) >= 0.6;
}

function toBlocks(lines: Line[]): Block[] {
  const blocks: Block[] = [];
  // Typed via "as" so TypeScript doesn't narrow it to null (it's reassigned inside open()).
  let cur = null as Block | null;
  const open = (title: Line | null): Block => {
    cur = { title, subtitle: null, extra: [], bullets: [] };
    blocks.push(cur);
    return cur;
  };
  for (const line of lines) {
    const block: Block | null = cur;
    if (line.bullet) {
      (block ?? open(null)).bullets.push({
        text: line.segs.map((s) => s.text).join(' '),
        lead: boldLead(line.items),
        links: [...line.links],
        bodyX: line.x,
      });
      continue;
    }
    const lastBullet = block?.bullets[block.bullets.length - 1];
    if (lastBullet && line.x >= lastBullet.bodyX - 3 && !isTitleLike(line)) {
      lastBullet.text = clean(`${lastBullet.text} ${line.text}`);
      lastBullet.links.push(...line.links);
      continue;
    }
    const fresh = block && block.title && !block.subtitle && !block.bullets.length && !block.extra.length;
    if (isTitleLike(line) && !fresh) {
      open(line);
      continue;
    }
    if (fresh) {
      block.subtitle = line;
      continue;
    }
    (block ?? open(null)).extra.push(line);
  }
  return blocks;
}

function left(line: Line | null): string {
  return line?.segs[0]?.text ?? '';
}

function right(line: Line | null): string {
  return line ? line.segs.slice(1).map((s) => s.text).join(' ') : '';
}

function firstUrl(links: LinkRef[], prefer?: RegExp): string {
  if (prefer) {
    const hit = links.find((l) => prefer.test(l.url));
    if (hit) return hit.url;
  }
  return links.find((l) => !l.url.startsWith('mailto:'))?.url ?? '';
}

function stripLinkLabel(text: string): string {
  return text.replace(/\s*\|\s*(link|certificate|view|github|here|demo)\s*$/i, '').trim();
}

// ---------- section parsers ----------

const NOT_A_NAME =
  /(institute|university|college|school|resume|curriculum|vitae|technology|india|govt|government|ministry|national|importance|objective|profile|summary)/i;

/** The name is the largest short, letters-only line near the top of the first page. */
function pickNameLine(lines: Line[]): Line | null {
  const candidates = lines.slice(0, 12).filter((l) => {
    const words = l.text.split(/\s+/).length;
    return (
      !l.bullet &&
      l.segs.length === 1 &&
      words >= 2 &&
      words <= 4 &&
      /^\p{L}[\p{L} .'-]{2,40}$/u.test(l.text) &&
      !NOT_A_NAME.test(l.text) &&
      !sectionKeyFor(l.text)
    );
  });
  if (!candidates.length) return null;
  return candidates.reduce((best, l) => (l.size > best.size + 0.5 ? l : best), candidates[0]);
}

function parseHeader(lines: Line[], nameLine: Line | null): Profile {
  const profile = emptyProfile();
  if (!lines.length) return profile;
  profile.name = titleCaseIfShouting(nameLine?.text ?? lines[0].text);
  const rest = lines.filter((l) => l !== nameLine);
  const text = rest.map((l) => l.text).join(' | ');
  profile.email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? '';
  profile.phone = text.match(/\+?\d[\d\s-]{8,}\d/)?.[0]?.trim() ?? '';
  for (const link of rest.flatMap((l) => l.links)) {
    const gh = parseGithubUrl(link.url);
    if (link.url.startsWith('mailto:')) profile.email ||= link.url.slice(7);
    else if (/linkedin\.com/i.test(link.url)) profile.linkedin ||= link.url;
    else if (gh && !gh.repo) profile.github ||= link.url;
    else if (!profile.otherLinks.some((o) => o.url === link.url)) {
      profile.otherLinks.push({ label: link.text || 'Website', url: link.url } satisfies ExtraLink);
    }
  }
  return profile;
}

function parseExperience(blocks: Block[], warnings: string[]): ExperienceItem[] {
  const out: ExperienceItem[] = [];
  for (const b of blocks) {
    if (!b.title) {
      if (b.bullets.length) warnings.push('Some experience bullets had no job title above them and were skipped.');
      continue;
    }
    let role = left(b.title);
    let company = left(b.subtitle);
    const titleRight = right(b.title);
    const subRight = right(b.subtitle);
    let date = '';
    let location = '';
    if (isDateLike(titleRight)) {
      date = titleRight;
      location = subRight;
    } else if (isDateLike(subRight)) {
      date = subRight;
      location = titleRight;
    } else {
      location = titleRight || subRight;
    }
    if (!company) {
      const parts = role.split(/\s+(?:\||—|–|@|at)\s+/);
      if (parts.length > 1) [role, company] = [parts[0], parts.slice(1).join(' ')];
    }
    if (ROLE_RE.test(company) && !ROLE_RE.test(role)) [role, company] = [company, role];
    if (!location && company.includes(',')) {
      const idx = company.indexOf(',');
      location = company.slice(idx + 1).trim();
      company = company.slice(0, idx).trim();
    }
    const bullets = [...b.extra.map((l) => l.text), ...b.bullets.map((x) => x.text)];
    out.push({ id: makeId('exp', out.length, role), role, company, location, ...parseDateRange(date), bullets });
  }
  return out;
}

function parseEducation(blocks: Block[]): EducationItem[] {
  const out: EducationItem[] = [];
  for (const b of blocks) {
    if (!b.title) continue;
    const titleRight = right(b.title);
    const subRight = right(b.subtitle);
    const date = isDateLike(titleRight) ? titleRight : isDateLike(subRight) ? subRight : '';
    const location = date === titleRight ? subRight : titleRight;
    let degree = left(b.subtitle);
    let score = '';
    const m = degree.match(
      /^(.*?)\s*[,|–-]\s*((?:CGPA|GPA|Percentage|Score|Marks)?\s*:?\s*\d{1,3}(?:\.\d+)?\s*(?:%|\/\s*10|\/\s*4|CGPA|GPA)?)$/i,
    );
    if (m) {
      degree = m[1];
      score = m[2];
    }
    const range = parseDateRange(date);
    out.push({
      id: makeId('edu', out.length, left(b.title)),
      school: left(b.title),
      degree,
      score,
      location,
      start: range.start,
      end: range.end,
    });
  }
  return out;
}

function parseProjects(blocks: Block[]): ResumeProject[] {
  const out: ResumeProject[] = [];
  for (const b of blocks) {
    if (!b.title) continue;
    const parts = left(b.title).split(/\s*\|\s*/);
    const name = parts[0];
    const stack: string[] = [];
    for (const p of parts.slice(1)) if (!LINK_LABEL_RE.test(p)) stack.push(...splitList(p));
    const bullets: string[] = [];
    for (const l of [b.subtitle, ...b.extra]) {
      if (!l) continue;
      const m = l.text.match(/^(?:tech(?:nolog(?:y|ies))?(?:\s*stack)?|tools?(?:\s*used)?|stack|built with)\s*:?\s*(.*)$/i);
      if (m) stack.push(...splitList(m[1]));
      else bullets.push(l.text);
    }
    bullets.push(...b.bullets.map((x) => x.text));
    const links = [...b.title.links, ...(b.subtitle?.links ?? [])];
    out.push({
      id: makeId('proj', out.length, name),
      name,
      url: firstUrl(links, /github\.com/i),
      stack: dedupe(stack),
      bullets,
    });
  }
  return out;
}

function parseAchievements(blocks: Block[]): Achievement[] {
  const out: Achievement[] = [];
  for (const b of blocks) {
    if (b.title && !b.bullets.length) {
      out.push({ id: makeId('ach', out.length, b.title.text), text: stripLinkLabel(b.title.text), url: firstUrl(b.title.links) });
    }
    for (const x of b.bullets) {
      out.push({ id: makeId('ach', out.length, x.text), text: stripLinkLabel(x.text), url: firstUrl(x.links) });
    }
  }
  return out;
}

function parseResponsibilities(blocks: Block[]): Responsibility[] {
  const out: Responsibility[] = [];
  for (const b of blocks) {
    if (b.title) {
      const title = [left(b.title), left(b.subtitle)].filter(Boolean).join(', ');
      out.push({ id: makeId('pos', out.length, title), title, text: b.bullets.map((x) => x.text).join(' ') });
      continue;
    }
    for (const x of b.bullets) {
      const colon = x.text.indexOf(':');
      if (colon > 0 && colon <= 80) {
        const title = x.text.slice(0, colon).trim();
        out.push({ id: makeId('pos', out.length, title), title, text: x.text.slice(colon + 1).trim() });
      } else if (x.lead && x.lead.length < x.text.length) {
        out.push({ id: makeId('pos', out.length, x.lead), title: x.lead, text: x.text.slice(x.lead.length).replace(/^[\s:–-]+/, '') });
      } else {
        out.push({ id: makeId('pos', out.length, x.text), title: '', text: x.text });
      }
    }
  }
  return out;
}

function parseSkills(blocks: Block[]): SkillGroup[] {
  const out: SkillGroup[] = [];
  const texts = blocks.flatMap((b) => [...(b.title ? [b.title.text] : []), ...b.extra.map((l) => l.text), ...b.bullets.map((x) => x.text)]);
  for (const t of texts) {
    const colon = t.indexOf(':');
    const label = colon > 0 && colon <= 40 ? t.slice(0, colon).trim() : '';
    const items = splitList(colon > 0 && colon <= 40 ? t.slice(colon + 1) : t);
    if (items.length) out.push({ id: makeId('skill', out.length, label || items[0]), label, items });
  }
  return out;
}

// ---------- entry point ----------

export async function parseResume(buf: Uint8Array): Promise<ParseResult> {
  const warnings: string[] = [];
  const { lines, numPages } = await readLines(buf);
  if (numPages > MAX_PAGES) warnings.push(`Only the first ${MAX_PAGES} pages were read.`);

  const textChars = lines.reduce((n, l) => n + l.text.length, 0);
  if (textChars < 200) {
    warnings.push('Very little text was found. If this PDF is a scanned image, export it from Word/LaTeX/Google Docs instead.');
  }

  const bodySize = bodySizeOf(lines);
  const nameLine = pickNameLine(lines);
  const sections: { key: SectionKey; heading: string; lines: Line[] }[] = [{ key: 'header', heading: '', lines: [] }];
  for (const line of lines) {
    if (line === nameLine) {
      sections[0].lines.push(line);
      continue;
    }
    const key = headingKey(line, bodySize);
    if (key) sections.push({ key, heading: line.text, lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }
  if (sections.length === 1) warnings.push("Couldn't find any section headings (Education, Experience, Projects…).");

  const blocksOf = (key: SectionKey) => sections.filter((s) => s.key === key).flatMap((s) => toBlocks(s.lines));
  for (const s of sections) if (s.key === 'other') warnings.push(`Skipped the "${s.heading}" section; the site has no place for it yet.`);

  const profile = parseHeader(sections[0].lines, nameLine);
  const experience = parseExperience(blocksOf('experience'), warnings);
  const education = parseEducation(blocksOf('education'));
  const skills = parseSkills(blocksOf('skills'));
  const projects = parseProjects(blocksOf('projects'));
  const achievements = parseAchievements(blocksOf('achievements'));
  const responsibilities = parseResponsibilities(blocksOf('responsibilities'));

  if (!profile.location) {
    const now = experience.find((e) => e.current) ?? experience[0];
    profile.location = now?.location.replace(/\s*\(.*\)$/, '').trim() ?? '';
  }

  const repoLinks: string[] = [];
  for (const l of lines) {
    for (const link of l.links) {
      const gh = parseGithubUrl(link.url);
      if (!gh?.repo) continue;
      const url = `https://github.com/${gh.owner}/${gh.repo}`;
      if (!repoLinks.includes(url)) repoLinks.push(url);
    }
  }
  const githubUsername = parseGithubUrl(profile.github)?.owner ?? (repoLinks[0] ? parseGithubUrl(repoLinks[0])!.owner : '');

  if (!profile.name) warnings.push("Couldn't find your name at the top of the resume.");
  if (!experience.length) warnings.push('No experience entries were found.');
  if (!projects.length) warnings.push('No projects were found.');
  if (!githubUsername) warnings.push('No GitHub link was found, so the project list cannot be filled from GitHub.');

  return {
    data: { profile, experience, education, skills, projects, achievements, responsibilities, githubUsername, repoLinks },
    warnings: dedupe(warnings),
  };
}
