import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ASO & Pazar İstihbarat Radarı',
  description: 'Zero-LLM Local-First App Store Optimization & Market Intelligence Tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
