import { DEFAULT_THEME } from '@/lib/document/types';
import type { DesignStyle, FunctionalModule } from './types';

export const functionalModules: FunctionalModule[] = [
  {
    id: 'forms', name: { fr: 'Formulaires et prospects', en: 'Forms and leads' },
    description: { fr: 'Coordonnées, messages et demandes enregistrés dans le back-office.', en: 'Contact details, messages and requests stored in the back office.' },
    keywords: ['contact', 'lead', 'formulaire', 'message'], availability: 'implemented', componentTypes: ['contactForm'],
  },
  {
    id: 'blog', name: { fr: 'Blog et contenu', en: 'Blog and content' },
    description: { fr: 'Articles, brouillons et publications intégrés aux snapshots du site.', en: 'Articles, drafts and publications included in site snapshots.' },
    keywords: ['article', 'blog', 'magazine', 'éditorial'], availability: 'implemented', componentTypes: ['blog'],
  },
  {
    id: 'catalog', name: { fr: 'Catalogue et commandes manuelles', en: 'Catalogue and manual orders' },
    description: { fr: 'Produits, prix serveur, stock et commandes sans encaissement en ligne.', en: 'Products, server-side prices, inventory and orders without online collection.' },
    keywords: ['produit', 'boutique', 'panier', 'commande manuelle'], availability: 'implemented', componentTypes: ['products'],
  },
  {
    id: 'reservations', name: { fr: 'Demandes de réservation', en: 'Reservation requests' },
    description: { fr: 'Demandes de date et de service à confirmer manuellement, sans moteur de disponibilité.', en: 'Date and service requests confirmed manually, without an availability engine.' },
    keywords: ['réservation', 'rendez-vous', 'créneau', 'booking'], availability: 'implemented', componentTypes: ['reservation'],
  },
];

function theme(primaryColor: string, secondaryColor: string, accentColor: string, backgroundColor: string, textColor: string, mutedTextColor: string, radius: number, headingFontFamily = DEFAULT_THEME.headingFontFamily) {
  return { ...DEFAULT_THEME, primaryColor, secondaryColor, accentColor, backgroundColor, textColor, mutedTextColor, radius, headingFontFamily };
}

export const designStyles: DesignStyle[] = [
  {
    id: 'professional-clear', name: { fr: 'Professionnel et clair', en: 'Clear professional' },
    description: { fr: 'Une structure lisible, des contrastes francs et une tonalité corporate.', en: 'A readable structure, clear contrast and a corporate tone.' },
    keywords: ['entreprise', 'corporate', 'sobre'], theme: theme('#5B45D6', '#172033', '#B66A17', '#FFFDF8', '#172033', '#5B6675', 18),
  },
  {
    id: 'minimal-luxury', name: { fr: 'Luxe minimaliste', en: 'Minimal luxury' },
    description: { fr: 'Des espaces généreux, une palette discrète et une typographie éditoriale.', en: 'Generous spacing, a discreet palette and editorial typography.' },
    keywords: ['luxe', 'minimal', 'premium', 'mode'], theme: theme('#315C55', '#17332F', '#9A6A24', '#F7F6F1', '#17332F', '#5F6E68', 8),
  },
  {
    id: 'warm-artisanal', name: { fr: 'Chaleureux et artisanal', en: 'Warm and artisanal' },
    description: { fr: 'Des couleurs de terre et une ambiance accueillante pour les savoir-faire.', en: 'Earth colours and a welcoming feel for craft businesses.' },
    keywords: ['artisan', 'restaurant', 'chaleureux', 'local'], theme: theme('#8B3A3A', '#2B1B17', '#9A6A24', '#FFFAF3', '#2B1B17', '#6F625C', 16),
  },
  {
    id: 'editorial-modern', name: { fr: 'Éditorial moderne', en: 'Modern editorial' },
    description: { fr: 'Une hiérarchie de magazine pour les contenus et les analyses.', en: 'A magazine hierarchy for content and analysis.' },
    keywords: ['magazine', 'blog', 'média', 'éditorial'], theme: theme('#3E4BA8', '#191D38', '#B45032', '#FFFDF8', '#191D38', '#626879', 10),
  },
  {
    id: 'bold-creative', name: { fr: 'Créatif affirmé', en: 'Bold creative' },
    description: { fr: 'Des accents vifs et des angles souples pour les marques expressives.', en: 'Vivid accents and soft corners for expressive brands.' },
    keywords: ['créatif', 'audacieux', 'studio', 'jeune'], theme: theme('#7647C7', '#29213D', '#B23D62', '#FCF8FF', '#29213D', '#6C6378', 26),
  },
  {
    id: 'natural-organic', name: { fr: 'Naturel et organique', en: 'Natural and organic' },
    description: { fr: 'Une palette végétale et douce pour les produits et projets durables.', en: 'A soft botanical palette for products and sustainable projects.' },
    keywords: ['nature', 'bio', 'durable', 'agriculture'], theme: theme('#426B46', '#203426', '#8B6426', '#F8FAF2', '#203426', '#5D6E60', 22),
  },
];
