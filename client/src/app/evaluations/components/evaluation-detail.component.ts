import { Component, computed, inject, OnInit, OnDestroy, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { EvaluationService } from '../services/evaluation.service';
import { Evaluation, EvaluationEntry } from '../models/evaluation.models';
import { CategoriesStore } from '../../tasks/store/categories.store';
import { EvaluationEntryDialogComponent } from './evaluation-entry-dialog.component';
import { EvaluationCreateDialogComponent } from './evaluation-create-dialog.component';
import { EvaluationEditConfigDialogComponent } from './evaluation-edit-config-dialog.component';
import * as utils from '../utils/evaluation.utils';

interface CategorySummaryRow {
  name: string;
  scorePercent: number;
  softScorePercent: number | null;
  color: string;
  count: number;
}

@Component({
  selector: 'app-evaluation-detail',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    SkeletonModule,
    TooltipModule,
    ConfirmDialogModule,
    ToastModule,
    EvaluationEntryDialogComponent,
    EvaluationCreateDialogComponent,
    EvaluationEditConfigDialogComponent,
    RouterLink,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="container mx-auto px-4 py-6">
      @if (loading()) {
        <div class="space-y-4">
          <p-skeleton width="300px" height="2rem"></p-skeleton>
          <p-skeleton width="100%" height="400px"></p-skeleton>
        </div>
      } @else if (evaluation()) {
        <div class="mb-6">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h1 class="text-2xl font-bold text-gray-800">
                {{ utils.getEvaluationName(evaluation()!) }}
              </h1>
              <div class="flex items-center gap-3 mt-2">
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  [ngClass]="utils.getStatusClasses(evaluation()!.status)"
                >
                  {{ evaluation()!.status }}
                </span>
                <span class="text-sm text-gray-500">
                  Created: {{ utils.formatDate(evaluation()!.created_at) }}
                </span>
                @if (evaluation()!.created_by) {
                  <span class="text-sm text-gray-500">
                    by {{ evaluation()!.created_by }}
                  </span>
                }
                @if (evaluation()!.error_count > 0) {
                  <span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {{ evaluation()!.error_count }} {{ evaluation()!.error_count === 1 ? 'error' : 'errors' }}
                  </span>
                }
              </div>
            </div>
            <div class="flex gap-2 items-center">
              @if (evaluation()!.status === 'completed' && getScore()) {
                <div class="text-right mr-4">
                  <span class="text-sm text-gray-500">Total score:</span>
                  <span class="ml-2 text-lg font-semibold" [class]="utils.getScoreClass(getScore()!)">
                    {{ getScore() }}%
                  </span>
                  @if (getSoftScore()) {
                    <span class="ml-2 text-sm font-medium text-gray-500" pTooltip="Soft score" tooltipPosition="top">
                      / {{ getSoftScore() }}%
                    </span>
                  }
                </div>
              }
              @if (evaluation()!.status === 'pending') {
                <p-button
                  label="Start"
                  severity="success"
                  [outlined]="true"
                  (onClick)="startEvaluation()"
                ></p-button>
              }
              @if (evaluation()!.status === 'failed' || evaluation()!.status === 'cancelled') {
                <p-button
                  label="Resume"
                  severity="success"
                  [outlined]="true"
                  (onClick)="startEvaluation()"
                ></p-button>
              }
              @if (evaluation()!.status === 'running' || evaluation()!.status === 'cancelling') {
                <p-button
                  [label]="evaluation()!.status === 'cancelling' ? 'Cancelling...' : 'Cancel'"
                  severity="warn"
                  [outlined]="true"
                  [disabled]="evaluation()!.status === 'cancelling'"
                  (onClick)="cancelEvaluation()"
                ></p-button>
              }
              @if (canEditConfig()) {
                <p-button
                  label="Edit configuration"
                  icon="pi pi-pencil"
                  severity="secondary"
                  [outlined]="true"
                  (onClick)="openEditConfig()"
                ></p-button>
              }
              <p-button
                [label]="showSettings() ? 'Hide settings' : 'Show settings'"
                [icon]="showSettings() ? 'pi pi-eye-slash' : 'pi pi-eye'"
                severity="secondary"
                [outlined]="true"
                (onClick)="showSettings.set(!showSettings())"
              ></p-button>
              <p-button
                label="Duplicate"
                severity="secondary"
                [outlined]="true"
                (onClick)="openDuplicate()"
              ></p-button>
              <p-button
                label="Copy URL"
                severity="secondary"
                [outlined]="true"
                (onClick)="copyUrl()"
              ></p-button>
              @if (evaluation()!.category_scores) {
                <p-button
                  label="Copy results"
                  severity="secondary"
                  [outlined]="true"
                  (onClick)="copyResultsJson()"
                ></p-button>
              }
              @if (evaluation()!.status !== 'running' && evaluation()!.status !== 'cancelling') {
                <p-button
                  label="Delete"
                  severity="danger"
                  [outlined]="true"
                  (onClick)="confirmDelete($event)"
                ></p-button>
              }
            </div>
          </div>

          @if (evaluation()!.status !== 'pending' && evaluation()!.total_tasks > 0) {
            <div class="flex items-center gap-3 mb-4">
              <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  [ngClass]="evaluation()!.status === 'running' ? 'bg-blue-500' : evaluation()!.status === 'completed' ? 'bg-green-500' : 'bg-gray-400'"
                  [style.width.%]="getProgress()"
                ></div>
              </div>
              <span class="text-sm text-gray-600 whitespace-nowrap">
                {{ evaluation()!.completed_tasks }} / {{ evaluation()!.total_tasks }} tasks
              </span>
            </div>
          }

          @if (evaluation()!.error_message) {
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <div><span class="font-medium">Error:</span> {{ evaluation()!.error_message }}</div>
              @if (evaluation()!.error_task_id; as taskId) {
                <div class="mt-1">
                  Failed at task:
                  <a
                    [routerLink]="['/tasks', taskId]"
                    class="underline hover:text-red-900"
                    [pTooltip]="taskId"
                    tooltipPosition="top"
                  >{{ taskId.substring(0, 8) }}</a>
                </div>
              }
            </div>
          }

          @if (showSettings()) {
            <div class="border border-gray-200 rounded-lg bg-white p-4 mb-4 space-y-4">
              <div>
                <h3 class="text-sm font-semibold text-gray-500 mb-2">Categories</h3>
                @if (evaluation()!.categories?.length) {
                  <div class="flex flex-wrap gap-1">
                    @for (cat of evaluation()!.categories || []; track cat) {
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        [style.background-color]="getCategoryColors(cat).secondary"
                        [style.color]="getCategoryColors(cat).primary"
                      >
                        {{ cat }}
                      </span>
                    }
                  </div>
                } @else {
                  <span class="text-sm text-gray-400">No categories</span>
                }
              </div>

              <div>
                <h3 class="text-sm font-semibold text-gray-500 mb-2">Model configuration</h3>
                @if (evaluation()!.model_configuration) {
                  <pre class="p-3 bg-gray-50 rounded-lg font-mono text-xs text-gray-800 overflow-x-auto whitespace-pre">{{ formattedConfig() }}</pre>
                } @else {
                  <span class="text-sm text-gray-400">No configuration</span>
                }
              </div>
            </div>
          }
        </div>

        @if (categorySummary().length > 0) {
          <div class="mb-4">
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              @for (row of categorySummary(); track row.name) {
                <div class="border border-gray-200 rounded-lg bg-white p-3">
                  <div class="flex items-center gap-2 mb-2">
                    <span
                      class="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      [style.background-color]="row.color"
                    ></span>
                    <span
                      class="text-sm font-semibold text-gray-800 truncate"
                      [title]="row.name"
                    >
                      {{ row.name }}
                    </span>
                  </div>
                  <div class="flex items-baseline gap-2">
                    <div class="text-2xl font-bold">
                      {{ row.scorePercent.toFixed(2) }}%
                    </div>
                    @if (row.softScorePercent !== null) {
                      <div class="text-sm font-medium text-gray-500" pTooltip="Soft score" tooltipPosition="top">
                        / {{ row.softScorePercent.toFixed(2) }}%
                      </div>
                    }
                  </div>
                  @if (loadingEntries()) {
                    <p-skeleton width="4rem" height="1rem"></p-skeleton>
                  } @else {
                    <div class="text-xs text-gray-500 mt-1">
                      {{ row.count }} {{ row.count === 1 ? 'entry' : 'entries' }}
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }

        <p-card>
          <div class="text-sm text-gray-600 font-semibold mb-2">
            Total: {{ entries().length }} {{ entries().length === 1 ? 'entry' : 'entries' }}
          </div>

          <p-table
            [value]="entries()"
            [loading]="loadingEntries()"
            [tableStyle]="{ 'min-width': '50rem' }"
            selectionMode="single"
            (onRowSelect)="onRowClick($event.data)"
          >
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 40px">#</th>
                <th style="width: 40px">Category</th>
                <th style="width: 45%">Question</th>
                <th style="width: 45%">Answer</th>
                <th style="width: 60px">Score</th>
                <th style="width: 60px">Error</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-entry let-rowIndex="rowIndex">
              <tr
                class="cursor-pointer hover:bg-gray-50"
                [class.bg-red-50]="entry.score !== null && entry.score < 1"
                [class.hover:bg-red-100]="entry.score !== null && entry.score < 1"
                (click)="onRowClick(entry)"
              >
                <td>
                  <span class="text-sm text-gray-600">{{ getRowNumber(rowIndex) }}</span>
                </td>
                <td>
                  <div class="flex items-center justify-center">
                    <div
                      class="w-6 h-6 rounded-full border-2 border-gray-300"
                      [style.background-color]="getCategoryColor(entry.category)"
                      [pTooltip]="entry.category || ''"
                      tooltipPosition="top"
                    ></div>
                  </div>
                </td>
                <td>
                  <div class="flex flex-col gap-1">
                    <span class="text-sm text-gray-900 line-clamp-2">
                      {{ truncateText(entry.question, 100) }}
                    </span>
                    @if (entry.file) {
                      <div class="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md text-xs max-w-fit">
                        <i [ngClass]="utils.getFileIconClass(entry.file)"></i>
                        <span class="truncate max-w-32">{{ entry.file }}</span>
                      </div>
                    }
                  </div>
                </td>
                <td>
                  <span class="text-sm text-gray-700 line-clamp-3">
                    {{ truncateText(entry.answer, 150) }}
                  </span>
                </td>
                <td>
                  <div class="flex items-center justify-center">
                    @if (entry.score !== null) {
                      <span class="font-semibold" [class]="getEntryScoreClass(entry.score)">
                        {{ formatEntryScore(entry.score) }}
                      </span>
                    } @else {
                      <span class="text-gray-400">-</span>
                    }
                  </div>
                </td>
                <td>
                  @if (entry.error) {
                    <i class="pi pi-exclamation-triangle text-red-500" [pTooltip]="entry.error" tooltipPosition="left"></i>
                  }
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="6" class="py-8">
                  <div class="text-gray-500 text-center">
                    <i class="pi pi-info-circle text-3xl mb-2"></i>
                    <p>No entries yet</p>
                  </div>
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="loadingbody">
              @for (item of [1, 2, 3, 4, 5]; track item) {
                <tr>
                  <td><p-skeleton width="30px" height="1.5rem"></p-skeleton></td>
                  <td><p-skeleton shape="circle" size="1.5rem"></p-skeleton></td>
                  <td><p-skeleton width="100%" height="1.5rem"></p-skeleton></td>
                  <td><p-skeleton width="100%" height="1.5rem"></p-skeleton></td>
                  <td><p-skeleton width="60px" height="1.5rem"></p-skeleton></td>
                  <td><p-skeleton width="30px" height="1.5rem"></p-skeleton></td>
                </tr>
              }
            </ng-template>
          </p-table>
        </p-card>
      } @else {
        <div class="text-center text-gray-500 py-8">
          <i class="pi pi-exclamation-circle text-4xl mb-4"></i>
          <p>Evaluation not found</p>
        </div>
      }

      <p-confirmDialog></p-confirmDialog>
      <p-toast></p-toast>

      <app-evaluation-create-dialog (created)="onEvaluationCreated()"></app-evaluation-create-dialog>

      <app-evaluation-edit-config-dialog (saved)="onConfigSaved()"></app-evaluation-edit-config-dialog>

      <app-evaluation-entry-dialog
        [(visible)]="dialogVisible"
        [entry]="selectedEntry()"
      ></app-evaluation-entry-dialog>
    </div>
  `,
})
export class EvaluationDetailComponent implements OnInit, OnDestroy {
  private readonly evaluationService = inject(EvaluationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly categoriesStore = inject(CategoriesStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly createDialog = viewChild(EvaluationCreateDialogComponent);
  readonly editConfigDialog = viewChild(EvaluationEditConfigDialogComponent);

  evaluationId = signal<string>('');
  evaluation = signal<Evaluation | null>(null);
  entries = signal<EvaluationEntry[]>([]);
  loading = signal(false);
  loadingEntries = signal(false);
  selectedEntry = signal<EvaluationEntry | null>(null);
  dialogVisible = signal(false);
  showSettings = signal(false);

  formattedConfig = computed(() => {
    const config = this.evaluation()?.model_configuration;
    return config ? JSON.stringify(config, null, 2) : '';
  });

  private readonly entryCountsByCategory = computed<Map<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const entry of this.entries()) {
      const cat = entry.category;
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  });

  readonly categorySummary = computed<CategorySummaryRow[]>(() => {
    const scores = this.evaluation()?.category_scores;
    if (!scores) return [];
    const counts = this.entryCountsByCategory();
    const rows: CategorySummaryRow[] = [];
    for (const category of this.categoriesStore.categories()) {
      const raw = scores[category.name];
      if (raw === undefined) continue;
      const parsed = parseFloat(raw);
      if (Number.isNaN(parsed)) continue;
      const rawSoft = scores[`${category.name}_soft`];
      const parsedSoft = rawSoft !== undefined ? parseFloat(rawSoft) : NaN;
      rows.push({
        name: category.name,
        scorePercent: parsed,
        softScorePercent: Number.isNaN(parsedSoft) ? null : parsedSoft,
        color: category.primaryColor,
        count: counts.get(category.name) ?? 0,
      });
    }
    return rows;
  });

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.evaluationId.set(id);
        this.loadEvaluation();
      }
    });
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private loadEvaluation() {
    this.loading.set(true);
    this.evaluationService.get(this.evaluationId()).subscribe({
      next: (evaluation) => {
        this.evaluation.set(evaluation);
        this.loading.set(false);
        this.loadEntries();
        this.updatePolling();
      },
      error: () => {
        this.evaluation.set(null);
        this.loading.set(false);
      },
    });
  }

  private updatePolling() {
    const status = this.evaluation()?.status;
    const isActive = status === 'running' || status === 'cancelling';
    if (isActive && !this.pollingInterval) {
      this.pollingInterval = setInterval(() => this.pollEvaluation(), 3000);
    } else if (!isActive && this.pollingInterval) {
      this.stopPolling();
    }
  }

  private pollEvaluation() {
    this.evaluationService.get(this.evaluationId()).subscribe({
      next: (evaluation) => {
        const prevStatus = this.evaluation()?.status;
        const wasActive = prevStatus === 'running' || prevStatus === 'cancelling';
        const isActive = evaluation.status === 'running' || evaluation.status === 'cancelling';
        this.evaluation.set(evaluation);
        this.updatePolling();
        if (wasActive && !isActive) {
          this.loadEntries();
        }
      },
    });
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  loadEntries() {
    this.loadingEntries.set(true);
    this.evaluationService.getEntries(this.evaluationId(), 1, 10000).subscribe({
      next: (response) => {
        this.entries.set(response.entries);
        this.loadingEntries.set(false);
      },
      error: () => {
        this.loadingEntries.set(false);
      },
    });
  }

  onRowClick(entry: EvaluationEntry | EvaluationEntry[] | undefined) {
    if (!entry || Array.isArray(entry)) return;
    this.selectedEntry.set(entry);
    this.dialogVisible.set(true);
  }

  startEvaluation() {
    this.evaluationService.start(this.evaluationId()).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Started', detail: 'Evaluation started' });
        this.loadEvaluation();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.detail || 'Failed to start evaluation',
        });
      },
    });
  }

  cancelEvaluation() {
    this.evaluationService.cancel(this.evaluationId()).subscribe({
      next: () => {
        this.messageService.add({ severity: 'info', summary: 'Cancelled', detail: 'Evaluation cancelled' });
        this.loadEvaluation();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.detail || 'Failed to cancel evaluation',
        });
      },
    });
  }

  confirmDelete(event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Are you sure you want to delete this evaluation?',
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => {
        this.evaluationService.delete(this.evaluationId()).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Evaluation deleted' });
            this.router.navigate(['/evaluations']);
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete evaluation' });
          },
        });
      },
    });
  }

  openDuplicate() {
    const eval_ = this.evaluation();
    if (eval_?.model_configuration && eval_?.categories) {
      this.createDialog()?.openWithConfig(eval_.model_configuration, eval_.categories);
    }
  }

  canEditConfig(): boolean {
    const status = this.evaluation()?.status;
    return status === 'pending' || status === 'failed' || status === 'cancelled';
  }

  openEditConfig() {
    const eval_ = this.evaluation();
    if (eval_) {
      this.editConfigDialog()?.open(eval_);
    }
  }

  onConfigSaved() {
    this.loadEvaluation();
  }

  onEvaluationCreated() {
    this.router.navigate(['/evaluations']);
  }

  copyResultsJson() {
    const scores = this.evaluation()?.category_scores;
    if (!scores) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No data',
        detail: 'No results available to copy',
      });
      return;
    }

    const json = JSON.stringify(scores);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json)
        .then(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Copied',
            detail: 'Results JSON copied to clipboard',
          });
        })
        .catch((err) => {
          console.error('Error copying to clipboard:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to copy results to clipboard',
          });
        });
    } else {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = json;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (successful) {
          this.messageService.add({
            severity: 'success',
            summary: 'Copied',
            detail: 'Results JSON copied to clipboard',
          });
        } else {
          throw new Error('execCommand failed');
        }
      } catch (err) {
        console.error('Error copying to clipboard:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to copy results to clipboard',
        });
      }
    }
  }

  copyUrl() {
    const url = window.location.href;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Copied',
            detail: 'URL copied to clipboard'
          });
        })
        .catch((err) => {
          console.error('Error copying to clipboard:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to copy URL to clipboard'
          });
        });
    } else {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (successful) {
          this.messageService.add({
            severity: 'success',
            summary: 'Copied',
            detail: 'URL copied to clipboard'
          });
        } else {
          throw new Error('execCommand failed');
        }
      } catch (err) {
        console.error('Error copying to clipboard:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to copy URL to clipboard'
        });
      }
    }
  }

  getProgress(): number {
    const eval_ = this.evaluation();
    if (!eval_ || eval_.total_tasks === 0) return 0;
    return (eval_.completed_tasks / eval_.total_tasks) * 100;
  }

  getScore(): string | null {
    const total = this.evaluation()?.category_scores?.['total'];
    if (!total) return null;
    return parseFloat(total).toFixed(1);
  }

  getSoftScore(): string | null {
    const total = this.evaluation()?.category_scores?.['total_soft'];
    if (!total) return null;
    return parseFloat(total).toFixed(1);
  }

  protected readonly utils = utils;

  getRowNumber(index: number): number {
    return index + 1;
  }

  getCategoryColor(categoryName: string | null): string {
    if (!categoryName) return '#808080';
    return this.categoriesStore.getCategoryColor(categoryName).primary;
  }

  getCategoryColors(categoryName: string): { primary: string; secondary: string } {
    return this.categoriesStore.getCategoryColor(categoryName);
  }

  formatEntryScore(score: number): string {
    return `${(score * 100).toFixed(0)}%`;
  }

  getEntryScoreClass(score: number): string {
    if (score >= 1) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  }

  truncateText(text: string | null, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
