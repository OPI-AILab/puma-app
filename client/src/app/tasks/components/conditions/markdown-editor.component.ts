import {
  Component,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  forwardRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      display: block;
    }
    .raw-editor-container textarea {
      width: 100%;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      resize: none;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 14px;
      line-height: 1.5;
      outline: none;
      background: #fafafa;
      overflow: hidden;
      min-height: 80px;
    }
    .raw-editor-container textarea:focus {
      background: #fff;
    }
  `],
  template: `
    <div class="raw-editor-container">
      <textarea
        #textarea
        [ngModel]="value"
        (ngModelChange)="onTextareaChange($event)"
        (blur)="onTextareaBlur()"
        placeholder="Enter markdown..."
      ></textarea>
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MarkdownEditorComponent),
      multi: true
    }
  ]
})
export class MarkdownEditorComponent implements AfterViewInit, OnDestroy, ControlValueAccessor {
  @Input() value: string = '';
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('textarea', { static: false }) textareaRef!: ElementRef<HTMLTextAreaElement>;

  private isDisabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngAfterViewInit() {
    setTimeout(() => this.autoResize(), 0);
  }

  ngOnDestroy() {}

  writeValue(value: string): void {
    this.value = value || '';
    setTimeout(() => this.autoResize(), 0);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  onTextareaChange(newValue: string) {
    this.value = newValue;
    this.valueChange.emit(newValue);
    this.onChange(newValue);
    this.autoResize();
  }

  onTextareaBlur() {
    this.onTouched();
  }

  private autoResize() {
    const textarea = this.textareaRef?.nativeElement;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }
}
