import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ModelService } from '../services/model.service';
import { ModelDetailsAndProperties } from '../models/model.models';
import {Textarea} from 'primeng/textarea';

@Component({
  selector: 'app-model-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    Textarea
  ],
  providers: [MessageService],
  template: `
    <div class="container mx-auto px-4 py-6">
      <div class="mb-6">
          <h1 class="text-3xl font-bold text-gray-900">
            {{ isEditMode ? 'Edit Model' : 'New Model' }}
          </h1>
          @if (isEditMode && modelId) {
            <p class="text-gray-600 mt-2">ID: {{ modelId }}</p>
          }
        </div>

        @if (isLoading) {
          <p-card>
            <div class="flex items-center justify-center py-12">
              <i class="pi pi-spin pi-spinner text-4xl text-blue-500"></i>
              <span class="ml-3 text-lg text-gray-600">Loading...</span>
            </div>
          </p-card>
        } @else {
          <p-card>
            <form [formGroup]="modelForm" (ngSubmit)="save()">
              <div class="space-y-6">
                <div>
                  <label for="details" class="block text-sm font-semibold text-gray-700 mb-2">
                    Details (JSON)
                  </label>
                  <textarea
                    pInputTextarea
                    id="details"
                    formControlName="details"
                    [rows]="12"
                    class="w-full"
                    [ngClass]="{'ng-invalid ng-dirty': modelForm.get('details')?.invalid && modelForm.get('details')?.touched}"
                    placeholder='{\n  "id": "gemini-2.5-pro",\n  "model": "openai/google/gemini-2.5-pro",\n  "api_base": "http://10.20.20.235:4000/",\n  "max_tokens": 16384,\n  "threads": 1,\n  "temperature": 1\n}'
                  ></textarea>
                  @if (modelForm.get('details')?.invalid && modelForm.get('details')?.touched) {
                    <p class="mt-2 text-sm text-red-600">
                      <i class="pi pi-exclamation-circle mr-1"></i>
                      Invalid JSON format
                    </p>
                  }
                </div>

                <div>
                  <label for="properties" class="block text-sm font-semibold text-gray-700 mb-2">
                    Properties (JSON)
                  </label>
                  <textarea
                    pInputTextarea
                    id="properties"
                    formControlName="properties"
                    [rows]="10"
                    class="w-full"
                    [ngClass]="{'ng-invalid ng-dirty': modelForm.get('properties')?.invalid && modelForm.get('properties')?.touched}"
                    placeholder='{\n  "categories": [\n    {\n      "category": "History and culture",\n      "selected": true\n    }\n  ]\n}'
                  ></textarea>
                  @if (modelForm.get('properties')?.invalid && modelForm.get('properties')?.touched) {
                    <p class="mt-2 text-sm text-red-600">
                      <i class="pi pi-exclamation-circle mr-1"></i>
                      Invalid JSON format
                    </p>
                  }
                </div>

                <div class="flex gap-3 pt-4">
                  <p-button
                    type="submit"
                    [label]="isEditMode ? 'Save Changes' : 'Create Model'"
                    icon="pi pi-check"
                    [disabled]="modelForm.invalid || isSaving"
                    [loading]="isSaving"
                    severity="success"
                  ></p-button>
                  <p-button
                    type="button"
                    label="Cancel"
                    icon="pi pi-times"
                    severity="secondary"
                    [outlined]="true"
                    (onClick)="cancel()"
                    [disabled]="isSaving"
                  ></p-button>
                </div>
              </div>
            </form>
          </p-card>
        }
    </div>
  `
})
export class ModelFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly modelService = inject(ModelService);
  private readonly messageService = inject(MessageService);

  modelForm!: FormGroup;
  isEditMode = false;
  isLoading = false;
  isSaving = false;
  modelId: string | null = null;

  ngOnInit(): void {
    this.initForm();
    this.checkMode();
  }

  private initForm(): void {
    this.modelForm = this.fb.group({
      details: ['', [Validators.required, this.jsonValidator.bind(this)]],
      properties: ['', [Validators.required, this.jsonValidator.bind(this)]]
    });
  }

  private checkMode(): void {
    this.modelId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.modelId;

    if (this.isEditMode && this.modelId) {
      this.loadModel(this.modelId);
    }
  }

  private loadModel(id: string): void {
    this.isLoading = true;
    this.modelService.getModel(id).subscribe({
      next: (model) => {
        this.modelForm.patchValue({
          details: JSON.stringify(model.details, null, 2),
          properties: JSON.stringify(model.properties || { categories: [] }, null, 2)
        });
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading model:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load model'
        });
        this.isLoading = false;
        this.router.navigate(['/models']);
      }
    });
  }

  private jsonValidator(control: any): { [key: string]: any } | null {
    if (!control.value) {
      return null;
    }

    try {
      JSON.parse(control.value);
      return null;
    } catch (e) {
      return { invalidJson: true };
    }
  }

  save(): void {
    if (this.modelForm.invalid) {
      this.modelForm.markAllAsTouched();
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please check the JSON data validity'
      });
      return;
    }

    this.isSaving = true;

    try {
      const details = JSON.parse(this.modelForm.get('details')?.value);
      const properties = JSON.parse(this.modelForm.get('properties')?.value);

      const modelData: ModelDetailsAndProperties = {
        details,
        properties
      };

      const saveOperation = this.isEditMode && this.modelId
        ? this.modelService.updateModel(this.modelId, modelData)
        : this.modelService.saveModel(modelData);

      saveOperation.subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: this.isEditMode ? 'Model updated successfully' : 'Model created successfully'
          });
          this.router.navigate(['/models']);
        },
        error: (err) => {
          console.error('Error saving model:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to save model'
          });
          this.isSaving = false;
        }
      });
    } catch (e) {
      console.error('JSON parsing error:', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Invalid JSON format'
      });
      this.isSaving = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/models']);
  }
}
