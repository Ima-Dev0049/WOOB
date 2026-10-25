import { describe, expect, it } from 'vitest';
import { applicationRecordsCsv } from '@/lib/application/csv';
import type { ApplicationObject } from '@/lib/application/model';

describe('CSV applicatif', () => {
  it('échappe les cellules et neutralise les formules même après des espaces ou retours', () => {
    const object: ApplicationObject = {
      key: 'exports', label: 'Export', pluralLabel: 'Exports', titleField: 'nom', actions: [],
      fields: [
        { key: 'nom', label: 'Nom', type: 'text', required: true, maxLength: 160 },
        { key: 'espaces', label: 'Espaces', type: 'text', required: false, maxLength: 160 },
        { key: 'retour', label: 'Retour', type: 'text', required: false, maxLength: 160 },
        { key: 'tabulation', label: 'Tabulation', type: 'text', required: false, maxLength: 160 },
        { key: 'arobase', label: 'Arobase', type: 'text', required: false, maxLength: 160 },
        { key: 'actif', label: 'Actif', type: 'boolean', required: false },
        { key: 'quantite', label: 'Quantité', type: 'integer', required: false },
      ],
    };
    const date = new Date('2027-01-02T03:04:05.000Z');
    const csv = applicationRecordsCsv(object, [{
      id: 'record-1', createdAt: date, updatedAt: date,
      data: { nom: 'Client "Premium"', espaces: '  =2+2', retour: '\r\n+SUM(1,2)', tabulation: '\t-2+2', arobase: '\n@commande', actif: false, quantite: 0 },
    }]);
    expect(csv.startsWith('\uFEFF"id","nom","espaces","retour","tabulation","arobase","actif","quantite","created_at","updated_at"')).toBe(true);
    expect(csv).toContain('"Client ""Premium"""');
    expect(csv).toContain('"\'  =2+2"');
    expect(csv).toContain('"\'\r\n+SUM(1,2)"');
    expect(csv).toContain('"\'\t-2+2"');
    expect(csv).toContain('"\'\n@commande"');
    expect(csv).toContain('"false","0","2027-01-02T03:04:05.000Z"');
  });
});
