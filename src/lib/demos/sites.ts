import { buildProjectDraft, withCreativeConcept, type GeneratedProjectDraft } from '@/lib/catalog/generation';
import type { CreationSelection, ProjectContent } from '@/lib/catalog/types';
import { assertValidPageDocument } from '@/lib/document/validation';
import { makeNode } from '@/lib/document/factory';
import type { ComponentType, PageNode, SiteSnapshot } from '@/lib/document/types';
import { isDemoSlug, type DemoSlug } from './showcases';

type DemoDefinition = {
  slug: DemoSlug;
  selection: CreationSelection;
  content: ProjectContent;
  conceptId: string;
  customize: (draft: GeneratedProjectDraft) => void;
};

function nodeAt(draft: GeneratedProjectDraft, path: string, type: ComponentType): { node: PageNode; siblings: PageNode[]; index: number } {
  const page = draft.pages.find((candidate) => candidate.path === path);
  const siblings = page?.document.root.children;
  const index = siblings?.findIndex((node) => node.type === type) ?? -1;
  const node = index >= 0 ? siblings?.[index] : undefined;
  if (!siblings || !node) throw new Error(`Bloc de démonstration introuvable : ${path} · ${type}`);
  return { node, siblings, index };
}

function update(draft: GeneratedProjectDraft, path: string, type: ComponentType, props: Record<string, unknown>): void {
  Object.assign(nodeAt(draft, path, type).node.props, props);
}

function replace(draft: GeneratedProjectDraft, path: string, type: ComponentType, replacementType: Exclude<ComponentType, 'page'>, props: Record<string, unknown>): void {
  const { node, siblings, index } = nodeAt(draft, path, type);
  const replacement = makeNode(replacementType, props);
  siblings[index] = { ...node, type: replacementType, props: replacement.props };
}

function updateAll(draft: GeneratedProjectDraft, type: ComponentType, props: Record<string, unknown>): void {
  for (const page of draft.pages) {
    for (const node of page.document.root.children ?? []) {
      if (node.type === type) Object.assign(node.props, props);
    }
  }
}

const kingFoodImages = [
  { src: '/images/demos/king-food-hero.jpg', alt: 'Poisson grillé, riz parfumé et légumes dans une assiette sombre — visuel généré pour la démonstration.' },
  { src: '/images/demos/king-food-table.jpg', alt: 'Grande table de plats et d’assiettes à partager — visuel généré pour la démonstration.' },
] as const;
const portfolioImages = [
  { src: '/images/demos/portfolio-hero.jpg', alt: 'Architecture sculpturale en béton avec un pan de verre bleu — étude visuelle générée.' },
  { src: '/images/demos/portfolio-project.jpg', alt: 'Volumes bleus, rouges et métalliques sur une table d’atelier — étude visuelle générée.' },
] as const;

const definitions: DemoDefinition[] = [
  {
    slug: 'king-food',
    conceptId: 'editorial-ritual',
    selection: {
      name: 'King Food',
      brief: 'Un restaurant chaleureux et généreux, présenté dans une direction éditoriale haut de gamme. Mettre en scène les plats, le partage et le menu sans inventer de preuves clients ni de coordonnées.',
      siteTypeId: 'restaurant-classic',
      activityDomainId: 'food-agriculture',
      designStyleId: 'warm-artisanal',
      moduleIds: ['reservations'],
      locale: 'fr',
    },
    content: {
      heroEyebrow: 'Cuisine généreuse · Moments de partage',
      heroTitle: 'King Food',
      heroDescription: 'Une identité de restaurant pensée autour d’assiettes généreuses, de belles matières et du plaisir de se retrouver.',
      seoDescription: 'King Food — une démonstration Woob de site de restaurant, avec menu, galerie et parcours de réservation non actif.',
    },
    customize(draft) {
      updateAll(draft, 'header', { ctaLabel: 'Réserver une table', ctaHref: '/reservation' });
      updateAll(draft, 'footer', { copyright: 'Démonstration Woob — aucune donnée transmise.' });
      update(draft, '/', 'hero', {
        primaryLabel: 'Découvrir le menu', primaryHref: '/menu',
        secondaryLabel: 'Voir la réservation démo', secondaryHref: '/reservation',
        imageUrl: kingFoodImages[0].src, imageAlt: kingFoodImages[0].alt,
        layout: 'editorial', visualTreatment: 'framed',
      });
      update(draft, '/', 'gallery', { title: 'Une table à partager', images: kingFoodImages, layout: 'editorial' });
      replace(draft, '/', 'testimonials', 'features', {
        title: 'Le récit d’un repas', layout: 'editorial',
        items: [
          { icon: '01', title: 'Le feu', description: 'Des saveurs grillées et des textures franches, mises en valeur par une photographie immersive.' },
          { icon: '02', title: 'Le partage', description: 'Une composition éditoriale qui donne une vraie place aux plats et aux moments de table.' },
          { icon: '03', title: 'Le rendez-vous', description: 'Un menu lisible et un parcours de réservation présenté sans collecter de données.' },
        ],
      });
      replace(draft, '/', 'contact', 'cta', {
        title: 'Le prochain repas commence ici.',
        description: 'Parcourez la carte ou découvrez le parcours de réservation de cette démonstration.',
        buttonLabel: 'Voir le menu', buttonHref: '/menu',
      });
      update(draft, '/menu', 'heading', { text: 'Une carte pensée pour donner faim', level: 1 });
      update(draft, '/menu', 'features', {
        title: 'Quelques assiettes de démonstration', layout: 'editorial',
        items: [
          { icon: '01', title: 'Poisson grillé', description: 'Riz parfumé, légumes rôtis et herbes fraîches.' },
          { icon: '02', title: 'Assiettes à partager', description: 'Plantains, légumes et condiments réunis au centre de la table.' },
          { icon: '03', title: 'Le goût du marché', description: 'Une structure de carte à adapter aux produits et aux saisons du restaurant.' },
        ],
      });
      update(draft, '/menu', 'cta', {
        title: 'Envie de voir la suite ?',
        description: 'Le parcours suivant illustre une demande de réservation, sans l’enregistrer.',
        buttonLabel: 'Découvrir la réservation', buttonHref: '/reservation',
      });
      update(draft, '/reservation', 'heading', { text: 'Votre table chez King Food', level: 1 });
      update(draft, '/reservation', 'reservation', {
        serviceName: 'Table au restaurant — démonstration',
        title: 'Demander une table',
        description: 'Parcours de démonstration — aucune demande ni donnée personnelle ne sera envoyée.',
        submitLabel: 'Bouton inactif en démonstration',
      });
      replace(draft, '/reservation', 'contact', 'faq', {
        title: 'Avant de réserver',
        items: [{ question: 'Cette réservation est-elle réelle ?', answer: 'Non. Cette page illustre le parcours Woob ; aucune donnée n’est collectée et aucune table n’est réservée.' }],
      });
      update(draft, '/contact', 'heading', { text: 'Les coordonnées du restaurant', level: 1 });
      replace(draft, '/contact', 'contact', 'text', {
        text: 'Cette démonstration ne publie ni adresse, ni téléphone, ni adresse e-mail. Dans un projet réel, ces informations sont renseignées et validées par le propriétaire du site avant publication.',
      });
    },
  },
  {
    slug: 'atelier-ligne',
    conceptId: 'monumental-signal',
    selection: {
      name: 'Atelier Ligne',
      brief: 'Un portfolio de direction artistique premium, architectural et éditorial. Présenter des études visuelles générées pour la démonstration, jamais des projets clients ou des références inventées.',
      siteTypeId: 'portfolio-designer',
      activityDomainId: 'art-crafts',
      designStyleId: 'minimal-luxury',
      moduleIds: ['forms'],
      locale: 'fr',
    },
    content: {
      heroEyebrow: 'Portfolio · Direction artistique',
      heroTitle: 'Atelier Ligne',
      heroDescription: 'Un portfolio éditorial pour faire dialoguer architecture, matières et expérimentations visuelles.',
      seoDescription: 'Atelier Ligne — une démonstration Woob de portfolio éditorial, avec études visuelles et formulaire de contact non actif.',
    },
    customize(draft) {
      updateAll(draft, 'header', { ctaLabel: 'Prendre contact', ctaHref: '/contact' });
      updateAll(draft, 'footer', { copyright: 'Démonstration Woob — études visuelles générées.' });
      update(draft, '/', 'hero', {
        primaryLabel: 'Voir les études', primaryHref: '/projets',
        secondaryLabel: 'Découvrir la démarche', secondaryHref: '/a-propos',
        imageUrl: portfolioImages[0].src, imageAlt: portfolioImages[0].alt,
        layout: 'monumental', visualTreatment: 'plain',
      });
      update(draft, '/', 'gallery', { title: 'Deux études, deux matières', images: portfolioImages, layout: 'editorial' });
      update(draft, '/', 'cta', {
        title: 'Donner de l’espace aux idées.',
        description: 'Un concept de portfolio conçu avec les blocs structurés et la direction créative de Woob.',
        buttonLabel: 'Explorer les études', buttonHref: '/projets',
      });
      update(draft, '/projets', 'heading', { text: 'Études visuelles', level: 1 });
      update(draft, '/projets', 'gallery', { title: 'Architecture & volumes', images: portfolioImages, layout: 'editorial' });
      update(draft, '/projets', 'features', {
        title: 'Lire les études', layout: 'minimal',
        items: [
          { icon: '01', title: 'Habiter le béton', description: 'Un cadrage architectural qui oppose la masse, la lumière et un accent de bleu.' },
          { icon: '02', title: 'Couleurs en volume', description: 'Une nature morte d’atelier construite autour des matières et des formes.' },
          { icon: 'i', title: 'Note de démonstration', description: 'Ces visuels ont été générés pour ce portfolio ; ils ne présentent ni commande cliente ni réalisation revendiquée.' },
        ],
      });
      update(draft, '/a-propos', 'heading', { text: 'Une démarche avant une biographie', level: 1 });
      update(draft, '/a-propos', 'text', {
        text: 'Atelier Ligne est un concept de démonstration, pas le profil d’une personne ou d’un studio réel. Cette page montre comment un portfolio peut articuler une intention, des projets et une identité sans fabriquer de parcours professionnel.',
      });
      replace(draft, '/a-propos', 'team', 'features', {
        title: 'Ce que le portfolio met en scène', layout: 'cards',
        items: [
          { icon: '01', title: 'Une identité', description: 'Un nom, une typographie et une palette cohérente sur toutes les pages.' },
          { icon: '02', title: 'Un rythme éditorial', description: 'Des titres amples, des respirations et des images qui portent le récit.' },
          { icon: '03', title: 'Des projets contextualisés', description: 'Une page dédiée pour expliquer les études et distinguer clairement leur statut de démonstration.' },
        ],
      });
      update(draft, '/contact', 'heading', { text: 'Parler d’un projet', level: 1 });
      update(draft, '/contact', 'contactForm', {
        title: 'Premier échange',
        description: 'Formulaire de démonstration — aucune donnée n’est envoyée ni enregistrée.',
        submitLabel: 'Bouton inactif en démonstration',
      });
      replace(draft, '/contact', 'contact', 'faq', {
        title: 'À propos de ce formulaire',
        items: [{ question: 'Puis-je contacter Atelier Ligne ?', answer: 'Non. Atelier Ligne est un concept de démonstration. Le formulaire illustre uniquement le composant Woob et reste inactif.' }],
      });
    },
  },
  {
    slug: 'studio-cap',
    conceptId: 'clear-conversation',
    selection: {
      name: 'Studio Cap',
      brief: 'Un site de formation lumineux, rassurant et structuré. Montrer un programme en étapes, une galerie et une demande de contact sans faux chiffres, témoignages, certification ou promesse de résultat.',
      siteTypeId: 'education-training-center',
      activityDomainId: 'education',
      designStyleId: 'natural-organic',
      moduleIds: ['forms'],
      locale: 'fr',
    },
    content: {
      heroEyebrow: 'Formation · Apprentissage guidé',
      heroTitle: 'Studio Cap',
      heroDescription: 'Une expérience de formation lumineuse pour présenter un programme, rythmer les étapes et donner envie d’apprendre.',
      seoDescription: 'Studio Cap — une démonstration Woob de site de formation, avec programme pédagogique et formulaire de contact non actif.',
    },
    customize(draft) {
      updateAll(draft, 'header', { ctaLabel: 'Voir le programme', ctaHref: '/formations' });
      updateAll(draft, 'footer', { copyright: 'Démonstration Woob — aucune inscription ouverte.' });
      update(draft, '/', 'hero', {
        primaryLabel: 'Explorer le programme', primaryHref: '/formations',
        secondaryLabel: '', secondaryHref: '',
        imageUrl: '/images/demos/formation-hero.jpg',
        imageAlt: 'Groupe réuni autour d’une table avec une formatrice — visuel généré pour la démonstration.',
        layout: 'product-stage', visualTreatment: 'product',
      });
      replace(draft, '/', 'stats', 'gallery', {
        title: 'Un espace pour apprendre et pratiquer', layout: 'grid',
        images: [{ src: '/images/demos/formation-studio.jpg', alt: 'Croquis d’interfaces, nuanciers et ordinateur sur un bureau — visuel généré pour la démonstration.' }],
      });
      update(draft, '/', 'features', {
        title: 'Un parcours en trois temps', layout: 'cards',
        items: [
          { icon: '01', title: 'Comprendre', description: 'Poser les objectifs et découvrir les notions essentielles dans une structure lisible.' },
          { icon: '02', title: 'Pratiquer', description: 'Donner une place centrale aux exercices et aux ateliers dans le récit pédagogique.' },
          { icon: '03', title: 'Consolider', description: 'Présenter une dernière étape pour revenir sur les acquis, sans promettre de résultat inventé.' },
        ],
      });
      replace(draft, '/', 'testimonials', 'cta', {
        title: 'Un programme facile à parcourir.',
        description: 'Des sections structurées, une hiérarchie claire et un contact présenté sans collecter de données.',
        buttonLabel: 'Voir le programme', buttonHref: '/formations',
      });
      update(draft, '/', 'faq', {
        title: 'À propos de cette démonstration',
        items: [
          { question: 'Que présente ce site ?', answer: 'Une direction visuelle et une structure de pages conçues avec Woob pour illustrer un site de formation.' },
          { question: 'Peut-on s’inscrire ou obtenir une certification ?', answer: 'Non. Aucune inscription n’est ouverte et aucune certification n’est associée à cette démonstration.' },
        ],
      });
      update(draft, '/formations', 'heading', { text: 'Un programme, trois étapes', level: 1 });
      update(draft, '/formations', 'features', {
        title: 'Exemple de structure pédagogique', layout: 'editorial',
        items: [
          { icon: '01', title: 'Fondamentaux', description: 'Objectifs, vocabulaire et premiers repères pour commencer.' },
          { icon: '02', title: 'Atelier guidé', description: 'Un temps dédié à la pratique et à l’expérimentation.' },
          { icon: '03', title: 'Projet personnel', description: 'Une dernière séquence pour organiser et présenter son travail.' },
        ],
      });
      replace(draft, '/formations', 'pricing', 'text', {
        text: 'Ce programme est un exemple de structure, sans tarif ni session annoncée. Un vrai projet peut préciser ici les durées, prérequis, modalités et prix validés par l’organisme de formation.',
      });
      update(draft, '/formations', 'contactForm', {
        title: 'Demander le programme',
        description: 'Formulaire de démonstration — aucune demande n’est envoyée ni enregistrée.',
        submitLabel: 'Bouton inactif en démonstration',
      });
      update(draft, '/contact', 'heading', { text: 'Une question sur le parcours ?', level: 1 });
      update(draft, '/contact', 'contactForm', {
        title: 'Écrire à Studio Cap',
        description: 'Formulaire de démonstration — aucune donnée n’est envoyée ni enregistrée.',
        submitLabel: 'Bouton inactif en démonstration',
      });
      replace(draft, '/contact', 'contact', 'faq', {
        title: 'À propos de ce formulaire',
        items: [{ question: 'Ma demande sera-t-elle transmise ?', answer: 'Non. Studio Cap est un concept de démonstration. Ce formulaire reste inactif et ne collecte aucune donnée.' }],
      });
    },
  },
];

function createDemo(definition: DemoDefinition): SiteSnapshot {
  const initial = buildProjectDraft(definition.selection, definition.content);
  const draft = withCreativeConcept(initial, definition.conceptId);
  definition.customize(draft);
  for (const page of draft.pages) assertValidPageDocument(page.document);
  const home = draft.pages.find((page) => page.path === '/');
  if (!home) throw new Error(`Page d’accueil absente de la démonstration ${definition.slug}.`);
  return {
    projectId: `demo-${definition.slug}`,
    publicationId: `static-${definition.slug}`,
    publishedAt: new Date().toISOString(),
    name: draft.selection.name,
    description: definition.content.seoDescription,
    slug: definition.slug,
    defaultLocale: 'fr',
    theme: home.document.theme,
    creativeBrief: draft.brief,
    pages: draft.pages,
    navigation: draft.pages.map((page) => ({ label: page.name, path: page.path })),
    modules: [...draft.resolved.selectedModuleIds],
    products: [],
    posts: [],
  };
}

const cache = new Map<DemoSlug, SiteSnapshot>();

export function getDemoSite(slug: string): SiteSnapshot | undefined {
  if (!isDemoSlug(slug)) return undefined;
  const cached = cache.get(slug);
  if (cached) return cached;
  const definition = definitions.find((candidate) => candidate.slug === slug);
  if (!definition) return undefined;
  const site = createDemo(definition);
  cache.set(slug, site);
  return site;
}
