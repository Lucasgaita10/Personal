import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stone Gate — Investment Intelligence',
  description: 'Institutional real estate investment operating system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
