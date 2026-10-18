import '@perchados/ui-tokens/tokens.css';
import '@perchados/ui-web/focus.css';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { getServerEnv } from '@/shared/config/server-env';
import { ApiConfigProvider } from '@/shared/api/api-config-provider';

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: '500',
  display: 'swap',
  variable: '--font-ibm-plex-mono',
});

export const metadata: Metadata = {
  title: { default: 'Perchados', template: '%s · Perchados' },
  description: 'Panel de administración de Perchados',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // API_PUBLIC_URL se lee en ejecución (no en el build) y solo ese valor llega al cliente
  await connection();
  const { apiPublicUrl } = getServerEnv();
  return (
    <html lang="es" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body>
        <ApiConfigProvider apiPublicUrl={apiPublicUrl}>{children}</ApiConfigProvider>
      </body>
    </html>
  );
}
