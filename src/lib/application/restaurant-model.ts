import { applicationModelSchema } from './model';

/** A deterministic restaurant management model; it is not presented as AI output or a complete POS. */
export const restaurantApplicationModel = applicationModelSchema.parse({
  schemaVersion: 1,
  name: 'Gestion du restaurant',
  description: 'Tables, réservations et service exécutés par le moteur de gestion commun WOOB.',
  objects: [
    {
      key: 'tables',
      label: 'Table',
      pluralLabel: 'Tables',
      description: 'Les tables disponibles pour les réservations et le service.',
      titleField: 'nom',
      columns: ['nom', 'places', 'zone'],
      fields: [
        { key: 'nom', label: 'Nom de la table', type: 'text', required: true, maxLength: 80 },
        { key: 'places', label: 'Places', type: 'integer', required: true, min: 1, max: 30 },
        {
          key: 'zone', label: 'Zone', type: 'enum', required: true, defaultValue: 'salle',
          options: [
            { value: 'salle', label: 'Salle' },
            { value: 'terrasse', label: 'Terrasse' },
            { value: 'privatif', label: 'Espace privé' },
          ],
        },
        { key: 'notes', label: 'Notes', type: 'textarea', required: false, maxLength: 2000 },
      ],
      actions: [],
    },
    {
      key: 'reservations',
      label: 'Réservation',
      pluralLabel: 'Réservations',
      description: 'Les demandes de réservation et leur avancement pendant le service.',
      titleField: 'nom',
      statusField: 'statut',
      columns: ['nom', 'date', 'service', 'personnes', 'table-id', 'statut'],
      fields: [
        { key: 'nom', label: 'Nom du client', type: 'text', required: true, maxLength: 160 },
        { key: 'email', label: 'Email', type: 'email', required: false },
        { key: 'telephone', label: 'Téléphone', type: 'phone', required: true },
        { key: 'date', label: 'Date', type: 'date', required: true },
        {
          key: 'service', label: 'Service', type: 'enum', required: true, defaultValue: 'diner',
          options: [
            { value: 'dejeuner', label: 'Déjeuner' },
            { value: 'diner', label: 'Dîner' },
          ],
        },
        { key: 'personnes', label: 'Convives', type: 'integer', required: true, min: 1, max: 30 },
        { key: 'table-id', label: 'Table', type: 'relation', required: true, targetObject: 'tables' },
        { key: 'notes', label: 'Notes', type: 'textarea', required: false, maxLength: 2000 },
        {
          key: 'statut', label: 'Statut', type: 'enum', required: true, defaultValue: 'demandee',
          options: [
            { value: 'demandee', label: 'Demandée' },
            { value: 'confirmee', label: 'Confirmée' },
            { value: 'installee', label: 'Installée' },
            { value: 'terminee', label: 'Terminée' },
            { value: 'annulee', label: 'Annulée' },
          ],
        },
      ],
      actions: [
        { key: 'confirmer', label: 'Confirmer', from: ['demandee'], to: 'confirmee' },
        { key: 'installer', label: 'Installer', from: ['confirmee'], to: 'installee' },
        { key: 'terminer', label: 'Terminer', from: ['installee'], to: 'terminee' },
        { key: 'annuler', label: 'Annuler', from: ['demandee', 'confirmee'], to: 'annulee' },
      ],
    },
  ],
  roles: [
    { key: 'owner', label: 'Propriétaire', grants: [{ object: '*', operations: ['read', 'create', 'update', 'delete'], actions: ['*'] }] },
    { key: 'admin', label: 'Direction', grants: [{ object: '*', operations: ['read', 'create', 'update', 'delete'], actions: ['*'] }] },
    {
      key: 'editor', label: 'Accueil', grants: [
        { object: 'tables', operations: ['read'], actions: [] },
        { object: 'reservations', operations: ['read', 'create', 'update'], actions: ['confirmer', 'annuler'] },
      ],
    },
    {
      key: 'contributor', label: 'Service', grants: [
        { object: 'tables', operations: ['read'], actions: [] },
        { object: 'reservations', operations: ['read'], actions: ['installer', 'terminer'] },
      ],
    },
    {
      key: 'viewer', label: 'Lecture seule', grants: [
        { object: 'tables', operations: ['read'], actions: [] },
        { object: 'reservations', operations: ['read'], actions: [] },
      ],
    },
  ],
});
