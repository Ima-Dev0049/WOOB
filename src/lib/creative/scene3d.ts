export const SCENE3D_BUDGET = {
  maxPerPage: 1,
  maxPixelRatio: { low: 1, balanced: 1.5 },
  particles: { low: 32, balanced: 64 },
  geometryDetail: { low: 1, balanced: 2 },
} as const;

export type Scene3DFit = {
  eligible: boolean;
  explicitRequest: boolean;
  reasons: string[];
};

/**
 * 3D is opt-in. A generic premium or immersive-looking brief is not enough to
 * spend a WebGL budget; the local agent calls this gate before proposing one.
 */
export function evaluateScene3DFit(brief: string): Scene3DFit {
  const normalized = brief.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const explicitRequest = /(?:\b3d\b|webgl|orbite|orbital|prisme|sculpture)/i.test(normalized);
  const excluded = /(?:sans(?:\s+de)?\s+(?:3d|webgl)|pas\s+de\s+(?:3d|webgl))/i.test(normalized)
    && !/(?:supprim|retir)/i.test(normalized);
  if (!explicitRequest) {
    return { eligible: false, explicitRequest, reasons: ['Aucune demande explicite de scène 3D : le budget graphique reste inactif.'] };
  }
  if (excluded) {
    return { eligible: false, explicitRequest, reasons: ['La consigne refuse la 3D : aucune scène ne sera proposée.'] };
  }
  return {
    eligible: true,
    explicitRequest,
    reasons: ['La 3D est explicitement demandée ; une scène procédurale bornée peut être prévisualisée avant acceptation.'],
  };
}
