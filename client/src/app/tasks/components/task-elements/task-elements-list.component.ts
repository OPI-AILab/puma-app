import {ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {TextareaModule} from 'primeng/textarea';
import {ChatMessage, Condition} from '../../models/task.models';
import {FileElementComponent} from '../file-element.component';
import {ConditionsStore} from '../../store/conditions.store';

@Component({
  selector: 'app-task-elements-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TextareaModule, FileElementComponent],
  template: `
    <div class="space-y-4">
      @for (element of elements(); track element.id; let i = $index) {
        <div class="border border-gray-200 rounded-lg p-4">
          <div class="flex justify-between items-center mb-3">
            <span class="text-sm font-medium text-gray-600">
              {{ element.type === 'text' ? 'Text' : 'File' }} #{{ i + 1 }}
            </span>
            <div class="flex gap-1">
              <p-button icon="pi pi-arrow-up" size="small" severity="secondary" [text]="true" [disabled]="i === 0" (onClick)="conditionsStore.moveElementUp(i)"></p-button>
              <p-button icon="pi pi-arrow-down" size="small" severity="secondary" [text]="true" [disabled]="i === elements.length - 1" (onClick)="conditionsStore.moveElementDown(i)"></p-button>
              <p-button icon="pi pi-trash" size="small" severity="danger" [text]="true" (onClick)="conditionsStore.removeElement(i)"></p-button>
            </div>
          </div>

          @if (element.type === 'text') {
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Content</label>
              <textarea [(ngModel)]="element.text" (ngModelChange)="textChanged(element.id, $event)" rows="4" class="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
          } @else if (element.type === 'file') {
            <app-file-element [fileId]="element.file" (fileIdChanged)="conditionsStore.updateFile(element.id, $event)"></app-file-element>
          }
        </div>
      }
      <div class="flex justify-center gap-2">
        <p-button label="Text" icon="pi pi-plus" severity="info" (onClick)="conditionsStore.addTextElement()"></p-button>
        <p-button label="File" icon="pi pi-upload" severity="info" (onClick)="conditionsStore.addFileElement()"></p-button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskElementsListComponent {

  conditionsStore = inject(ConditionsStore);

  elements = this.conditionsStore.questionElements;

  textChanged(elementId: string, text: string) {
    this.elements.update(list => list.map(el => el.id === elementId ? ({...el, text}) : el));
  }

}
