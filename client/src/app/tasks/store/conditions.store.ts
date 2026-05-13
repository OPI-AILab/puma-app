import {computed, inject, Injectable, signal} from '@angular/core';
import {ChatMessage, Condition, ConditionType} from '../models/task.models';
import {generateId} from '../utils/id.util';
import {createCondition} from '../components/conditions/condition-factory';
import {CONDITION_TEXT_CONFIG_KEYS} from '../components/conditions/condition-types';
import {ConfirmationService} from 'primeng/api';
import {TaskService} from '../services/task.service';

@Injectable({ providedIn: 'root' })
export class ConditionsStore {

  private confirmationService = inject(ConfirmationService);
  private taskService = inject(TaskService);

  readonly questionElements = signal<ChatMessage[]>([]);
  readonly verificationConditions = signal<Condition[]>([]);
  readonly conditionConfigs = signal<{[id: string]: any}>({});
  readonly hasStructuredOutput = signal<boolean>(false);

  addTextElement() {
    const newElement: ChatMessage = { id: generateId(), type: 'text', order: this.questionElements().length, text: '' };
    this.questionElements.update(list => [...list, newElement]);
  }

  addFileElement() {
    const newElement: ChatMessage = { id: generateId(), type: 'file', order: this.questionElements().length, file: undefined };
    this.questionElements.update(list => [...list, newElement]);
  }

  updateFile(elementId: string, fileId: string) {
    this.questionElements.update(elements => elements.map(el => el.id === elementId ? { ...el, file: fileId } : el));
  }

  removeElement(index: number): void {
    const remove = (idx: number) => {
      this.questionElements.update(elements => elements.filter((_, i) => i !== idx).map((el, i2) => ({...el, order: i2})))
    };

    const element = this.questionElements()[index];
    if (element.type === 'file' && element.file) {
      this.confirmationService.confirm({
        message: 'Are you sure you want to delete this file?',
        header: 'Confirmation',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Delete',
        rejectLabel: 'Cancel',
        accept: () => {
          this.taskService.deleteFile(element.file!).subscribe({
            next: () => {
              remove(index);
            },
            error: () => {
              remove(index);
            }
          });
        }
      });
    } else {
      remove(index);
    }
  }

  moveElementUp(index: number) {
    if (index === 0) return;
    this.questionElements.update(elements => {
      const updated = [...elements];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated.map((el, i) => ({...el, order: i}));
    });
  }

  moveElementDown(index: number) {
    if (index === this.questionElements().length - 1) return;
    this.questionElements.update(elements => {
      const updated = [...elements];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated.map((el, i) => ({...el, order: i}));
    });
  }

  addCondition(type: ConditionType) {
    const newCondition = createCondition(type, this.verificationConditions().length);
    const textKey = CONDITION_TEXT_CONFIG_KEYS[type];
    if (textKey) {
      const current = this.conditionConfigs();
      this.conditionConfigs.set({ ...current, [newCondition.id]: { [textKey]: '' } });
    }
    this.verificationConditions.update(list => [...list, newCondition]);
  }

  removeCondition(index: number) {
    const condition = this.verificationConditions()[index];
    const configs = { ...this.conditionConfigs() };
    if (condition) {
      delete configs[condition.id];
      this.conditionConfigs.set(configs);
    }
    this.verificationConditions.update(conditions => conditions.filter((_, i) => i !== index).map((c, i2) => ({...c, order: i2})));
  }

  moveConditionUp(index: number) {
    if (index === 0) return;
    this.verificationConditions.update(conditions => {
      const updated = [...conditions];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated.map((c, i) => ({...c, order: i}));
    });
  }

  moveConditionDown(index: number) {
    if (index === this.verificationConditions().length - 1) return;
    this.verificationConditions.update(conditions => {
      const updated = [...conditions];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated.map((c, i) => ({...c, order: i}));
    });
  }

  areAllConditionsValid = computed(() => {
    const elements = this.questionElements();

    if (!elements.length) return false;

    const elementsValid = elements.every(el => {
      if (el.type === 'text') return !!(el.text && el.text.trim());
      if (el.type === 'file') return !!el.file;
      return false;
    });
    if (!elementsValid) return false;

    for (const c of this.verificationConditions()) {
      if (!this.isConditionValid(c)) return false;
    }

    return true;
  })

  isConditionValid(condition: Condition): boolean {
    const isNonNegativeInteger = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
    };

    const p: any = condition.params || {};
    switch (condition.type) {
      case 'include': {
        const listOk = Array.isArray(condition.expected) && condition.expected.length > 0;
        const minsOk = p.include_min == null || (isNonNegativeInteger(p.include_min));
        const maxsOk = p.include_max == null || (isNonNegativeInteger(p.include_max));
        const rangeOk = minsOk && maxsOk && (p.include_min == null || p.include_max == null || Number(p.include_min) <= Number(p.include_max));
        return listOk && rangeOk;
      }

      case 'exclude': {
        return Array.isArray(condition.expected) && condition.expected.length > 0;
      }
      case 'order': {
        return Array.isArray(condition.expected) && condition.expected.length > 0;
      }
      case 'regex': {
        const hasRegex = typeof condition.expected === 'string' && !!condition.expected.trim();
        try {
          new RegExp(condition.expected);
        } catch {
          return false;
        }
        const minOk = p.regex_min == null || (isNonNegativeInteger(p.regex_min));
        const maxOk = p.regex_max == null || (isNonNegativeInteger(p.regex_max));
        const lenOk = p.regex_match_length == null || (Number.isFinite(Number(p.regex_match_length)) && Number(p.regex_match_length) >= 0);
        if (!minOk || !maxOk || !lenOk) return false;
        if (p.regex_min != null && p.regex_max != null && Number(p.regex_min) > Number(p.regex_max)) return false;
        return hasRegex;
      }
      case 'ocr': {
        const expected = (condition as any).expected;
        if (!Array.isArray(expected) || expected.length === 0) return false;
        return expected.every((block: any) => typeof block === 'string' && block.trim().length > 0);
      }
      case 'struct': {
        const expected = condition.expected;
        const isEmpty = expected == null
          || (typeof expected === 'string' && !expected.trim())
          || (Array.isArray(expected) && expected.length === 0)
          || (typeof expected === 'object' && !Array.isArray(expected) && Object.keys(expected as object).length === 0);
        if (isEmpty) return this.hasStructuredOutput();
        if (typeof expected === 'object') return true;
        if (typeof expected !== 'string') return false;
        try {
          JSON.parse(expected);
          return true;
        } catch {
          return false;
        }
      }
      default:
        return true;
    }
  }

  reset() {
    this.questionElements.set([]);
    this.verificationConditions.set([]);
    this.conditionConfigs.set({});
    this.hasStructuredOutput.set(false);
  }

}
