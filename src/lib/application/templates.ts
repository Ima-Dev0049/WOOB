import type { ApplicationModel } from './model';
import { restaurantApplicationModel } from './restaurant-model';
import { schoolApplicationModel } from './school-model';

export type ManagedApplicationTemplate = {
  id: string;
  name: string;
  description: string;
  actionLabel: string;
  model: ApplicationModel;
};

/** Add a sector here without changing the application manager or its runtime. */
export const managedApplicationTemplates = [
  {
    id: 'restaurant',
    name: 'Gestion de restaurant',
    description: 'Tables, réservations et passage du service par les équipes accueil et salle.',
    actionLabel: 'Initialiser la gestion du restaurant',
    model: restaurantApplicationModel,
  },
  {
    id: 'school',
    name: 'Gestion scolaire',
    description: 'Filières, dossiers d’admission et processus de revue par le secrétariat.',
    actionLabel: 'Initialiser un portail scolaire',
    model: schoolApplicationModel,
  },
] as const satisfies readonly ManagedApplicationTemplate[];
