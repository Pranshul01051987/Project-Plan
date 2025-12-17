/**
 * =====================================================
 * PSC Project Plan - Google Sheets to GitHub Sync
 * =====================================================
 * 
 * This script automatically syncs your Google Sheet
 * to GitHub Issues and Project Roadmap.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Delete any existing code and paste this entire script
 * 4. Click on "Project Settings" (gear icon) on the left
 * 5. Scroll down to "Script Properties"
 * 6. Click "Add script property" and add:
 *    - Property: GITHUB_TOKEN
 *    - Value: YOUR_GITHUB_TOKEN_HERE
 * 7. Save the script (Ctrl+S)
 * 8. Run "setupTrigger" function once to enable auto-sync
 * 9. Authorize the script when prompted
 * 
 * =====================================================
 */

// ============ CONFIGURATION ============
const CONFIG = {
  GITHUB_OWNER: 'Pranshul01051987',
  GITHUB_REPO: 'Project-Plan',
  PROJECT_NUMBER: 1,
};

// ============ MAIN FUNCTIONS ============

/**
 * Run this ONCE to set up the automatic trigger
 */
function setupTrigger() {
  // Remove any existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Create new trigger for sheet edits
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  
  // Also create a time-based trigger as backup (every 4 hours)
  ScriptApp.newTrigger('syncToGitHub')
    .timeBased()
    .everyHours(4)
    .create();
  
  SpreadsheetApp.getUi().alert('✅ Triggers set up successfully!\n\nYour sheet will now auto-sync to GitHub when edited.');
}

/**
 * Triggered when sheet is edited
 */
function onSheetEdit(e) {
  // Debounce: wait 30 seconds before syncing to batch multiple edits
  const cache = CacheService.getScriptCache();
  const lastSync = cache.get('lastSync');
  const now = new Date().getTime();
  
  if (lastSync && (now - parseInt(lastSync)) < 30000) {
    // Schedule a delayed sync
    cache.put('pendingSync', 'true', 60);
    return;
  }
  
  cache.put('lastSync', now.toString(), 300);
  syncToGitHub();
}

/**
 * Manual sync function - can be run from menu
 */
function syncToGitHub() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  try {
    Logger.log('Starting sync to GitHub...');
    
    // Get all data
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    
    // Find column indices
    const cols = {
      phase: findColumn(headers, 'phase'),
      activity: findColumn(headers, 'activity'),
      taskDetail: findColumn(headers, 'task detail'),
      pt1Principle: findColumn(headers, 'pt1 principle'),
      deliverable: findColumn(headers, 'deliverable'),
      owner: findColumn(headers, 'owner'),
      quarter: findColumn(headers, 'quarter'),
      startDate: findColumn(headers, 'start date'),
      endDate: findColumn(headers, 'end date'),
      status: findColumn(headers, 'status'),
    };
    
    if (cols.activity === -1) {
      Logger.log('Error: Activity column not found');
      return;
    }
    
    // Get existing issues
    const existingIssues = getExistingIssues();
    Logger.log('Found ' + existingIssues.length + ' existing issues');
    
    let created = 0, updated = 0;
    
    // Process each row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const activity = row[cols.activity];
      
      if (!activity || activity.toString().trim() === '') continue;
      
      const rowData = {
        phase: cols.phase >= 0 ? row[cols.phase] : '',
        activity: activity,
        taskDetail: cols.taskDetail >= 0 ? row[cols.taskDetail] : '',
        pt1Principle: cols.pt1Principle >= 0 ? row[cols.pt1Principle] : '',
        deliverable: cols.deliverable >= 0 ? row[cols.deliverable] : '',
        owner: cols.owner >= 0 ? row[cols.owner] : '',
        quarter: cols.quarter >= 0 ? row[cols.quarter] : '',
        startDate: cols.startDate >= 0 ? formatDate(row[cols.startDate]) : '',
        endDate: cols.endDate >= 0 ? formatDate(row[cols.endDate]) : '',
        status: cols.status >= 0 ? row[cols.status] : '',
      };
      
      const result = syncRow(rowData, existingIssues);
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      
      // Rate limiting
      Utilities.sleep(500);
    }
    
    Logger.log('Sync complete! Created: ' + created + ', Updated: ' + updated);
    
    // Update the sync timestamp in sheet
    updateSyncTimestamp(sheet);
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    throw error;
  }
}

/**
 * Add a custom menu to the sheet
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔄 GitHub Sync')
    .addItem('Sync Now', 'syncToGitHub')
    .addItem('Setup Auto-Sync', 'setupTrigger')
    .addItem('View Roadmap', 'openRoadmap')
    .addToUi();
}

function openRoadmap() {
  const url = 'https://github.com/users/' + CONFIG.GITHUB_OWNER + '/projects/' + CONFIG.PROJECT_NUMBER;
  const html = '<script>window.open("' + url + '");google.script.host.close();</script>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html), 'Opening Roadmap...');
}

// ============ HELPER FUNCTIONS ============

function findColumn(headers, name) {
  return headers.findIndex(h => h.includes(name));
}

function formatDate(value) {
  if (!value) return '';
  
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'GMT', 'yyyy-MM-dd');
  }
  
  // Try to parse string date
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return Utilities.formatDate(date, 'GMT', 'yyyy-MM-dd');
  }
  
  return '';
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return 'TBD';
  const date = new Date(isoDate);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return date.getDate() + '-' + months[date.getMonth()] + '-' + date.getFullYear();
}

function getPhase(phaseText) {
  if (!phaseText) return null;
  const match = phaseText.toString().match(/Phase\s*(\d)/i);
  return match ? 'Phase ' + match[1] : null;
}

function getToken() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  if (!token) {
    throw new Error('GITHUB_TOKEN not set in Script Properties. Go to Project Settings → Script Properties to add it.');
  }
  return token;
}

function updateSyncTimestamp(sheet) {
  // Add a note to cell A1 with last sync time
  const now = new Date();
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  sheet.getRange('A1').setNote('Last synced to GitHub: ' + timestamp);
}

// ============ GITHUB API FUNCTIONS ============

function githubRequest(method, endpoint, payload) {
  const token = getToken();
  const options = {
    method: method,
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };
  
  if (payload) {
    options.payload = JSON.stringify(payload);
  }
  
  const url = 'https://api.github.com' + endpoint;
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  
  if (code >= 400) {
    Logger.log('GitHub API Error: ' + response.getContentText());
    throw new Error('GitHub API Error: ' + code);
  }
  
  const content = response.getContentText();
  return content ? JSON.parse(content) : null;
}

function graphqlRequest(query, variables) {
  const token = getToken();
  const options = {
    method: 'POST',
    headers: {
      'Authorization': 'bearer ' + token,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({ query: query, variables: variables || {} }),
    muteHttpExceptions: true,
  };
  
  const response = UrlFetchApp.fetch('https://api.github.com/graphql', options);
  const result = JSON.parse(response.getContentText());
  
  if (result.errors) {
    Logger.log('GraphQL Error: ' + JSON.stringify(result.errors));
    throw new Error('GraphQL Error: ' + result.errors[0].message);
  }
  
  return result.data;
}

function getExistingIssues() {
  const issues = [];
  let page = 1;
  
  while (true) {
    const batch = githubRequest('GET', 
      '/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/issues?state=all&per_page=100&page=' + page
    );
    if (!batch || batch.length === 0) break;
    issues.push(...batch);
    page++;
  }
  
  return issues;
}

function ensureLabel(name, color) {
  try {
    githubRequest('GET', '/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/labels/' + encodeURIComponent(name));
  } catch (e) {
    if (e.message.includes('404')) {
      githubRequest('POST', '/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/labels', {
        name: name,
        color: color,
      });
    }
  }
}

function createIssueTitle(rowData) {
  const phase = getPhase(rowData.phase);
  const activity = rowData.activity || 'Untitled Task';
  return phase ? '[' + phase + '] ' + activity : activity;
}

function createIssueBody(rowData) {
  const phase = getPhase(rowData.phase);
  const lines = [];
  
  lines.push('# 📋 ' + (rowData.activity || 'Task'));
  lines.push('');
  
  // Status section
  lines.push('## 📊 Status');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push('| **Status** | ' + (rowData.status || 'Not Started') + ' |');
  lines.push('| **Phase** | ' + (phase || 'N/A') + ' |');
  lines.push('| **Owner** | ' + (rowData.owner || 'TBD') + ' |');
  lines.push('');
  
  // Timeline section
  lines.push('## 📅 Timeline');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push('| **Start Date** | ' + formatDateDisplay(rowData.startDate) + ' |');
  lines.push('| **End Date** | ' + formatDateDisplay(rowData.endDate) + ' |');
  lines.push('| **Quarter** | ' + (rowData.quarter || 'TBD') + ' |');
  lines.push('');
  
  // Task Detail
  if (rowData.taskDetail) {
    lines.push('## 📝 Task Detail');
    lines.push(rowData.taskDetail);
    lines.push('');
  }
  
  // PT1 Principle
  if (rowData.pt1Principle) {
    lines.push('## 🎯 PT1 Principle');
    lines.push(rowData.pt1Principle);
    lines.push('');
  }
  
  // Deliverable
  if (rowData.deliverable) {
    lines.push('## 📦 Deliverable');
    lines.push(rowData.deliverable);
    lines.push('');
  }
  
  lines.push('---');
  lines.push('*🔄 Auto-synced from Google Sheet on ' + Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd HH:mm') + '*');
  
  return lines.join('\n');
}

function syncRow(rowData, existingIssues) {
  const title = createIssueTitle(rowData);
  const body = createIssueBody(rowData);
  const labels = [];
  
  // Phase label
  const phase = getPhase(rowData.phase);
  if (phase) {
    const phaseColors = {
      'Phase 1': '0052CC',
      'Phase 2': '5319E7',
      'Phase 3': '0E8A16',
      'Phase 4': 'D93F0B',
      'Phase 5': 'FF6B6B',
    };
    ensureLabel(phase, phaseColors[phase] || '666666');
    labels.push(phase);
  }
  
  // Quarter label
  if (rowData.quarter) {
    const quarterMatch = rowData.quarter.toString().match(/Q\d\s+\d{4}/);
    if (quarterMatch) {
      ensureLabel(quarterMatch[0], 'FBCA04');
      labels.push(quarterMatch[0]);
    }
  }
  
  // Status label
  if (rowData.status) {
    const statusColors = {
      'Started': '0E8A16',
      'Not Started': 'E4E669',
      'In Progress': '1D76DB',
      'Completed': '98FF98',
    };
    ensureLabel(rowData.status, statusColors[rowData.status] || 'CCCCCC');
    labels.push(rowData.status);
  }
  
  // Find existing issue
  const existing = existingIssues.find(i => 
    i.title.includes(rowData.activity) || i.title === title
  );
  
  let issueNumber;
  let action;
  
  if (existing) {
    // Update existing issue
    githubRequest('PATCH',
      '/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/issues/' + existing.number,
      { body: body, labels: labels }
    );
    issueNumber = existing.number;
    action = 'updated';
    Logger.log('Updated: ' + title);
  } else {
    // Create new issue
    const newIssue = githubRequest('POST',
      '/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/issues',
      { title: title, body: body, labels: labels }
    );
    issueNumber = newIssue.number;
    action = 'created';
    Logger.log('Created: ' + title);
    
    // Add to project
    addIssueToProject(issueNumber);
  }
  
  // Update project dates
  if (rowData.startDate || rowData.endDate) {
    updateProjectDates(issueNumber, rowData.startDate, rowData.endDate);
  }
  
  return action;
}

function addIssueToProject(issueNumber) {
  try {
    // Get issue node ID
    const query1 = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) { id }
        }
      }
    `;
    const issueData = graphqlRequest(query1, {
      owner: CONFIG.GITHUB_OWNER,
      repo: CONFIG.GITHUB_REPO,
      number: issueNumber,
    });
    const issueId = issueData.repository.issue.id;
    
    // Get project ID
    const query2 = `
      query($owner: String!, $number: Int!) {
        user(login: $owner) {
          projectV2(number: $number) { id }
        }
      }
    `;
    const projectData = graphqlRequest(query2, {
      owner: CONFIG.GITHUB_OWNER,
      number: CONFIG.PROJECT_NUMBER,
    });
    const projectId = projectData.user.projectV2.id;
    
    // Add issue to project
    const mutation = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item { id }
        }
      }
    `;
    graphqlRequest(mutation, { projectId: projectId, contentId: issueId });
    Logger.log('Added issue #' + issueNumber + ' to project');
  } catch (e) {
    Logger.log('Could not add to project: ' + e.message);
  }
}

function updateProjectDates(issueNumber, startDate, endDate) {
  try {
    // Get project info and field IDs
    const query = `
      query($owner: String!, $number: Int!) {
        user(login: $owner) {
          projectV2(number: $number) {
            id
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field { id name }
              }
            }
            items(first: 100) {
              nodes {
                id
                content { ... on Issue { number } }
              }
            }
          }
        }
      }
    `;
    
    const data = graphqlRequest(query, {
      owner: CONFIG.GITHUB_OWNER,
      number: CONFIG.PROJECT_NUMBER,
    });
    
    const project = data.user.projectV2;
    const startDateField = project.fields.nodes.find(f => f.name === 'Start Date');
    const endDateField = project.fields.nodes.find(f => f.name === 'End Date');
    const projectItem = project.items.nodes.find(i => i.content && i.content.number === issueNumber);
    
    if (!projectItem) {
      Logger.log('Issue #' + issueNumber + ' not found in project');
      return;
    }
    
    // Update dates
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Date!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { date: $value }
        }) { projectV2Item { id } }
      }
    `;
    
    if (startDate && startDateField) {
      graphqlRequest(mutation, {
        projectId: project.id,
        itemId: projectItem.id,
        fieldId: startDateField.id,
        value: startDate,
      });
    }
    
    if (endDate && endDateField) {
      graphqlRequest(mutation, {
        projectId: project.id,
        itemId: projectItem.id,
        fieldId: endDateField.id,
        value: endDate,
      });
    }
    
    Logger.log('Updated dates for issue #' + issueNumber);
  } catch (e) {
    Logger.log('Could not update dates: ' + e.message);
  }
}

