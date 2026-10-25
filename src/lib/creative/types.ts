export type HeroLayout = 'split' | 'editorial' | 'immersive' | 'monumental' | 'product-stage' | 'operations';
export type FeaturesLayout = 'cards' | 'editorial' | 'minimal' | 'bento';
export type GalleryLayout = 'grid' | 'editorial' | 'filmstrip';
export type VisualTreatment = 'plain' | 'organic' | 'framed' | 'orbital' | 'duotone' | 'product' | 'ledger';
export type MotionPreset = 'fade' | 'rise' | 'reveal' | 'scale';

export interface ProjectBrief {
  schemaVersion: '1.0.0';
  engine: 'local-brief-rules-v1';
  sourceText: string;
  objective: string;
  industry: string | null;
  audience: string[];
  valueProposition: string | null;
  tone: string[];
  requiredPages: { slug: string; purpose: string; requiredSections: string[] }[];
  requiredFeatures: { id: string; description: string; priority: 'required' | 'preferred'; acceptanceCriteria: string[] }[];
  constraints: string[];
  preferences: string[];
  references: { type: 'image' | 'url' | 'text'; assetId?: string; url?: string; description: string; usageRights?: string }[];
  assumptions: { id: string; description: string; basis: string }[];
  missingInformation: { id: string; description: string; blocking: false }[];
  contradictions: { id: string; description: string; resolution: string; status: 'resolved' | 'needs-input' }[];
  successCriteria: string[];
  motionPreference: 'standard' | 'disabled';
}

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
  motion: { preset: MotionPreset; intensity: 'subtle' | 'expressive'; rationale: string; /** Absent in early 1.0 documents means enabled. */ enabled?: boolean };
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
    briefRequirements: boolean | null;
    creativeDiversity: number | null;
    pageCount: number;
    heroLayout: HeroLayout | 'none';
    genericPatterns: string[];
  };
  issues: CreativeQualityIssue[];
}
