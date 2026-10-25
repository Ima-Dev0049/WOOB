import { applicationModelSchema } from './model';

/** A deterministic university administration model; it is not an LMS, grading or scheduling system. */
export const universityApplicationModel = applicationModelSchema.parse({
  schemaVersion: 1,
  name: 'Gestion universitaire',
  description: 'Étudiants, cours et inscriptions exécutés par le moteur commun WOOB, sans LMS ni notation.',
  objects: [
    {
      key: 'etudiants',
      label: 'Étudiant',
      pluralLabel: 'Étudiants',
      description: 'Les étudiants pouvant être rattachés aux inscriptions.',
      titleField: 'nom',
      columns: ['nom', 'email', 'telephone'],
      fields: [
        { key: 'nom', label: 'Nom complet', type: 'text', required: true, maxLength: 160 },
        { key: 'email', label: 'Email', type: 'email', required: true },
        { key: 'telephone', label: 'Téléphone', type: 'phone', required: false },
        { key: 'notes', label: 'Notes administratives', type: 'textarea', required: false, maxLength: 2000 },
      ],
      actions: [],
    },
    {
      key: 'cours',
      label: 'Cours',
      pluralLabel: 'Cours',
      description: 'Le catalogue administratif des cours ouverts aux inscriptions.',
      titleField: 'intitule',
      columns: ['intitule', 'code', 'credits', 'semestre'],
      fields: [
        { key: 'intitule', label: 'Intitulé du cours', type: 'text', required: true, maxLength: 160 },
        { key: 'code', label: 'Code du cours', type: 'text', required: true, maxLength: 24 },
        { key: 'credits', label: 'Crédits', type: 'integer', required: true, min: 1, max: 30 },
        {
          key: 'semestre', label: 'Semestre', type: 'enum', required: true, defaultValue: 's1',
          options: [
            { value: 's1', label: 'Semestre 1' },
            { value: 's2', label: 'Semestre 2' },
          ],
        },
        { key: 'description', label: 'Description', type: 'textarea', required: false, maxLength: 5000 },
      ],
      actions: [],
    },
    {
      key: 'inscriptions',
      label: 'Inscription',
      pluralLabel: 'Inscriptions',
      description: 'Les demandes d’inscription reliant un étudiant et un cours, avec leur processus administratif.',
      titleField: 'reference',
      statusField: 'statut',
      columns: ['reference', 'etudiant-id', 'cours-id', 'rentree', 'statut'],
      fields: [
        { key: 'reference', label: 'Référence', type: 'text', required: true, maxLength: 80 },
        { key: 'etudiant-id', label: 'Étudiant', type: 'relation', required: true, targetObject: 'etudiants' },
        { key: 'cours-id', label: 'Cours', type: 'relation', required: true, targetObject: 'cours' },
        { key: 'rentree', label: 'Date de rentrée', type: 'date', required: true },
        { key: 'notes', label: 'Notes', type: 'textarea', required: false, maxLength: 5000 },
        {
          key: 'statut', label: 'Statut', type: 'enum', required: true, defaultValue: 'demandee',
          options: [
            { value: 'demandee', label: 'Demandée' },
            { value: 'acceptee', label: 'Acceptée' },
            { value: 'active', label: 'Active' },
            { value: 'terminee', label: 'Terminée' },
            { value: 'annulee', label: 'Annulée' },
          ],
        },
      ],
      actions: [
        { key: 'accepter', label: 'Accepter', from: ['demandee'], to: 'acceptee' },
        { key: 'activer', label: 'Activer', from: ['acceptee'], to: 'active' },
        { key: 'terminer', label: 'Terminer', from: ['active'], to: 'terminee' },
        { key: 'annuler', label: 'Annuler', from: ['demandee', 'acceptee'], to: 'annulee' },
      ],
    },
  ],
  roles: [
    { key: 'owner', label: 'Propriétaire', grants: [{ object: '*', operations: ['read', 'create', 'update', 'delete'], actions: ['*'] }] },
    { key: 'admin', label: 'Direction', grants: [{ object: '*', operations: ['read', 'create', 'update', 'delete'], actions: ['*'] }] },
    {
      key: 'editor', label: 'Scolarité', grants: [
        { object: 'etudiants', operations: ['read', 'create', 'update'], actions: [] },
        { object: 'cours', operations: ['read', 'create', 'update'], actions: [] },
        { object: 'inscriptions', operations: ['read', 'create', 'update'], actions: ['accepter', 'annuler'] },
      ],
    },
    {
      key: 'contributor', label: 'Enseignement', grants: [
        { object: 'etudiants', operations: ['read'], actions: [] },
        { object: 'cours', operations: ['read'], actions: [] },
        { object: 'inscriptions', operations: ['read'], actions: ['activer', 'terminer'] },
      ],
    },
    {
      key: 'viewer', label: 'Lecture seule', grants: [
        { object: 'etudiants', operations: ['read'], actions: [] },
        { object: 'cours', operations: ['read'], actions: [] },
        { object: 'inscriptions', operations: ['read'], actions: [] },
      ],
    },
  ],
});
