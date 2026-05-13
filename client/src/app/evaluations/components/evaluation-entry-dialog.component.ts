import { Component, computed, effect, input, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { EvaluationEntry } from '../models/evaluation.models';
import { IMAGE_EXT, AUDIO_EXT } from '../utils/evaluation.utils';

@Component({
  selector: 'app-evaluation-entry-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule, TableModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      header="Entry details"
      [modal]="true"
      [style]="{ width: '800px' }"
      [dismissableMask]="true"
      [closeOnEscape]="true"
    >
      @if (entry()) {
        <div class="space-y-6">
          @if (entry()!.error) {
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <h3 class="text-sm font-semibold mb-1">Error</h3>
              <p class="text-sm">{{ entry()!.error }}</p>
            </div>
          }

          @if (entry()!.question?.trim()) {
            <div>
              <h3 class="text-sm font-semibold text-gray-500 mb-2">Question</h3>
              <div class="p-3 bg-gray-50 rounded-lg">
                <p class="text-gray-900 whitespace-pre-wrap">{{ entry()!.question }}</p>
              </div>
            </div>
          }

          @if (entry()!.file && showImage()) {
            <div>
              <h3 class="text-sm font-semibold text-gray-500 mb-2">File</h3>
              <div class="p-3 bg-gray-50 rounded-lg">
                @if (isImage()) {
                  <img
                    [src]="fileUrl()"
                    [alt]="entry()!.file!"
                    class="max-w-full max-h-64 rounded-lg shadow-sm cursor-pointer"
                  />
                } @else if (isAudio()) {
                  <audio controls [src]="fileUrl()" class="w-full"></audio>
                } @else {
                  <div class="flex items-center gap-2 text-gray-700">
                    <i class="pi pi-file"></i>
                    <span>{{ entry()!.file }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <div>
            <h3 class="text-sm font-semibold text-gray-500 mb-2">Model response</h3>
            <div class="p-3 bg-gray-50 rounded-lg">
              <p class="text-gray-900 whitespace-pre-wrap">{{ entry()!.answer }}</p>
            </div>
          </div>

          @if (entry()!.score !== null) {
            <div>
              <div class="flex items-center gap-4 mb-4">
                <span class="text-sm text-gray-600">Total score:</span>
                <span class="text-3xl font-bold" [class]="getScoreClass(entry()!.score!)">
                  {{ formatScore(entry()!.score!) }}
                </span>
              </div>

              @if (entry()!.scores && entry()!.scores!.length > 0) {
                <p-table [value]="entry()!.scores!" [tableStyle]="{ 'min-width': '100%' }">
                  <ng-template pTemplate="header">
                    <tr>
                      <th>Condition type</th>
                      <th class="text-center" style="width: 120px">Hard Score</th>
                      <th class="text-center" style="width: 120px">Soft Score</th>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="body" let-score>
                    <tr>
                      <td>{{ score.type }}</td>
                      <td>
                        <div class="flex justify-center">
                          <span
                            class="font-semibold px-2 py-1 rounded"
                            [class.bg-green-100]="score.hard_score >= 1"
                            [class.text-green-700]="score.hard_score >= 1"
                            [class.bg-red-100]="score.hard_score < 1"
                            [class.text-red-700]="score.hard_score < 1"
                          >
                            {{ formatScore(score.hard_score) }}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div class="flex justify-center">
                          <span
                            class="font-semibold px-2 py-1 rounded"
                            [class.bg-green-100]="score.soft_score >= 1"
                            [class.text-green-700]="score.soft_score >= 1"
                            [class.bg-red-100]="score.soft_score < 1"
                            [class.text-red-700]="score.soft_score < 1"
                          >
                            {{ formatScore(score.soft_score) }}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
              }
            </div>
          }
        </div>
      }

      <ng-template pTemplate="footer">
        <div class="flex justify-between gap-2">
          <div>
            @if (entry()?.task_id) {
              <p-button
                label="Edit question"
                icon="pi pi-pencil"
                severity="secondary"
                (onClick)="goToTask()"
              ></p-button>
            }
          </div>
          <p-button label="Close" (onClick)="visible.set(false)"></p-button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class EvaluationEntryDialogComponent {
  visible = model(false);
  entry = input<EvaluationEntry | null>(null);

  imageKey = signal(0);
  showImage = signal(true);

  constructor() {
    effect(() => {
      const currentEntry = this.entry();
      if (currentEntry) {
        this.showImage.set(false);
        this.imageKey.update(v => v + 1);
        setTimeout(() => this.showImage.set(true), 0);
      }
    });
  }

  fileUrl = computed(() => {
    const fileId = this.entry()?.file;
    if (!fileId) return '';
    return `/api/file/${fileId}/download?v=${this.imageKey()}`;
  });

  isImage = computed(() => {
    const fileId = this.entry()?.file;
    if (!fileId) return false;
    const ext = (fileId.split('.').pop() || '').toLowerCase();
    return IMAGE_EXT.has(ext);
  });

  isAudio = computed(() => {
    const fileId = this.entry()?.file;
    if (!fileId) return false;
    const ext = (fileId.split('.').pop() || '').toLowerCase();
    return AUDIO_EXT.has(ext);
  });

  goToTask() {
    const taskId = this.entry()?.task_id;
    if (taskId) {
      window.open('/tasks/' + taskId, '_blank');
    }
  }

  formatScore(score: number): string {
    return `${(score * 100).toFixed(0)}%`;
  }

  getScoreClass(score: number): string {
    if (score >= 1) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  }
}
