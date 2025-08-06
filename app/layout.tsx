import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Scraper4Gel',
  description: 'Scrape product listings from Machines4U',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* THIS IS THE LINE THAT FIXES IT: 
        We are changing the dark background (bg-gray-900) to a light one (bg-gray-50).
      */}
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        {children}
      </body>
    </html>
  );
}