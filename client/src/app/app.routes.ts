import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, setupGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'setup',
    loadComponent: () => import('./auth/components/setup.component').then(m => m.SetupComponent),
    canActivate: [setupGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/components/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'tasks',
    loadComponent: () => import('./tasks/components/task-list.component').then(m => m.TaskListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'tasks/:id',
    loadComponent: () => import('./tasks/components/task-detail.component').then(m => m.TaskDetailComponent),
    canActivate: [authGuard],
    runGuardsAndResolvers: 'always'
  },
  {
    path: 'models',
    loadComponent: () => import('./tasks/components/model-list.component').then(m => m.ModelListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'models/new',
    loadComponent: () => import('./tasks/components/model-form.component').then(m => m.ModelFormComponent),
    canActivate: [authGuard]
  },
  {
    path: 'models/edit/:id',
    loadComponent: () => import('./tasks/components/model-form.component').then(m => m.ModelFormComponent),
    canActivate: [authGuard]
  },
  {
    path: 'stats',
    loadComponent: () => import('./stats/components/weekly-stats.component').then(m => m.WeeklyStatsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'evaluations',
    loadComponent: () => import('./evaluations/components/evaluation-list.component').then(m => m.EvaluationListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'evaluations/:id',
    loadComponent: () => import('./evaluations/components/evaluation-detail.component').then(m => m.EvaluationDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'logs/:importId',
    loadComponent: () => import('./logs/components/log-list.component').then(m => m.LogListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/components/admin-panel.component').then(m => m.AdminPanelComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
