export interface Task {
  id: string;
  details: TaskDetails;
  category: string;
  user_added: string;
  date_added: string;
  user_modified: string;
  date_modified: string;
}

export interface TaskDetails {
  id: string;
  category: string;
  tags: string[];
  content: ChatMessage[];
  conditions: Condition[];
  files: FileMetadata[];
  structured_output?: StructuredOutput;
}

export interface StructuredOutput {
  name: string;
  array: boolean;
  fields: StructuredOutputField[];
}

export interface StructuredOutputField {
  name: string;
  type: string;
  description: string;
}

export interface Category {
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface SearchRequest {
  offset: number;
  limit: number;
}

export interface ChatMessage {
  id: string;
  order: number;
  type: ChatMessageType;
  text?: string;
  file?: string;
}

export interface Condition {
  id: string;
  type: ConditionType;
  order: number;
  expected?: any;
  params: IncludeCondition | ExcludeCondition | OrderCondition | RegexCondition;
}

export interface FileMetadata {
  id: string;
  url?: string;
  license?: string;
  attribution?: string;
}

export interface FileElement {
  id?: string;
  originalName?: string;
  url?: string;
  license?: string;
  attribution?: string;
}

export interface FileUploadResponse {
  id: string;
  originalName: string;
  fileName: string;
  url?: string;
  license?: string;
  attribution?: string;
}

export interface UpdateFileRequest {
  url?: string;
  license?: string;
  attribution?: string;
}

export interface IncludeCondition {
  include: string[];
  lemmatize: boolean;
  include_min?: number;
  include_max?: number;
}

export interface ExcludeCondition {
  exclude: string[];
  lemmatize: boolean;
}

export interface OrderCondition {
  order: string[];
  lemmatize: boolean;
}

export interface RegexCondition {
  regex_min?: number;
  regex_max?: number;
  regex_match_length?: number;
  regex_match_word: boolean;
}

export interface SavedResponse {
  id: string;
  task_id: string;
  model_id: string;
  answer: string;
  scores: any;
  date_created: string;
  user_created?: number;
}

export interface SavedResponseRequest {
  task_id: string;
  model_id: string;
  answer: string;
  scores: any;
  user_created?: number;
}
export interface TagStats {
  name: string;
  count: number;
}

export type ConditionType = 'include' | 'exclude' | 'order' | 'regex' | 'wacc' | 'struct' | 'ocr';
export type ChatMessageType = 'text' | 'file';
export type { ModelDetails, ModelCategory, ModelProperties, ModelDetailsAndProperties } from './model.models';
