export type ExperienceItem = {
  id: string;
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  bullets: string[];
};

export type EducationItem = {
  id: string;
  school: string;
  degree: string;
  score: string;
  location: string;
  start: string;
  end: string;
};

export type SkillGroup = { id: string; label: string; items: string[] };

export type ResumeProject = {
  id: string;
  name: string;
  url: string;
  stack: string[];
  bullets: string[];
};

export type Achievement = { id: string; text: string; url: string };

export type Responsibility = { id: string; title: string; text: string };

export type ExtraLink = { label: string; url: string };

export type Profile = {
  name: string;
  headline: string;
  about: string;
  email: string;
  // Parsed from the resume but never rendered on the public site.
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  otherLinks: ExtraLink[];
};

export type Narration = {
  text: string;
  // Preferred SpeechSynthesis voice name; "" lets the browser pick the most natural one.
  voice: string;
  rate: number;
  pitch: number;
};

export type Repo = {
  name: string;
  url: string;
  description: string;
  // README excerpt, filled during an admin sync for repos without a description.
  summary: string;
  language: string;
  stars: number;
  forks: number;
  pushedAt: string;
  homepage: string;
  topics: string[];
  fork: boolean;
  archived: boolean;
};

export type GithubSettings = {
  username: string;
  // Repo names shown as the three highlighted projects, in order.
  featured: string[];
  hidden: string[];
  repos: Repo[];
  syncedAt: string;
};

export type ResumeFileInfo = { fileName: string; uploadedAt: string };

export type SiteContent = {
  version: 1;
  profile: Profile;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillGroup[];
  projects: ResumeProject[];
  achievements: Achievement[];
  responsibilities: Responsibility[];
  narration: Narration;
  github: GithubSettings;
  resume: ResumeFileInfo | null;
  updatedAt: string;
};

// What the resume reader extracts from a PDF.
export type ResumeData = {
  profile: Profile;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillGroup[];
  projects: ResumeProject[];
  achievements: Achievement[];
  responsibilities: Responsibility[];
  githubUsername: string;
  // github.com/<user>/<repo> links found anywhere in the resume, in reading order.
  repoLinks: string[];
};

export type ParseResult = { data: ResumeData; warnings: string[] };
