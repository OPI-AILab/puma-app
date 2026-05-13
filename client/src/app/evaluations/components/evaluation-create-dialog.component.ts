import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { EvaluationService } from '../services/evaluation.service';
import { CategoriesStore } from '../../tasks/store/categories.store';
import { validateJsonText } from '../utils/evaluation.utils';

@Component({
  selector: 'app-evaluation-create-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, InputTextModule, CheckboxModule],
  template: `
    <p-dialog
      header="New Evaluation"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [modal]="true"
      [closable]="true"
      [style]="{ width: '600px' }"
      (onHide)="close()"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="font-medium text-gray-700">Name (optional)</label>
          <input
            pInputText
            [(ngModel)]="name"
            [placeholder]="defaultName()"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="font-medium text-gray-700">Model Configuration (JSON)</label>
          <textarea
            [(ngModel)]="configText"
            rows="8"
            class="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='{"type": "remote", "model": "gpt-4o", "api_key": "$OPENAI_API_KEY"}'
            (input)="validateJson()"
          ></textarea>
          @if (jsonError()) {
            <span class="text-red-500 text-xs">{{ jsonError() }}</span>
          }
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex justify-between items-center">
            <label class="font-medium text-gray-700">Categories</label>
            <p-button
              [label]="allSelected() ? 'Deselect all' : 'Select all'"
              [text]="true"
              size="small"
              (onClick)="toggleAll()"
            ></p-button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            @for (cat of categoriesStore.categories(); track cat.name) {
              <div class="flex items-center gap-2">
                <p-checkbox
                  [(ngModel)]="selectedCategories"
                  [value]="cat.name"
                  [inputId]="'cat-' + cat.name"
                ></p-checkbox>
                <label [for]="'cat-' + cat.name" class="text-sm text-gray-700 cursor-pointer">
                  <span
                    class="inline-block w-3 h-3 rounded-full mr-1"
                    [style.background-color]="cat.primaryColor"
                  ></span>
                  {{ cat.name }}
                </label>
              </div>
            }
          </div>
        </div>

        @if (errorMessage()) {
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {{ errorMessage() }}
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <div class="flex justify-end gap-2">
          <p-button
            label="Cancel"
            [outlined]="true"
            (onClick)="close()"
            [disabled]="isLoading()"
          ></p-button>
          <p-button
            label="Create"
            icon="pi pi-plus"
            (onClick)="create()"
            [disabled]="!isValid()"
            [loading]="isLoading()"
          ></p-button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class EvaluationCreateDialogComponent {
  private readonly evaluationService = inject(EvaluationService);
  readonly categoriesStore = inject(CategoriesStore);

  created = output<void>();

  visible = signal(false);
  name = '';
  defaultName = signal('');
  configText = '';
  selectedCategories: string[] = [];

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  jsonError = signal<string | null>(null);

  allSelected(): boolean {
    return this.selectedCategories.length === this.categoriesStore.categories().length;
  }

  open(): void {
    this.visible.set(true);
    this.name = '';
    this.configText = '';
    this.selectedCategories = this.categoriesStore.categories().map(c => c.name);
    this.errorMessage.set(null);
    this.jsonError.set(null);
    this.isLoading.set(false);
  }

  openWithConfig(modelConfiguration: Record<string, any>, categories: string[]): void {
    this.visible.set(true);
    this.name = '';
    this.configText = JSON.stringify(modelConfiguration, null, 2);
    this.selectedCategories = [...categories];
    this.errorMessage.set(null);
    this.jsonError.set(null);
    this.isLoading.set(false);
  }

  close(): void {
    this.visible.set(false);
    this.errorMessage.set(null);
    this.jsonError.set(null);
  }

  toggleAll(): void {
    if (this.allSelected()) {
      this.selectedCategories = [];
    } else {
      this.selectedCategories = this.categoriesStore.categories().map(c => c.name);
    }
  }

  validateJson(): void {
    const { error, parsed } = validateJsonText(this.configText);
    this.jsonError.set(error);
    const modelId = parsed && typeof parsed === 'object' && parsed !== null ? (parsed as { id?: string }).id : null;
    this.updateDefaultName(modelId || null);
  }

  private updateDefaultName(modelId: string | null): void {
    this.defaultName.set(modelId || '');
  }

  isValid(): boolean {
    if (!this.configText.trim()) return false;
    if (this.jsonError()) return false;
    if (this.selectedCategories.length === 0) return false;
    if (this.isLoading()) return false;
    return true;
  }

  create(): void {
    if (!this.isValid()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const request = {
      name: this.name.trim() || this.defaultName() || undefined,
      model_configuration: JSON.parse(this.configText),
      categories: this.selectedCategories,
    };

    this.evaluationService.create(request).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.close();
        this.created.emit();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.error?.detail || error.error?.message || 'Failed to create evaluation'
        );
      },
    });
  }
}
