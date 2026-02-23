// ─── Compilation ────────────────────────────────────────

export interface CompilationConfig {
  modelContextWindow: number;
  reservedForOutput: number;
  ring1MaxFraction: number;
  ring2MaxFraction: number;
  ring3MinFraction: number;
  ring1HardCap: number;
  bridgeVerbatimTokens: number;
  bridgeIncludeStateBullets: boolean;
  maxNegativeExemplarTokens: number;
  maxNegativeExemplars: number;
  maxPositiveExemplars: number;
  defaultTemperature: number;
  defaultTopP: number;
  defaultModel: string;
  sceneTypeOverrides: Record<string, { temperature: number; topP: number }>;
}

export interface CompiledPayload {
  systemMessage: string;
  userMessage: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  model: string;
  outputSchema?: Record<string, unknown>;
}

export interface CompilationLog {
  id: string;
  chunkId: string;
  payloadHash: string;
  ring1Tokens: number;
  ring2Tokens: number;
  ring3Tokens: number;
  totalTokens: number;
  availableBudget: number;
  ring1Contents: string[];
  ring2Contents: string[];
  ring3Contents: string[];
  lintWarnings: string[];
  lintErrors: string[];
  timestamp: string;
}

// ─── Compiler Internals ─────────────────────────────────

export interface RingSection {
  name: string;
  text: string;
  priority: number;
  immune: boolean;
}

export interface Ring1Result {
  text: string;
  sections: RingSection[];
  tokenCount: number;
  wasTruncated: boolean;
}

export interface Ring3Result {
  text: string;
  sections: RingSection[];
  tokenCount: number;
}

export interface BudgetResult {
  r1: string;
  r2?: string;
  r3: string;
  r1Sections: RingSection[];
  r2Sections?: RingSection[];
  r3Sections: RingSection[];
  wasCompressed: boolean;
  compressionLog: string[];
}
