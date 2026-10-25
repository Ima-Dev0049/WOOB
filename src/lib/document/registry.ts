import { z } from 'zod';
import type { ComponentType } from './types';

const href = z.string().max(2048);
const text = z.string().max(20_000);
const short = z.string().max(300);
const asset = z.string().max(160).optional().or(z.literal(''));
const item = <T extends z.ZodRawShape>(shape: T) => z.object(shape);
const list = <T extends z.ZodType>(schema: T) => z.array(schema).max(100);

export type FieldDefinition = {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'url' | 'number' | 'select' | 'boolean' | 'asset';
  options?: { value: string; label: string }[];
};

export type ComponentDefinition = {
  type: Exclude<ComponentType, 'page'>;
  label: string;
  category: 'Structure' | 'Contenu' | 'Conversion' | 'Preuve' | 'Commerce' | 'Éditorial';
  description: string;
  propsSchema: z.ZodType<Record<string, unknown>>;
  defaults: Record<string, unknown>;
  fields: FieldDefinition[];
  collectionFields?: Record<string, FieldDefinition[]>;
  keywords: string[];
};

const base = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const scene3dPropsSchema = base({ title: short, description: text, preset: z.enum(['orbital', 'prism']), quality: z.enum(['low', 'balanced']), autoRotate: z.boolean(), interactive: z.boolean(), fallbackSrc: z.string().max(2048).optional().or(z.literal('')), fallbackAssetId: asset, fallbackAlt: short });

export const componentRegistry: Record<Exclude<ComponentType, 'page'>, ComponentDefinition> = {
  section: {
    type: 'section', label: 'Section', category: 'Structure', description: 'Conteneur de contenu réutilisable.',
    propsSchema: base({ title: short.default(''), description: text.default('') }),
    defaults: { title: 'Nouvelle section', description: 'Ajoutez une description ou insérez des composants.' },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'description', label: 'Description', kind: 'textarea' }], keywords: ['conteneur', 'bloc'],
  },
  header: {
    type: 'header', label: 'En-tête', category: 'Structure', description: 'Identité, navigation et action principale.',
    propsSchema: base({ logoText: short, showNavigation: z.boolean(), ctaLabel: short, ctaHref: href }),
    defaults: { logoText: 'Woob', showNavigation: true, ctaLabel: 'Nous contacter', ctaHref: '/contact' },
    fields: [{ key: 'logoText', label: 'Nom du site', kind: 'text' }, { key: 'showNavigation', label: 'Afficher la navigation', kind: 'boolean' }, { key: 'ctaLabel', label: 'Texte du bouton', kind: 'text' }, { key: 'ctaHref', label: 'Lien du bouton', kind: 'url' }], keywords: ['menu', 'navigation'],
  },
  hero: {
    type: 'hero', label: 'Hero', category: 'Conversion', description: 'Ouverture éditoriale avec actions et visuel.',
    propsSchema: base({ eyebrow: short, title: short, description: text, primaryLabel: short, primaryHref: href, secondaryLabel: short, secondaryHref: href, imageAssetId: asset, imageUrl: z.string().max(2048).optional().or(z.literal('')), imageAlt: short, layout: z.enum(['split', 'editorial', 'immersive', 'monumental', 'product-stage', 'operations']).optional(), visualTreatment: z.enum(['plain', 'organic', 'framed', 'orbital', 'duotone', 'product', 'ledger']).optional() }),
    defaults: { eyebrow: 'Votre histoire commence ici', title: 'Une idée. Un site remarquable.', description: 'Présentez clairement votre valeur et guidez vos visiteurs vers la prochaine étape.', primaryLabel: 'Découvrir', primaryHref: '#contact', secondaryLabel: 'En savoir plus', secondaryHref: '#contenu', imageAssetId: '', imageUrl: '', imageAlt: '' },
    fields: [{ key: 'eyebrow', label: 'Surtitre', kind: 'text' }, { key: 'title', label: 'Titre principal', kind: 'textarea' }, { key: 'description', label: 'Description', kind: 'textarea' }, { key: 'primaryLabel', label: 'Bouton principal', kind: 'text' }, { key: 'primaryHref', label: 'Lien principal', kind: 'url' }, { key: 'secondaryLabel', label: 'Bouton secondaire', kind: 'text' }, { key: 'secondaryHref', label: 'Lien secondaire', kind: 'url' }, { key: 'imageAssetId', label: 'Image', kind: 'asset' }, { key: 'imageAlt', label: 'Texte alternatif', kind: 'text' }, { key: 'layout', label: 'Composition créative', kind: 'select', options: [{ value: 'split', label: 'Fractionnée' }, { value: 'editorial', label: 'Éditoriale asymétrique' }, { value: 'immersive', label: 'Immersive' }, { value: 'monumental', label: 'Monumentale' }, { value: 'product-stage', label: 'Scène produit' }, { value: 'operations', label: 'Opérations' }] }, { key: 'visualTreatment', label: 'Traitement du visuel', kind: 'select', options: [{ value: 'plain', label: 'Simple' }, { value: 'organic', label: 'Organique' }, { value: 'framed', label: 'Encadré' }, { value: 'orbital', label: 'Orbital' }, { value: 'duotone', label: 'Duotone' }, { value: 'product', label: 'Produit' }, { value: 'ledger', label: 'Panneau de pilotage' }] }], keywords: ['bannière', 'accueil'],
  },
  heading: {
    type: 'heading', label: 'Titre', category: 'Contenu', description: 'Titre hiérarchique accessible.',
    propsSchema: base({ text: short, level: z.number().int().min(1).max(4) }),
    defaults: { text: 'Un titre clair et mémorable', level: 2 },
    fields: [{ key: 'text', label: 'Texte du titre', kind: 'textarea' }, { key: 'level', label: 'Niveau', kind: 'select', options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `H${n}` })) }], keywords: ['heading', 'h1'],
  },
  text: {
    type: 'text', label: 'Texte', category: 'Contenu', description: 'Paragraphe de contenu.',
    propsSchema: base({ text, muted: z.boolean() }),
    defaults: { text: 'Racontez votre histoire avec un texte simple, utile et engageant.', muted: false },
    fields: [{ key: 'text', label: 'Contenu', kind: 'textarea' }, { key: 'muted', label: 'Style secondaire', kind: 'boolean' }], keywords: ['paragraphe'],
  },
  image: {
    type: 'image', label: 'Image', category: 'Contenu', description: 'Image responsive avec alternative.',
    propsSchema: base({ assetId: asset, src: z.string().max(2048).optional().or(z.literal('')), alt: short, caption: short }),
    defaults: { assetId: '', src: '', alt: '', caption: '' },
    fields: [{ key: 'assetId', label: 'Média', kind: 'asset' }, { key: 'alt', label: 'Texte alternatif', kind: 'text' }, { key: 'caption', label: 'Légende', kind: 'text' }], keywords: ['photo', 'média'],
  },
  button: {
    type: 'button', label: 'Bouton', category: 'Conversion', description: 'Lien ou appel à l’action.',
    propsSchema: base({ label: short, href, variant: z.enum(['primary', 'secondary', 'ghost']) }),
    defaults: { label: 'Commencer', href: '#contact', variant: 'primary' },
    fields: [{ key: 'label', label: 'Libellé', kind: 'text' }, { key: 'href', label: 'Lien', kind: 'url' }, { key: 'variant', label: 'Variante', kind: 'select', options: ['primary', 'secondary', 'ghost'].map((v) => ({ value: v, label: v })) }], keywords: ['cta', 'lien'],
  },
  features: {
    type: 'features', label: 'Fonctionnalités', category: 'Contenu', description: 'Grille de bénéfices ou services.',
    propsSchema: base({ title: short, items: list(item({ title: short, description: text, icon: short })), layout: z.enum(['cards', 'editorial', 'minimal', 'bento']).optional() }),
    defaults: { title: 'Tout pour vous lancer', items: [{ title: 'Simple', description: 'Une expérience claire et accessible.', icon: 'sparkles' }, { title: 'Rapide', description: 'Des pages légères et réactives.', icon: 'zap' }, { title: 'Évolutif', description: 'Des blocs qui grandissent avec vous.', icon: 'layers' }] },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'layout', label: 'Composition', kind: 'select', options: [{ value: 'cards', label: 'Cartes' }, { value: 'editorial', label: 'Éditoriale' }, { value: 'minimal', label: 'Minimaliste' }, { value: 'bento', label: 'Bento modulaire' }] }],
    collectionFields: { items: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'description', label: 'Description', kind: 'textarea' }, { key: 'icon', label: 'Icône', kind: 'text' }] }, keywords: ['services', 'grille'],
  },
  gallery: {
    type: 'gallery', label: 'Galerie', category: 'Contenu', description: 'Galerie d’images responsive.',
    propsSchema: base({ title: short, images: list(item({ assetId: asset, src: z.string().max(2048).optional().or(z.literal('')), alt: short })), layout: z.enum(['grid', 'editorial', 'filmstrip']).optional() }),
    defaults: { title: 'En images', images: [] },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'layout', label: 'Composition', kind: 'select', options: [{ value: 'grid', label: 'Grille' }, { value: 'editorial', label: 'Éditoriale' }, { value: 'filmstrip', label: 'Pellicule horizontale' }] }],
    collectionFields: { images: [{ key: 'assetId', label: 'Image', kind: 'asset' }, { key: 'alt', label: 'Texte alternatif', kind: 'text' }] }, keywords: ['photos', 'portfolio'],
  },
  testimonials: {
    type: 'testimonials', label: 'Témoignages', category: 'Preuve', description: 'Preuves sociales et avis clients.',
    propsSchema: base({ title: short, items: list(item({ quote: text, author: short, role: short })) }),
    defaults: { title: 'Ils nous font confiance', items: [{ quote: 'Une équipe attentive et un résultat qui nous ressemble.', author: 'Alex Martin', role: 'Client' }] },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }], collectionFields: { items: [{ key: 'quote', label: 'Citation', kind: 'textarea' }, { key: 'author', label: 'Auteur', kind: 'text' }, { key: 'role', label: 'Fonction', kind: 'text' }] }, keywords: ['avis', 'clients'],
  },
  pricing: {
    type: 'pricing', label: 'Tarifs', category: 'Conversion', description: 'Offres et appels à l’action.',
    propsSchema: base({ title: short, items: list(item({ name: short, price: short, period: short, description: short, features: z.array(short).max(30), ctaLabel: short, ctaHref: href, highlighted: z.boolean() })) }),
    defaults: { title: 'Des offres transparentes', items: [{ name: 'Essentiel', price: 'Sur devis', period: '', description: 'Pour bien commencer.', features: ['Accompagnement', 'Support'], ctaLabel: 'Nous contacter', ctaHref: '#contact', highlighted: false }] },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }], collectionFields: { items: [{ key: 'name', label: 'Offre', kind: 'text' }, { key: 'price', label: 'Prix affiché', kind: 'text' }, { key: 'description', label: 'Description', kind: 'text' }, { key: 'ctaLabel', label: 'Bouton', kind: 'text' }, { key: 'ctaHref', label: 'Lien', kind: 'url' }] }, keywords: ['prix', 'abonnement'],
  },
  faq: {
    type: 'faq', label: 'FAQ', category: 'Contenu', description: 'Questions et réponses accessibles.',
    propsSchema: base({ title: short, items: list(item({ question: short, answer: text })) }),
    defaults: { title: 'Questions fréquentes', items: [{ question: 'Comment commencer ?', answer: 'Contactez-nous pour définir votre besoin.' }] },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }], collectionFields: { items: [{ key: 'question', label: 'Question', kind: 'text' }, { key: 'answer', label: 'Réponse', kind: 'textarea' }] }, keywords: ['questions'],
  },
  contactForm: {
    type: 'contactForm', label: 'Formulaire de contact', category: 'Conversion', description: 'Collecte réelle de demandes dans le module Formulaires.',
    propsSchema: base({ title: short, description: text, formKey: z.string().regex(/^[a-z0-9-]+$/), submitLabel: short }),
    defaults: { title: 'Parlons de votre projet', description: 'Nous vous répondrons dans les meilleurs délais.', formKey: 'contact', submitLabel: 'Envoyer la demande' },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'description', label: 'Description', kind: 'textarea' }, { key: 'formKey', label: 'Clé du formulaire', kind: 'text' }, { key: 'submitLabel', label: 'Bouton', kind: 'text' }], keywords: ['contact', 'lead'],
  },
  cta: {
    type: 'cta', label: 'Appel à l’action', category: 'Conversion', description: 'Bannière de conversion.',
    propsSchema: base({ title: short, description: text, buttonLabel: short, buttonHref: href }),
    defaults: { title: 'Prêt à passer à l’étape suivante ?', description: 'Échangeons sur vos objectifs.', buttonLabel: 'Commencer', buttonHref: '#contact' },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'description', label: 'Description', kind: 'textarea' }, { key: 'buttonLabel', label: 'Bouton', kind: 'text' }, { key: 'buttonHref', label: 'Lien', kind: 'url' }], keywords: ['conversion'],
  },
  footer: {
    type: 'footer', label: 'Pied de page', category: 'Structure', description: 'Navigation et mentions de fin de site.',
    propsSchema: base({ text: short, copyright: short, links: list(item({ label: short, href })) }),
    defaults: { text: 'Construit avec Woob', copyright: 'Tous droits réservés.', links: [{ label: 'Contact', href: '/contact' }] },
    fields: [{ key: 'text', label: 'Texte', kind: 'text' }, { key: 'copyright', label: 'Copyright', kind: 'text' }], collectionFields: { links: [{ key: 'label', label: 'Libellé', kind: 'text' }, { key: 'href', label: 'Lien', kind: 'url' }] }, keywords: ['footer'],
  },
  stats: {
    type: 'stats', label: 'Statistiques', category: 'Preuve', description: 'Chiffres clés et résultats.',
    propsSchema: base({ title: short, items: list(item({ value: short, label: short })) }),
    defaults: { title: 'Notre impact', items: [{ value: '10+', label: 'années d’expérience' }, { value: '98 %', label: 'clients satisfaits' }] },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }], collectionFields: { items: [{ key: 'value', label: 'Valeur', kind: 'text' }, { key: 'label', label: 'Libellé', kind: 'text' }] }, keywords: ['chiffres'],
  },
  team: {
    type: 'team', label: 'Équipe', category: 'Contenu', description: 'Présentation des membres de l’équipe.',
    propsSchema: base({ title: short, items: list(item({ name: short, role: short, assetId: asset, src: z.string().max(2048).optional().or(z.literal('')) })) }),
    defaults: { title: 'Rencontrez l’équipe', items: [{ name: 'Votre nom', role: 'Votre rôle', assetId: '', src: '' }] },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }], collectionFields: { items: [{ key: 'name', label: 'Nom', kind: 'text' }, { key: 'role', label: 'Rôle', kind: 'text' }, { key: 'assetId', label: 'Photo', kind: 'asset' }] }, keywords: ['personnes'],
  },
  blog: {
    type: 'blog', label: 'Articles', category: 'Éditorial', description: 'Articles publiés du module Blog.',
    propsSchema: base({ title: short, limit: z.number().int().min(1).max(24) }),
    defaults: { title: 'Le journal', limit: 6 },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'limit', label: 'Nombre d’articles', kind: 'number' }], keywords: ['blog', 'magazine'],
  },
  products: {
    type: 'products', label: 'Catalogue produits', category: 'Commerce', description: 'Produits actifs et commande manuelle sans paiement en ligne.',
    propsSchema: base({ title: short, limit: z.number().int().min(1).max(48), showCart: z.boolean() }),
    defaults: { title: 'Notre sélection', limit: 12, showCart: true },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'limit', label: 'Nombre de produits', kind: 'number' }, { key: 'showCart', label: 'Activer le panier', kind: 'boolean' }], keywords: ['boutique', 'ecommerce'],
  },
  reservation: {
    type: 'reservation', label: 'Réservation', category: 'Conversion', description: 'Demandes de créneau dans le module Réservations.',
    propsSchema: base({ title: short, description: text, serviceName: short, submitLabel: short }),
    defaults: { title: 'Réserver un créneau', description: 'Votre réservation sera confirmée par notre équipe.', serviceName: 'Réservation', submitLabel: 'Demander la réservation' },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'description', label: 'Description', kind: 'textarea' }, { key: 'serviceName', label: 'Service', kind: 'text' }, { key: 'submitLabel', label: 'Bouton', kind: 'text' }], keywords: ['restaurant', 'booking'],
  },
  contact: {
    type: 'contact', label: 'Coordonnées', category: 'Contenu', description: 'Adresse, contact et horaires.',
    propsSchema: base({ title: short, address: short, email: short, phone: short, hours: short }),
    defaults: { title: 'Nous trouver', address: 'Votre adresse', email: 'contact@example.com', phone: '+00 00 00 00 00', hours: 'Lun–Sam · 9h–18h' },
    fields: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'address', label: 'Adresse', kind: 'text' }, { key: 'email', label: 'Email', kind: 'text' }, { key: 'phone', label: 'Téléphone', kind: 'text' }, { key: 'hours', label: 'Horaires', kind: 'text' }], keywords: ['adresse', 'contact'],
  },
  scene3d: {
    type: 'scene3d', label: 'Scène 3D procédurale', category: 'Contenu', description: 'Sculpture générée localement, chargée à l’approche du viewport, avec contrôles et fallback statique.',
    propsSchema: scene3dPropsSchema,
    defaults: { title: 'Une matière à explorer', description: 'Une sculpture procédurale pour donner du relief au récit, sans modèle externe.', preset: 'orbital', quality: 'low', autoRotate: true, interactive: true, fallbackSrc: '', fallbackAssetId: '', fallbackAlt: 'Sculpture abstraite, alternative statique de la scène 3D.' },
    fields: [
      { key: 'title', label: 'Titre de la scène', kind: 'text' },
      { key: 'description', label: 'Description accessible', kind: 'textarea' },
      { key: 'preset', label: 'Composition 3D', kind: 'select', options: [{ value: 'orbital', label: 'Orbite' }, { value: 'prism', label: 'Prisme' }] },
      { key: 'quality', label: 'Budget visuel', kind: 'select', options: [{ value: 'low', label: 'Économe' }, { value: 'balanced', label: 'Équilibré' }] },
      { key: 'autoRotate', label: 'Rotation automatique', kind: 'boolean' },
      { key: 'interactive', label: 'Rotation manuelle', kind: 'boolean' },
      { key: 'fallbackAssetId', label: 'Image de fallback', kind: 'asset' },
      { key: 'fallbackSrc', label: 'URL du fallback externe', kind: 'url' },
      { key: 'fallbackAlt', label: 'Alternative du fallback', kind: 'text' },
    ],
    keywords: ['3d', 'webgl', 'orbite', 'sculpture', 'immersif'],
  },
};

export function createNode(type: Exclude<ComponentType, 'page'>, id: string): import('./types').PageNode {
  const definition = componentRegistry[type];
  const node: import('./types').PageNode = {
    id,
    type,
    version: 1,
    name: definition.label,
    props: structuredClone(definition.defaults),
    styles: {},
  };
  if (type === 'section') node.children = [];
  return node;
}

export const insertableComponents = Object.values(componentRegistry);
