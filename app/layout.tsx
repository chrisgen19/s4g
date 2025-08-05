// app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // The critical import

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Machines4U Scraper',
  description: 'Scrape product listings from Machines4U',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-900 text-gray-200`}>
        {children}
      </body>
    </html>
  );
}