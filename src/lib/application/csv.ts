import type { ApplicationObject, ApplicationRecordData } from './model';

export const APPLICATION_EXPORT_LIMIT = 5000;

type ApplicationCsvRecord = {
  id: string;
  data: ApplicationRecordData;
  createdAt: Date;
  updatedAt: Date;
};

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return '""';
  if (typeof value === 'number' || typeof value === 'boolean') return `"${String(value)}"`;
  const text = String(value);
  // Spreadsheet formulas can be hidden behind spaces, tabs or line breaks.
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A machine-oriented export: stable field keys and raw values, including hidden columns. */
export function applicationRecordsCsv(object: ApplicationObject, records: ApplicationCsvRecord[]): string {
  const keys = object.fields.map((field) => field.key);
  const rows = [
    ['id', ...keys, 'created_at', 'updated_at'].map(csvCell).join(','),
    ...records.map((record) => [record.id, ...keys.map((key) => record.data[key]), record.createdAt.toISOString(), record.updatedAt.toISOString()].map(csvCell).join(',')),
  ];
  return `\uFEFF${rows.join('\r\n')}`;
}
