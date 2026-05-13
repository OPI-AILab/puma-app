import {Component, computed, EventEmitter, inject, Input, Output} from '@angular/core';
import {CommonModule, NgClass} from '@angular/common';
import {Condition, ConditionType} from '../../models/task.models';
import {CONDITION_LABELS} from '../conditions/condition-types';
import {ConditionsStore} from '../../store/conditions.store';
import {ButtonModule} from 'primeng/button';
import {ConditionFormComponent} from '../conditions/condition-form.component';

@Component({
  selector: 'app-verification-condition',
  standalone: true,
  imports: [CommonModule, NgClass, ButtonModule, ConditionFormComponent],
  template: `
    <div
      class="rounded-lg p-4 border"
      [ngClass]="{ 'border-red-500': !isConditionValid, 'border-gray-200': isConditionValid }"
    >
      <div class="flex justify-between items-center mb-3">
        <span class="text-sm font-medium text-gray-600">
          {{ getConditionTypeName(condition.type) }} #{{ index + 1 }}
        </span>
        <div class="flex gap-1">
          <p-button icon="pi pi-arrow-up" size="small" severity="secondary" [text]="true"
                    [disabled]="index === 0" (onClick)="this.conditionsStore.moveConditionUp(index)"></p-button>
          <p-button icon="pi pi-arrow-down" size="small" severity="secondary" [text]="true"
                    [disabled]="index === totalConditions - 1"
                    (onClick)="conditionsStore.moveConditionDown(index)"></p-button>
          <p-button icon="pi pi-trash" size="small" severity="danger" [text]="true"
                    (onClick)="conditionsStore.removeCondition(index)"></p-button>
        </div>
      </div>

      <app-condition-form
        [condition]="condition"
        [index]="index"
        (changed)="onConditionChanged()"
      ></app-condition-form>
    </div>
  `,
  host: {
    class: 'block w-full'
  },
})
export class VerificationConditionComponent {
  @Input({required: true}) condition!: Condition;
  @Input({required: true}) index!: number;
  @Input({required: true}) totalConditions!: number;

  @Output() changed = new EventEmitter<Condition>();

  conditionsStore = inject(ConditionsStore);

  getConditionTypeName(type: string): string {
    return CONDITION_LABELS[type as ConditionType] || type;
  }

  onConditionChanged() {
    this.changed.emit(this.condition);
  }

  isConditionValid = computed(() => {
    return this.conditionsStore.isConditionValid(this.condition);
  });

}
