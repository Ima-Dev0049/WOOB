import { applicationModelSchema } from './model';

/** A deterministic commercial management model; budgets are estimates, never invoices or payments. */
export const commercialApplicationModel = applicationModelSchema.parse({
  schemaVersion: 1,
  name: 'Gestion commerciale',
  description: 'Clients et opportunités exécutés par le moteur de gestion commun WOOB, sans facturation ni paiement.',
  objects: [
    {
      key: 'clients',
      label: 'Client',
      pluralLabel: 'Clients',
      description: 'Les entreprises et contacts rattachés aux opportunités commerciales.',
      titleField: 'nom',
      columns: ['nom', 'contact', 'segment'],
      fields: [
        { key: 'nom', label: 'Nom de l’entreprise', type: 'text', required: true, maxLength: 160 },
        { key: 'contact', label: 'Contact principal', type: 'text', required: false, maxLength: 160 },
        { key: 'email', label: 'Email', type: 'email', required: false },
        { key: 'telephone', label: 'Téléphone', type: 'phone', required: false },
        {
          key: 'segment', label: 'Segment', type: 'enum', required: true, defaultValue: 'pme',
          options: [
            { value: 'tpe', label: 'Très petite entreprise' },
            { value: 'pme', label: 'PME' },
            { value: 'grand-compte', label: 'Grand compte' },
            { value: 'association', label: 'Association' },
          ],
        },
        { key: 'notes', label: 'Notes', type: 'textarea', required: false, maxLength: 2000 },
      ],
      actions: [],
    },
    {
      key: 'opportunites',
      label: 'Opportunité',
      pluralLabel: 'Opportunités',
      description: 'Les opportunités et leur avancement jusqu’à la validation de la conclusion.',
      titleField: 'nom',
      statusField: 'statut',
      columns: ['nom', 'client-id', 'budget', 'echeance', 'statut'],
      fields: [
        { key: 'nom', label: 'Nom de l’opportunité', type: 'text', required: true, maxLength: 160 },
        { key: 'client-id', label: 'Client', type: 'relation', required: true, targetObject: 'clients' },
        { key: 'budget', label: 'Budget estimé (€)', type: 'number', required: false, min: 0, max: 1_000_000_000, help: 'Montant indicatif uniquement : aucune facture ni aucun paiement n’est généré.' },
        { key: 'echeance', label: 'Échéance prévisionnelle', type: 'date', required: false },
        { key: 'notes', label: 'Notes', type: 'textarea', required: false, maxLength: 5000 },
        {
          key: 'statut', label: 'Statut', type: 'enum', required: true, defaultValue: 'nouvelle',
          options: [
            { value: 'nouvelle', label: 'Nouvelle' },
            { value: 'qualifiee', label: 'Qualifiée' },
            { value: 'proposition', label: 'Proposition envoyée' },
            { value: 'gagnee', label: 'Gagnée' },
            { value: 'perdue', label: 'Perdue' },
          ],
        },
      ],
      actions: [
        { key: 'qualifier', label: 'Qualifier', from: ['nouvelle'], to: 'qualifiee' },
        { key: 'proposer', label: 'Envoyer la proposition', from: ['qualifiee'], to: 'proposition' },
        { key: 'conclure', label: 'Conclure', from: ['proposition'], to: 'gagnee' },
        { key: 'perdre', label: 'Marquer perdue', from: ['nouvelle', 'qualifiee', 'proposition'], to: 'perdue' },
      ],
    },
  ],
  roles: [
    { key: 'owner', label: 'Propriétaire', grants: [{ object: '*', operations: ['read', 'create', 'update', 'delete'], actions: ['*'] }] },
    { key: 'admin', label: 'Direction', grants: [{ object: '*', operations: ['read', 'create', 'update', 'delete'], actions: ['*'] }] },
    {
      key: 'editor', label: 'Commercial', grants: [
        { object: 'clients', operations: ['read', 'create', 'update'], actions: [] },
        { object: 'opportunites', operations: ['read', 'create', 'update'], actions: ['qualifier', 'proposer', 'perdre'] },
      ],
    },
    {
      key: 'contributor', label: 'Validation', grants: [
        { object: 'clients', operations: ['read'], actions: [] },
        { object: 'opportunites', operations: ['read'], actions: ['conclure'] },
      ],
    },
    {
      key: 'viewer', label: 'Lecture seule', grants: [
        { object: 'clients', operations: ['read'], actions: [] },
        { object: 'opportunites', operations: ['read'], actions: [] },
      ],
    },
  ],
});
