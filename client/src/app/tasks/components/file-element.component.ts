import {Component, computed, EventEmitter, inject, Input, OnChanges, OnInit, Output, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {TooltipModule} from 'primeng/tooltip';
import {FileMetadata} from '../models/task.models';
import {TaskService} from '../services/task.service';
import {Dialog} from 'primeng/dialog';
import {Textarea} from 'primeng/textarea';

@Component({
  selector: 'app-file-element',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    Dialog,
    Textarea,
  ],
  template: `
    <div class="space-y-3">
      @if (fileMetadata() && !showUploadForm()) {
        <div class="relative">
          @if (isImage()) {
            <div class="grid grid-cols-5 gap-4">
              <div class="col-span-2">
                <div class="relative group">
                  <img
                    [src]="fileUrl()"
                    [alt]="fileMetadata()?.id"
                    class="w-full rounded-lg shadow-sm border border-gray-200 cursor-pointer transition-transform hover:scale-105"
                    (error)="onImageError()"
                    (click)="openImageModal()"
                  />
                  <a
                    [href]="'/api/files/' + fileMetadata()?.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white rounded-lg shadow-md w-7 h-7 flex items-center justify-center"
                    pTooltip="Open in full res"
                    tooltipPosition="left"
                    (click)="$event.stopPropagation()"
                  >
                    <i class="pi pi-external-link text-gray-700 text-sm" aria-hidden="true"></i>
                  </a>
                </div>
                <div class="mt-4 flex justify-center">
                  <ng-container *ngTemplateOutlet="fileReplace"></ng-container>
                </div>
              </div>

              <div class="col-span-3">
                <div class="space-y-3">
                  <ng-container *ngTemplateOutlet="metadataFields"></ng-container>
                </div>
              </div>
            </div>
          } @else if (isAudio()) {
            <div class="grid grid-cols-5 gap-4">
              <div class="col-span-2">
                <div class="relative group">
                  <audio
                    controls
                    [src]="fileUrl()"
                    class="w-full"
                  ></audio>
                </div>

                <div class="mt-4 flex justify-center">
                  <ng-container *ngTemplateOutlet="fileReplace"></ng-container>
                </div>
              </div>

              <div class="col-span-3">
                <div class="space-y-3">
                  <ng-container *ngTemplateOutlet="metadataFields"></ng-container>
                </div>
              </div>
            </div>
          } @else if (isVideo()) {
            <div class="grid grid-cols-5 gap-4">
              <div class="col-span-2">
                <div class="relative group cursor-pointer" (click)="openVideoModal()">
                  <video
                    [src]="fileUrl()"
                    class="w-full rounded-lg shadow-sm border border-gray-200 transition-transform hover:scale-105"
                  ></video>
                  <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="bg-black/50 rounded-full w-12 h-12 flex items-center justify-center">
                      <i class="pi pi-play text-white text-xl" aria-hidden="true"></i>
                    </div>
                  </div>
                </div>
                <div class="mt-4 flex justify-center">
                  <ng-container *ngTemplateOutlet="fileReplace"></ng-container>
                </div>
              </div>
              <div class="col-span-3">
                <div class="space-y-3">
                  <ng-container *ngTemplateOutlet="metadataFields"></ng-container>
                </div>
              </div>
            </div>
          } @else {
            <div class="flex items-center p-4 border border-gray-200 rounded-lg bg-gray-50">
              <i class="pi pi-file text-2xl text-gray-500 mr-3"></i>
              <div class="flex-1">
                <p class="font-medium text-gray-700 break-all">{{ fileMetadata()?.id }}</p>
                <p class="text-sm text-gray-500">{{ fileExtension() }}</p>
              </div>
              @if (fileMetadata() && !showUploadForm() && !replacingFile()) {
                <p-button
                  icon="pi pi-refresh"
                  severity="secondary"
                  size="small"
                  (onClick)="startFileReplacement()"
                  [disabled]="uploading()"
                ></p-button>
              }
            </div>

            <div class="mt-4 space-y-3">
              <ng-container *ngTemplateOutlet="metadataFields"></ng-container>
            </div>
          }
        </div>
      }

      @if (!fileMetadata() || showUploadForm()) {
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ replacingFile() ? 'Wybierz nowy plik' : 'File' }}</label>
            <input
              type="file"
              class="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              (change)="replacingFile() ? onFileReplace($event) : onFileSelect($event)"
              #fileInput
              [accept]="getAcceptAttribute()"
            />
            <div class="mt-1 text-xs text-gray-500">
              <i class="pi pi-info-circle mr-1"></i>Maximum video file size: {{ MAX_VIDEO_SIZE_MB }} MB
            </div>
            @if (fileMetadata()?.id && showUploadForm()) {
              <div class="mt-2 text-sm text-gray-600 truncate">
                {{ replacingFile() ? 'Current file: ' : 'Selected file: ' }}{{ fileMetadata()?.id }}
              </div>
            }
          </div>

          @if (uploading()) {
            <div class="text-sm text-blue-600">
              <i class="pi pi-spin pi-spinner mr-2"></i>{{ replacingFile() ? 'Replacing...' : 'Uploading...' }}
            </div>
          }

          @if (fileError()) {
            <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <i class="pi pi-exclamation-triangle mr-2"></i>
              {{ fileError() }}
            </div>
          }

          @if (fileMetadata() && showUploadForm()) {
            <div class="flex gap-2">
              <p-button
                label="Cancel"
                severity="secondary"
                size="small"
                (onClick)="cancelEdit()"
              ></p-button>
            </div>
          }
        </div>
      }

      <p-dialog
        [(visible)]="showImageModal"
        [modal]="true"
        [style]="{ 'max-width': '90vw', 'width': 'auto' }"
        [draggable]="false"
        [resizable]="false"
        [closeOnEscape]="true"
        [dismissableMask]="true"
        (onHide)="closeImageModal()"
      >
        <ng-template pTemplate="header">
          <h3>{{ fileMetadata()?.id }}</h3>
        </ng-template>
        <div class="flex justify-center">
          <img
            [src]="fileUrl()"
            [alt]="fileMetadata()?.id"
            class="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
          />
        </div>
      </p-dialog>

      <p-dialog
        [(visible)]="showVideoModal"
        [modal]="true"
        [style]="{ 'max-width': '90vw', 'width': 'auto' }"
        [draggable]="false"
        [resizable]="false"
        [closeOnEscape]="true"
        [dismissableMask]="true"
        (onHide)="closeVideoModal()"
      >
        <ng-template pTemplate="header">
          <h3>{{ fileMetadata()?.id }}</h3>
        </ng-template>
        <div class="flex justify-center">
          @if (showVideoModal()) {
            <video
              controls
              autoplay
              [src]="fileUrl()"
              class="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
            ></video>
          }
        </div>
      </p-dialog>

      <ng-template #metadataFields>
        <div class="flex justify-between items-center">
          <h4 class="font-medium text-gray-700 break-all">{{ fileMetadata()?.id }}</h4>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Source</label>
          <textarea
            pTextarea
            [autoResize]="true"
            [(ngModel)]="localMetadata.url"
            (blur)="onMetadataChange()"
            class="w-full"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">License</label>
          <textarea
            pTextarea
            [autoResize]="true"
            [(ngModel)]="localMetadata.license"
            (blur)="onMetadataChange()"
            class="w-full"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Attribution</label>
          <textarea
            pTextarea
            [autoResize]="true"
            [(ngModel)]="localMetadata.attribution"
            (blur)="onMetadataChange()"
            class="w-full"
          ></textarea>
        </div>
      </ng-template>

      <ng-template #fileReplace>
        @if (fileMetadata() && !showUploadForm() && !replacingFile()) {
          <p-button
            icon="pi pi-refresh"
            label="Replace"
            severity="secondary"
            size="small"
            (onClick)="startFileReplacement()"
            [disabled]="uploading()"
          ></p-button>
        }
      </ng-template>
    </div>
  `
})
export class FileElementComponent implements OnInit, OnChanges {
  @Input() fileId?: string;
  @Output() fileIdChanged = new EventEmitter<string>();

  private taskService = inject(TaskService);

  fileMetadata = signal<FileMetadata | undefined>(undefined);
  showUploadForm = signal(false);
  showImageModal = signal(false);
  showVideoModal = signal(false);
  uploading = signal(false);
  imageError = signal(false);
  replacingFile = signal(false);
  fileError = signal<string | null>(null);
  localMetadata: Partial<FileMetadata> = {};

  readonly MAX_VIDEO_SIZE_MB = 20;
  private readonly MAX_VIDEO_SIZE_BYTES = this.MAX_VIDEO_SIZE_MB * 1024 * 1024;

  supportedImageExtensions = ["jpg", "jpeg", "png", "webp"];
  supportedAudioExtensions = ['mp3', 'wav', 'ogg'];
  supportedVideoExtensions = ['mp4', 'webm'];

  imageExtensionsAccept = computed(() => {
    return this.supportedImageExtensions.map(ext => `image/${ext}`);
  });

  audioExtensionsAccept = computed(() => {
    return this.supportedAudioExtensions.map(ext => `audio/${ext}`);
  });

  videoExtensionsAccept = computed(() => {
    return this.supportedVideoExtensions.map(ext => `video/${ext}`);
  });

  supportedExtensionsAccept = computed(() => {
    return [...this.imageExtensionsAccept(), ...this.audioExtensionsAccept(), ...this.videoExtensionsAccept()].join(',');
  });

  fileExtension = computed(() => {
    const metadata = this.fileMetadata();
    if (!metadata?.id) return '';

    const parts = metadata.id.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  });

  fileUrl = computed(() => {
    const metadata = this.fileMetadata();
    if (!metadata?.id) return '';

    return `/api/file/${metadata.id}/download`;
  });

  isImage = computed(() => {
    const extension = this.fileExtension()?.toLowerCase();
    return this.supportedImageExtensions.includes(extension ?? '');
  });

  isAudio = computed(() => {
    const extension = this.fileExtension()?.toLowerCase();
    return this.supportedAudioExtensions.includes(extension ?? '');
  });

  isVideo = computed(() => {
    const extension = this.fileExtension()?.toLowerCase();
    return this.supportedVideoExtensions.includes(extension ?? '');
  });

  ngOnInit() {
    this.loadFileMetadata();
  }

  ngOnChanges() {
    this.loadFileMetadata();
  }

  onImageError() {
    this.imageError.set(true);
  }

  cancelEdit() {
    this.showUploadForm.set(false);
    this.replacingFile.set(false);
    this.fileError.set(null);
    this.updateLocalMetadata();
  }

  onMetadataChange() {
    if (!this.fileId) return;

    const currentMetadata = this.fileMetadata();
    if (currentMetadata) {
      const updatedMetadata = {...currentMetadata, ...this.localMetadata};
      this.fileMetadata.set(updatedMetadata);
    }

    this.taskService.updateFile(this.fileId, this.localMetadata).subscribe({
      error: (error) => {
        console.error('Error updating file metadata:', error);
        this.updateLocalMetadata();
      }
    });
  }

  openImageModal() {
    this.showImageModal.set(true);
  }

  closeImageModal() {
    this.showImageModal.set(false);
  }

  openVideoModal() {
    this.showVideoModal.set(true);
  }

  closeVideoModal() {
    this.showVideoModal.set(false);
  }

  private updateLocalMetadata() {
    const metadata = this.fileMetadata();
    if (metadata) {
      this.localMetadata = {
        url: metadata.url || '',
        license: metadata.license || '',
        attribution: metadata.attribution || ''
      };
    }
  }

  private loadFileMetadata() {
    if (this.fileId) {
      this.taskService.getFileMetadata(this.fileId).subscribe({
        next: (metadata) => {
          this.fileMetadata.set(metadata);
          this.updateLocalMetadata();
        },
      });
    } else {
      this.fileMetadata.set(undefined);
    }
  }

  onFileSelect(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.fileError.set(null);

    const sizeError = this.validateVideoSize(file);
    if (sizeError) {
      this.fileError.set(sizeError);
      event.target.value = '';
      return;
    }

    this.uploading.set(true);

    this.taskService.uploadFile(file).subscribe({
      next: (response) => {
        this.fileId = response.id;
        this.fileIdChanged.emit(response.id);

        this.loadFileMetadata();
        this.showUploadForm.set(false);
        this.uploading.set(false);
      },
      error: (error) => {
        console.error('Error uploading file:', error);
        this.uploading.set(false);
      }
    });
  }

  startFileReplacement(): void {
    this.replacingFile.set(true);
    this.showUploadForm.set(true);
    this.fileError.set(null);
  }

  private isVideoFile(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return this.supportedVideoExtensions.includes(ext ?? '');
  }

  private validateVideoSize(file: File): string | null {
    if (this.isVideoFile(file.name) && file.size > this.MAX_VIDEO_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `Video file is too large (${sizeMB} MB). Maximum allowed size is ${this.MAX_VIDEO_SIZE_MB} MB.`;
    }
    return null;
  }

  validateFileType(newFile: File): boolean {
    const currentExtension = this.fileExtension()?.toLowerCase();
    if (!currentExtension) return false;

    const newFileName = newFile.name;
    const newExtension = newFileName.split('.').pop()?.toLowerCase();
    if (!newExtension) return false;

    const isCurrentImage = this.supportedImageExtensions.includes(currentExtension);
    const isNewImage = this.supportedImageExtensions.includes(newExtension);
    const isCurrentAudio = this.supportedAudioExtensions.includes(currentExtension);
    const isNewAudio = this.supportedAudioExtensions.includes(newExtension);
    const isCurrentVideo = this.supportedVideoExtensions.includes(currentExtension);
    const isNewVideo = this.supportedVideoExtensions.includes(newExtension);

    return (isCurrentImage && isNewImage) || (isCurrentAudio && isNewAudio) || (isCurrentVideo && isNewVideo);
  }

  getAcceptAttribute(): string {
    if (this.replacingFile()) {
      const extension = this.fileExtension()?.toLowerCase();
      if (this.supportedImageExtensions.includes(extension ?? '')) {
        return this.imageExtensionsAccept().join(',');
      } else if (this.supportedAudioExtensions.includes(extension ?? '')) {
        return this.audioExtensionsAccept().join(',');
      } else if (this.supportedVideoExtensions.includes(extension ?? '')) {
        return this.videoExtensionsAccept().join(',');
      }
    }
    return this.supportedExtensionsAccept();
  }

  onFileReplace(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.fileError.set(null);

    const sizeError = this.validateVideoSize(file);
    if (sizeError) {
      this.fileError.set(sizeError);
      event.target.value = '';
      return;
    }

    if (!this.validateFileType(file)) {
      this.fileError.set('New file must be the same type as the old one');
      return;
    }

    const savedUrl = this.localMetadata.url;
    const savedLicense = this.localMetadata.license;
    const savedAttribution = this.localMetadata.attribution;

    this.uploading.set(true);

    this.taskService.uploadFile(file, savedUrl, savedLicense, savedAttribution).subscribe({
      next: (response) => {
        this.fileId = response.id;
        this.fileIdChanged.emit(response.id);
        this.loadFileMetadata();
        this.showUploadForm.set(false);
        this.replacingFile.set(false);
        this.uploading.set(false);
        event.target.value = '';
      },
      error: (_) => {
        this.fileError.set('Error occurred. Try again.');
        this.uploading.set(false);
        event.target.value = '';
      }
    });
  }

}
