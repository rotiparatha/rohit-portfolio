import type { Metadata } from 'next';
import { connection } from 'next/server';
import Landing from '@/components/landing/Landing';
import Portfolio from '@/components/portfolio/Portfolio';
import { defaultContent } from '@/lib/content';
import { getPublicProjects } from '@/lib/github';
import { readContent } from '@/lib/store';

/** The public page never fails on storage trouble; it falls back to the built-in defaults. */
async function loadContent() {
  try {
    return await readContent();
  } catch (err) {
    console.error('Could not load site content', err);
    return defaultContent();
  }
}

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const { profile } = await loadContent();
  return {
    title: [profile.name, profile.headline].filter(Boolean).join(' · '),
    description: profile.about || `Portfolio of ${profile.name}.`,
  };
}

export default async function Home() {
  // Content changes whenever the admin publishes, so render per request.
  await connection();
  const content = await loadContent();
  const projects = await getPublicProjects(content);
  const firstName = content.profile.name.split(/\s+/)[0] || 'me';

  return (
    <Landing firstName={firstName} name={content.profile.name} headline={content.profile.headline} narration={content.narration}>
      <Portfolio content={content} projects={projects} />
    </Landing>
  );
}
