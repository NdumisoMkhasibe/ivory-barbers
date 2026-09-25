import type { Metadata } from 'next';
import '@fontsource/barlow-condensed/400.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'IVORY Barbers | A Cut of Distinction.',
  description: 'Thoughtful cuts. Everyday confidence. Discover IVORY Barbers in Observatory, explore the menu and try our working booking and AI Preview.',
  icons: { icon: '/images/IVORY_Barbers_Logo.png' },
  openGraph: { title: 'IVORY Barbers — A Cut of Distinction.', description: 'Your style. Our craft. An Observatory barber shop concept.', images: ['/images/IVORY_Barbers_Logo.png'] }
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en-ZA"><body>{children}</body></html>;
}
