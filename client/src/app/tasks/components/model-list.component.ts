import {Component, inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, RouterLink} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {SkeletonModule} from 'primeng/skeleton';
import {MessageModule} from 'primeng/message';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {ConfirmationService, MessageService} from 'primeng/api';
import {ModelService} from '../services/model.service';
import {ModelDetailsAndProperties} from '../models/model.models';
import {BehaviorSubject, catchError, map, of, startWith, switchMap} from 'rxjs';
import {CategoriesStore} from '../store/categories.store';

@Component({
  selector: 'app-model-list',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    SkeletonModule,
    MessageModule,
    ConfirmDialogModule,
    RouterLink,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="container mx-auto px-4 py-6">
      <p-button icon="pi pi-arrow-left" label="Tasks list" severity="secondary" routerLink="/"></p-button>

      <div class="flex justify-between items-center mb-6 mt-4">
        <h1 class="text-3xl font-bold text-gray-900">Models</h1>
        <p-button
          label="Add New Model"
          icon="pi pi-plus"
          severity="success"
          (onClick)="addModel()"
        ></p-button>
      </div>

      <p-card>
        @if (modelsViewModel$ | async; as vm) {
          @if (vm.isLoading) {
            <div class="space-y-4">
              @for (item of [1, 2, 3, 4, 5]; track item) {
                <div class="flex gap-4 items-center">
                  <p-skeleton width="100%" height="1.5rem"></p-skeleton>
                  <p-skeleton width="10rem" height="1.5rem"></p-skeleton>
                  <p-skeleton width="8rem" height="1.5rem"></p-skeleton>
                </div>
              }
            </div>
          } @else if (vm.error) {
            <p-message severity="error">{{ vm.error }}</p-message>
          } @else {
            @if (vm.models.length === 0) {
              <div class="text-center py-12">
                <i class="pi pi-info-circle text-5xl text-gray-400 mb-4"></i>
                <p class="text-gray-600 text-lg">No Models</p>
                <p class="text-gray-500 text-sm mt-2">Add a new model to get started</p>
              </div>
            } @else {
              <p-table
                [value]="vm.models"
                [tableStyle]="{ 'min-width': '50rem' }"
                class="p-datatable-striped"
              >
                <ng-template pTemplate="header">
                  <tr>
                    <th class="font-semibold">Model ID</th>
                    <th class="font-semibold">Categories</th>
                    <th style="width: 140px" class="font-semibold text-center">Actions</th>
                  </tr>
                </ng-template>

                <ng-template pTemplate="body" let-model>
                  <tr class="hover:bg-gray-50">
                    <td>
                      <span class="font-medium text-gray-900">{{ model.details.id }}</span>
                    </td>
                    <td>
                      <div class="flex flex-wrap gap-2">
                        @for (category of getAllCategories(model); track category.category) {
                          <span
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            [style.background-color]="category.selected ? getCategoryColor(category.category).secondary : '#f3f4f6'"
                            [style.color]="category.selected ? getCategoryColor(category.category).primary : '#9ca3af'"
                            [style.opacity]="category.selected ? '1' : '0.7'"
                          >
                            {{ category.category }}
                          </span>
                        }
                        @if (getAllCategories(model).length === 0) {
                          <span class="text-gray-400 text-sm">No categories</span>
                        }
                      </div>
                    </td>
                    <td>
                      <div class="flex gap-2 justify-center">
                        <p-button
                          icon="pi pi-pencil"
                          [rounded]="true"
                          severity="info"
                          [outlined]="true"
                          (onClick)="editModel(model.details.id)"
                        ></p-button>
                        <p-button
                          icon="pi pi-trash"
                          [rounded]="true"
                          severity="danger"
                          [outlined]="true"
                          (onClick)="confirmDelete(model.details.id, $event)"
                        ></p-button>
                      </div>
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            }
          }
        }
      </p-card>

      <p-confirmDialog/>
    </div>
  `
})
export class ModelListComponent implements OnInit {
  private readonly modelService = inject(ModelService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly categoriesStore = inject(CategoriesStore);

  private refreshModelsSubject = new BehaviorSubject<void>(undefined);

  modelsViewModel$ = this.refreshModelsSubject.pipe(
    startWith(undefined),
    switchMap(() =>
      this.modelService.getModels({offset: 0, limit: 100}).pipe(
        map(models => ({
          models,
          isLoading: false,
          error: null
        })),
        startWith({models: [], isLoading: true, error: null}),
        catchError((err) => {
          console.error('Error loading models:', err);
          return of({
            models: [],
            isLoading: false,
            error: 'Error loading models list'
          });
        })
      )
    )
  );

  ngOnInit(): void {
    this.loadModels();
  }

  loadModels(): void {
    this.refreshModelsSubject.next(undefined);
  }

  addModel(): void {
    this.router.navigate(['/models/new']);
  }

  editModel(modelId: string): void {
    this.router.navigate(['/models/edit', modelId]);
  }

  confirmDelete(modelId: string, event: Event): void {
    event.stopPropagation();
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Are you sure you want to delete this model?',
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: () => {
        this.deleteModel(modelId);
      }
    });
  }

  private deleteModel(modelId: string): void {
    this.modelService.deleteModel(modelId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Model deleted successfully'
        });
        this.loadModels();
      },
      error: (err) => {
        console.error('Error deleting model:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete model'
        });
      }
    });
  }

  getAllCategories(model: ModelDetailsAndProperties): { category: string; selected: boolean }[] {
    if (!model.properties?.categories) {
      return [];
    }
    return model.properties.categories;
  }

  getCategoryColor(categoryName: string): { primary: string; secondary: string } {
    return this.categoriesStore.getCategoryColor(categoryName);
  }
}
