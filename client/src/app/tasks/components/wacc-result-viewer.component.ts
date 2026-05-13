import {ChangeDetectionStrategy, Component, Input, OnChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {SafeHtmlPipe} from '../pipes/safeHtml.pipes';
import {EvaluationResult} from './evaluation-results.component';
import {diffArrays} from 'diff';

interface TokenWithContext {
  word: string;
  normalized: string;
  prefix: string;
}

@Component({
  selector: 'app-wacc-result-viewer',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="font-mono text-sm whitespace-pre-wrap break-words text-gray-800"
      [innerHTML]="diffHtml | safeHtml">
    </div>
  `
})
export class WaccResultViewerComponent implements OnChanges {

  @Input({required: true}) result!: EvaluationResult;
  @Input({required: true}) expected!: string;
  @Input() showMissing = false;

  diffHtml = '';

  ngOnChanges() {
    this.computeDiff();
  }

  private tokenizeWithContext(text: string): TokenWithContext[] {
    const tokens: TokenWithContext[] = [];
    const wordRegex = /[\p{L}\p{N}]+/gu;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(text)) !== null) {
      const prefix = text.slice(lastIndex, match.index);
      tokens.push({
        word: match[0],
        normalized: match[0].toLowerCase(),
        prefix,
      });
      lastIndex = match.index + match[0].length;
    }

    return tokens;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private computeDiff() {
    const expectedTokens = this.tokenizeWithContext(this.expected || '');
    const answerTokens = this.tokenizeWithContext(this.result.answer || '');

    const expectedNormalized = expectedTokens.map(t => t.normalized);
    const answerNormalized = answerTokens.map(t => t.normalized);

    const changes = diffArrays(expectedNormalized, answerNormalized);
    const parts: string[] = [];

    let expectedIdx = 0;
    let answerIdx = 0;

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      const count = change.value.length;

      if (!change.added && !change.removed) {
        for (let j = 0; j < count; j++) {
          const token = answerTokens[answerIdx + j];
          const prefix = this.escapeHtml(token.prefix);
          const word = this.escapeHtml(token.word);
          parts.push(prefix + word);
        }
        expectedIdx += count;
        answerIdx += count;
      } else if (change.removed) {
        const next = changes[i + 1];
        if (next?.added) {
          const addedCount = next.value.length;
          const addedParts: string[] = [];
          for (let j = 0; j < addedCount; j++) {
            const sep = j > 0 ? ' ' : '';
            addedParts.push(sep + this.escapeHtml(next.value[j]));
          }

          const prefix = answerIdx < answerTokens.length
            ? this.escapeHtml(answerTokens[answerIdx].prefix || ' ')
            : ' ';

          if (this.showMissing) {
            const removedParts: string[] = [];
            for (let j = 0; j < count; j++) {
              const sep = j > 0 ? ' ' : '';
              removedParts.push(sep + this.escapeHtml(change.value[j]));
            }
            parts.push(
              prefix +
              `<span style="color: #dc2626; background-color: #fef2f2; text-decoration: line-through; padding: 1px 2px; border-radius: 2px;">${removedParts.join('')}</span>` +
              `<span style="color: #d97706; background-color: #fffbeb; padding: 1px 2px; border-radius: 2px;">${addedParts.join('')}</span>`
            );
          } else {
            parts.push(
              prefix +
              `<span style="color: #d97706; background-color: #fffbeb; padding: 1px 2px; border-radius: 2px;">${addedParts.join('')}</span>`
            );
          }
          expectedIdx += count;
          answerIdx += addedCount;
          i++;
        } else {
          if (this.showMissing) {
            const removedParts: string[] = [];
            for (let j = 0; j < count; j++) {
              const sep = j > 0 ? ' ' : '';
              removedParts.push(sep + this.escapeHtml(change.value[j]));
            }
            parts.push(
              ` <span style="color: #dc2626; background-color: #fef2f2; text-decoration: line-through; padding: 1px 2px; border-radius: 2px;">${removedParts.join('')}</span>`
            );
          }
          expectedIdx += count;
        }
      } else if (change.added) {
        const addedParts: string[] = [];
        for (let j = 0; j < count; j++) {
          const sep = j > 0 ? ' ' : '';
          addedParts.push(sep + this.escapeHtml(change.value[j]));
        }
        parts.push(
          ` <span style="color: #d97706; background-color: #fffbeb; padding: 1px 2px; border-radius: 2px;">${addedParts.join('')}</span>`
        );
        answerIdx += count;
      }
    }

    this.diffHtml = parts.join('');
  }
}
