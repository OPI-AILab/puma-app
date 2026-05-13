import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {TooltipModule} from 'primeng/tooltip';
import {MarkdownEditorComponent} from './markdown-editor.component';
import {MarkdownViewerComponent} from './markdown-viewer.component';

@Component({
  selector: 'app-ocr-condition-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TooltipModule, MarkdownEditorComponent, MarkdownViewerComponent],
  template: `
    <div class="space-y-3">
      <div class="flex items-center justify-between mb-2">
        <label class="block text-sm font-medium text-gray-700">
          Expected (Markdown)<span class="text-red-500">*</span>
        </label>
        <p-button
          [icon]="previewMode ? 'pi pi-code' : 'pi pi-eye'"
          [text]="true"
          severity="secondary"
          size="small"
          [pTooltip]="previewMode ? 'Show raw markdown' : 'Show rendered markdown'"
          tooltipPosition="top"
          (onClick)="previewMode = !previewMode"
        ></p-button>
      </div>
      @for (block of blocks; track $index) {
        <div class="relative">
          @if (blocks.length > 1) {
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-gray-500">Block {{ $index + 1 }}</span>
              @if (!previewMode) {
                <button pButton type="button" icon="pi pi-trash" class="p-button-text p-button-danger p-button-sm"
                        (click)="removeBlock($index)"></button>
              }
            </div>
          }
          @if (previewMode) {
            <app-markdown-viewer [value]="block"></app-markdown-viewer>
          } @else {
            <app-markdown-editor [ngModel]="block" (ngModelChange)="updateBlock($index, $event)"></app-markdown-editor>
          }
        </div>
      }
      @if (!previewMode && blocks.length < 4) {
        <button pButton type="button" label="Add block" icon="pi pi-plus"
                class="p-button-outlined p-button-sm" (click)="addBlock()"></button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OcrConditionFormComponent {
  @Input() set expected(value: any) {
    if (Array.isArray(value)) {
      this.blocks = value;
    } else {
      this.blocks = [value || ''];
    }
  }
  @Output() expectedChange = new EventEmitter<string[]>();

  blocks: string[] = [''];
  previewMode = false;

  updateBlock(index: number, value: string) {
    const updated = [...this.blocks];
    updated[index] = value;
    this.blocks = updated;
    this.expectedChange.emit(this.blocks);
  }

  addBlock() {
    this.blocks = [...this.blocks, ''];
    this.expectedChange.emit(this.blocks);
  }

  removeBlock(index: number) {
    const filtered = this.blocks.filter((_, i) => i !== index);
    this.blocks = filtered.length ? filtered : [''];
    this.expectedChange.emit(this.blocks);
  }
}
