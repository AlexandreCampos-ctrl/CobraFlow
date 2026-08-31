import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './marketing.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CobraFlow — Gestão inteligente de cobranças',
  description: 'Plataforma financeira para cobranças, recebimentos e recuperação de inadimplência.',
  metadataBase: new URL('https://cobraflow-gestao.sites.openai.com'),
  openGraph: {
    title: 'CobraFlow — Gestão inteligente de cobranças',
    description: 'Controle recebimentos, inadimplência e recuperação em uma única plataforma.',
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image', title: 'CobraFlow', description: 'Gestão inteligente de cobranças', images: ['/og.png'] },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

