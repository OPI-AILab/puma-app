import {Component, computed, inject, Input, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Condition, ConditionType} from '../../models/task.models';
import {ConditionsStore} from '../../store/conditions.store';
import {CategoriesStore} from '../../store/categories.store';
import {ButtonModule} from 'primeng/button';
import {VerificationConditionComponent} from './verification-condition.component';
import {CONDITION_LABELS} from '../conditions/condition-types';

@Component({
  selector: 'app-verification-conditions-list',
  standalone: true,
  imports: [CommonModule, ButtonModule, VerificationConditionComponent],
  template: `
    <div class="space-y-4">
      @for (condition of verificationConditions(); track condition.id; let i = $index) {
        <app-verification-condition
          [condition]="condition"
          [index]="i"
          [totalConditions]="verificationConditions.length"
          (changed)="onConditionChanged($event)"
        ></app-verification-condition>
      }

      <div class="flex justify-center gap-2">
        @for (type of availableConditionTypes(); track type) {
          @switch (type) {
            @case ('include') {
              <p-button label="Include" icon="pi pi-plus" severity="info"
                        (onClick)="addCondition('include')"></p-button>
            }
            @case ('exclude') {
              <p-button label="Exclude" icon="pi pi-minus" severity="info"
                        (onClick)="addCondition('exclude')"></p-button>
            }
            @case ('order') {
              <p-button label="Order" icon="pi pi-sort" severity="info"
                        (onClick)="addCondition('order')"></p-button>
            }
            @case ('regex') {
              <p-button label="Regex" icon="pi pi-search" severity="info"
                        (onClick)="addCondition('regex')"></p-button>
            }
            @case ('wacc') {
              <p-button label="WAcc" icon="pi pi-language" severity="info"
                        (onClick)="addCondition('wacc')"></p-button>
            }
            @case ('ocr') {
              <p-button label="OCR" icon="pi pi-file" severity="info"
                        (onClick)="addCondition('ocr')"></p-button>
            }
            @case ('struct') {
              <p-button label="Structure" icon="pi pi-code" severity="info"
                        (onClick)="addCondition('struct')"></p-button>
            }
          }
        }
      </div>
    </div>
  `
})
export class VerificationConditionsListComponent {

  private _category = signal<string | null>(null);

  @Input() set category(value: string | null) {
    this._category.set(value);
  }

  conditionsStore = inject(ConditionsStore);
  categoriesStore = inject(CategoriesStore);

  verificationConditions = this.conditionsStore.verificationConditions;

  readonly availableConditionTypes = computed(() => {
    const category = this._category();
    if (!category) {
      return [];
    }
    return this.categoriesStore.allowedTypesFor(category);
  });

  addCondition(type: ConditionType) {
    this.conditionsStore.addCondition(type);
  }

  onConditionChanged(condition: Condition) {
    this.verificationConditions.update(list => list.map(c => c.id === condition.id ? ({
      ...condition,
      params: {...(condition.params as any)}
    }) : c));
  }

}
