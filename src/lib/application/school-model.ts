import { applicationModelSchema } from './model';

/** A deterministic example used to exercise the managed runtime; it is not presented as AI output. */
export const schoolApplicationModel = applicationModelSchema.parse({
  schemaVersion: 1,
  name: 'Portail scolaire',
  description: 'Filières et dossiers d’admission exécutés par le moteur commun WOOB.',
  objects: [
    {
      key: 'filieres',
      label: 'Filière',
      pluralLabel: 'Filières',
      description: 'Les formations auxquelles les dossiers peuvent être rattachés.',
      titleField: 'nom',
      columns: ['nom', 'code', 'description'],
      fields: [
        { key: 'nom', label: 'Nom de la filière', type: 'text', required: true, maxLength: 160 },
        { key: 'code', label: 'Code', type: 'text', required: true, maxLength: 24 },
        { key: 'description', label: 'Description', type: 'textarea', required: false, maxLength: 2000 },
      ],
      actions: [],
    },
    {
      key: 'dossiers',
      label: 'Dossier',
      pluralLabel: 'Dossiers',
      description: 'Les demandes d’inscription et leur processus de validation.',
      titleField: 'nom',
      statusField: 'statut',
      columns: ['nom', 'email', 'telephone', 'filiere-id', 'statut'],
      fields: [
        { key: 'nom', label: 'Nom complet', type: 'text', required: true, maxLength: 160 },
        { key: 'email', label: 'Email', type: 'email', required: true },
        { key: 'telephone', label: 'Téléphone', type: 'phone', required: false },
        { key: 'filiere-id', label: 'Filière', type: 'relation', required: true, targetObject: 'filieres' },
        { key: 'motivation', label: 'Motivation', type: 'textarea', required: false, maxLength: 5000 },
        {
          key: 'statut', label: 'Statut', type: 'enum', required: true, defaultValue: 'recu',
          options: [
            { value: 'recu', label: 'Reçu' },
            { value: 'en-revue', label: 'En revue' },
            { value: 'accepte', label: 'Accepté' },
            { value: 'refuse', label: 'Refusé' },
          ],
        },
      ],
      actions: [
        { key: 'mettre-en-revue', label: 'Mettre en revue', from: ['recu'], to: 'en-revue' },
        { key: 'accepter', label: 'Accepter', from: ['en-revue'], to: 'accepte' },
        { key: 'refuser', label: 'Refuser', from: ['recu', 'en-revue'], to: 'refuse' },
      ],
    },
  ],
  roles: [
    { key: 'owner', label: 'Propriétaire', grants: [{ object: '*', operations: ['read', 'create', 'update', 'delete'], actions: ['*'] }] },
    { key: 'admin', label: 'Direction', grants: [{ object: '*', operations: ['read', 'create', 'update', 'delete'], actions: ['*'] }] },
    {
      key: 'editor', label: 'Secrétariat', grants: [
        { object: 'filieres', operations: ['read'], actions: [] },
        { object: 'dossiers', operations: ['read', 'create', 'update'], actions: ['mettre-en-revue', 'accepter', 'refuser'] },
      ],
    },
    {
      key: 'contributor', label: 'Contributeur', grants: [
        { object: 'filieres', operations: ['read'], actions: [] },
        { object: 'dossiers', operations: ['read', 'create'], actions: [] },
      ],
    },
    {
      key: 'viewer', label: 'Lecture seule', grants: [
        { object: 'filieres', operations: ['read'], actions: [] },
        { object: 'dossiers', operations: ['read'], actions: [] },
      ],
    },
  ],
});
