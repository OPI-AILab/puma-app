import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {ButtonModule} from 'primeng/button';
import {TooltipModule} from 'primeng/tooltip';
import {SafeHtmlPipe} from '../pipes/safeHtml.pipes';
import {MarkdownPipe} from '../pipes/markdown.pipe';
import {StructResultViewerComponent} from './struct-result-viewer.component';
import {OcrResultViewerComponent} from './ocr-result-viewer.component';
import {WaccResultViewerComponent} from './wacc-result-viewer.component';
import {Condition} from '../models/task.models';

export interface EvaluationResult {
  model_id: string;
  answer: string;
  scores: { type: string; hard_score?: number; soft_score?: number; meta?: { errors?: string[] } }[];
  last_exception?: string;
}

@Component({
  selector: 'app-evaluation-results',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    SafeHtmlPipe,
    MarkdownPipe,
    StructResultViewerComponent,
    OcrResultViewerComponent,
    WaccResultViewerComponent,
    TooltipModule
  ],
  styles: [`
    ::ng-deep .llm-response-card .p-card-body {
      padding: 0;
    }
  `],
  template: `
    @if (evaluationResults.length > 0) {
      <div
        [class]="category === 'OCR' ? 'grid grid-cols-2 mt-4 gap-4 items-start' : 'grid grid-cols-3 mt-4 gap-4 items-start'">
        @for (result of evaluationResults; track result.model_id) {
          <p-card class="llm-response-card shadow-lg border border-gray-200 overflow-hidden flex flex-col">
            <ng-template pTemplate="header">
              <div class="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200">
                <h2 class="text-lg font-bold text-gray-800">{{ result.model_id }}</h2>
                <div class="flex items-center gap-1">
                  @if (showToggle) {
                    <p-button
                      [icon]="isShowMissing(result.model_id) ? 'pi pi-eye-slash' : 'pi pi-eye'"
                      [text]="true"
                      severity="secondary"
                      [pTooltip]="isShowMissing(result.model_id) ? 'Hide missing fragments' : 'Show missing fragments'"
                      tooltipPosition="top"
                      (onClick)="toggleShowMissing(result.model_id)"
                    ></p-button>
                  }
                  @if (isModelAvailable(result.model_id)) {
                    <p-button
                      icon="pi pi-refresh"
                      [text]="true"
                      severity="secondary"
                      (onClick)="onEvaluateSingleModel(result.model_id)"
                      [loading]="isModelEvaluating(result.model_id)"
                    ></p-button>
                  }
                </div>
              </div>
            </ng-template>
            <div class="flex flex-col">
              @if (result.last_exception) {
                <div class="p-4 text-red-600 bg-red-50 border-l-4 border-red-500 m-4 rounded-r">
                  <div class="font-bold mb-1">Error</div>
                  {{ result.last_exception }}
                </div>
              } @else {
                <div class="p-4 flex-grow">
                  @if (isModelEvaluating(result.model_id)) {
                    <div class="flex items-center justify-center py-8">
                      <i class="pi pi-spin pi-spinner text-2xl"></i>
                      <span class="ml-2">Loading...</span>
                    </div>
                  } @else if (hasStructCondition) {
                    <app-struct-result-viewer [result]="result" [showMissing]="isShowMissing(result.model_id)"></app-struct-result-viewer>
                  } @else if (category === 'OCR') {
                    <app-ocr-result-viewer [result]="result"></app-ocr-result-viewer>
                  } @else if (snapshotExpected) {
                    <app-wacc-result-viewer [result]="result" [expected]="snapshotExpected" [showMissing]="isShowMissing(result.model_id)"></app-wacc-result-viewer>
                  } @else {
                    <div class="prose prose-sm max-w-none break-words text-gray-800"
                         [innerHTML]="result.answer | markdown | safeHtml"></div>
                  }
                </div>

                @if (getErrors(result).length > 0 && !hasStructCondition) {
                  <div class="p-4 border-t border-gray-200">
                    <h4 class="text-sm font-semibold text-red-700 mb-2">Errors</h4>
                    <div class="space-y-1">
                      @for (error of getErrors(result); track $index) {
                        <div class="text-sm text-red-700 bg-red-50 p-2 rounded border border-red-200">
                          <span><span class="font-semibold">{{ error.type }}:</span> {{ error.message }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (result.scores.length > 0) {
                  <div class="bg-gray-50 p-4 border-t border-gray-200 mt-auto">
                    <h4 class="text-sm font-semibold text-gray-700 mb-3">Scores</h4>
                    <div class="space-y-2">
                      @for (evalResult of result.scores; track evalResult.type) {
                        <div
                          class="flex items-center justify-between bg-white p-2 rounded border border-gray-200 shadow-sm font-mono">
                          <span class="font-medium text-gray-700">{{ evalResult.type }}</span>
                          <div class="flex gap-2 text-sm">
                            @if (evalResult.hard_score !== undefined) {
                              <span
                                class="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">Hard: {{ evalResult.hard_score | number: '1.0-4' }}</span>
                            }
                            @if (evalResult.soft_score !== undefined) {
                              <span
                                class="px-2 py-1 bg-green-100 text-green-800 rounded font-medium">Soft: {{ evalResult.soft_score | number: '1.0-4' }}</span>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              }
            </div>
          </p-card>
        }
      </div>
    }
  `
})
export class EvaluationResultsComponent implements OnChanges {

  @Input() evaluationResults: EvaluationResult[] = [];
  @Input() evaluatingModelIds: string[] = [];
  @Input() availableModelIds: string[] = [];
  @Input() hasStructCondition: boolean = false;
  @Input() category: string = '';
  @Input() conditions: Condition[] = [];

  snapshotExpected: string | null = null;
  showMissingModels = new Set<string>();

  get showToggle(): boolean {
    return this.hasStructCondition || this.snapshotExpected !== null;
  }

  @Output() evaluateSingleModel = new EventEmitter<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['evaluationResults'] && this.evaluationResults.length > 0) {
      const wacc = this.conditions.find(c => c.type === 'wacc');
      this.snapshotExpected = wacc?.expected ?? null;
      this.showMissingModels.clear();
    }
  }

  isShowMissing(modelId: string): boolean {
    return this.showMissingModels.has(modelId);
  }

  toggleShowMissing(modelId: string): void {
    if (this.showMissingModels.has(modelId)) {
      this.showMissingModels.delete(modelId);
    } else {
      this.showMissingModels.add(modelId);
    }
  }

  isModelEvaluating(modelId: string): boolean {
    return this.evaluatingModelIds.includes(modelId);
  }

  onEvaluateSingleModel(modelId: string): void {
    this.evaluateSingleModel.emit(modelId);
  }

  isModelAvailable(modelId: string): boolean {
    return this.availableModelIds.includes(modelId);
  }

  getErrors(result: EvaluationResult): { type: string; message: string }[] {
    const errors: { type: string; message: string }[] = [];
    for (const score of result.scores) {
      if (score.meta?.errors) {
        for (const error of score.meta.errors) {
          errors.push({ type: score.type, message: error });
        }
      }
    }
    return errors;
  }

}
