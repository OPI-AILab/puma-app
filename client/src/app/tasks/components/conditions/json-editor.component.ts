import {
  Component,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewEncapsulation,
  forwardRef,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {ButtonModule} from 'primeng/button';

import Prism from 'prismjs';
import 'prismjs/components/prism-json';

@Component({
  selector: 'app-json-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule],
  encapsulation: ViewEncapsulation.None,
  styles: [`
    app-json-editor {
      display: block;
    }

    app-json-editor .json-editor-wrapper {
      position: relative;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      overflow: hidden;
      background: #f8f9fa;
    }

    app-json-editor .json-editor-wrapper.invalid {
      border-color: #ef4444;
    }

    app-json-editor .json-editor-wrapper.focused {
      border-color: #6366f1;
      box-shadow: 0 0 0 1px #6366f1;
    }

    app-json-editor .json-editor-container {
      position: relative;
      min-height: 120px;
    }

    app-json-editor .json-editor-container textarea,
    app-json-editor .json-editor-container pre {
      margin: 0;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      line-height: 1.6;
      tab-size: 2;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow: hidden;
    }

    app-json-editor .json-editor-container textarea {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      color: transparent;
      caret-color: #1f2937;
      border: none;
      outline: none;
      resize: none;
      z-index: 1;
      -webkit-text-fill-color: transparent;
    }

    app-json-editor .json-editor-container pre {
      position: relative;
      z-index: 0;
      pointer-events: none;
      min-height: 120px;
      background: transparent;
    }

    app-json-editor .json-editor-container pre code {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      background: none;
      padding: 0;
    }

    app-json-editor .json-editor-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px;
      border-top: 1px solid #e5e7eb;
      background: #f3f4f6;
    }

    app-json-editor .json-status {
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    app-json-editor .json-editor-container .token.property { color: #0550ae; }
    app-json-editor .json-editor-container .token.string { color: #0a3069; }
    app-json-editor .json-editor-container .token.number { color: #0550ae; }
    app-json-editor .json-editor-container .token.boolean { color: #cf222e; }
    app-json-editor .json-editor-container .token.null { color: #cf222e; }
    app-json-editor .json-editor-container .token.operator { color: #24292f; }
    app-json-editor .json-editor-container .token.punctuation { color: #6e7781; }
  `],
  template: `
    <div class="json-editor-wrapper"
         [class.invalid]="!isValid && value"
         [class.focused]="isFocused">
      <div class="json-editor-container">
        <pre aria-hidden="true"><code #highlight class="language-json" [innerHTML]="highlightedHtml"></code></pre>
        <textarea
          #textarea
          [value]="value"
          (input)="onInput($event)"
          (focus)="isFocused = true"
          (blur)="isFocused = false; onTouched()"
          (keydown.tab)="onTab($event)"
          (keydown.enter)="onEnter($event)"
          (keydown)="onKeydown($event)"
          spellcheck="false"
          placeholder="Enter JSON..."
        ></textarea>
      </div>
      <div class="json-editor-toolbar">
        <span class="json-status" [style.color]="!value ? '#6b7280' : isValid ? '#16a34a' : '#ef4444'">
          <i class="pi" [ngClass]="!value ? 'pi-code' : isValid ? 'pi-check-circle' : 'pi-exclamation-circle'"></i>
          {{ !value ? 'Empty' : isValid ? 'Valid JSON' : 'Invalid JSON' }}
        </span>
        <p-button
          icon="pi pi-align-left"
          label="Format"
          [text]="true"
          size="small"
          [disabled]="!isValid || !value"
          (onClick)="formatJson()"
        />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => JsonEditorComponent),
      multi: true
    }
  ]
})
export class JsonEditorComponent implements AfterViewInit, OnChanges, OnDestroy, ControlValueAccessor {
  @Input() value: string = '';
  @Output() valueChange = new EventEmitter<string>();
  @Output() validityChange = new EventEmitter<boolean>();

  @ViewChild('textarea', {static: false}) textareaRef!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('highlight', {static: false}) highlightRef!: ElementRef<HTMLElement>;

  highlightedHtml: string = '';
  isValid: boolean = true;
  isFocused: boolean = false;

  private onChangeFn: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.updateHighlight();
    setTimeout(() => this.syncScroll(), 0);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value']) {
      this.updateHighlight();
      this.validate();
    }
  }

  writeValue(value: string): void {
    this.value = value || '';
    this.updateHighlight();
    this.validate();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  onInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.value = target.value;
    this.updateHighlight();
    this.validate();
    this.valueChange.emit(this.value);
    this.onChangeFn(this.value);
    setTimeout(() => this.syncScroll(), 0);
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key !== '}' && event.key !== ']') return;

    const textarea = this.textareaRef.nativeElement;
    const start = textarea.selectionStart;
    const value = textarea.value;

    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const beforeCursor = value.substring(lineStart, start);
    if (beforeCursor.trim() !== '') return;

    const closing = event.key;
    const opening = closing === '}' ? '{' : '[';
    let depth = 0;
    for (let i = start - 1; i >= 0; i--) {
      if (value[i] === closing) depth++;
      if (value[i] === opening) {
        if (depth === 0) {
          const openerLineStart = value.lastIndexOf('\n', i - 1) + 1;
          const openerLine = value.substring(openerLineStart, i);
          const openerIndent = openerLine.match(/^(\s*)/)?.[1] || '';

          event.preventDefault();
          textarea.value = value.substring(0, lineStart) + openerIndent + closing + value.substring(start);
          const newPos = lineStart + openerIndent.length + 1;
          textarea.selectionStart = textarea.selectionEnd = newPos;
          this.value = textarea.value;
          this.updateHighlight();
          this.validate();
          this.valueChange.emit(this.value);
          this.onChangeFn(this.value);
          setTimeout(() => this.syncScroll(), 0);
          return;
        }
        depth--;
      }
    }
  }

  onEnter(event: Event) {
    event.preventDefault();
    const textarea = this.textareaRef.nativeElement;
    const start = textarea.selectionStart;
    const value = textarea.value;

    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const currentLine = value.substring(lineStart, start);
    const currentIndent = currentLine.match(/^(\s*)/)?.[1] || '';

    const charBefore = value.substring(0, start).trimEnd().slice(-1);
    const charAfter = value.substring(start).trimStart().charAt(0);

    const isOpening = charBefore === '{' || charBefore === '[';
    const isClosing = charAfter === '}' || charAfter === ']';

    let insert: string;
    let cursorOffset: number;

    if (isOpening && isClosing) {
      const newIndent = currentIndent + '  ';
      insert = '\n' + newIndent + '\n' + currentIndent;
      cursorOffset = newIndent.length + 1;
    } else if (isOpening) {
      const newIndent = currentIndent + '  ';
      insert = '\n' + newIndent;
      cursorOffset = newIndent.length + 1;
    } else {
      insert = '\n' + currentIndent;
      cursorOffset = currentIndent.length + 1;
    }

    textarea.value = value.substring(0, start) + insert + value.substring(textarea.selectionEnd);
    textarea.selectionStart = textarea.selectionEnd = start + cursorOffset;
    this.value = textarea.value;
    this.updateHighlight();
    this.validate();
    this.valueChange.emit(this.value);
    this.onChangeFn(this.value);
    setTimeout(() => this.syncScroll(), 0);
  }

  onTab(event: Event) {
    event.preventDefault();
    const textarea = this.textareaRef.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    textarea.value = value.substring(0, start) + '  ' + value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + 2;
    this.value = textarea.value;
    this.updateHighlight();
    this.validate();
    this.valueChange.emit(this.value);
    this.onChangeFn(this.value);
    setTimeout(() => this.syncScroll(), 0);
  }

  formatJson() {
    if (!this.value) return;
    try {
      const parsed = JSON.parse(this.value);
      this.value = JSON.stringify(parsed, null, 2);
      this.updateHighlight();
      this.validate();
      this.valueChange.emit(this.value);
      this.onChangeFn(this.value);
      if (this.textareaRef) {
        this.textareaRef.nativeElement.value = this.value;
      }
      this.cdr.markForCheck();
    } catch (e) {
      // Not valid JSON
    }
  }

  private updateHighlight() {
    const code = this.value || '';
    if (!code) {
      this.highlightedHtml = '';
      return;
    }
    this.highlightedHtml = Prism.highlight(code, Prism.languages['json'], 'json');
  }

  private validate() {
    if (!this.value) {
      this.isValid = true;
    } else {
      try {
        JSON.parse(this.value);
        this.isValid = true;
      } catch (e) {
        this.isValid = false;
      }
    }
    this.validityChange.emit(this.isValid);
  }

  private syncScroll() {
    const textarea = this.textareaRef?.nativeElement;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const pre = textarea.previousElementSibling as HTMLElement;
    if (pre) {
      textarea.style.height = pre.scrollHeight + 'px';
    }
  }

  ngOnDestroy() {}
}
