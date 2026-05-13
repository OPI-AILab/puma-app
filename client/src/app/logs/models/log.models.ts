export interface LogImport {
  id: string;
  name: string;
  created_at: string;
  total_entries: number;
  avg_score: number;
}

export interface LogEntryScore {
  type: string;
  hard_score: number;
  soft_score: number;
}

export interface LogEntry {
  id: number;
  import_id: string;
  task_id: string | null;
  file: string;
  question: string;
  answer: string;
  category: string;
  score: number;
  scores: LogEntryScore[];
}

export interface LogEntriesResponse {
  entries: LogEntry[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}
