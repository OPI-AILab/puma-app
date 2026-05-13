export interface WeekData {
  year: number;
  week: number;
  start_date: string;
  end_date: string;
  users: { [username: string]: number };
}

export interface WeeklyStats {
  weeks: WeekData[];
  totals: { [username: string]: number };
  all_users: string[];
}
