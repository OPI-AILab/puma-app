import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {InputTextModule} from 'primeng/inputtext';
import {ButtonModule} from 'primeng/button';

@Component({
  selector: 'app-token-structure-field',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule],
  host: {
    class: 'block w-full'
  },
  template: `
    <div class="space-y-2">
      <label class="block text-sm font-medium text-gray-700">
        {{ label }} @if (required) {
        <span class="text-red-500">*</span>
      }
      </label>

      <textarea pInputText
                [ngModel]="expectedTxt"
                (ngModelChange)="onModelChange($event)"
                [rows]="5"
                class="w-full font-mono !text-sm"
                [placeholder]="placeholder"
      ></textarea>

      @if (parseError) {
        <div class="text-xs text-red-500">{{ parseError }}</div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenStructureFieldComponent implements OnInit, OnChanges {
  @Input() label = '';
  @Input() required = false;
  @Input() placeholder = 'e.g. ["16", "szesnastego"], ["kwietnia"], "2003"';

  @Input() model: any[] = [];
  @Output() modelChange = new EventEmitter<any[]>();

  expectedTxt = '';
  parseError? = '';

  ngOnInit() {
    this.modelToText();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['model']) {
      this.modelToText();
    }
  }

  onModelChange(text: string) {
    this.expectedTxt = text;
    this.textToModel();
  }

  private modelToText() {
    if (!this.model) {
      this.expectedTxt = '';
      return;
    }
    try {
      this.expectedTxt = this.model.map(item => {
        if (typeof item === 'string') {
          return item;
        }
        if (Array.isArray(item)) {
          return `[${item.join(', ')}]`;
        }
        return JSON.stringify(item);
      }).join(', ');
    } catch (e) {
      this.expectedTxt = '';
    }
  }

  private textToModel() {
    if (!this.expectedTxt?.trim()) {
      this.parseError = undefined;
      this.model = [];
      this.modelChange.emit(this.model);
      return;
    }

    try {
      this.model = this.parseTokenStructure(this.expectedTxt);
      this.parseError = undefined;
      this.modelChange.emit(this.model);
    } catch (e: any) {
      this.parseError = 'Invalid format. ' + e.message;
    }
  }

  private parseTokenStructure(text: string): any[] {
    const result: any[] = [];
    let i = 0;
    let currentToken = '';
    let insideArray = false;
    let arrayElements: string[] = [];

    while (i < text.length) {
      const char = text[i];

      if (char === '[') {
        if (insideArray) {
          throw new Error('Nested arrays are not supported');
        }
        if (currentToken.trim()) {
          throw new Error('Array must be preceded by a comma or be at the start');
        }
        insideArray = true;
        arrayElements = [];
      } else if (char === ']') {
        if (!insideArray) {
          throw new Error('Unexpected closing bracket');
        }
        if (currentToken.trim()) {
          arrayElements.push(currentToken.trim());
        }
        result.push(arrayElements);
        arrayElements = [];
        currentToken = '';
        insideArray = false;
      } else if (char === ',') {
        if (insideArray) {
          if (currentToken.trim()) {
            arrayElements.push(currentToken.trim());
          }
        } else {
          if (currentToken.trim()) {
            result.push(currentToken.trim());
          }
        }
        currentToken = '';
      } else {
        currentToken += char;
      }

      i++;
    }

    if (insideArray) {
      throw new Error('Unclosed array bracket');
    }

    if (currentToken.trim()) {
      result.push(currentToken.trim());
    }

    return result;
  }
}
