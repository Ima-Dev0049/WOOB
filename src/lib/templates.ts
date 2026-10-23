import { DEFAULT_THEME } from './document/types';
import type { PageNode, ThemeSettings } from './document/types';
import { makeNode } from './document/factory';

export type TemplateProduct = { name: string; description: string; priceCents: number; currency: string; inventory: number | null };
export type TemplatePost = { title: string; excerpt: string; content: string };
export type TemplatePage = { name: string; path: string; seoTitle: string; seoDescription: string; nodes: PageNode[] };
export type SiteTemplate = {
  id: string;
  name: string;
  sector: string;
  description: string;
  tags: string[];
  theme: ThemeSettings;
  modules: string[];
  pages: TemplatePage[];
  products: TemplateProduct[];
  posts: TemplatePost[];
};

const theme = (primaryColor: string, secondaryColor: string, accentColor: string, backgroundColor = '#FFFDF8'): ThemeSettings => ({
  ...DEFAULT_THEME, primaryColor, secondaryColor, accentColor, backgroundColor,
});

const header = (logoText: string) => makeNode('header', { logoText, ctaHref: '/contact' });
const footer = (text: string) => makeNode('footer', { text, links: [{ label: 'Accueil', href: '/' }, { label: 'Contact', href: '/contact' }] });
const contactPage = (title = 'Contact'): TemplatePage => ({
  name: 'Contact', path: '/contact', seoTitle: title, seoDescription: 'Contactez notre équipe.',
  nodes: [makeNode('heading', { text: title, level: 1 }), makeNode('contact'), makeNode('contactForm'), footer('Merci de votre visite')],
});

export const siteTemplates: SiteTemplate[] = [
  {
    id: 'studio-business', name: 'Studio & entreprise', sector: 'Entreprise', description: 'Une présence premium pour présenter vos services, votre équipe et vos preuves.', tags: ['services', 'b2b', 'premium'],
    theme: theme('#5B45D6', '#172033', '#E9A23B'), modules: ['forms', 'blog'], products: [],
    posts: [{ title: 'Construire une marque claire', excerpt: 'Les fondations d’un message utile.', content: 'Une marque claire commence par une promesse simple, des preuves concrètes et une expérience cohérente.' }],
    pages: [
      { name: 'Accueil', path: '/', seoTitle: 'Studio — Des idées aux résultats', seoDescription: 'Conseil, design et réalisation pour les équipes ambitieuses.', nodes: [header('Studio'), makeNode('hero', { eyebrow: 'Stratégie · Design · Impact', title: 'Donnez à votre entreprise une présence inoubliable.', description: 'Nous transformons vos idées en expériences claires, utiles et mesurables.', primaryLabel: 'Parler de votre projet', primaryHref: '/contact' }), makeNode('features', { title: 'Notre savoir-faire' }), makeNode('stats'), makeNode('testimonials'), makeNode('team'), makeNode('blog'), makeNode('cta'), footer('Studio') ] },
      { name: 'Services', path: '/services', seoTitle: 'Nos services', seoDescription: 'Un accompagnement de la stratégie au lancement.', nodes: [header('Studio'), makeNode('heading', { text: 'Des services conçus pour avancer', level: 1 }), makeNode('features'), makeNode('pricing'), makeNode('faq'), footer('Studio')] },
      contactPage(),
    ],
  },
  {
    id: 'restaurant-safran', name: 'Restaurant Safran', sector: 'Restaurant', description: 'Menu, ambiance, réservations et coordonnées pour une table contemporaine.', tags: ['restaurant', 'réservation', 'menu'],
    theme: theme('#8B3A3A', '#2B1B17', '#D4A24C', '#FFFAF3'), modules: ['forms', 'reservations'], products: [], posts: [],
    pages: [
      { name: 'Accueil', path: '/', seoTitle: 'Maison Safran — Cuisine de saison', seoDescription: 'Une cuisine vivante, des produits de saison et une table chaleureuse.', nodes: [header('Maison Safran'), makeNode('hero', { eyebrow: 'Cuisine de saison', title: 'Le goût du moment, simplement.', description: 'Des produits choisis, une cuisine ouverte et des assiettes qui racontent la saison.', primaryLabel: 'Réserver une table', primaryHref: '/reservation', secondaryLabel: 'Voir le menu', secondaryHref: '/menu' }), makeNode('gallery', { title: 'La maison en images' }), makeNode('testimonials', { title: 'À table avec vous' }), makeNode('contact'), footer('Maison Safran') ] },
      { name: 'Menu', path: '/menu', seoTitle: 'Le menu', seoDescription: 'Découvrez notre carte de saison.', nodes: [header('Maison Safran'), makeNode('heading', { text: 'Le menu de saison', level: 1 }), makeNode('features', { title: 'À partager', items: [{ title: 'Entrées', description: 'Légumes rôtis, condiment aux herbes — 12 €', icon: 'leaf' }, { title: 'Plats', description: 'Poisson du jour, beurre safrané — 26 €', icon: 'utensils' }, { title: 'Desserts', description: 'Fruits de saison et crème légère — 9 €', icon: 'sparkles' }] }), makeNode('cta', { title: 'Une table vous attend', buttonLabel: 'Réserver', buttonHref: '/reservation' }), footer('Maison Safran')] },
      { name: 'Réservation', path: '/reservation', seoTitle: 'Réserver une table', seoDescription: 'Demandez votre table à la Maison Safran.', nodes: [header('Maison Safran'), makeNode('reservation', { serviceName: 'Table au restaurant' }), makeNode('contact'), footer('Maison Safran')] },
      contactPage(),
    ],
  },
  {
    id: 'portfolio-atelier', name: 'Portfolio Atelier', sector: 'Portfolio', description: 'Un portfolio éditorial pour exposer vos projets et votre démarche.', tags: ['designer', 'photographe', 'créateur'],
    theme: theme('#1D5C55', '#17332F', '#E7B65B', '#F7F6F1'), modules: ['forms', 'blog'], products: [],
    posts: [{ title: 'Notes sur le processus créatif', excerpt: 'Regarder, tester, simplifier.', content: 'Le processus créatif avance par itérations. Chaque essai apporte une information utile pour la suite.' }],
    pages: [
      { name: 'Accueil', path: '/', seoTitle: 'Atelier — Design & images', seoDescription: 'Portfolio de projets visuels et de réflexions sur le design.', nodes: [header('Atelier'), makeNode('hero', { eyebrow: 'Designer indépendant', title: 'Des formes justes pour des idées singulières.', description: 'Identités, images et expériences numériques.', primaryLabel: 'Voir les projets', primaryHref: '/projets' }), makeNode('gallery'), makeNode('blog'), makeNode('cta'), footer('Atelier') ] },
      { name: 'Projets', path: '/projets', seoTitle: 'Projets sélectionnés', seoDescription: 'Une sélection de travaux récents.', nodes: [header('Atelier'), makeNode('heading', { text: 'Projets sélectionnés', level: 1 }), makeNode('gallery'), makeNode('features', { title: 'La démarche' }), footer('Atelier')] },
      contactPage(),
    ],
  },
  {
    id: 'academy-horizon', name: 'Académie Horizon', sector: 'Formation', description: 'Présentez vos formations, votre équipe et collectez les demandes d’inscription.', tags: ['école', 'cours', 'formation'],
    theme: theme('#2864B4', '#142B49', '#E6A33C'), modules: ['forms', 'blog'], products: [],
    posts: [{ title: 'Bien préparer sa formation', excerpt: 'Les réflexes pour progresser.', content: 'Définissez votre objectif, organisez un temps régulier et pratiquez sur des projets concrets.' }],
    pages: [
      { name: 'Accueil', path: '/', seoTitle: 'Académie Horizon', seoDescription: 'Des formations concrètes pour développer vos compétences.', nodes: [header('Horizon'), makeNode('hero', { eyebrow: 'Apprendre par la pratique', title: 'Votre prochaine compétence commence ici.', description: 'Des parcours guidés par des professionnels et adaptés à vos objectifs.', primaryLabel: 'Voir les formations', primaryHref: '/formations' }), makeNode('stats'), makeNode('features'), makeNode('testimonials'), makeNode('faq'), footer('Académie Horizon') ] },
      { name: 'Formations', path: '/formations', seoTitle: 'Nos formations', seoDescription: 'Explorez les parcours de l’Académie Horizon.', nodes: [header('Horizon'), makeNode('heading', { text: 'Nos formations', level: 1 }), makeNode('features', { title: 'Choisissez votre parcours', items: [{ title: 'Design numérique', description: 'Fondamentaux, outils et projet final.', icon: 'palette' }, { title: 'Développement web', description: 'Bases solides et applications guidées.', icon: 'code' }, { title: 'Communication', description: 'Stratégie, contenu et mesure.', icon: 'message' }] }), makeNode('pricing'), makeNode('contactForm', { title: 'Demander le programme' }), footer('Académie Horizon')] },
      contactPage(),
    ],
  },
  {
    id: 'market-epices', name: 'Boutique Épices', sector: 'Boutique', description: 'Catalogue, panier local et commandes manuelles sans paiement en ligne.', tags: ['ecommerce', 'produits', 'commande'],
    theme: theme('#9A4D2E', '#3B241A', '#E2B24A', '#FFF9F0'), modules: ['forms', 'catalog'], products: [
      { name: 'Mélange du marché', description: 'Un mélange aromatique pour les plats du quotidien.', priceCents: 890, currency: 'EUR', inventory: 40 },
      { name: 'Poivre des hauteurs', description: 'Des notes intenses et florales.', priceCents: 1290, currency: 'EUR', inventory: 25 },
      { name: 'Coffret découverte', description: 'Trois mélanges à offrir ou à savourer.', priceCents: 2490, currency: 'EUR', inventory: 12 },
    ], posts: [],
    pages: [
      { name: 'Accueil', path: '/', seoTitle: 'Épices du Monde', seoDescription: 'Des épices choisies et des mélanges préparés en petite série.', nodes: [header('Épices du Monde'), makeNode('hero', { eyebrow: 'Petites séries · Grands parfums', title: 'Le voyage commence dans votre cuisine.', description: 'Des mélanges aromatiques sourcés avec attention.', primaryLabel: 'Découvrir la boutique', primaryHref: '/boutique' }), makeNode('features'), makeNode('testimonials'), footer('Épices du Monde') ] },
      { name: 'Boutique', path: '/boutique', seoTitle: 'La boutique', seoDescription: 'Commandez nos mélanges et coffrets.', nodes: [header('Épices du Monde'), makeNode('products'), makeNode('faq', { title: 'Commande et livraison', items: [{ question: 'Le paiement est-il en ligne ?', answer: 'Non. La commande est enregistrée sans paiement en ligne et notre équipe vous contacte pour confirmer les modalités.' }] }), footer('Épices du Monde')] },
      contactPage(),
    ],
  },
  {
    id: 'journal-signal', name: 'Magazine Signal', sector: 'Blog', description: 'Une base éditoriale pour publier des analyses et construire une audience.', tags: ['blog', 'magazine', 'actualités'],
    theme: theme('#3E4BA8', '#191D38', '#EB8B5C'), modules: ['forms', 'blog'], products: [],
    posts: [
      { title: 'Les signaux faibles du numérique', excerpt: 'Observer avant de conclure.', content: 'Les tendances utiles apparaissent souvent dans les usages avant les discours. Apprenons à les observer avec méthode.' },
      { title: 'Pourquoi la clarté est une stratégie', excerpt: 'Mieux lire, mieux décider.', content: 'Une information claire réduit le coût de décision et permet à chacun de se concentrer sur l’essentiel.' },
    ],
    pages: [
      { name: 'Accueil', path: '/', seoTitle: 'Signal — Regarder autrement', seoDescription: 'Analyses et récits pour comprendre le numérique.', nodes: [header('Signal'), makeNode('hero', { eyebrow: 'Le magazine des idées claires', title: 'Comprendre ce qui transforme notre quotidien.', description: 'Des analyses accessibles, sans bruit inutile.', primaryLabel: 'Lire le journal', primaryHref: '/journal' }), makeNode('blog'), makeNode('cta', { title: 'Recevoir la prochaine édition', buttonLabel: 'Nous écrire', buttonHref: '/contact' }), footer('Signal') ] },
      { name: 'Journal', path: '/journal', seoTitle: 'Le journal', seoDescription: 'Tous les articles de Signal.', nodes: [header('Signal'), makeNode('blog', { title: 'Tous les articles', limit: 12 }), footer('Signal')] },
      contactPage(),
    ],
  },
];

export function getTemplate(id: string): SiteTemplate | undefined {
  return siteTemplates.find((template) => template.id === id);
}
