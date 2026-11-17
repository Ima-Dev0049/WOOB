import { addApplicationTransition, addOptionalApplicationTypedField, setApplicationObjectColumns } from './model-editor';
import { applicationColumnKeys, type ApplicationModel } from './model';

export const applicationProposalKinds = {
  'suivi-date': {
    label: 'Suivi par date',
    description: 'Ajoute une date de suivi optionnelle et l’affiche dans la liste.',
    type: 'date' as const,
    defaultLabel: 'Date de suivi',
  },
  tel: {
    label: 'Contact téléphonique',
    description: 'Ajoute un téléphone optionnel et l’affiche dans la liste.',
    type: 'text' as const,
    defaultLabel: 'Téléphone',
  },
  montant: {
    label: 'Montant à suivre',
    description: 'Ajoute un montant optionnel, borné à zéro, et l’affiche dans la liste.',
    type: 'number' as const,
    defaultLabel: 'Montant',
  },
  validation: {
    label: 'Étape de validation',
    description: 'Ajoute une transition entre deux statuts existants du processus.',
    type: null,
    defaultLabel: 'Valider',
  },
} as const;

export type ApplicationProposalKind = keyof typeof applicationProposalKinds;

export type ApplicationProposalRequest = {
  kind: ApplicationProposalKind;
  objectKey: string;
  label?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
};

export type ApplicationProposalChange = { label: string; detail: string };

export type ApplicationProposal = {
  kind: ApplicationProposalKind;
  title: string;
  summary: string;
  objectKey: string;
  objectLabel: string;
  changes: ApplicationProposalChange[];
  model: ApplicationModel;
  /** Extra key created by the proposal, useful for the preview only. */
  createdKey: string;
};

export class ApplicationProposalError extends Error {
  constructor(readonly code: 'PROPOSAL_TARGET_INVALID' | 'PROPOSAL_ALREADY_APPLIED' | 'PROPOSAL_TRANSITION_INVALID' | 'PROPOSAL_REQUEST_INVALID', message: string) {
    super(message);
    this.name = 'ApplicationProposalError';
  }
}

/**
 * Builds a deterministic, previewable proposal from an explicit intent.
 * No remote model is called, nothing is persisted, and the active model is never mutated.
 */
export function proposeApplicationModelChange(model: ApplicationModel, request: ApplicationProposalRequest): ApplicationProposal {
  const kind = applicationProposalKinds[request.kind];
  if (!kind) throw new ApplicationProposalError('PROPOSAL_REQUEST_INVALID', 'Type de proposition inconnu.');
  const target = model.objects.find((object) => object.key === request.objectKey);
  if (!target) throw new ApplicationProposalError('PROPOSAL_TARGET_INVALID', 'Cet objet n’existe pas dans le modèle actif.');
  const label = (request.label ?? kind.defaultLabel).trim();
  if (label.length < 2 || label.length > 120) throw new ApplicationProposalError('PROPOSAL_REQUEST_INVALID', 'Le libellé doit contenir entre 2 et 120 caractères.');

  if (request.kind === 'validation') {
    const status = target.fields.find((field) => field.key === target.statusField);
    const statuses = status?.options ?? [];
    if (statuses.length < 2) throw new ApplicationProposalError('PROPOSAL_TRANSITION_INVALID', 'Cet objet ne possède pas deux statuts distincts.');
    const from = request.from ?? statuses[0]!.value;
    const to = request.to ?? statuses[1]!.value;
    if (from === to || !statuses.some((option) => option.value === from) || !statuses.some((option) => option.value === to)) {
      throw new ApplicationProposalError('PROPOSAL_TRANSITION_INVALID', 'Choisissez deux statuts différents de ce processus.');
    }
    const existing = target.actions.find((action) => action.label.trim().toLowerCase() === label.toLowerCase() && action.from.join(',') === from && action.to === to);
    if (existing) throw new ApplicationProposalError('PROPOSAL_ALREADY_APPLIED', `La transition « ${existing.label} » existe déjà pour ce processus.`);
    const draft = addApplicationTransition(model, { objectKey: target.key, label, key: '', from, to });
    const created = draft.objects.find((object) => object.key === target.key)!.actions.at(-1)!;
    const labelOf = (value: string) => statuses.find((option) => option.value === value)?.label ?? value;
    return {
      kind: request.kind,
      title: `Transition « ${created.label} »`,
      summary: `${labelOf(from)} → ${labelOf(to)} sur ${target.pluralLabel}.`,
      objectKey: target.key,
      objectLabel: target.pluralLabel,
      createdKey: created.key,
      changes: [
        { label: 'Nouvelle transition', detail: `${created.label} (${created.key}) depuis ${labelOf(from)} vers ${labelOf(to)}` },
        { label: 'Statuts conservés', detail: statuses.map((option) => option.label).join(', ') },
        { label: 'Données existantes', detail: 'Aucun enregistrement, champ ou droit n’est modifié.' },
      ],
      model: draft,
    };
  }

  const fields = target.fields;
  const collision = fields.find((field) => field.label.trim().toLowerCase() === label.toLowerCase());
  if (collision) throw new ApplicationProposalError('PROPOSAL_ALREADY_APPLIED', `Un champ « ${collision.label} » existe déjà sur ${target.pluralLabel}.`);
  if (kind.type !== 'text' && kind.type !== 'number' && kind.type !== 'date') throw new ApplicationProposalError('PROPOSAL_REQUEST_INVALID', 'Ce type de proposition n’ajoute pas de champ.');
  const draftWithField = addOptionalApplicationTypedField(model, {
    objectKey: target.key,
    label,
    key: '',
    type: kind.type,
    ...(kind.type === 'number' ? { min: 0 } : {}),
  });
  const createdField = draftWithField.objects.find((object) => object.key === target.key)!.fields.at(-1)!;
  const currentColumns = applicationColumnKeys(target);
  const changes: ApplicationProposalChange[] = [
    { label: 'Nouveau champ', detail: `${createdField.label} (${createdField.key}), optionnel${kind.type === 'number' ? ', borné à 0' : ''}` },
    { label: 'Données existantes', detail: 'Aucun enregistrement existant n’est réécrit ; le champ reste vide jusqu’à saisie.' },
  ];
  let draft = draftWithField;
  if (!currentColumns.includes(createdField.key) && currentColumns.length < 12) {
    draft = setApplicationObjectColumns(draftWithField, { objectKey: target.key, columns: [...currentColumns, createdField.key] });
    changes.push({ label: 'Colonne ajoutée', detail: `Le tableau affiche ${createdField.label} après les colonnes existantes.` });
  } else {
    changes.push({ label: 'Colonnes inchangées', detail: 'Le champ reste disponible dans le formulaire, sans dépasser douze colonnes visibles.' });
  }
  return {
    kind: request.kind,
    title: `Champ « ${createdField.label} »`,
    summary: `${createdField.label} ajouté à ${target.pluralLabel}.`,
    objectKey: target.key,
    objectLabel: target.pluralLabel,
    createdKey: createdField.key,
    changes,
    model: draft,
  };
}
