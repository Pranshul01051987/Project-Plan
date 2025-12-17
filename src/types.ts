export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked';

export interface Task {
  id: string;
  phase: string;
  activity: string;
  taskDetail: string;
  principle: string;
  deliverable: string;
  owner: string;
  quarter: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
}

export interface Phase {
  name: string;
  tasks: Task[];
  progress: number;
  startDate: string;
  endDate: string;
}

export interface ProjectData {
  name: string;
  tasks: Task[];
  phases: Phase[];
  lastUpdated: string;
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    overdue: number;
  };
  overallProgress: number;
}

export interface SheetConfig {
  sheetId: string;
  sheetName?: string;
  refreshInterval: number;
}


