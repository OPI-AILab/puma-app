import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { LogService } from '../services/log.service';

@Component({
  selector: 'app-log-import-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  template: `
    <p-dialog
      header="Import logs"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [modal]="true"
      [closable]="true"
      [style]="{ width: '450px' }"
      (onHide)="close()"
    >
      <div class="flex flex-col gap-4">
        <p class="text-gray-600 text-sm">
          Import a JSONL log file. Each line should contain one log entry.
        </p>

        <div class="flex flex-col gap-2">
          <label class="font-medium text-gray-700">Choose file</label>
          <div class="flex items-center gap-2">
            <input
              type="file"
              accept=".jsonl,.txt"
              (change)="onFileSelected($event)"
              #fileInput
              class="hidden"
            />
            <p-button
              label="Choose file"
              icon="pi pi-folder-open"
              [outlined]="true"
              (onClick)="fileInput.click()"
            ></p-button>
            <span class="text-sm text-gray-600 truncate max-w-[200px]">
              {{ selectedFile()?.name || 'No file selected' }}
            </span>
          </div>
        </div>

        @if (errorMessage()) {
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
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
            label="Import"
            icon="pi pi-upload"
            (onClick)="importLogs()"
            [disabled]="!selectedFile() || isLoading()"
            [loading]="isLoading()"
          ></p-button>
        </div>
      </ng-template>
    </p-dialog>
  `
})
export class LogImportDialogComponent {
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);

  visible = signal(false);
  selectedFile = signal<File | null>(null);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  open(): void {
    this.visible.set(true);
    this.selectedFile.set(null);
    this.errorMessage.set(null);
    this.isLoading.set(false);
  }

  close(): void {
    this.visible.set(false);
    this.selectedFile.set(null);
    this.errorMessage.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const validExtensions = ['.jsonl', '.txt'];
      const hasValidExtension = validExtensions.some(ext =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (!hasValidExtension) {
        this.errorMessage.set('Invalid file format. Allowed formats: .jsonl, .txt');
        this.selectedFile.set(null);
        return;
      }

      this.errorMessage.set(null);
      this.selectedFile.set(file);
    }
  }

  importLogs(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.logService.importLogs(file).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.close();
        this.router.navigate(['/logs', response.import_id]);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.error?.detail ||
          error.error?.message ||
          'An error occurred while importing logs'
        );
      }
    });
  }
}
