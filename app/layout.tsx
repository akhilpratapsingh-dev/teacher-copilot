import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Teacher Copilot — AI Grading Platform',
  description: 'Grade student exams, track class progress, and get AI-powered teaching insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        <Providers>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
