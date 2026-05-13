export interface ModelDetails {
  id: string;
}

export interface ModelCategory {
  category: string;
  selected: boolean;
}

export interface ModelProperties {
  categories: ModelCategory[];
}

export interface ModelDetailsAndProperties {
  details: ModelDetails;
  properties?: ModelProperties;
}

export interface ModelForCategory {
  model_id: string;
  selected: boolean;
}

export interface EvaluationResult {
  type: string;
  hard_score?: number;
  soft_score?: number;
  meta?: Record<string, any>;
}

export interface EvalSample {
  id: string;
  model_id: string;
  answer: string;
  last_exception?: string;
  scores: EvaluationResult[];
}
