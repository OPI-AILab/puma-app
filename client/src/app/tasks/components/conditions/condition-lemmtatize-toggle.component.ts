import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CheckboxModule} from 'primeng/checkbox';

@Component({
  selector: 'app-condition-lemmatize-toggle',
  standalone: true,
  imports: [FormsModule, CheckboxModule],
  template: `
    <p-checkbox
      [(ngModel)]="model.lemmatize"
      binary="true"
      [inputId]="checkboxId"
    ></p-checkbox>
    <label [for]="checkboxId" class="ml-2">Lemmatize</label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConditionLemmatizeToggleComponent {
  @Input() model: any;
  @Input() checkboxId!: string;
}
