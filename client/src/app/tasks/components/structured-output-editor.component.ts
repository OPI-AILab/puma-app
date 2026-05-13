import {Component, EventEmitter, Input, Output, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {CardModule} from 'primeng/card';
import {InputTextModule} from 'primeng/inputtext';
import {SelectModule} from 'primeng/select';
import {CheckboxModule} from 'primeng/checkbox';
import {TextareaModule} from 'primeng/textarea';
import {StructuredOutput, StructuredOutputField} from '../models/task.models';

@Component({
  selector: 'app-structured-output-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    SelectModule,
    CheckboxModule,
    TextareaModule
  ],
  template: `
    <p-card>
      <ng-template pTemplate="header">
        <div class="flex justify-between items-center p-4 pb-0">
          <h2 class="text-lg font-semibold">Structured Output</h2>
          <div class="flex items-center">
            <p-checkbox [ngModel]="enabled()" (ngModelChange)="toggleEnabled($event)" [binary]="true" inputId="enableStructuredOutput"></p-checkbox>
            <label for="enableStructuredOutput" class="ml-2 cursor-pointer">Enable</label>
          </div>
        </div>
      </ng-template>

      @if (enabled()) {
        <div class="mt-4">
          <div class="mb-4 flex items-center">
            <p-checkbox [ngModel]="isArray()" (ngModelChange)="updateArray($event)" [binary]="true" inputId="outputIsArray"></p-checkbox>
            <label for="outputIsArray" class="ml-2 cursor-pointer">Output should be array of elements</label>
          </div>

          <div class="flex flex-col gap-3">
            @for (field of fields(); track $index) {
              <div class="border border-surface-200 rounded-lg p-3">
                <div class="flex justify-between items-center mb-2">
                  <span class="text-sm font-semibold text-gray-500">Field #{{ $index + 1 }}</span>
                  <p-button icon="pi pi-trash" severity="danger" [text]="true" (onClick)="removeField($index)"></p-button>
                </div>
                <div class="flex gap-2 items-end">
                  <div class="flex-1">
                    <label class="block text-sm font-medium mb-1">Name</label>
                    <input pInputText [(ngModel)]="field.name" (blur)="emitChange()" class="w-full" placeholder="Field name" />
                  </div>
                  <div class="flex-1">
                    <label class="block text-sm font-medium mb-1">Type</label>
                    <p-select
                      [options]="fieldTypes"
                      [(ngModel)]="field.type"
                      (ngModelChange)="emitChange()"
                      [style]="{'width':'100%'}"
                      appendTo="body"
                    ></p-select>
                  </div>
                </div>
                <div class="mt-2">
                  <label class="block text-sm font-medium mb-1">Description</label>
                  <textarea pTextarea [(ngModel)]="field.description" (blur)="emitChange()" class="w-full" placeholder="Description" [autoResize]="true" rows="2"></textarea>
                </div>
              </div>
            }
          </div>

          <div class="mt-3 text-center">
            <p-button label="Add Field" icon="pi pi-plus" [text]="true" (onClick)="addField()"></p-button>
          </div>
        </div>
      }
    </p-card>
  `
})
export class StructuredOutputEditorComponent {
  @Input() set structuredOutput(value: StructuredOutput | undefined | null) {
    if (value) {
      this.enabled.set(true);
      this.isArray.set(value.array);
      this.fields.set(value.fields.map(f => ({...f})));
    } else {
      this.enabled.set(false);
      this.isArray.set(false);
      this.fields.set([]);
    }
  }

  @Output() structuredOutputChange = new EventEmitter<StructuredOutput | undefined>();

  enabled = signal(false);
  isArray = signal(false);
  fields = signal<StructuredOutputField[]>([]);

  fieldTypes = [
    { label: 'String', value: 'string' },
    { label: 'Number', value: 'number' },
    { label: 'Boolean', value: 'boolean' },
    { label: 'Array[String]', value: 'array[string]' },
    { label: 'Array[Number]', value: 'array[number]' },
    { label: 'Array[Boolean]', value: 'array[boolean]' }
  ];

  toggleEnabled(value: boolean) {
    this.enabled.set(value);
    this.emitChange();
  }

  updateArray(value: boolean) {
    this.isArray.set(value);
    this.emitChange();
  }

  addField() {
    this.fields.update(fields => [...fields, { name: '', type: 'string', description: '' }]);
    this.emitChange();
  }

  removeField(index: number) {
    this.fields.update(fields => fields.filter((_, i) => i !== index));
    this.emitChange();
  }

  trackByFn(index: number, item: any): any {
    return index;
  }

  emitChange() {
    if (!this.enabled()) {
      this.structuredOutputChange.emit(undefined);
      return;
    }

    const output: StructuredOutput = {
      name: 'Object',
      array: this.isArray(),
      fields: this.fields()
    };
    this.structuredOutputChange.emit(output);
  }
}
