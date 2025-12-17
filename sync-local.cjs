/**
 * Local Sync Script - Excel/CSV → GitHub Issues + Project Dates
 * 
 * Run this from your laptop to sync your project plan to GitHub Issues
 * AND automatically set dates on your GitHub Project roadmap.
 * 
 * Usage:
 *   1. Export your Google Sheet as Excel (.xlsx)
 *   2. Save it as "project-plan.xlsx" in this folder
 *   3. Run: node sync-local.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ============ CONFIGURATION ============
const CONFIG = {
  LOCAL_FILE: path.join(__dirname, 'project-plan.xlsx'),
  GITHUB_OWNER: 'Pranshul01051987',
  GITHUB_REPO: 'Project-Plan',
  PROJECT_NUMBER: 1,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
};

// Label colors for phases
const PHASE_COLORS = {
  'Phase 1': '0052CC',
  'Phase 2': '5319E7',
  'Phase 3': '0E8A16',
  'Phase 4': 'D93F0B',
  'Phase 5': 'FF6B6B',
};

// Label colors for quarters
const QUARTER_COLORS = {
  'Q1 2025': 'FBCA04',
  'Q2 2025': 'F9D0C4',
  'Q3 2025': 'C5DEF5',
  'Q4 2025': 'BFD4F2',
  'Q1 2026': 'D4C5F9',
  'Q2 2026': 'FEF2C0',
  'Q3 2026': 'BFDADC',
  'Q4 2026': 'C2E0C6',
  'Q1 2027': 'E6CCFF',
  'Q2 2027': 'CCFFE6',
  'Q3 2027': 'FFCCCC',
  'Q4 2027': 'CCE6FF',
};

// Status colors
const STATUS_COLORS = {
  'Started': '0E8A16',      // Green
  'Not Started': 'E4E669',  // Yellow
  'In Progress': '1D76DB',  // Blue
  'Completed': '98FF98',    // Light green
  'Blocked': 'D73A4A',      // Red
};

// ============ HELPERS ============

function log(emoji, message) {
  console.log(`${emoji}  ${message}`);
}

function parseDate(value) {
  if (!value) return null;
  
  // Handle Excel date serial numbers
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  
  // Handle "01-Oct-2025" format
  const match = String(value).match(/(\d{1,2})-(\w{3})-(\d{4})/);
  if (match) {
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
                     Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    return `${match[3]}-${months[match[2]] || '01'}-${match[1].padStart(2, '0')}`;
  }
  
  // Handle other date formats
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  
  return null;
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return 'TBD';
  const [year, month, day] = isoDate.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${months[parseInt(month) - 1]}-${year}`;
}

// ============ READ LOCAL FILE ============

function readLocalFile() {
  log('📂', `Reading local file: ${CONFIG.LOCAL_FILE}`);
  
  if (!fs.existsSync(CONFIG.LOCAL_FILE)) {
    console.error('\n❌ ERROR: File not found!');
    console.log('\nPlease export your Google Sheet:');
    console.log('  1. Open your Google Sheet');
    console.log('  2. File → Download → Microsoft Excel (.xlsx)');
    console.log(`  3. Save as: ${CONFIG.LOCAL_FILE}`);
    console.log('  4. Run this script again\n');
    process.exit(1);
  }
  
  const workbook = XLSX.readFile(CONFIG.LOCAL_FILE, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  log('✅', `Found ${rows.length} rows in file`);
  
  // Debug: Show first row's keys
  if (rows.length > 0) {
    log('📋', `Columns found: ${Object.keys(rows[0]).join(', ')}`);
  }
  
  return rows;
}

// ============ GITHUB REST API ============

function githubRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: method,
      headers: {
        'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'PSC-Project-Sync',
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) {
          reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
        } else {
          resolve(data ? JSON.parse(data) : null);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============ GITHUB GRAPHQL API ============

function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    
    const options = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': `bearer ${CONFIG.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PSC-Project-Sync',
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = JSON.parse(Buffer.concat(chunks).toString());
        if (data.errors) {
          reject(new Error(JSON.stringify(data.errors)));
        } else {
          resolve(data.data);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============ PROJECT FUNCTIONS ============

async function getProjectInfo() {
  log('📊', 'Getting project info...');
  
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          title
          fields(first: 20) {
            nodes {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
              }
            }
          }
        }
      }
    }
  `;
  
  const data = await graphqlRequest(query, {
    owner: CONFIG.GITHUB_OWNER,
    number: CONFIG.PROJECT_NUMBER,
  });
  
  return data.user.projectV2;
}

async function createDateField(projectId, fieldName) {
  log('📅', `Creating date field: ${fieldName}`);
  
  const mutation = `
    mutation($projectId: ID!, $name: String!) {
      createProjectV2Field(input: {
        projectId: $projectId,
        dataType: DATE,
        name: $name
      }) {
        projectV2Field {
          ... on ProjectV2Field {
            id
            name
          }
        }
      }
    }
  `;
  
  const data = await graphqlRequest(mutation, {
    projectId: projectId,
    name: fieldName,
  });
  
  return data.createProjectV2Field.projectV2Field;
}

async function getProjectItems(projectId) {
  log('📋', 'Getting project items...');
  
  const query = `
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  id
                  number
                  title
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const data = await graphqlRequest(query, { projectId });
  return data.node.items.nodes;
}

async function addIssueToProject(projectId, issueNodeId) {
  log('➕', 'Adding issue to project...');
  
  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {
        projectId: $projectId,
        contentId: $contentId
      }) {
        item {
          id
        }
      }
    }
  `;
  
  const data = await graphqlRequest(mutation, {
    projectId,
    contentId: issueNodeId,
  });
  
  return data.addProjectV2ItemById.item;
}

async function getIssueNodeId(issueNumber) {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
        }
      }
    }
  `;
  
  const data = await graphqlRequest(query, {
    owner: CONFIG.GITHUB_OWNER,
    repo: CONFIG.GITHUB_REPO,
    number: issueNumber,
  });
  
  return data.repository.issue.id;
}

async function updateProjectItemDate(projectId, itemId, fieldId, dateValue) {
  if (!dateValue) return;
  
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Date!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId,
        itemId: $itemId,
        fieldId: $fieldId,
        value: { date: $value }
      }) {
        projectV2Item {
          id
        }
      }
    }
  `;
  
  await graphqlRequest(mutation, {
    projectId,
    itemId,
    fieldId,
    value: dateValue,
  });
}

// ============ ISSUE FUNCTIONS ============

async function getExistingIssues() {
  log('📋', 'Fetching existing issues...');
  const issues = [];
  let page = 1;
  
  while (true) {
    const batch = await githubRequest('GET', 
      `/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/issues?state=all&per_page=100&page=${page}`
    );
    if (!batch || batch.length === 0) break;
    issues.push(...batch);
    page++;
  }
  
  log('✅', `Found ${issues.length} existing issues`);
  return issues;
}

async function ensureLabel(name, color, description = '') {
  try {
    await githubRequest('GET', 
      `/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/labels/${encodeURIComponent(name)}`
    );
  } catch (e) {
    if (e.message.includes('404')) {
      log('🏷️', `Creating label: ${name}`);
      await githubRequest('POST', 
        `/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/labels`,
        { name, color, description }
      );
    }
  }
}

function getPhaseFromRow(row) {
  // First check if there's a Phase column
  const phaseColumn = getField(row, 'Phase') || '';
  
  // Extract phase number from formats like "Phase 1: Compliance Analysis"
  const phaseMatch = phaseColumn.match(/Phase\s*(\d)/i);
  if (phaseMatch) {
    return `Phase ${phaseMatch[1]}`;
  }
  
  // Fallback: check activity name
  const activity = getField(row, 'Activity') || '';
  
  if (activity.includes('Phase 1') || activity.includes('PT1 Breakdown') || 
      activity.includes('Evidence Gathering') || activity.includes('Documentation Analysis') ||
      activity.includes('Third party')) {
    return 'Phase 1';
  }
  if (activity.includes('Phase 2') || activity.includes('Automation') || 
      activity.includes('Statement of Conformity') || activity.includes('Pilot Product')) {
    return 'Phase 2';
  }
  if (activity.includes('Phase 3') || activity.includes('Internal Audit') || 
      activity.includes('Process Mandate')) {
    return 'Phase 3';
  }
  if (activity.includes('Phase 4') || activity.includes('Conformance Delivery') || 
      activity.includes('Products not covered')) {
    return 'Phase 4';
  }
  if (activity.includes('Phase 5') || activity.includes('Lifecycle') || 
      activity.includes('PDS Solution')) {
    return 'Phase 5';
  }
  
  return null;
}

function getPhaseDescription(row) {
  // Get the full phase description from the Phase column
  const phaseColumn = getField(row, 'Phase') || '';
  
  // Extract description after colon, e.g., "Phase 1: Compliance Analysis" -> "Compliance Analysis"
  const match = phaseColumn.match(/Phase\s*\d+:\s*(.+)/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function createIssueTitle(row) {
  const activity = getField(row, 'Activity') || 'Untitled Task';
  const phase = getPhaseFromRow(row);
  
  if (phase) {
    return `[${phase}] ${activity}`;
  }
  return activity;
}

// Helper to get value from row with fuzzy column matching
function getField(row, fieldName) {
  // Try exact match first
  if (row[fieldName] !== undefined) return row[fieldName];
  
  // Try with trimmed keys
  for (const key of Object.keys(row)) {
    if (key.trim().toLowerCase() === fieldName.toLowerCase()) {
      return row[key];
    }
  }
  
  return null;
}

function createIssueBody(row) {
  const startDate = parseDate(getField(row, 'Start Date'));
  const endDate = parseDate(getField(row, 'End Date'));
  const taskDetail = getField(row, 'Task Detail');
  const pt1Principle = getField(row, 'PT1 Principle');
  const deliverable = getField(row, 'Deliverable');
  const owner = getField(row, 'Owner');
  const quarter = getField(row, 'Quarter');
  const activity = getField(row, 'Activity');
  const status = getField(row, 'Status');
  const phaseDesc = getPhaseDescription(row);
  const phase = getPhaseFromRow(row);
  
  const sections = [];
  
  // Header with activity name
  sections.push(`# 📋 ${activity || 'Task'}\n`);
  
  // Status & Phase section
  sections.push(`## 📊 Status`);
  sections.push(`| Field | Value |`);
  sections.push(`|-------|-------|`);
  sections.push(`| **Status** | ${status || 'Not Started'} |`);
  sections.push(`| **Phase** | ${phase || 'N/A'}${phaseDesc ? ` - ${phaseDesc}` : ''} |`);
  sections.push(`| **Owner** | ${owner || 'TBD'} |`);
  sections.push(``);
  
  // Timeline section
  sections.push(`## 📅 Timeline`);
  sections.push(`| Field | Value |`);
  sections.push(`|-------|-------|`);
  sections.push(`| **Start Date** | ${formatDateDisplay(startDate)} |`);
  sections.push(`| **End Date** | ${formatDateDisplay(endDate)} |`);
  sections.push(`| **Quarter** | ${quarter || 'TBD'} |`);
  sections.push(``);
  
  // Task Detail
  if (taskDetail) {
    sections.push(`## 📝 Task Detail`);
    sections.push(taskDetail);
    sections.push(``);
  }
  
  // PT1 Principle
  if (pt1Principle) {
    sections.push(`## 🎯 PT1 Principle`);
    sections.push(pt1Principle);
    sections.push(``);
  }
  
  // Deliverable
  if (deliverable) {
    sections.push(`## 📦 Deliverable`);
    sections.push(deliverable);
    sections.push(``);
  }
  
  // Footer
  sections.push(`---`);
  sections.push(`*🔄 Synced from Excel on ${new Date().toISOString().split('T')[0]}*`);
  
  return sections.join('\n');
}

async function syncRow(row, existingIssues) {
  const activity = getField(row, 'Activity');
  if (!activity) return null;
  
  const title = createIssueTitle(row);
  const body = createIssueBody(row);
  const labels = [];
  
  // Add phase label
  const phase = getPhaseFromRow(row);
  if (phase && PHASE_COLORS[phase]) {
    await ensureLabel(phase, PHASE_COLORS[phase], `${phase} tasks`);
    labels.push(phase);
  }
  
  // Add quarter label - handle multi-quarter ranges like "Q3 2026 - Q4 2026"
  const quarter = getField(row, 'Quarter');
  if (quarter) {
    // Extract first quarter from range
    const quarterMatch = quarter.match(/Q\d\s+\d{4}/);
    if (quarterMatch && QUARTER_COLORS[quarterMatch[0]]) {
      await ensureLabel(quarterMatch[0], QUARTER_COLORS[quarterMatch[0]], `${quarterMatch[0]} deliverables`);
      labels.push(quarterMatch[0]);
    } else if (QUARTER_COLORS[quarter]) {
      await ensureLabel(quarter, QUARTER_COLORS[quarter], `${quarter} deliverables`);
      labels.push(quarter);
    }
  }
  
  // Add status label
  const status = getField(row, 'Status');
  if (status && STATUS_COLORS[status]) {
    await ensureLabel(status, STATUS_COLORS[status], `Status: ${status}`);
    labels.push(status);
  }
  
  // Check if issue exists (match by activity name in title)
  const existing = existingIssues.find(i => 
    i.title.includes(activity) || i.title === title
  );
  
  if (existing) {
    log('🔄', `Updating: ${title}`);
    await githubRequest('PATCH',
      `/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/issues/${existing.number}`,
      { body, labels }
    );
    return { action: 'updated', number: existing.number, row };
  } else {
    log('➕', `Creating: ${title}`);
    const newIssue = await githubRequest('POST',
      `/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/issues`,
      { title, body, labels }
    );
    return { action: 'created', number: newIssue.number, row };
  }
}

// ============ MAIN ============

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  PSC Project Plan → GitHub Issues Sync                     ║');
  console.log('║  With All Fields & Automatic Project Dates                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  if (!CONFIG.GITHUB_TOKEN) {
    console.error('❌ ERROR: GITHUB_TOKEN environment variable not set!\n');
    console.log('Run: $env:GITHUB_TOKEN = "your_token_here"');
    process.exit(1);
  }
  
  try {
    // Step 1: Read local file
    const rows = readLocalFile();
    
    // Step 2: Sync issues
    const existingIssues = await getExistingIssues();
    const syncedIssues = [];
    let created = 0, updated = 0, skipped = 0;
    
    for (const row of rows) {
      if (!getField(row, 'Activity')) {
        skipped++;
        continue;
      }
      
      const result = await syncRow(row, existingIssues);
      if (result) {
        syncedIssues.push(result);
        if (result.action === 'created') created++;
        else updated++;
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n📊 Issues synced!\n');
    
    // Step 3: Get project info and ensure date fields exist
    log('🔧', 'Setting up project date fields...');
    const project = await getProjectInfo();
    
    let startDateField = project.fields.nodes.find(f => f.name === 'Start Date');
    let endDateField = project.fields.nodes.find(f => f.name === 'End Date');
    
    if (!startDateField) {
      startDateField = await createDateField(project.id, 'Start Date');
    }
    if (!endDateField) {
      endDateField = await createDateField(project.id, 'End Date');
    }
    
    log('✅', `Start Date field ID: ${startDateField.id}`);
    log('✅', `End Date field ID: ${endDateField.id}`);
    
    // Step 4: Get project items and update dates
    let projectItems = await getProjectItems(project.id);
    
    log('📅', 'Updating dates on project items...');
    
    for (const syncedIssue of syncedIssues) {
      let projectItem = projectItems.find(item => 
        item.content && item.content.number === syncedIssue.number
      );
      
      // If issue is not in project, add it
      if (!projectItem) {
        log('➕', `Adding issue #${syncedIssue.number} to project...`);
        try {
          const issueNodeId = await getIssueNodeId(syncedIssue.number);
          const newItem = await addIssueToProject(project.id, issueNodeId);
          projectItem = { id: newItem.id, content: { number: syncedIssue.number } };
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          log('⚠️', `Could not add issue #${syncedIssue.number} to project: ${e.message}`);
          continue;
        }
      }
      
      if (projectItem) {
        const startDate = parseDate(getField(syncedIssue.row, 'Start Date'));
        const endDate = parseDate(getField(syncedIssue.row, 'End Date'));
        
        if (startDate) {
          await updateProjectItemDate(project.id, projectItem.id, startDateField.id, startDate);
        }
        if (endDate) {
          await updateProjectItemDate(project.id, projectItem.id, endDateField.id, endDate);
        }
        
        log('✅', `Set dates for issue #${syncedIssue.number}`);
      }
      
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Sync Complete!                                          ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  📊 Created: ${String(created).padEnd(4)} issues                              ║`);
    console.log(`║  🔄 Updated: ${String(updated).padEnd(4)} issues                              ║`);
    console.log(`║  ⏭️  Skipped: ${String(skipped).padEnd(4)} rows (no activity)                 ║`);
    console.log(`║  📅 Dates set on project items                              ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log('🔗 View your project at:');
    console.log(`   https://github.com/users/${CONFIG.GITHUB_OWNER}/projects/${CONFIG.PROJECT_NUMBER}\n`);
    
    console.log('📋 Fields synced per issue:');
    console.log('   • Phase → Issue Title + Label + Body');
    console.log('   • Activity → Issue Title');
    console.log('   • Task Detail → Issue Body');
    console.log('   • PT1 Principle → Issue Body');
    console.log('   • Deliverable → Issue Body');
    console.log('   • Owner → Issue Body');
    console.log('   • Quarter → Issue Body + Label');
    console.log('   • Start Date → Issue Body + Project Field');
    console.log('   • End Date → Issue Body + Project Field');
    console.log('   • Status → Issue Body + Label\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
