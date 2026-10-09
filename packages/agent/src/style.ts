export interface StylePackage {
  id: string;
  typography?: Record<string, unknown>;
  captions?: Record<string, unknown>;
  transitions?: string[];
  pacing?: Record<string, unknown>;
  motion?: Record<string, unknown>;
  colors?: string[];
  music?: Record<string, unknown>;
  cta?: Record<string, unknown>;
  motionGrammarId?: string;
  motionStyleIds?: string[];
}
export function normalizeStyle(style: StylePackage): StylePackage {
  return JSON.parse(JSON.stringify(style));
}
