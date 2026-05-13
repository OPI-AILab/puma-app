import {ConditionType} from '../../models/task.models';

export const CONDITION_LABELS: Record<ConditionType, string> = {
  include: 'Include',
  exclude: 'Exclude',
  order: 'Order',
  regex: 'Regex',
  wacc: 'WAcc',
  ocr: 'OCR',
  struct: 'Structure'
};

export const CONDITION_DEFAULTS: Record<ConditionType, any> = {
  include: {include: [], lemmatize: true, include_min: 0, include_max: 0},
  exclude: {exclude: [], lemmatize: true},
  order: {order: [], lemmatize: true},
  regex: {regex_min: 0, regex_max: 0, regex_match_length: 0, regex_match_word: false},
  wacc: {},
  ocr: {},
  struct: {}
};

export const CONDITION_TEXT_CONFIG_KEYS: Partial<Record<ConditionType, string>> = {
  include: 'includeText',
  exclude: 'excludeText',
  order: 'orderText'
};
