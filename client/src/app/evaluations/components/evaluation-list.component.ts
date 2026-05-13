import { Component, inject, OnInit, OnDestroy, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { EvaluationService } from '../services/evaluation.service';
import { Evaluation } from '../models/evaluation.models';
import { EvaluationCreateDialogComponent } from './evaluation-create-dialog.component';
import { CategoriesStore } from '../../tasks/store/categories.store';
import * as utils from '../utils/evaluation.utils';

@Component({
  selector: 'app-evaluation-list',
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
    EvaluationCreateDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="container mx-auto px-4 py-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">Evaluations</h1>
        <p-button
          label="New Evaluation"
          icon="pi pi-plus"
          (onClick)="openCreateDialog()"
        ></p-button>
      </div>

      <p-card>
        <p-table
          [value]="evaluations()"
          [loading]="loading()"
          [tableStyle]="{ 'min-width': '60rem' }"
          [paginator]="false"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Name</th>
              <th>Categories</th>
              <th style="width: 120px">Status</th>
              <th style="width: 180px">Progress</th>
              <th style="width: 100px">Score</th>
              <th style="width: 140px">Created</th>
              <th style="width: 200px">Actions</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-evaluation>
            <tr
              class="cursor-pointer hover:bg-gray-50"
              (click)="goToDetail(evaluation)"
            >
              <td>
                <span class="font-medium text-gray-900">
                  {{ utils.getEvaluationName(evaluation) }}
                </span>
              </td>
              <td>
                <div class="flex flex-wrap gap-1">
                  @for (cat of evaluation.categories || []; track cat) {
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      [style.background-color]="getCategoryColor(cat).secondary"
                      [style.color]="getCategoryColor(cat).primary"
                    >
                      {{ cat }}
                    </span>
                  }
                </div>
              </td>
              <td>
                <span
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  [ngClass]="utils.getStatusClasses(evaluation.status)"
                >
                  {{ evaluation.status }}
                </span>
              </td>
              <td>
                @if (evaluation.status !== 'pending') {
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-300"
                        [ngClass]="evaluation.status === 'running' ? 'bg-blue-500' : evaluation.status === 'completed' ? 'bg-green-500' : 'bg-gray-400'"
                        [style.width.%]="getProgress(evaluation)"
                      ></div>
                    </div>
                    <span class="text-xs text-gray-500 whitespace-nowrap">
                      {{ evaluation.completed_tasks }}/{{ evaluation.total_tasks }}
                    </span>
                  </div>
                }
              </td>
              <td>
                @if (evaluation.status === 'completed' && getScore(evaluation)) {
                  <span class="font-semibold" [class]="utils.getScoreClass(getScore(evaluation)!)">
                    {{ getScore(evaluation) }}%
                  </span>
                } @else {
                  <span class="text-gray-400">-</span>
                }
              </td>
              <td>
                <span class="text-sm text-gray-500">
                  {{ utils.formatDate(evaluation.created_at) }}
                </span>
              </td>
              <td>
                <div class="flex gap-2" (click)="$event.stopPropagation()">
                  <p-button
                    label="View"
                    severity="secondary"
                    [outlined]="true"
                    (onClick)="goToDetail(evaluation)"
                  ></p-button>
                  @if (evaluation.status === 'running' || evaluation.status === 'cancelling') {
                    <p-button
                      [label]="evaluation.status === 'cancelling' ? 'Cancelling...' : 'Cancel'"
                      severity="warn"
                      [outlined]="true"
                      [disabled]="evaluation.status === 'cancelling'"
                      (onClick)="cancelEvaluation(evaluation)"
                    ></p-button>
                  }
                  @if (evaluation.status === 'failed' || evaluation.status === 'cancelled') {
                    <p-button
                      label="Resume"
                      severity="success"
                      [outlined]="true"
                      (onClick)="startEvaluation(evaluation)"
                    ></p-button>
                  }
                  @if (evaluation.status === 'pending') {
                    <p-button
                      label="Start"
                      severity="success"
                      [outlined]="true"
                      (onClick)="startEvaluation(evaluation)"
                    ></p-button>
                  }
                  @if (evaluation.status !== 'running' && evaluation.status !== 'cancelling') {
                    <p-button
                      label="Delete"
                      severity="danger"
                      [outlined]="true"
                      (onClick)="confirmDelete($event, evaluation)"
                    ></p-button>
                  }
                </div>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="7" class="py-8">
                <div class="text-gray-500 text-center">
                  <i class="pi pi-inbox text-3xl mb-2"></i>
                  <p>No evaluations yet</p>
                </div>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="loadingbody">
            @for (item of [1, 2, 3]; track item) {
              <tr>
                <td><p-skeleton width="200px" height="1.5rem"></p-skeleton></td>
                <td><p-skeleton width="150px" height="1.5rem"></p-skeleton></td>
                <td><p-skeleton width="80px" height="1.5rem"></p-skeleton></td>
                <td><p-skeleton width="100%" height="1.5rem"></p-skeleton></td>
                <td><p-skeleton width="60px" height="1.5rem"></p-skeleton></td>
                <td><p-skeleton width="100px" height="1.5rem"></p-skeleton></td>
                <td><p-skeleton width="120px" height="1.5rem"></p-skeleton></td>
              </tr>
            }
          </ng-template>
        </p-table>
      </p-card>

      <app-evaluation-create-dialog (created)="loadEvaluations()"></app-evaluation-create-dialog>
      <p-confirmDialog></p-confirmDialog>
      <p-toast></p-toast>
    </div>
  `,
})
export class EvaluationListComponent implements OnInit, OnDestroy {
  private readonly evaluationService = inject(EvaluationService);
  private readonly router = inject(Router);
  private readonly categoriesStore = inject(CategoriesStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly createDialog = viewChild(EvaluationCreateDialogComponent);

  evaluations = signal<Evaluation[]>([]);
  loading = signal(false);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.loadEvaluations();
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  loadEvaluations() {
    this.loading.set(true);
    this.evaluationService.getList(1, 100).subscribe({
      next: (response) => {
        this.evaluations.set(response.evaluations);
        this.loading.set(false);
        this.updatePolling();
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private updatePolling() {
    const hasActive = this.evaluations().some(e => e.status === 'running' || e.status === 'cancelling');
    if (hasActive && !this.pollingInterval) {
      this.pollingInterval = setInterval(() => this.pollEvaluations(), 3000);
    } else if (!hasActive && this.pollingInterval) {
      this.stopPolling();
    }
  }

  private pollEvaluations() {
    this.evaluationService.getList(1, 100).subscribe({
      next: (response) => {
        this.evaluations.set(response.evaluations);
        this.updatePolling();
      },
    });
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  openCreateDialog() {
    this.createDialog()?.open();
  }

  goToDetail(evaluation: Evaluation) {
    this.router.navigate(['/evaluations', evaluation.id]);
  }

  startEvaluation(evaluation: Evaluation) {
    this.evaluationService.start(evaluation.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Started', detail: 'Evaluation started' });
        this.loadEvaluations();
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

  cancelEvaluation(evaluation: Evaluation) {
    this.evaluationService.cancel(evaluation.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'info', summary: 'Cancelled', detail: 'Evaluation cancelled' });
        this.loadEvaluations();
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

  confirmDelete(event: Event, evaluation: Evaluation) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Are you sure you want to delete this evaluation?',
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', outlined: true },
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      accept: () => {
        this.evaluationService.delete(evaluation.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Evaluation deleted' });
            this.loadEvaluations();
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete evaluation' });
          },
        });
      },
    });
  }

  getCategoryColor(categoryName: string): { primary: string; secondary: string } {
    return this.categoriesStore.getCategoryColor(categoryName);
  }

  protected readonly utils = utils;

  getProgress(evaluation: Evaluation): number {
    if (evaluation.total_tasks === 0) return 0;
    return (evaluation.completed_tasks / evaluation.total_tasks) * 100;
  }

  getScore(evaluation: Evaluation): string | null {
    const total = evaluation.category_scores?.['total'];
    if (!total) return null;
    return parseFloat(total).toFixed(1);
  }

}
