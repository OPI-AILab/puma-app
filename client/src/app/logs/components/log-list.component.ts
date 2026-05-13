import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { LogService } from '../services/log.service';
import { LogImport, LogEntry } from '../models/log.models';
import { CategoriesStore } from '../../tasks/store/categories.store';
import { LogEntryDialogComponent } from './log-entry-dialog.component';

@Component({
  selector: 'app-log-list',
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
    DialogModule,
    LogEntryDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="container mx-auto px-4 py-6">
      @if (loading()) {
        <div class="space-y-4">
          <p-skeleton width="300px" height="2rem"></p-skeleton>
          <p-skeleton width="100%" height="400px"></p-skeleton>
        </div>
      } @else if (logImport()) {
        <div class="mb-6">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h1 class="text-2xl font-bold text-gray-800">{{ logImport()!.name }}</h1>
              <p class="text-sm text-gray-500 mt-1">
                Created: {{ formatDate(logImport()!.created_at) }}
              </p>
            </div>
            <div class="flex gap-2 items-center">
              <div class="text-right mr-4">
                <span class="text-sm text-gray-500">Average score:</span>
                <span class="ml-2 text-lg font-semibold" [class]="getScoreClass(logImport()!.avg_score)">
                  {{ formatScore(logImport()!.avg_score) }}
                </span>
              </div>
              <p-button
                icon="pi pi-copy"
                label="Copy URL"
                severity="secondary"
                size="small"
                (onClick)="copyUrl()"
              ></p-button>
              <p-button
                icon="pi pi-trash"
                label="Delete"
                severity="danger"
                size="small"
                (onClick)="confirmDelete($event)"
              ></p-button>
            </div>
          </div>
        </div>

        <p-card>
          <div class="text-sm text-gray-600 font-semibold mb-2">
            Total: {{ totalEntries() }} {{ totalEntries() === 1 ? 'entry' : 'entries' }}
          </div>

          <p-table
            [value]="entries()"
            [lazy]="true"
            [paginator]="true"
            [rows]="pageSize"
            [totalRecords]="totalEntries()"
            [loading]="loadingEntries()"
            (onLazyLoad)="loadEntriesLazy($event)"
            [tableStyle]="{ 'min-width': '50rem' }"
            [rowsPerPageOptions]="[25, 50, 100]"
            selectionMode="single"
            (onRowSelect)="onRowClick($event.data)"
          >
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 40px">#</th>
                <th style="width: 40px">Category</th>
                <th style="width: 50%">Question</th>
                <th style="width: 50%">Answer</th>
                <th style="width: 40px">Score</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-entry let-rowIndex="rowIndex">
              <tr
                class="cursor-pointer hover:bg-gray-50"
                [class.bg-red-50]="entry.score < 1"
                [class.hover:bg-red-100]="entry.score < 1"
                (click)="onRowClick(entry)"
              >
                <td>
                  <div class="flex items-center justify-center">
                    <span class="text-sm text-gray-600">{{ getRowNumber(rowIndex) }}</span>
                  </div>
                </td>
                <td>
                  <div class="flex items-center justify-center">
                    <div
                      class="w-6 h-6 rounded-full border-2 border-gray-300"
                      [style.background-color]="getCategoryColor(entry.category)"
                      [pTooltip]="entry.category"
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
                      <div
                        class="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md text-xs max-w-fit"
                      >
                        <i [ngClass]="getFileIconClass(entry.file)"></i>
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
                    <span
                      class="font-semibold"
                      [class]="getScoreClass(entry.score)"
                    >
                      {{ formatScore(entry.score) }}
                    </span>
                  </div>
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="5" class="py-8">
                  <div class="text-gray-500 text-center">
                    <i class="pi pi-info-circle text-3xl mb-2"></i>
                    <p>No entries</p>
                  </div>
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="loadingbody">
              @for (item of [1, 2, 3, 4, 5]; track item) {
                <tr>
                  <td>
                    <p-skeleton width="30px" height="1.5rem"></p-skeleton>
                  </td>
                  <td>
                    <p-skeleton shape="circle" size="1.5rem"></p-skeleton>
                  </td>
                  <td>
                    <p-skeleton width="100%" height="1.5rem"></p-skeleton>
                  </td>
                  <td>
                    <p-skeleton width="100%" height="1.5rem"></p-skeleton>
                  </td>
                  <td>
                    <p-skeleton width="60px" height="1.5rem"></p-skeleton>
                  </td>
                </tr>
              }
            </ng-template>
          </p-table>
        </p-card>
      } @else {
        <div class="text-center text-gray-500 py-8">
          <i class="pi pi-exclamation-circle text-4xl mb-4"></i>
          <p>Log set not found</p>
        </div>
      }

      <p-confirmDialog></p-confirmDialog>
      <p-toast></p-toast>

      <app-log-entry-dialog
        [(visible)]="dialogVisible"
        [entry]="selectedEntry()"
      ></app-log-entry-dialog>
    </div>
  `,
})
export class LogListComponent implements OnInit {
  private readonly logService = inject(LogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly categoriesStore = inject(CategoriesStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  importId = signal<string>('');
  logImport = signal<LogImport | null>(null);
  entries = signal<LogEntry[]>([]);
  loading = signal(false);
  loadingEntries = signal(false);
  totalEntries = signal(0);


  selectedEntry = signal<LogEntry | null>(null);
  dialogVisible = signal(false);

  readonly pageSize = 25;

  private readonly imageExt = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
  private readonly audioExt = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['importId'];
      if (id) {
        this.importId.set(id);
        this.loadImport();
      }
    });
  }

  private loadImport() {
    this.loading.set(true);
    this.logService.getLogImport(this.importId()).subscribe({
      next: (logImport) => {
        this.logImport.set(logImport);
        this.totalEntries.set(logImport.total_entries);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading log import:', err);
        this.loading.set(false);
      }
    });
  }

  loadEntriesLazy(event: any) {
    this.loadingEntries.set(true);
    const page = Math.floor((event.first || 0) / (event.rows || this.pageSize)) + 1;
    const limit = event.rows || this.pageSize;

    this.logService.getLogEntries(this.importId(), page, limit).subscribe({
      next: (response) => {
        this.entries.set(response.entries);
        this.totalEntries.set(response.total);
        this.loadingEntries.set(false);
      },
      error: (err) => {
        console.error('Error loading log entries:', err);
        this.loadingEntries.set(false);
      }
    });
  }

  onRowClick(entry: LogEntry | LogEntry[] | undefined) {
    if (!entry || Array.isArray(entry)) return;
    this.selectedEntry.set(entry);
    this.dialogVisible.set(true);
  }

  getRowNumber(index: number): number {
    return index + 1;
  }

  getCategoryColor(categoryName: string): string {
    const colors = this.categoriesStore.getCategoryColor(categoryName);
    return colors.primary;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatScore(score: number): string {
    return `${(score * 100).toFixed(0)}%`;
  }

  getScoreClass(score: number): string {
    if (score >= 1) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  }

  truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  getFileIconClass(fileId?: string): string {
    if (!fileId) return 'pi pi-file text-gray-600';
    const ext = (fileId.split('.').pop() || '').toLowerCase();
    if (this.imageExt.has(ext)) return 'pi pi-image text-emerald-600';
    if (this.audioExt.has(ext)) return 'pi pi-volume-up text-blue-600';
    return 'pi pi-file text-gray-600';
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

  confirmDelete(event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Are you sure you want to delete this log set?',
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: 'Cancel',
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      acceptButtonProps: {
        label: 'Delete',
        severity: 'danger',
      },
      accept: () => {
        this.deleteImport();
      }
    });
  }

  private deleteImport() {
    this.logService.deleteLogImport(this.importId()).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Log set deleted successfully'
        });
        this.router.navigate(['/tasks']);
      },
      error: (err) => {
        console.error('Error deleting log import:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete log set'
        });
      }
    });
  }
}
