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
import {InputNumberModule} from 'primeng/inputnumber';
import {InputTextModule} from 'primeng/inputtext';
import {CheckboxModule} from 'primeng/checkbox';
import {ButtonModule} from 'primeng/button';
import {Condition} from '../../models/task.models';
import {ConditionLemmatizeToggleComponent} from './condition-lemmtatize-toggle.component';
import {TokenStructureFieldComponent} from './token-structure-field.component';
import {TextareaModule} from 'primeng/textarea';
import {JsonEditorComponent} from './json-editor.component';
import {OcrConditionFormComponent} from './ocr-condition-form.component';

@Component({
  selector: 'app-condition-form',
  standalone: true,
  imports: [CommonModule, FormsModule, InputNumberModule, InputTextModule, TextareaModule, CheckboxModule, ButtonModule, ConditionLemmatizeToggleComponent, TokenStructureFieldComponent, JsonEditorComponent, OcrConditionFormComponent],
  template: `
    @switch (condition.type) {
      @case ('include') {
        <div class="space-y-3">
          <app-token-structure-field
            label="Phrases to include"
            [required]="true"
            [model]="$any(condition).expected || []"
            (modelChange)="onExpectedChanged($event)"
          />
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Min</label>
              <p-inputNumber [(ngModel)]="$any(condition.params).include_min" (ngModelChange)="onParamChanged()"
                             [showButtons]="true" [min]="0" class="w-full"></p-inputNumber>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Max</label>
              <p-inputNumber [(ngModel)]="$any(condition.params).include_max" (ngModelChange)="onParamChanged()"
                             [showButtons]="true" [min]="0" class="w-full"></p-inputNumber>
            </div>
          </div>
          <app-condition-lemmatize-toggle [model]="$any(condition.params)" [checkboxId]="'include-lemmatize-' + index"/>
        </div>
      }
      @case ('exclude') {
        <div class="space-y-3">
          <app-token-structure-field
            label="Phrases to exclude"
            [required]="true"
            [model]="$any(condition).expected || []"
            (modelChange)="onExpectedChanged($event)"
          />
          <app-condition-lemmatize-toggle [model]="$any(condition.params)" [checkboxId]="'exclude-lemmatize-' + index"/>
        </div>
      }
      @case ('order') {
        <div class="space-y-3">
          <app-token-structure-field
            label="Order of elements"
            [required]="true"
            [model]="$any(condition).expected || []"
            (modelChange)="onExpectedChanged($event)"
          />
          <app-condition-lemmatize-toggle [model]="$any(condition.params)" [checkboxId]="'order-lemmatize-' + index"/>
        </div>
      }
      @case ('regex') {
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Regular expression <span
              class="text-red-500">*</span></label>
            <input pInputText [(ngModel)]="$any(condition).expected" (ngModelChange)="onParamChanged()" class="w-full"/>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Min</label>
              <p-inputNumber [(ngModel)]="$any(condition.params).regex_min" (ngModelChange)="onParamChanged()"
                             [showButtons]="true" [min]="0" class="w-full"></p-inputNumber>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Max</label>
              <p-inputNumber [(ngModel)]="$any(condition.params).regex_max" (ngModelChange)="onParamChanged()"
                             [showButtons]="true" [min]="0" class="w-full"></p-inputNumber>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Length</label>
              <p-inputNumber [(ngModel)]="$any(condition.params).regex_match_length" (ngModelChange)="onParamChanged()"
                             [showButtons]="true" [min]="0" class="w-full"></p-inputNumber>
            </div>
          </div>
          <div>
            <p-checkbox [(ngModel)]="$any(condition.params).regex_match_word" (ngModelChange)="onParamChanged()"
                        binary="true" [inputId]="'regex-match-word-' + index"></p-checkbox>
            <label [for]="'regex-match-word-' + index" class="ml-2">Match word</label>
          </div>
        </div>
      }
      @case ('wacc') {
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Expected<span
              class="text-red-500">*</span></label>
            <textarea rows="5" class="w-full" pTextarea [autoResize]="true"
                      [(ngModel)]="$any(condition).expected" (ngModelChange)="onParamChanged()">
            </textarea>
          </div>
        </div>
      }
      @case ('ocr') {
        <app-ocr-condition-form
          [expected]="$any(condition).expected"
          (expectedChange)="onExpectedChanged($event)"
        ></app-ocr-condition-form>
      }
      @case ('struct') {
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Expected JSON<span
              class="text-red-500">*</span></label>
            <app-json-editor
              [value]="expectedJsonString"
              (valueChange)="onExpectedJsonChange($event)"
              (validityChange)="jsonValid = $event"
            />
          </div>
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConditionFormComponent implements OnInit, OnChanges {
  @Input() condition!: Condition;
  @Input() index!: number;
  @Output() changed = new EventEmitter<Condition>();

  expectedJsonString: string = '';
  jsonValid: boolean = true;

  ngOnInit() {
    this.updateJsonString();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['condition']) {
      this.updateJsonString();
    }
  }

  private updateJsonString() {
    if (this.condition.type === 'struct') {
      const expected = this.condition.expected;
      if (expected && typeof expected === 'object') {
        try {
          const currentObj = JSON.parse(this.expectedJsonString);
          if (JSON.stringify(currentObj) === JSON.stringify(expected)) {
            return;
          }
        } catch (e) {}
        this.expectedJsonString = JSON.stringify(expected, null, 2);
      } else if (typeof expected === 'string') {
        if (this.expectedJsonString !== expected) {
          try {
            this.expectedJsonString = JSON.stringify(JSON.parse(expected), null, 2);
          } catch (e) {
            this.expectedJsonString = expected;
          }
        }
      } else {
        this.expectedJsonString = '';
      }
    }
  }

  onExpectedJsonChange(value: string) {
    this.expectedJsonString = value;
    if (this.condition.type === 'struct') {
      try {
        this.condition.expected = JSON.parse(value);
      } catch (e) {
        this.condition.expected = value;
      }
    } else {
      this.condition.expected = value;
    }
    this.onParamChanged();
  }

  onExpectedChanged(structure: any[]) {
    (this.condition as any).expected = structure;
    this.onParamChanged();
  }

  onParamChanged() {
    this.changed.emit(this.condition);
  }

  jsonValidator(value: string): boolean {
    if (!value) {
      return true;
    }
    try {
      JSON.parse(value);
      return true;
    } catch (e) {
      return false;
    }
  }
}
