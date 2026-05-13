import {Condition} from '../models/task.models';

export interface ConditionConfigMap { [id: string]: any; }

export function normalizeConditions(conditions: Condition[], _configMap: ConditionConfigMap): Condition[] {
  return conditions.map(inputCondition => {
    const condition = { ...inputCondition };
    const params = { ...condition.params } as any;
    ['include','exclude','order'].forEach(key => {
      if (params[key]) {
        if (!Array.isArray(params[key])) {
          params[key] = [];
        } else {
          params[key] = params[key]
            .map((u: any) => {
              if (typeof u === 'string') return u;
              if (Array.isArray(u)) {
                const deep = u.some(el => Array.isArray(el));
                if (deep) {
                  return u.flat().filter((x: any) => typeof x === 'string');
                }
                return u.filter((x: any) => typeof x === 'string');
              }
              return undefined;
            })
            .filter((x: any) => x !== undefined && (typeof x === 'string' || Array.isArray(x)));
        }
      }
    });

    if ((condition as any).expected == null) {
      if (['include','exclude','order'].includes(condition.type as any)) {
        const key = condition.type as 'include'|'exclude'|'order';
        (condition as any).expected = params[key] || [];
      } else if (condition.type === 'regex') {
        (condition as any).expected = (params as any).regex || '';
        delete (params as any).regex;
      } else if (condition.type === 'struct') {
        (condition as any).expected = '{}';
      }
    } else if (condition.type === 'regex') {
      if (typeof (condition as any).expected !== 'string') {
        (condition as any).expected = '';
      }
      if ((params as any).regex !== undefined) delete (params as any).regex;
    } else if (condition.type === 'struct') {
      const val = (condition as any).expected;
      if (typeof val === 'object') {
        (condition as any).expected = JSON.stringify(val);
      }
    } else if (condition.type === 'ocr') {
      const val = (condition as any).expected;
      if (typeof val === 'string') {
        (condition as any).expected = val ? [val] : [''];
      } else if (!Array.isArray(val)) {
        (condition as any).expected = [''];
      }
    }
    return { ...condition, params };
  });
}
