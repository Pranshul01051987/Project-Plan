import * as XLSX from 'xlsx';
import { Task, Phase, ProjectData, TaskStatus, SheetConfig } from './types';

const STORAGE_KEY = 'psc_sheet_config';
const DATA_KEY = 'psc_project_data';

// CORS proxies
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
];

export function saveConfig(config: SheetConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function loadConfig(): SheetConfig | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function saveData(data: ProjectData): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export function loadData(): ProjectData | null {
  const stored = localStorage.getItem(DATA_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function extractSheetId(input: string): string | null {
  if (!input.includes('/') && input.length > 20) {
    return input.trim();
  }
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || null;
}

function parseDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  const str = String(value).trim();
  if (!str) return '';
  
  // Handle DD-MMM-YYYY format like "01-Oct-2025"
  const match = str.match(/(\d{1,2})-(\w{3})-(\d{4})/);
  if (match) {
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    };
    const month = months[match[2]] || '01';
    return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
  }
  
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return str;
}

function determineStatus(startDate: string, endDate: string): TaskStatus {
  if (!startDate && !endDate) return 'not-started';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  
  if (end && end < today) return 'completed';
  if (start && start <= today) return 'in-progress';
  return 'not-started';
}

function calculateProgress(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  
  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (today >= end) return 100;
  if (today <= start) return 0;
  
  const total = end.getTime() - start.getTime();
  const elapsed = today.getTime() - start.getTime();
  
  return Math.round((elapsed / total) * 100);
}

function findCol(headers: string[], keywords: string[]): number {
  const lower = headers.map(h => String(h || '').toLowerCase().trim());
  for (const kw of keywords) {
    for (let i = 0; i < lower.length; i++) {
      if (lower[i].includes(kw.toLowerCase())) return i;
    }
  }
  return -1;
}

export async function fetchProjectData(config: SheetConfig): Promise<{ success: boolean; data?: ProjectData; error?: string }> {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/export?format=xlsx`;
  
  for (const proxy of CORS_PROXIES) {
    try {
      console.log(`Trying proxy: ${proxy}`);
      const response = await fetch(`${proxy}${encodeURIComponent(exportUrl)}`);
      
      if (!response.ok) continue;
      
      const buffer = await response.arrayBuffer();
      const firstBytes = new Uint8Array(buffer.slice(0, 4));
      if (firstBytes[0] === 0x3C) continue; // HTML response
      
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = config.sheetName || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      if (!sheet) {
        return { success: false, error: `Sheet "${sheetName}" not found` };
      }
      
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      if (rows.length < 2) {
        return { success: false, error: 'No data rows found' };
      }
      
      const headers = (rows[0] as string[]).map(h => String(h || ''));
      
      // Find columns for PSC format
      const cols = {
        phase: findCol(headers, ['phase']),
        activity: findCol(headers, ['activity']),
        taskDetail: findCol(headers, ['task detail']),
        principle: findCol(headers, ['pt1 principle', 'principle']),
        deliverable: findCol(headers, ['deliverable']),
        owner: findCol(headers, ['owner']),
        quarter: findCol(headers, ['quarter']),
        startDate: findCol(headers, ['start date', 'start']),
        endDate: findCol(headers, ['end date', 'end']),
      };
      
      const tasks: Task[] = [];
      const phaseMap = new Map<string, Task[]>();
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        if (!row || row.length === 0) continue;
        
        const activity = cols.activity >= 0 ? String(row[cols.activity] || '').trim() : '';
        if (!activity) continue;
        
        const startDate = cols.startDate >= 0 ? parseDate(row[cols.startDate]) : '';
        const endDate = cols.endDate >= 0 ? parseDate(row[cols.endDate]) : '';
        const phase = cols.phase >= 0 ? String(row[cols.phase] || '').trim() : '';
        
        const task: Task = {
          id: `task-${i}`,
          phase,
          activity,
          taskDetail: cols.taskDetail >= 0 ? String(row[cols.taskDetail] || '').trim() : '',
          principle: cols.principle >= 0 ? String(row[cols.principle] || '').trim() : '',
          deliverable: cols.deliverable >= 0 ? String(row[cols.deliverable] || '').trim() : '',
          owner: cols.owner >= 0 ? String(row[cols.owner] || '').trim() : '',
          quarter: cols.quarter >= 0 ? String(row[cols.quarter] || '').trim() : '',
          startDate,
          endDate,
          status: determineStatus(startDate, endDate),
          progress: calculateProgress(startDate, endDate),
        };
        
        tasks.push(task);
        
        if (phase) {
          if (!phaseMap.has(phase)) phaseMap.set(phase, []);
          phaseMap.get(phase)!.push(task);
        }
      }
      
      // Build phases
      const phases: Phase[] = [];
      phaseMap.forEach((phaseTasks, name) => {
        const starts = phaseTasks.filter(t => t.startDate).map(t => t.startDate);
        const ends = phaseTasks.filter(t => t.endDate).map(t => t.endDate);
        const avgProgress = phaseTasks.reduce((sum, t) => sum + t.progress, 0) / phaseTasks.length;
        
        phases.push({
          name,
          tasks: phaseTasks,
          progress: Math.round(avgProgress),
          startDate: starts.length ? starts.sort()[0] : '',
          endDate: ends.length ? ends.sort().reverse()[0] : '',
        });
      });
      
      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        notStarted: tasks.filter(t => t.status === 'not-started').length,
        overdue: tasks.filter(t => t.status !== 'completed' && t.endDate && t.endDate < today).length,
      };
      
      const overallProgress = tasks.length > 0
        ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length)
        : 0;
      
      const data: ProjectData = {
        name: 'PSC Conformance Delivery Process Plan',
        tasks,
        phases,
        lastUpdated: new Date().toISOString(),
        stats,
        overallProgress,
      };
      
      console.log(`Loaded ${tasks.length} tasks, ${phases.length} phases`);
      return { success: true, data };
      
    } catch (err) {
      console.error('Proxy failed:', err);
      continue;
    }
  }
  
  return {
    success: false,
    error: 'Unable to fetch data. Make sure the sheet is shared as "Anyone with the link can view".',
  };
}


