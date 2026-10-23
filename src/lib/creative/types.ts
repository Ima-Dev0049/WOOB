export type HeroLayout = 'split' | 'editorial' | 'immersive' | 'monumental' | 'product-stage';
export type FeaturesLayout = 'cards' | 'editorial' | 'minimal';
export type GalleryLayout = 'grid' | 'editorial' | 'filmstrip';
export type VisualTreatment = 'plain' | 'organic' | 'framed' | 'orbital' | 'duotone' | 'product';
export type MotionPreset = 'fade' | 'rise' | 'reveal' | 'scale';

export interface CreativeDirection {
  schemaVersion: '1.0.0';
  engine: 'local-rules-v1' | 'openai-structured-v1';
  conceptId: string;
  name: string;
  intent: string;
  audience: string;
  emotion: string;
  personality: string[];
  concept: string;
  rationale: string;
  palette: {
    mode: 'light' | 'dark';
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    rationale: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    scale: 'monumental' | 'editorial' | 'balanced';
    rationale: string;
  };
  composition: {
    heroLayout: HeroLayout;
    featuresLayout: FeaturesLayout;
    galleryLayout: GalleryLayout;
    rhythm: 'compact' | 'balanced' | 'airy';
    rationale: string;
  };
  imagery: { treatment: VisualTreatment; guidance: string };
  motion: { preset: MotionPreset; intensity: 'subtle' | 'expressive'; rationale: string };
  conversion: { goal: string; action: string };
  constraints: string[];
}

export interface CreativeEvaluation {
  conceptId: string;
  score: number;
  reasons: string[];
}

export interface CreativeDiversityReport {
  score: number;
  uniqueCompositions: number;
  uniquePalettes: number;
  sharedDecisions: string[];
}

export interface CreativeDirectionResult {
  candidates: CreativeDirection[];
  selectedId: string;
  evaluations: CreativeEvaluation[];
  diversity: CreativeDiversityReport;
}

export interface CreativeQualityIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface CreativeQualityReport {
  scope: 'document-model';
  score: number;
  visualInspection: false;
  metrics: {
    minimumContrast: number | null;
    motionNodes: number;
    responsiveRules: boolean;
    creativeDiversity: number | null;
    pageCount: number;
    heroLayout: HeroLayout | 'none';
    genericPatterns: string[];
  };
  issues: CreativeQualityIssue[];
}
