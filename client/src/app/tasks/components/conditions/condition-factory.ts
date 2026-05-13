import {Condition, ConditionType} from '../../models/task.models';
import {CONDITION_DEFAULTS} from './condition-types';
import {generateId} from '../../utils/id.util';

export function createCondition(type: ConditionType, currentLength: number): Condition {
  const params = { ...CONDITION_DEFAULTS[type] } as any;
  return {
    id: generateId(),
    type,
    order: currentLength,
    expected: type === 'regex' || type === 'wacc' || type === 'struct' ? '' :
              type === 'ocr' ? [''] : [],
    params
  } as Condition;
}
