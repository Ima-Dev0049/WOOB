import type { Metadata, Viewport } from 'next';
import './globals.css';
import './app.css';
import './business.css';
import './ai.css';
import './admin.css';
import './catalog.css';
import './responsive.css';
import './editor-panels.css';
import './motion.css';
import './experience.css';
import { RouteMotion } from '@/components/ui/RouteMotion';

export const metadata: Metadata = {
  title: { default: 'Woob — Votre site, votre vision', template: '%s · Woob' },
  description: 'Créez, personnalisez et publiez un site professionnel avec un éditeur visuel structuré et des outils métier intégrés.',
  applicationName: 'Woob',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f6f5f1' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body><RouteMotion>{children}</RouteMotion></body></html>;
}
