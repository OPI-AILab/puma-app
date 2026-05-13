export interface Evaluation {
  id: string;
  name: string | null;
  model_configuration: Record<string, any> | null;
  categories: string[] | null;
  status: 'pending' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled';
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  total_tasks: number;
  completed_tasks: number;
  error_count: number;
  category_scores: Record<string, string> | null;
  error_message: string | null;
  error_task_id: string | null;
}

export interface EvaluationEntry {
  id: number;
  evaluation_id: string;
  task_id: string | null;
  category: string | null;
  file: string | null;
  question: string | null;
  answer: string | null;
  score: number | null;
  soft_score: number | null;
  scores: { type: string; hard_score: number; soft_score: number }[] | null;
  error: string | null;
  created_at: string | null;
}

export interface EvaluationEntriesResponse {
  entries: EvaluationEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface EvaluationsListResponse {
  evaluations: Evaluation[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CreateEvaluationRequest {
  name?: string;
  model_configuration: Record<string, any>;
  categories: string[];
}
