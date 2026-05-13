import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  ElementRef,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Crepe, CrepeFeature} from '@milkdown/crepe';
import {replaceAll} from '@milkdown/kit/utils';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import {htmlTablePlugin} from '../../../milkdown-plugins/html-table';

@Component({
  selector: 'app-markdown-viewer',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host {
      display: block;
    }
    .viewer-container {
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 4px;
      min-height: 80px;
    }
    ::ng-deep .viewer-container .milkdown {
      font-size: 14px;
      font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    }
  `],
  template: `
    <div class="viewer-container" #viewerRoot></div>
  `
})
export class MarkdownViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() value: string = '';

  @ViewChild('viewerRoot', {static: false}) viewerRootRef!: ElementRef<HTMLDivElement>;

  private crepeInstance: Crepe | null = null;
  private initializing = false;

  ngAfterViewInit() {
    this.initViewer();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value'] && this.crepeInstance) {
      this.crepeInstance.editor.action(replaceAll(this.value || ''));
    }
  }

  ngOnDestroy() {
    if (this.crepeInstance) {
      this.crepeInstance.destroy();
      this.crepeInstance = null;
    }
  }

  private async initViewer() {
    if (this.initializing || !this.viewerRootRef?.nativeElement) return;
    this.initializing = true;

    try {
      const crepe = new Crepe({
        root: this.viewerRootRef.nativeElement,
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
      crepe.editor.action(replaceAll(this.value || ''));
      this.crepeInstance = crepe;
    } catch (error) {
    } finally {
      this.initializing = false;
    }
  }
}
