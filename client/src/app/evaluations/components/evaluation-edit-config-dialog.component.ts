import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { Evaluation } from '../models/evaluation.models';
import { EvaluationService } from '../services/evaluation.service';
import { validateJsonText } from '../utils/evaluation.utils';

@Component({
  selector: 'app-evaluation-edit-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule],
  template: `
    <p-dialog
      header="Edit configuration"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [modal]="true"
      [closable]="true"
      [style]="{ width: '600px' }"
      (onHide)="close()"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="font-medium text-gray-700">Model configuration (JSON)</label>
          <textarea
            [(ngModel)]="configText"
            rows="10"
            class="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='{"type": "remote", "model": "gpt-4o", "api_key": "$OPENAI_API_KEY"}'
            (input)="validateJson()"
          ></textarea>
          @if (jsonError()) {
            <span class="text-red-500 text-xs">{{ jsonError() }}</span>
          }
        </div>

        @if (hasEntries()) {
          <div class="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded text-sm">
            <i class="pi pi-info-circle mr-1"></i>
            Existing entries ({{ evaluation()!.completed_tasks }}/{{ evaluation()!.total_tasks }}) keep their previous scores when continuing.
          </div>
        }

        @if (errorMessage()) {
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {{ errorMessage() }}
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <div class="flex justify-end gap-2 flex-wrap">
          <p-button
            label="Cancel"
            [outlined]="true"
            severity="secondary"
            (onClick)="close()"
            [disabled]="isLoading()"
          ></p-button>
          <p-button
            label="Save"
            icon="pi pi-save"
            [outlined]="true"
            (onClick)="save()"
            [disabled]="!isValid()"
            [loading]="isLoading()"
          ></p-button>
          @if (hasEntries()) {
            <p-button
              label="Save & Continue"
              icon="pi pi-play"
              (onClick)="saveAndContinue()"
              [disabled]="!isValid()"
              [loading]="isLoading()"
            ></p-button>
            <p-button
              label="Save & Restart"
              icon="pi pi-refresh"
              severity="warn"
              (onClick)="saveAndRestart()"
              [disabled]="!isValid()"
              [loading]="isLoading()"
            ></p-button>
          } @else {
            <p-button
              label="Save & Start"
              icon="pi pi-play"
              (onClick)="saveAndStart()"
              [disabled]="!isValid()"
              [loading]="isLoading()"
            ></p-button>
          }
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class EvaluationEditConfigDialogComponent {
  private readonly evaluationService = inject(EvaluationService);
  private readonly messageService = inject(MessageService);

  saved = output<void>();

  visible = signal(false);
  configText = '';
  evaluation = signal<Evaluation | null>(null);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  jsonError = signal<string | null>(null);

  hasEntries(): boolean {
    return (this.evaluation()?.completed_tasks ?? 0) > 0;
  }

  open(evaluation: Evaluation): void {
    this.evaluation.set(evaluation);
    this.configText = evaluation.model_configuration
      ? JSON.stringify(evaluation.model_configuration, null, 2)
      : '';
    this.errorMessage.set(null);
    this.jsonError.set(null);
    this.isLoading.set(false);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
    this.errorMessage.set(null);
    this.jsonError.set(null);
  }

  validateJson(): void {
    this.jsonError.set(validateJsonText(this.configText).error);
  }

  isValid(): boolean {
    if (!this.configText.trim()) return false;
    if (this.jsonError()) return false;
    if (this.isLoading()) return false;
    return true;
  }

  save(): void {
    this.runUpdate(null);
  }

  saveAndContinue(): void {
    this.runUpdate(false);
  }

  saveAndRestart(): void {
    this.runUpdate(true);
  }

  saveAndStart(): void {
    this.runUpdate(true);
  }

  private runUpdate(startReset: boolean | null): void {
    if (!this.isValid()) return;
    const id = this.evaluation()?.id;
    if (!id) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const config = JSON.parse(this.configText);

    this.evaluationService.updateConfiguration(id, config).subscribe({
      next: () => {
        if (startReset === null) {
          this.finishSuccess('Configuration saved');
          return;
        }
        this.evaluationService.start(id, startReset).subscribe({
          next: () => {
            this.finishSuccess(startReset ? 'Restarted' : 'Continued');
          },
          error: (err) => {
            this.isLoading.set(false);
            const detail = err?.error?.detail || 'Failed to start evaluation';
            this.errorMessage.set(detail);
            this.messageService.add({ severity: 'error', summary: 'Error', detail });
            this.saved.emit();
          },
        });
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err?.error?.detail || 'Failed to save configuration';
        this.errorMessage.set(detail);
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
      },
    });
  }

  private finishSuccess(detail: string): void {
    this.isLoading.set(false);
    this.messageService.add({ severity: 'success', summary: 'Saved', detail });
    this.saved.emit();
    this.close();
  }
}
