export type ApplicationObjectSummary = {
  objectKey: string;
  total: number;
  statuses: { value: string; count: number }[];
};

/** Counts cover every readable record, not only the current paginated table page. */
export type ApplicationSummary = {
  total: number;
  objects: ApplicationObjectSummary[];
};
