import { useState, useEffect, useCallback } from 'react';
import { ProjectData, SheetConfig, Task } from './types';
import { fetchProjectData, saveConfig, loadConfig, saveData, loadData, extractSheetId } from './sheetService';
import './App.css';

// Your Google Sheet ID - extracted from the URL you shared
const DEFAULT_SHEET_ID = '1fyFoRxuOWI71S6ZoTkMXZpaEM3Mf00L3x-pV7NOFnYE';

function App() {
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'in-progress' | 'completed' | 'upcoming'>('all');

  const refresh = useCallback(async (config: SheetConfig) => {
    setRefreshing(true);
    setError(null);
    
    const result = await fetchProjectData(config);
    
    if (result.success && result.data) {
      setData(result.data);
      saveData(result.data);
    } else {
      setError(result.error || 'Failed to fetch data');
    }
    
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    const config = loadConfig();
    const cached = loadData();
    
    if (cached) {
      setData(cached);
      setLoading(false);
    }
    
    if (config) {
      setSheetUrl(config.sheetId);
      refresh(config);
    } else {
      // Use default sheet ID
      const defaultConfig: SheetConfig = {
        sheetId: DEFAULT_SHEET_ID,
        refreshInterval: 300,
      };
      saveConfig(defaultConfig);
      setSheetUrl(DEFAULT_SHEET_ID);
      refresh(defaultConfig);
    }
  }, [refresh]);

  const handleSaveConfig = () => {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      setError('Invalid Google Sheet URL');
      return;
    }
    
    const config: SheetConfig = {
      sheetId,
      refreshInterval: 300,
    };
    saveConfig(config);
    setShowConfig(false);
    refresh(config);
  };

  const handleRefresh = () => {
    const config = loadConfig();
    if (config) refresh(config);
  };

  const filteredTasks = data?.tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'in-progress') return task.status === 'in-progress';
    if (filter === 'upcoming') return task.status === 'not-started';
    return true;
  }) || [];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isOverdue = (task: Task) => {
    if (task.status === 'completed') return false;
    const today = new Date().toISOString().split('T')[0];
    return task.endDate && task.endDate < today;
  };

  if (loading && !data) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading project data...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="title-section">
            <h1>🎯 PSC Conformance Delivery</h1>
            <p className="subtitle">Process Plan Dashboard</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={() => setShowConfig(true)}>
              ⚙️ Settings
            </button>
            <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? '↻ Syncing...' : '↻ Sync'}
            </button>
          </div>
        </div>
        {data && (
          <p className="last-updated">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </p>
        )}
      </header>

      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {data && (
        <main className="main">
          {/* Stats Cards */}
          <section className="stats-grid">
            <div className="stat-card">
              <span className="stat-value progress">{data.overallProgress}%</span>
              <span className="stat-label">Overall Progress</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${data.overallProgress}%` }}></div>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-value total">{data.stats.total}</span>
              <span className="stat-label">Total Tasks</span>
            </div>
            <div className="stat-card">
              <span className="stat-value completed">{data.stats.completed}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat-card">
              <span className="stat-value in-progress">{data.stats.inProgress}</span>
              <span className="stat-label">In Progress</span>
            </div>
            <div className="stat-card">
              <span className="stat-value upcoming">{data.stats.notStarted}</span>
              <span className="stat-label">Upcoming</span>
            </div>
            {data.stats.overdue > 0 && (
              <div className="stat-card overdue-card">
                <span className="stat-value overdue">{data.stats.overdue}</span>
                <span className="stat-label">Overdue</span>
              </div>
            )}
          </section>

          {/* Phases Timeline */}
          <section className="phases-section">
            <h2>📅 Phases</h2>
            <div className="phases-grid">
              {data.phases.map((phase, idx) => (
                <div key={idx} className="phase-card">
                  <div className="phase-header">
                    <h3>{phase.name}</h3>
                    <span className={`phase-progress ${phase.progress === 100 ? 'done' : ''}`}>
                      {phase.progress}%
                    </span>
                  </div>
                  <div className="phase-dates">
                    {formatDate(phase.startDate)} → {formatDate(phase.endDate)}
                  </div>
                  <div className="phase-bar">
                    <div className="phase-fill" style={{ width: `${phase.progress}%` }}></div>
                  </div>
                  <div className="phase-tasks-count">
                    {phase.tasks.filter(t => t.status === 'completed').length} / {phase.tasks.length} tasks
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tasks Table */}
          <section className="tasks-section">
            <div className="tasks-header">
              <h2>📋 Tasks</h2>
              <div className="filter-tabs">
                {(['all', 'in-progress', 'completed', 'upcoming'] as const).map(f => (
                  <button
                    key={f}
                    className={`filter-btn ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'All' : f === 'in-progress' ? 'In Progress' : f === 'completed' ? 'Completed' : 'Upcoming'}
                  </button>
                ))}
              </div>
            </div>

            <div className="tasks-table-wrapper">
              <table className="tasks-table">
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Phase</th>
                    <th>Deliverable</th>
                    <th>Owner</th>
                    <th>Quarter</th>
                    <th>Timeline</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => (
                    <tr key={task.id} className={isOverdue(task) ? 'overdue-row' : ''}>
                      <td>
                        <div className="task-name">
                          <strong>{task.activity}</strong>
                          {task.taskDetail && (
                            <span className="task-detail">{task.taskDetail}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="phase-badge">{task.phase}</span>
                      </td>
                      <td className="deliverable-cell">
                        {task.deliverable || '—'}
                      </td>
                      <td>{task.owner || '—'}</td>
                      <td>
                        <span className="quarter-badge">{task.quarter}</span>
                      </td>
                      <td className="timeline-cell">
                        <span className={isOverdue(task) ? 'overdue' : ''}>
                          {formatDate(task.startDate)} → {formatDate(task.endDate)}
                          {isOverdue(task) && ' ⚠️'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${task.status}`}>
                          {task.status === 'completed' ? '✓ Done' :
                           task.status === 'in-progress' ? '↻ Active' :
                           '○ Planned'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* Config Modal */}
      {showConfig && (
        <div className="modal-overlay" onClick={() => setShowConfig(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>⚙️ Settings</h2>
            <p className="modal-desc">Connect your Google Sheet project plan</p>
            
            <label className="form-label">Google Sheet URL or ID</label>
            <input
              type="text"
              className="form-input"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
            <p className="form-hint">
              Sheet must be shared as "Anyone with the link can view"
            </p>
            
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfig(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveConfig}>
                Save & Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

