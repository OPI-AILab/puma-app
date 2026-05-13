import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ButtonModule} from 'primeng/button';
import {TooltipModule} from 'primeng/tooltip';
import {Crepe, CrepeFeature} from '@milkdown/crepe';
import {replaceAll} from '@milkdown/kit/utils';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import {htmlTablePlugin} from '../../milkdown-plugins/html-table';
import {EvaluationResult} from './evaluation-results.component';

@Component({
  selector: 'app-ocr-result-viewer',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    ::ng-deep .milkdown {
      font-size: 14px;
      font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    }
  `],
  template: `
    <div class="flex justify-end mb-2">
      <p-button
        [icon]="isRendered ? 'pi pi-code' : 'pi pi-eye'"
        [text]="true"
        severity="secondary"
        [pTooltip]="isRendered ? 'Show raw markdown' : 'Show rendered markdown'"
        tooltipPosition="top"
        (onClick)="toggleViewMode()"
      ></p-button>
    </div>
    @if (!isRendered) {
      <pre class="font-mono text-sm whitespace-pre-wrap break-words text-gray-800 bg-gray-50 p-2 rounded border border-gray-200">{{ result.answer }}</pre>
    } @else {
      <div [id]="'viewer-' + result.model_id" class="prose prose-sm max-w-none break-words text-gray-800"></div>
    }
  `
})
export class OcrResultViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({required: true}) result!: EvaluationResult;

  isRendered = false;
  private viewerInstance: Crepe | null = null;
  private initializing = false;

  ngAfterViewInit() {
    if (this.isRendered) {
      this.initializeViewer();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['result'] && this.isRendered) {
      requestAnimationFrame(() => this.initializeViewer());
    }
  }

  ngOnDestroy() {
    this.destroyViewer();
  }

  toggleViewMode() {
    this.isRendered = !this.isRendered;
    if (this.isRendered) {
      setTimeout(() => this.initializeViewer(), 50);
    } else {
      this.destroyViewer();
    }
  }

  private async initializeViewer() {
    if (this.initializing) return;

    const elementId = `viewer-${this.result.model_id}`;
    const element = document.getElementById(elementId);
    if (!element) return;

    if (this.viewerInstance) {
      if (element.children.length === 0) {
        await this.viewerInstance.destroy();
        this.viewerInstance = null;
      } else {
        this.viewerInstance.editor.action(replaceAll(this.result.answer || ''));
        return;
      }
    }

    this.initializing = true;
    try {
      const crepe = new Crepe({
        root: element,
        defaultValue: '',
        features: {
          [CrepeFeature.Latex]: false,
          [CrepeFeature.CodeMirror]: false,
          [CrepeFeature.Toolbar]: false,
          [CrepeFeature.BlockEdit]: false,
        },
      });
      htmlTablePlugin.flat().forEach((plugin) => crepe.editor.use(plugin));
      await crepe.create();
      crepe.setReadonly(true);
      crepe.editor.action(replaceAll(this.result.answer || ''));
      this.viewerInstance = crepe;
    } catch (error) {
    } finally {
      this.initializing = false;
    }
  }

  private destroyViewer() {
    if (this.viewerInstance) {
      this.viewerInstance.destroy();
      this.viewerInstance = null;
    }
  }
}
