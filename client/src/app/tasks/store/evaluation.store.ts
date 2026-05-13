import {computed, inject, Injectable, signal} from '@angular/core';
import {ChatMessage, Condition, SavedResponseRequest, StructuredOutput, TaskDetails} from '../models/task.models';
import {generateId} from '../utils/id.util';
import {EvalSample, ModelForCategory} from '../models/model.models';
import {catchError} from 'rxjs/operators';
import {merge, of} from 'rxjs';
import {ModelService} from '../services/model.service';
import {SavedResponseService} from '../services/saved-response.service';

@Injectable({ providedIn: 'root' })
export class EvaluationStore {

  private modelService = inject(ModelService);
  private savedResponseService = inject(SavedResponseService);

  readonly availableModels = signal<ModelForCategory[]>([]);
  readonly loadingModels = signal(false);
  readonly evaluatingModels = signal(false);
  readonly evaluatingModelIds = signal<string[]>([]);
  readonly evaluationResults = signal<EvalSample[]>([]);

  hasSelectedModels = computed(() => this.availableModels().some(model => model.selected));

  loadModelsForCategory(category: string) {
    if (!category) {
      this.loadingModels.set(false);
      this.availableModels.set([]);
      return;
    }

    this.loadingModels.set(true);

    this.modelService.getModelsForCategory(category).subscribe({
      next: (models) => {
        this.availableModels.set(models);
        this.loadingModels.set(false);
      },
      error: (error) => {
        console.error('Error loading models:', error);
        this.loadingModels.set(false);
      }
    });
  }

  evaluateModels(id: string, category: string, content: ChatMessage[], conditions: Condition[], structuredOutput?: StructuredOutput) {
    this.evaluatingModels.set(true);

    const selectedModels = this.availableModels().filter(model => model.selected);
    const selectedModelIds = selectedModels.map(model => model.model_id);

    this.evaluatingModelIds.set(selectedModelIds);

    const taskData: TaskDetails = {
      id: id || generateId(),
      category,
      tags: [],
      content,
      conditions,
      files: [],
      structured_output: structuredOutput
    };

    const initialResults: EvalSample[] = selectedModels.map(model => ({
      id: model.model_id,
      model_id: model.model_id,
      answer: 'Loading...',
      scores: [],
      last_exception: undefined
    }));
    this.evaluationResults.set(initialResults);

    const evaluationObservables = selectedModels.map(model =>
      this.modelService.evaluateModel(model.model_id, taskData).pipe(
        catchError(error => of({
          id: taskData.id,
          model_id: model.model_id,
          answer: '',
          scores: [],
          last_exception: error.message || 'Unknown error during evaluation.'
        } as EvalSample))
      )
    );

    merge(...evaluationObservables).subscribe({
      next: (result: EvalSample) => {
        this.evaluatingModelIds.update(ids => ids.filter(id => id !== result.model_id));

        this.evaluationResults.update(currentResults => {
          const index = currentResults.findIndex(r => r.model_id === result.model_id);
          if (index > -1) {
            const newResults = [...currentResults];
            newResults[index] = result;
            return newResults;
          }
          return [...currentResults, result];
        });

        if (!result.last_exception && result.answer && result.answer !== 'Loading...') {
          const request: SavedResponseRequest = {
            task_id: taskData.id,
            model_id: result.model_id,
            answer: result.answer,
            scores: result.scores
          };
          this.savedResponseService.save(request).subscribe();
        }
      },
      error: (error) => {
        console.error('Error during models evaluation:', error);
        this.evaluatingModels.set(false);
      },
      complete: () => {
        this.evaluatingModels.set(false);
      }
    });
  }

  evaluateSingleModel(modelId: string, id: string, category: string, content: ChatMessage[], conditions: Condition[], structuredOutput?: StructuredOutput) {
    this.evaluatingModelIds.update(ids => [...ids, modelId]);

    const taskData: TaskDetails = {
      id: id || generateId(),
      category,
      tags: [],
      content,
      conditions,
      files: [],
      structured_output: structuredOutput
    };

    this.evaluationResults.update(currentResults => {
      const index = currentResults.findIndex(r => r.model_id === modelId);
      const loadingResult: EvalSample = {
        id: modelId,
        model_id: modelId,
        answer: 'Loading...',
        scores: [],
        last_exception: undefined
      };
      if (index > -1) {
        const newResults = [...currentResults];
        newResults[index] = loadingResult;
        return newResults;
      }
      return [...currentResults, loadingResult];
    });

    this.modelService.evaluateModel(modelId, taskData).pipe(
      catchError(error => of({
        id: taskData.id,
        model_id: modelId,
        answer: '',
        scores: [],
        last_exception: error.message || 'Unknown error during evaluation.'
      } as EvalSample))
    ).subscribe({
      next: (result: EvalSample) => {
        this.evaluationResults.update(currentResults => {
          const index = currentResults.findIndex(r => r.model_id === result.model_id);
          if (index > -1) {
            const newResults = [...currentResults];
            newResults[index] = result;
            return newResults;
          }
          return [...currentResults, result];
        });
      },
      error: (error) => {
        console.error(`Error evaluating model ${modelId}:`, error);
        this.evaluatingModelIds.update(ids => ids.filter(id => id !== modelId));
      },
      complete: () => {
        this.evaluatingModelIds.update(ids => ids.filter(id => id !== modelId));
      }
    });
  }

  reset() {
    this.evaluationResults.set([]);
    this.loadingModels.set(false);
  }

  getPendingResponses(): EvalSample[] {
    return this.evaluationResults().filter(r =>
      !r.last_exception && r.answer && r.answer !== 'Loading...'
    );
  }

}
