export interface Settings {
  id: 1;
  parent_name: string;
  current_student_id: number | null;
  timezone: string;
  created_at: number;
  updated_at: number;
}

export interface Student {
  id: number;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface Day {
  date: string; // YYYY-MM-DD
  student_id: number;
  is_homeschool_day: boolean;
  notes: string;
  created_at: number;
  updated_at: number;
}

export interface Photo {
  id: number;
  date: string; // YYYY-MM-DD
  student_id: number;
  file_path: string; // Relative path
  caption: string;
  created_at: number;
}

export interface DayUpdate {
  is_homeschool_day?: boolean;
  notes?: string;
}

export interface ExportManifest {
  version: string;
  exported_at: string;
  app_version: string;
  parent_name: string;
  total_days: number;
  total_photos: number;
  date_range: {
    earliest: string;
    latest: string;
  };
}
