import {Component, inject, signal} from '@angular/core';
import {NavbarComponent} from './components/navbar.component';
import {RouterOutlet} from '@angular/router';
import {AuthStore} from './auth/store/auth.store';
import {CommonModule} from '@angular/common';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [
    NavbarComponent,
    RouterOutlet,
    CommonModule,
    ToastModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly authStore = inject(AuthStore);
  protected readonly title = signal('multimodal-benchmark-client');
}
