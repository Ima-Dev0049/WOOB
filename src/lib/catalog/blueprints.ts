import type { ComponentType } from '@/lib/document/types';
import type { FunctionalModuleId, PageRecipe, SiteBlueprint } from './types';

type NodeType = Exclude<ComponentType, 'page'>;
const page = (id: string, fr: string, en: string, path: string, components: NodeType[], requiredModuleId?: FunctionalModuleId): PageRecipe => ({ id, name: { fr, en }, path, components, ...(requiredModuleId ? { requiredModuleId } : {}) });
const home = (components: NodeType[] = ['features', 'testimonials', 'cta']) => page('home', 'Accueil', 'Home', '/', ['header', 'hero', ...components, 'footer']);
const contact = () => page('contact', 'Contact', 'Contact', '/contact', ['header', 'heading', 'contactForm', 'contact', 'footer']);
const about = () => page('about', 'À propos', 'About', '/a-propos', ['header', 'heading', 'text', 'team', 'footer']);
const blog = (path = '/journal') => page('blog', 'Journal', 'Journal', path, ['header', 'heading', 'blog', 'footer'], 'blog');
const catalog = (path = '/boutique') => page('catalog', 'Boutique', 'Shop', path, ['header', 'heading', 'products', 'faq', 'footer'], 'catalog');
const reservation = (path = '/reservation') => page('reservation', 'Réservation', 'Booking', path, ['header', 'heading', 'reservation', 'contact', 'footer'], 'reservations');
const all: FunctionalModuleId[] = ['forms', 'blog', 'catalog', 'reservations'];
const content: FunctionalModuleId[] = ['forms', 'blog'];
const booking: FunctionalModuleId[] = ['forms', 'blog', 'reservations'];

export const siteBlueprints: SiteBlueprint[] = [
  {
    id: 'showcase', templateId: 'studio-business', recommendedModuleIds: ['forms'], supportedModuleIds: all,
    pages: [home(), page('services', 'Services', 'Services', '/services', ['header', 'heading', 'features', 'pricing', 'faq', 'footer']), about(), contact()],
  },
  {
    id: 'ecommerce', templateId: 'market-epices', recommendedModuleIds: ['forms', 'catalog'], supportedModuleIds: ['forms', 'blog', 'catalog'],
    pages: [home(['features', 'products', 'testimonials', 'footer'].filter((type) => type !== 'footer') as NodeType[]), catalog(), blog('/actualites'), contact()],
    notice: { fr: 'Les commandes sont manuelles et impayées par défaut. Paiement en ligne, dropshipping, abonnements et logistique ne sont pas inclus.', en: 'Orders are manual and unpaid by default. Online payments, dropshipping, subscriptions and logistics are not included.' },
  },
  {
    id: 'marketplace', templateId: 'studio-business', recommendedModuleIds: ['forms'], supportedModuleIds: content,
    pages: [home(['features', 'stats', 'faq', 'cta']), page('how', 'Comment ça marche', 'How it works', '/fonctionnement', ['header', 'heading', 'features', 'faq', 'footer']), blog(), contact()],
    notice: { fr: 'Woob crée ici le site éditorial de la plateforme. Comptes vendeurs, multi-offres, paiements et moteur de marketplace ne sont pas implémentés.', en: 'Woob creates the platform’s editorial website. Seller accounts, multi-vendor offers, payments and marketplace infrastructure are not implemented.' },
  },
  {
    id: 'saas', templateId: 'studio-business', recommendedModuleIds: ['forms', 'blog'], supportedModuleIds: content,
    pages: [home(['features', 'stats', 'pricing', 'faq', 'cta']), page('features', 'Fonctionnalités', 'Features', '/fonctionnalites', ['header', 'heading', 'features', 'gallery', 'faq', 'footer']), blog('/ressources'), contact()],
    notice: { fr: 'Le résultat est le site de présentation du logiciel, pas une application SaaS, un CRM ou un portail client opérationnel.', en: 'The result is the software’s marketing website, not an operational SaaS application, CRM or customer portal.' },
  },
  {
    id: 'landing', templateId: 'studio-business', recommendedModuleIds: ['forms'], supportedModuleIds: ['forms', 'catalog', 'reservations'],
    pages: [home(['features', 'testimonials', 'pricing', 'faq', 'contactForm', 'cta']), page('thanks', 'Merci', 'Thank you', '/merci', ['header', 'heading', 'text', 'cta', 'footer'])],
  },
  {
    id: 'education', templateId: 'academy-horizon', recommendedModuleIds: ['forms', 'blog'], supportedModuleIds: all,
    pages: [home(['stats', 'features', 'testimonials', 'faq']), page('courses', 'Formations', 'Courses', '/formations', ['header', 'heading', 'features', 'pricing', 'contactForm', 'footer']), blog('/ressources'), reservation('/inscription'), contact()],
    notice: { fr: 'Les pages présentent les formations et collectent les demandes. LMS, comptes apprenants, progression et certification ne sont pas inclus.', en: 'Pages present courses and collect requests. LMS, learner accounts, progress and certification are not included.' },
  },
  {
    id: 'restaurant', templateId: 'restaurant-safran', recommendedModuleIds: ['forms', 'reservations'], supportedModuleIds: all,
    pages: [home(['gallery', 'testimonials', 'contact']), page('menu', 'Menu', 'Menu', '/menu', ['header', 'heading', 'features', 'cta', 'footer']), catalog('/commander'), reservation(), contact()],
    notice: { fr: 'La réservation est une demande à confirmer manuellement. Aucune disponibilité en temps réel ni paiement de commande n’est inclus.', en: 'Reservations are requests confirmed manually. Real-time availability and order payments are not included.' },
  },
  {
    id: 'tourism', templateId: 'studio-business', recommendedModuleIds: ['forms', 'reservations'], supportedModuleIds: all,
    pages: [home(['gallery', 'features', 'testimonials', 'cta']), page('stays', 'Séjours et offres', 'Stays and offers', '/sejours', ['header', 'heading', 'gallery', 'features', 'pricing', 'footer']), reservation(), blog('/guides'), contact()],
    notice: { fr: 'Les disponibilités, vols, paiements et réservations fournisseurs nécessitent des intégrations qui ne sont pas incluses.', en: 'Availability, flights, payments and supplier bookings require integrations that are not included.' },
  },
  {
    id: 'real-estate', templateId: 'studio-business', recommendedModuleIds: ['forms'], supportedModuleIds: booking,
    pages: [home(['features', 'gallery', 'stats', 'cta']), page('properties', 'Biens et projets', 'Properties and projects', '/biens', ['header', 'heading', 'gallery', 'features', 'contactForm', 'footer']), reservation('/visite'), contact()],
    notice: { fr: 'Gestion multi-agents, annonces synchronisées, estimation automatique et transactions immobilières ne sont pas incluses.', en: 'Multi-agent management, synchronised listings, automated valuation and property transactions are not included.' },
  },
  {
    id: 'health', templateId: 'studio-business', recommendedModuleIds: ['forms', 'reservations'], supportedModuleIds: booking,
    pages: [home(['features', 'team', 'faq', 'contact']), page('care', 'Services et informations', 'Care and information', '/services', ['header', 'heading', 'features', 'faq', 'footer']), reservation('/rendez-vous'), blog('/conseils'), contact()],
    notice: { fr: 'Aucun portail patient, dossier médical ou stockage sécurisé de données de santé n’est inclus. Les demandes ne doivent pas contenir d’informations médicales sensibles.', en: 'No patient portal, medical record or secure health-data storage is included. Requests must not contain sensitive medical information.' },
  },
  {
    id: 'finance-legal', templateId: 'studio-business', recommendedModuleIds: ['forms', 'blog'], supportedModuleIds: booking,
    pages: [home(['features', 'stats', 'team', 'faq']), page('expertise', 'Expertises', 'Expertise', '/expertises', ['header', 'heading', 'features', 'pricing', 'faq', 'footer']), reservation('/consultation'), blog('/analyses'), contact()],
    notice: { fr: 'Aucune transaction financière, recommandation réglementée automatisée ou gestion de dossier juridique n’est incluse.', en: 'No financial transaction, automated regulated recommendation or legal case management is included.' },
  },
  {
    id: 'jobs', templateId: 'studio-business', recommendedModuleIds: ['forms', 'blog'], supportedModuleIds: content,
    pages: [home(['features', 'stats', 'testimonials', 'cta']), page('offers', 'Offres et opportunités', 'Jobs and opportunities', '/opportunites', ['header', 'heading', 'features', 'contactForm', 'footer']), blog('/conseils'), contact()],
    notice: { fr: 'Les formulaires collectent des demandes simples. ATS, comptes candidats, matching et gestion des candidatures ne sont pas inclus.', en: 'Forms collect simple requests. ATS, candidate accounts, matching and application management are not included.' },
  },
  {
    id: 'portfolio', templateId: 'portfolio-atelier', recommendedModuleIds: ['forms'], supportedModuleIds: content,
    pages: [home(['gallery', 'blog', 'cta']), page('work', 'Projets', 'Work', '/projets', ['header', 'heading', 'gallery', 'features', 'footer']), about(), blog(), contact()],
  },
  {
    id: 'media', templateId: 'journal-signal', recommendedModuleIds: ['forms', 'blog'], supportedModuleIds: content,
    pages: [home(['blog', 'features', 'cta']), blog(), page('about', 'La rédaction', 'Editorial team', '/redaction', ['header', 'heading', 'text', 'team', 'footer']), contact()],
  },
  {
    id: 'events', templateId: 'studio-business', recommendedModuleIds: ['forms', 'reservations'], supportedModuleIds: all,
    pages: [home(['features', 'gallery', 'pricing', 'faq', 'cta']), page('program', 'Programme', 'Programme', '/programme', ['header', 'heading', 'features', 'gallery', 'faq', 'footer']), reservation('/inscription'), contact()],
    notice: { fr: 'Les inscriptions sont des demandes manuelles. Billetterie, paiement, QR codes et gestion des participants ne sont pas inclus.', en: 'Registrations are manual requests. Ticketing, payments, QR codes and attendee management are not included.' },
  },
  {
    id: 'community', templateId: 'journal-signal', recommendedModuleIds: ['forms', 'blog'], supportedModuleIds: content,
    pages: [home(['features', 'blog', 'testimonials', 'cta']), page('community', 'La communauté', 'Community', '/communaute', ['header', 'heading', 'features', 'team', 'faq', 'footer']), blog(), contact()],
    notice: { fr: 'Woob crée le site public ou de présentation. Comptes membres, forum, fil social et communauté payante ne sont pas implémentés.', en: 'Woob creates the public or presentation website. Member accounts, forums, social feeds and paid communities are not implemented.' },
  },
  {
    id: 'nonprofit', templateId: 'studio-business', recommendedModuleIds: ['forms', 'blog'], supportedModuleIds: ['forms', 'blog', 'catalog'],
    pages: [home(['features', 'stats', 'blog', 'cta']), page('actions', 'Nos actions', 'Our actions', '/actions', ['header', 'heading', 'features', 'gallery', 'stats', 'footer']), blog('/actualites'), contact()],
    notice: { fr: 'Les dons et paiements ne sont pas encaissés par Woob. Le catalogue éventuel reste en commande manuelle.', en: 'Donations and payments are not collected by Woob. Any catalogue remains manual-order only.' },
  },
  {
    id: 'sports', templateId: 'academy-horizon', recommendedModuleIds: ['forms', 'reservations'], supportedModuleIds: all,
    pages: [home(['features', 'stats', 'team', 'cta']), page('activities', 'Activités', 'Activities', '/activites', ['header', 'heading', 'features', 'pricing', 'faq', 'footer']), reservation('/seance'), blog('/conseils'), contact()],
  },
  {
    id: 'beauty', templateId: 'restaurant-safran', recommendedModuleIds: ['forms', 'reservations'], supportedModuleIds: all,
    pages: [home(['gallery', 'features', 'testimonials', 'cta']), page('services', 'Prestations', 'Services', '/prestations', ['header', 'heading', 'features', 'pricing', 'gallery', 'footer']), catalog(), reservation(), contact()],
    notice: { fr: 'Les rendez-vous sont des demandes à confirmer. Paiement et gestion automatique des disponibilités ne sont pas inclus.', en: 'Appointments are requests requiring confirmation. Payments and automated availability are not included.' },
  },
  {
    id: 'local-services', templateId: 'studio-business', recommendedModuleIds: ['forms'], supportedModuleIds: all,
    pages: [home(['features', 'testimonials', 'faq', 'cta']), page('services', 'Services', 'Services', '/services', ['header', 'heading', 'features', 'pricing', 'contactForm', 'footer']), reservation('/demande'), blog('/conseils'), contact()],
  },
  {
    id: 'custom', templateId: 'studio-business', recommendedModuleIds: ['forms'], supportedModuleIds: all,
    pages: [home(['features', 'cta']), about(), blog(), catalog(), reservation(), contact()],
  },
];
