/**
 * Sync Google Sheet to GitHub Issues
 * 
 * Reads your PSC Conformance Delivery Process Plan from Google Sheets
 * and creates/updates GitHub Issues for each task.
 */

const XLSX = require('xlsx');
const fetch = require('node-fetch');

const SHEET_ID = process.env.SHEET_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

const GITHUB_API = 'https://api.github.com';

// Labels for phases
const PHASE_COLORS = {
  'Phase 1': '0052CC',
  'Phase 2': '5319E7', 
  'Phase 3': '0E8A16',
};

// Labels for quarters
const QUARTER_COLORS = {
  'Q4 2025': 'FBCA04',
  'Q1 2026': 'F9D0C4',
  'Q2 2026': 'C5DEF5',
  'Q3 2026': 'BFD4F2',
  'Q4 2026': 'D4C5F9',
};

async function fetchSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
  
  console.log('📥 Fetching Google Sheet...');
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`✅ Found ${rows.length} rows`);
  return rows;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  
  // Handle "01-Oct-2025" format
  const match = String(value).match(/(\d{1,2})-(\w{3})-(\d{4})/);
  if (match) {
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
                     Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    return `${match[3]}-${months[match[2]] || '01'}-${match[1].padStart(2, '0')}`;
  }
  
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function createIssueBody(row) {
  const parts = [];
  
  if (row['Task Detail']) {
    parts.push(`## Task Detail\n${row['Task Detail']}`);
  }
  
  if (row['PT1 Principle']) {
    parts.push(`## PT1 Principle\n${row['PT1 Principle']}`);
  }
  
  if (row['Deliverable']) {
    parts.push(`## Deliverable\n📦 ${row['Deliverable']}`);
  }
  
  const startDate = parseDate(row['Start Date']);
  const endDate = parseDate(row['End Date']);
  
  if (startDate || endDate) {
    parts.push(`## Timeline\n📅 ${startDate || 'TBD'} → ${endDate || 'TBD'}`);
  }
  
  if (row['Owner']) {
    parts.push(`## Owner\n👤 ${row['Owner']}`);
  }
  
  parts.push(`\n---\n*Auto-synced from [Google Sheet](https://docs.google.com/spreadsheets/d/${SHEET_ID})*`);
  
  return parts.join('\n\n');
}

async function githubRequest(endpoint, options = {}) {
  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }
  
  return response.status === 204 ? null : response.json();
}

async function getExistingIssues() {
  console.log('📋 Fetching existing issues...');
  
  const issues = [];
  let page = 1;
  
  while (true) {
    const batch = await githubRequest(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&per_page=100&page=${page}`
    );
    
    if (batch.length === 0) break;
    issues.push(...batch);
    page++;
  }
  
  console.log(`✅ Found ${issues.length} existing issues`);
  return issues;
}

async function ensureLabel(name, color) {
  try {
    await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/labels/${encodeURIComponent(name)}`);
  } catch {
    console.log(`🏷️ Creating label: ${name}`);
    await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
  }
}

async function createOrUpdateIssue(row, existingIssues) {
  const activity = row['Activity'] || '';
  if (!activity) return null;
  
  const phase = row['Phase'] || '';
  const quarter = row['Quarter'] || '';
  const title = `[${phase.split(':')[0] || 'Task'}] ${activity}`;
  
  // Check if issue already exists (by title match)
  const existing = existingIssues.find(i => i.title === title);
  
  const body = createIssueBody(row);
  const labels = [];
  
  // Add phase label
  if (phase) {
    const phaseKey = Object.keys(PHASE_COLORS).find(k => phase.includes(k));
    if (phaseKey) {
      labels.push(phaseKey);
      await ensureLabel(phaseKey, PHASE_COLORS[phaseKey]);
    }
  }
  
  // Add quarter label
  if (quarter && QUARTER_COLORS[quarter]) {
    labels.push(quarter);
    await ensureLabel(quarter, QUARTER_COLORS[quarter]);
  }
  
  if (existing) {
    // Update existing issue
    console.log(`🔄 Updating: ${title}`);
    return githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/issues/${existing.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ body, labels }),
    });
  } else {
    // Create new issue
    console.log(`➕ Creating: ${title}`);
    return githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body, labels }),
    });
  }
}

async function main() {
  console.log('🚀 Starting sync...\n');
  
  try {
    // Fetch sheet data
    const rows = await fetchSheet();
    
    // Get existing issues
    const existingIssues = await getExistingIssues();
    
    // Process each row
    let created = 0;
    let updated = 0;
    
    for (const row of rows) {
      if (!row['Activity']) continue;
      
      const existing = existingIssues.find(i => 
        i.title === `[${(row['Phase'] || '').split(':')[0] || 'Task'}] ${row['Activity']}`
      );
      
      await createOrUpdateIssue(row, existingIssues);
      
      if (existing) {
        updated++;
      } else {
        created++;
      }
      
      // Rate limit: wait 1 second between API calls
      await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log(`\n✅ Sync complete!`);
    console.log(`   Created: ${created} issues`);
    console.log(`   Updated: ${updated} issues`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();


