import type { Metadata } from 'next';
import { connection } from 'next/server';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminLogin from '@/components/admin/AdminLogin';
import { currentAdmin, googleConfigured } from '@/lib/auth';
import { readContent } from '@/lib/store';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminPage(props: PageProps<'/admin'>) {
  await connection();
  const email = await currentAdmin();
  if (!email) {
    const { error } = await props.searchParams;
    return <AdminLogin configured={googleConfigured()} error={typeof error === 'string' ? error : ''} />;
  }
  return <AdminDashboard initial={await readContent()} email={email} />;
}
