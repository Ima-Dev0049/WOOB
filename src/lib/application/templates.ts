import type { ApplicationModel } from './model';
import { commercialApplicationModel } from './commercial-model';
import { restaurantApplicationModel } from './restaurant-model';
import { schoolApplicationModel } from './school-model';
import { universityApplicationModel } from './university-model';

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
    id: 'commercial',
    name: 'Gestion commerciale',
    description: 'Clients, opportunités et validation des conclusions par les équipes commerciales.',
    actionLabel: 'Initialiser la gestion commerciale',
    model: commercialApplicationModel,
  },
  {
    id: 'university',
    name: 'Gestion universitaire',
    description: 'Étudiants, cours et inscriptions répartis entre scolarité et enseignement.',
    actionLabel: 'Initialiser la gestion universitaire',
    model: universityApplicationModel,
  },
  {
    id: 'school',
    name: 'Gestion scolaire',
    description: 'Filières, dossiers d’admission et processus de revue par le secrétariat.',
    actionLabel: 'Initialiser un portail scolaire',
    model: schoolApplicationModel,
  },
] as const satisfies readonly ManagedApplicationTemplate[];
