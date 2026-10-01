import type { Metadata, Viewport } from 'next';
import { Bangers, Manrope } from 'next/font/google';
import './globals.css';

const comic = Bangers({ weight: '400', subsets: ['latin'], variable: '--font-comic', display: 'swap' });
const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Rohit Parashar',
  description: 'Portfolio of Rohit Parashar: product analytics, dashboards and projects.',
};

export const viewport: Viewport = {
  themeColor: '#0a0d14',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${comic.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
