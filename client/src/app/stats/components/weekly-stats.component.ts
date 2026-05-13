import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { StatsService } from '../services/stats.service';
import { WeeklyStats, WeekData } from '../models/stats.models';
import {Button} from 'primeng/button';
import {RouterLink} from '@angular/router';

interface WeekRow {
  weekLabel: string;
  userCounts: { count: number; cumulative: number }[];
}

@Component({
  selector: 'app-weekly-stats',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    CardModule,
    SkeletonModule,
    MessageModule,
    Button,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container mx-auto px-4 py-6">
      <p-button icon="pi pi-arrow-left" label="Tasks list" severity="secondary" routerLink="/"></p-button>

      <h2 class="text-2xl font-bold mb-4 mt-4">Weekly stats</h2>

      <p-card>
        @if (isLoading()) {
          <div class="space-y-4">
            @for (item of [1, 2, 3, 4, 5]; track item) {
              <div class="flex gap-4 items-center">
                <p-skeleton width="100%" height="1.5rem"></p-skeleton>
              </div>
            }
          </div>
        } @else if (error()) {
          <p-message severity="error">{{ error() }}</p-message>
        } @else {
          <p-table [value]="weekRows()" [tableStyle]="{ 'min-width': '50rem' }">
            <ng-template pTemplate="header">
              <tr>
                <th>Week</th>
                @for (user of allUsers(); track user) {
                  <th style="text-align: right">{{ user }}</th>
                }
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-row>
              <tr>
                <td class="font-medium">{{ row.weekLabel }}</td>
                @for (userCount of row.userCounts; track $index) {
                  <td style="text-align: right">{{ userCount.count }} ({{ userCount.cumulative }})</td>
                }
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td [attr.colspan]="allUsers().length + 1" class="py-8">
                  <div class="text-gray-500 text-center">
                    <i class="pi pi-info-circle text-3xl mb-2"></i>
                    <p>No data</p>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>
    </div>
  `,
})
export class WeeklyStatsComponent implements OnInit {
  private readonly statsService = inject(StatsService);

  isLoading = signal(true);
  error = signal<string | null>(null);
  allUsers = signal<string[]>([]);
  weekRows = signal<WeekRow[]>([]);

  ngOnInit(): void {
    this.loadStats();
  }

  private loadStats(): void {
    this.statsService.getWeeklyStats().subscribe({
      next: (stats) => {
        this.allUsers.set(stats.all_users);
        this.weekRows.set(this.buildWeekRows(stats));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading weekly stats:', err);
        this.error.set('Error loading weekly stats:');
        this.isLoading.set(false);
      },
    });
  }

  private buildWeekRows(stats: WeeklyStats): WeekRow[] {
    const cumulativeTotals: { [username: string]: number } = {};
    stats.all_users.forEach(user => cumulativeTotals[user] = 0);

    const sortedWeeks = [...stats.weeks].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.week - b.week;
    });

    const rows: WeekRow[] = [];

    for (const week of sortedWeeks) {
      const userCounts: { count: number; cumulative: number }[] = [];

      for (const user of stats.all_users) {
        const count = week.users[user] || 0;
        cumulativeTotals[user] += count;
        userCounts.push({
          count,
          cumulative: cumulativeTotals[user],
        });
      }

      rows.push({
        weekLabel: this.formatWeekLabel(week),
        userCounts,
      });
    }

    return rows.reverse();
  }

  private formatWeekLabel(week: WeekData): string {
    const startDate = new Date(week.start_date);
    const endDate = new Date(week.end_date);

    const startDay = startDate.getDate().toString().padStart(2, '0');
    const startMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
    const startYear = startDate.getFullYear();

    const endDay = endDate.getDate().toString().padStart(2, '0');
    const endMonth = (endDate.getMonth() + 1).toString().padStart(2, '0');
    const endYear = endDate.getFullYear();

    return `${startDay}/${startMonth}/${startYear} - ${endDay}/${endMonth}/${endYear}`;
  }
}
