import {Component, computed, effect, inject, signal} from '@angular/core';
import {TagEditorComponent} from './tag-editor.component';
import {CommonModule} from '@angular/common';
import {ActivatedRoute, Router} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {ButtonModule} from 'primeng/button';
import {CardModule} from 'primeng/card';
import {InputTextModule} from 'primeng/inputtext';
import {TextareaModule} from 'primeng/textarea';
import {SelectModule} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {FileUploadModule} from 'primeng/fileupload';
import {TooltipModule} from 'primeng/tooltip';
import {ProgressSpinnerModule} from 'primeng/progressspinner';
import {PopoverModule} from 'primeng/popover';
import {TaskService} from '../services/task.service';
import {SavedResponseService} from '../services/saved-response.service';
import {Condition, SavedResponse, SavedResponseRequest, StructuredOutput, Task, TaskDetails} from '../models/task.models';
import {TaskElementsListComponent} from './task-elements/task-elements-list.component';
import {StructuredOutputEditorComponent} from './structured-output-editor.component';
import {VerificationConditionsListComponent} from './verification-conditions/verification-conditions-list.component';
import {generateId} from '../utils/id.util';
import {normalizeConditions} from '../utils/normalize-condition.util';
import {ConditionsStore} from '../store/conditions.store';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {ModelForCategory} from '../models/model.models';
import {EvaluationStore} from '../store/evaluation.store';
import {CategoriesStore} from '../store/categories.store';
import {CheckboxModule} from 'primeng/checkbox';
import {TableModule} from 'primeng/table';
import {EvaluationResultsComponent} from './evaluation-results.component';
import {ConfirmationService, MessageService} from 'primeng/api';
import {CONDITION_LABELS} from './conditions/condition-types';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    InputNumberModule,
    FileUploadModule,
    TooltipModule,
    ProgressSpinnerModule,
    PopoverModule,
    TaskElementsListComponent,
    StructuredOutputEditorComponent,
    VerificationConditionsListComponent,
    ConfirmDialogModule,
    TagEditorComponent,
    CheckboxModule,
    TableModule,
    EvaluationResultsComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6">
      <div class="flex mb-4">
        <div class="flex gap-2 justify-between items-center w-full">
          <p-button icon="pi pi-arrow-left" label="Tasks list" severity="secondary" (onClick)="cancel()"></p-button>

          <div class="flex items-center gap-2">
            <app-tag-editor
              [tags]="tags()"
              (tagsChange)="onTagsChange($event)"
              [taskId]="taskId()"
            ></app-tag-editor>
            @if (category(); as currentCategory) {
              <div class="flex items-center gap-2">
                <p-button
                  [label]="currentCategory"
                  [outlined]="false"
                  [style]="{
                    color: getCategoryColor(currentCategory, 'primary'),
                    'border-color': getCategoryColor(currentCategory, 'primary'),
                    'background-color': getCategoryColor(currentCategory, 'secondary')
                  }"
                  styleClass="!text-sm"
                ></p-button>
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  severity="secondary"
                  (onClick)="op.toggle($event)"
                  [style]="{ 'border-color': '#C0C0C0' }"
                ></p-button>
                <p-popover #op>
                  <div class="flex flex-col gap-2 w-48">
                    @for (cat of categories(); track cat.name) {
                      <p-button
                        [label]="cat.name"
                        [style]="{
                          color: cat.primaryColor,
                          'border-color': cat.primaryColor,
                          'background-color': cat.secondaryColor
                        }"
                        styleClass="w-full !text-sm !justify-start"
                        (onClick)="updateCategory(cat.name); op.hide()"
                      ></p-button>
                    }
                  </div>
                </p-popover>
              </div>
            }
            @if (!isNewTask()) {
              <p-button label="Delete" severity="danger" [outlined]="true" (onClick)="confirmDeleteTask()"></p-button>
            }
            <p-button label="Save" (onClick)="save()" [loading]="saving()"
                      [disabled]="!conditionsStore.areAllConditionsValid()"></p-button>
          </div>
        </div>
      </div>

      @if (userAdded() || dateAdded()) {
        <div class="flex justify-end mb-4">
          <div class="text-sm text-gray-500 flex gap-1">
            @if (userAdded() && dateAdded()) {
              <div>Added by <strong>{{ userAdded() }}</strong> on {{ dateAdded() | date:'yyyy-MM-dd HH:mm' }}</div>
            }
            @if (userModified() && dateModified()) {
              <div>| Modified by <strong>{{ userModified() }}</strong> on {{ dateModified() | date:'yyyy-MM-dd HH:mm' }}</div>
            }
          </div>
        </div>
      }

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <p-card>
            <ng-template pTemplate="header">
              <div class="flex justify-between items-center p-4 pb-0">
                <h2 class="text-lg font-semibold">Task</h2>
              </div>
            </ng-template>
            <app-task-elements-list/>
          </p-card>

          @if (category() === 'Structured extraction') {
            <app-structured-output-editor
              [structuredOutput]="structuredOutput()"
              (structuredOutputChange)="onStructuredOutputChange($event)"
            ></app-structured-output-editor>
          }
        </div>

        <div class="space-y-4">
          <p-card>
            <ng-template pTemplate="header">
              <div class="flex justify-between items-center p-4 pb-0">
                <h2 class="text-lg font-semibold">Verification</h2>
              </div>
            </ng-template>

            <app-verification-conditions-list [category]="category()"/>
          </p-card>
        </div>

        <div class="space-y-4 col-span-2">
          <p-card>
            <ng-template pTemplate="header">
              <div class="flex justify-between items-center p-4 pb-0">
                <h2 class="text-lg font-semibold">Models</h2>
              </div>
            </ng-template>
            <div class="space-y-4">
              <div class="flex gap-2">
                @if (availableModels().length === 0) {
                  @if (loadingModels()) {
                    <div>Loading models...</div>
                  } @else {
                    No models available for this category.
                  }
                } @else {
                  @for (model of availableModels(); track model.model_id) {
                    <p-button
                      [label]="model.model_id"
                      [outlined]="!model.selected"
                      (onClick)="toggleModelSelection(model)"
                      styleClass="!text-sm"
                      [style]="{ 'background-color': model.selected ? '#2196F3' : 'transparent', 'color': model.selected ? 'white' : '#2196F3', 'border-color': '#2196F3' }"
                    ></p-button>
                  }
                }
              </div>
              <div class="flex justify-center">
                <p-button
                  label="Generate"
                  (onClick)="evaluateModels()"
                  [loading]="evaluatingModels()"
                  [disabled]="!hasSelectedModels()"
                ></p-button>
              </div>
              <app-evaluation-results
                [evaluationResults]="evaluationResults()"
                [evaluatingModelIds]="evaluatingModelIds()"
                [availableModelIds]="availableModelIds()"
                [hasStructCondition]="hasStructCondition()"
                [category]="category() ?? ''"
                [conditions]="verificationConditions()"
                (evaluateSingleModel)="evaluateSingleModel($event)"
              ></app-evaluation-results>
            </div>
          </p-card>
        </div>
      </div>
      <p-confirmDialog/>
    </div>
  `
})
export class TaskDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private taskService = inject(TaskService);
  private savedResponseService = inject(SavedResponseService);

  conditionsStore = inject(ConditionsStore);
  evaluationStore = inject(EvaluationStore);
  categoriesStore = inject(CategoriesStore);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  questionElements = this.conditionsStore.questionElements;
  verificationConditions = this.conditionsStore.verificationConditions;

  availableModels = this.evaluationStore.availableModels;
  loadingModels = this.evaluationStore.loadingModels
  evaluatingModels = this.evaluationStore.evaluatingModels;
  evaluatingModelIds = this.evaluationStore.evaluatingModelIds;
  evaluationResults = this.evaluationStore.evaluationResults;
  hasSelectedModels = this.evaluationStore.hasSelectedModels;
  availableModelIds = computed(() => this.availableModels().map(m => m.model_id));

  taskId = signal<string>('');

  isNewTask = signal(false);
  saving = signal(false);
  category = signal<string | null>(null);
  tags = signal<string[]>([]);

  structuredOutput = signal<StructuredOutput | undefined>(undefined);

  userAdded = signal<string | null>(null);
  dateAdded = signal<string | null>(null);
  userModified = signal<string | null>(null);
  dateModified = signal<string | null>(null);

  categories = this.categoriesStore.categories;

  private readonly returnCategory: string | null = null;
  private readonly returnTags: string[] = [];

  constructor() {
    const navigation = this.router.getCurrentNavigation();
    this.returnCategory = navigation?.extras?.state?.['returnCategory'] || null;
    this.returnTags = navigation?.extras?.state?.['returnTags'] || [];

    effect(() => {
      const currentCategory = this.category();
      if (currentCategory) {
        this.evaluationStore.loadModelsForCategory(currentCategory);
      }
    });

    effect(() => {
      this.conditionsStore.hasStructuredOutput.set(!!this.structuredOutput());
    });

    this.route.params.subscribe(() => {
      const category = this.route.snapshot.queryParamMap.get('category');
      if (category) this.category.set(category);

      this.evaluationStore.reset();
      const taskId = this.route.snapshot.paramMap.get('id');
      if (taskId && taskId !== 'new') {
        this.taskId.set(taskId);
        this.isNewTask.set(false);
        this.conditionsStore.reset();
        this.loadTask(taskId);
      } else {
        this.taskId.set(generateId());
        this.isNewTask.set(true);
        this.conditionsStore.reset();
      }
    });
  }

  loadTask(id: string) {
    this.taskService.getTask(id).subscribe({
      next: (task) => {
        if (!task) {
          this.handleTaskNotFound();
          return;
        }
        const contentWithIds = (task.details.content || [])
          .map((el, index) => ({...el, id: generateId()}));
        this.questionElements.set(contentWithIds);
        const conditionsWithIds = (task.details.conditions || []).map(cond => ({...cond, id: cond.id || generateId()}));
        this.verificationConditions.set(conditionsWithIds);
        this.category.set(task.details.category || null);
        this.tags.set(task.details.tags || []);

        this.structuredOutput.set(task.details.structured_output);

        this.refreshMetadata(task);

        this.loadSavedResponses(id);
      },
      error: (error) => {
        if (error?.status === 404) {
          this.handleTaskNotFound();
          return;
        }
        console.error('Error loading task:', error);
      }
    });
  }

  private handleTaskNotFound() {
    this.messageService.add({
      severity: 'info',
      summary: 'Task not found',
      detail: 'The requested task does not exist or has been deleted.',
      life: 5000
    });
    this.router.navigate(['/tasks']);
  }

  private loadSavedResponses(taskId: string) {
    this.savedResponseService.getAllForTask(taskId).subscribe({
      next: (responses) => {
        if (responses && responses.length > 0) {
          const evalResults = responses.map(response => this.convertToEvalSample(response));
          this.evaluationStore.evaluationResults.set(evalResults);
        }
      },
      error: (error) => {
        console.error('Error loading saved responses:', error);
      }
    });
  }

  private convertToEvalSample(response: SavedResponse) {
    const scores = response.scores || [];

    return {
      id: response.task_id,
      model_id: response.model_id,
      answer: response.answer,
      scores: scores,
      last_exception: undefined
    };
  }

  taskData = computed((): TaskDetails => {
    const hasStructuredOutput = !!this.structuredOutput();
    const conditions = this.verificationConditions().filter(c => {
      if (c.type === 'struct' && hasStructuredOutput && this.isStructConditionEmpty(c)) {
        return false;
      }
      return true;
    });
    const processedConditions = normalizeConditions(conditions, this.conditionsStore.conditionConfigs());

    return {
      id: this.isNewTask() ? generateId() : this.route.snapshot.paramMap.get('id') || '',
      category: this.category() || this.route.snapshot.queryParamMap.get('category') || '',
      tags: this.tags(),
      content: this.questionElements(),
      conditions: processedConditions,
      files: [],
      structured_output: this.structuredOutput()
    } as TaskDetails;
  });

  save() {
    const schemaErrors = this.validateStructuredOutput();
    if (schemaErrors.length > 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Structured Output schema is invalid',
        detail: schemaErrors.join('\n'),
        life: 8000
      });
      return;
    }

    this.saving.set(true);

    this.taskService.saveTask(this.taskData()).subscribe({
      next: (savedTask) => {
        this.refreshMetadata(savedTask);
        this.savePendingResponses(savedTask.id);
      },
      error: (error) => {
        console.error('Error saving task:', error);
        this.saving.set(false);
      }
    });
  }

  private savePendingResponses(taskId: string) {
    const pendingResponses = this.evaluationStore.getPendingResponses();

    if (pendingResponses.length === 0) {
      this.saving.set(false);
      this.router.navigate(['/tasks', taskId]);
      return;
    }

    const requests: SavedResponseRequest[] = pendingResponses.map(response => ({
      task_id: taskId,
      model_id: response.model_id,
      answer: response.answer,
      scores: response.scores || []
    }));

    this.savedResponseService.saveBatch(requests).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/tasks', taskId]);
      },
      error: (error) => {
        console.error('Error saving responses:', error);
        this.saving.set(false);
        this.router.navigate(['/tasks', taskId]);
      }
    });
  }

  cancel() {
    const queryParams: any = {};
    if (this.returnCategory) {
      queryParams.category = this.returnCategory;
    }
    if (this.returnTags.length > 0) {
      queryParams.tags = this.returnTags.join(',');
    }
    this.router.navigate(['/tasks'], { queryParams });
  }

  confirmDeleteTask(): void {
    this.confirmationService.confirm({
      message: 'Do you want to delete this task?',
      header: 'Confirmation',
      icon: 'pi pi-info-circle',
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true,
      },
      acceptButtonProps: {
        label: 'Delete',
        severity: 'danger',
      },
      accept: () => {
        this.taskService.deleteTask(this.taskId()).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Task deleted successfully' });
            this.cancel();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete task' });
            console.error('Error deleting task: ', err);
          },
        });
      },
    });
  }

  toggleModelSelection(model: ModelForCategory) {
    model.selected = !model.selected;
  }

  evaluateModels() {
    const schemaErrors = this.validateStructuredOutput();
    if (schemaErrors.length > 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Structured Output schema is invalid',
        detail: schemaErrors.join('\n'),
        life: 8000
      });
      return;
    }

    const taskId = this.taskId();

    if (taskId) {
      this.savedResponseService.deleteForTask(taskId).subscribe({
        next: () => {
          this.performEvaluation();
        },
        error: (error) => {
          console.error('Error deleting responses:', error);
          this.performEvaluation();
        }
      });
    } else {
      this.performEvaluation();
    }
  }

  private performEvaluation() {
    this.evaluationStore.evaluateModels(
      this.taskId() || '',
      this.category() || this.route.snapshot.queryParamMap.get('category') || '',
      this.questionElements(),
      normalizeConditions(this.verificationConditions(), this.conditionsStore.conditionConfigs()),
      this.structuredOutput()
    );
  }

  evaluateSingleModel(modelId: string) {
    this.evaluationStore.evaluateSingleModel(
      modelId,
      this.taskId() || '',
      this.category() || this.route.snapshot.queryParamMap.get('category') || '',
      this.questionElements(),
      normalizeConditions(this.verificationConditions(), this.conditionsStore.conditionConfigs()),
      this.structuredOutput()
    );
  }

  hasStructCondition = computed(() => {
    return this.verificationConditions().some(c => c.type === 'struct') || !!this.structuredOutput();
  });

  onTagsChange(newTags: string[]): void {
    this.tags.set(newTags);
  }

  updateCategory(categoryName: string) {
    const currentConditions = this.verificationConditions();
    if (currentConditions.length > 0) {
      const allowedTypes = this.categoriesStore.allowedTypesFor(categoryName);
      const incompatibleTypes = [...new Set(
        currentConditions.filter(c => !allowedTypes.includes(c.type)).map(c => c.type)
      )];
      if (incompatibleTypes.length > 0) {
        const labels = incompatibleTypes.map(t => CONDITION_LABELS[t] ?? t);
        this.messageService.add({
          severity: 'warn',
          summary: 'Category change blocked',
          detail: `Task contains conditions not supported in category "${categoryName}": ${labels.join(', ')}. Remove them before changing the category.`,
          life: 6000
        });
        return;
      }
    }
    this.category.set(categoryName);
  }

  getCategoryColor(categoryName: string, type: 'primary' | 'secondary'): string {
    const colors = this.categoriesStore.getCategoryColor(categoryName);
    return type === 'primary' ? colors.primary : colors.secondary;
  }

  private validateStructuredOutput(): string[] {
    const output = this.structuredOutput();
    if (!output) return [];

    const errors: string[] = [];
    const seenNames = new Map<string, number>();

    output.fields.forEach((field, i) => {
      const num = i + 1;
      if (!field.name?.trim()) errors.push(`Field #${num}: name is empty`);
      if (!field.type?.trim()) errors.push(`Field #${num}: type is not selected`);
      if (!field.description?.trim()) errors.push(`Field #${num}: description is empty`);

      const normalized = field.name?.trim().toLowerCase();
      if (normalized) {
        if (seenNames.has(normalized)) {
          errors.push(`Field #${num} has the same name as field #${seenNames.get(normalized)}: "${field.name.trim()}"`);
        } else {
          seenNames.set(normalized, num);
        }
      }
    });

    const structCondition = this.verificationConditions().find(c => c.type === 'struct');
    if (structCondition && !this.isStructConditionEmpty(structCondition)) {
      errors.push(...this.compareExpectedJsonWithSchema(output, structCondition));
    }

    return errors;
  }

  private isStructConditionEmpty(c: Condition): boolean {
    const expected: any = (c as any).expected;
    if (expected == null) return true;
    if (typeof expected === 'string') return !expected.trim();
    if (Array.isArray(expected)) return expected.length === 0;
    if (typeof expected === 'object') return Object.keys(expected).length === 0;
    return false;
  }

  private compareExpectedJsonWithSchema(output: StructuredOutput, condition: Condition): string[] {
    const raw: any = (condition as any).expected;
    let parsed: any;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return [];
    }

    const sample = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)) return [];

    const declaredFields = output.fields.filter(f => !!f.name?.trim());
    const declaredNames = new Set(declaredFields.map(f => f.name.trim()));
    const expectedKeys = Object.keys(sample);

    const errors: string[] = [];
    if (expectedKeys.length !== declaredFields.length) {
      errors.push(`Expected JSON has ${expectedKeys.length} field(s) but Structured Output declares ${declaredFields.length}`);
    }

    const undeclared = expectedKeys.filter(k => !declaredNames.has(k));
    if (undeclared.length > 0) {
      errors.push(`Expected JSON contains fields not declared in Structured Output: ${undeclared.join(', ')}`);
    }

    const missing = [...declaredNames].filter(n => !expectedKeys.includes(n));
    if (missing.length > 0) {
      errors.push(`Expected JSON is missing fields declared in Structured Output: ${missing.join(', ')}`);
    }

    return errors;
  }

  private refreshMetadata(task: Task) {
    this.userAdded.set(task.user_added || null);
    this.dateAdded.set(task.date_added || null);
    this.userModified.set(task.user_modified || null);
    this.dateModified.set(task.date_modified || null);
  }

  onStructuredOutputChange(output: StructuredOutput | undefined) {
    this.structuredOutput.set(output);
  }
}
