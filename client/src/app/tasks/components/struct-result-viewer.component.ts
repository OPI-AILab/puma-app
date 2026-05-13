import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {SafeHtmlPipe} from '../pipes/safeHtml.pipes';
import {EvaluationResult} from './evaluation-results.component';

@Component({
  selector: 'app-struct-result-viewer',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="font-mono text-sm whitespace-pre-wrap break-words text-gray-800"
      [innerHTML]="formattedHtml | safeHtml">
    </div>
  `
})
export class StructResultViewerComponent implements OnChanges {

  @Input({required: true}) result!: EvaluationResult;
  @Input() showMissing = false;

  formattedHtml = '';

  ngOnChanges() {
    this.formattedHtml = this.formatJsonWithErrors(this.result);
  }

  private formatJsonWithErrors(result: EvaluationResult): string {
    const errors = this.getStructErrors(result);
    try {
      let cleaned = result.answer.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(cleaned);
      if (errors.length === 0) {
        return this.escapeHtml(JSON.stringify(parsed, null, 2));
      }
      return this.renderJsonNode(parsed, new Set(errors), '', 0);
    } catch {
      return this.escapeHtml(result.answer);
    }
  }

  private getStructErrors(result: EvaluationResult): string[] {
    const errors: string[] = [];
    for (const score of result.scores) {
      if (score.meta?.errors) {
        errors.push(...score.meta.errors);
      }
    }
    return errors;
  }

  private renderJsonNode(value: any, errors: Set<string>, prefix: string, indent: number): string {
    const pad = '  '.repeat(indent);
    const padInner = '  '.repeat(indent + 1);

    if (value === null) return 'null';
    if (typeof value === 'string') return this.escapeHtml(JSON.stringify(value));
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      const items = value.map((item, i) => {
        const itemPrefix = prefix + `[${i}]`;
        return padInner + this.renderJsonNode(item, errors, itemPrefix, indent + 1);
      });
      return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      const keySet = new Set(keys);
      const entries = keys.map(key => {
        const childValue = value[key];
        const isNestedObject = childValue !== null && typeof childValue === 'object' && !Array.isArray(childValue);

        if (isNestedObject) {
          const nestedPrefix = prefix + key + '.';
          const valStr = this.renderJsonNode(childValue, errors, nestedPrefix, indent + 1);
          return padInner + this.escapeHtml(JSON.stringify(key)) + ': ' + valStr;
        } else {
          const fullPath = prefix + key;
          const hasError = errors.has(fullPath);
          const valStr = this.renderJsonNode(childValue, errors, fullPath, indent + 1);
          const line = this.escapeHtml(JSON.stringify(key)) + ': ' + valStr;
          if (hasError) {
            return padInner + '<span style="color: #dc2626; background-color: #fef2f2;">' + line + '</span>';
          }
          return padInner + line;
        }
      });

      if (this.showMissing) {
        const missingFields = new Set<string>();
        errors.forEach(errorPath => {
          if (errorPath.startsWith(prefix)) {
            const remaining = errorPath.substring(prefix.length);
            const dotIndex = remaining.indexOf('.');
            const fieldName = dotIndex === -1 ? remaining : remaining.substring(0, dotIndex);
            if (fieldName && !keySet.has(fieldName)) {
              missingFields.add(fieldName);
            }
          }
        });
        for (const field of missingFields) {
          const line = this.escapeHtml(JSON.stringify(field)) + ': <i>???</i>';
          entries.push(padInner + '<span style="color: #d97706; background-color: #fffbeb;">' + line + '</span>');
        }
      }

      if (entries.length === 0) return '{}';
      return '{\n' + entries.join(',\n') + '\n' + pad + '}';
    }

    return this.escapeHtml(String(value));
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

}
