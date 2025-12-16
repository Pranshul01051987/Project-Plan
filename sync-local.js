/**
 * Local Sync Script - Google Sheet → GitHub Issues
 * 
 * Run this from your laptop (on VPN) to sync your project plan to GitHub Issues.
 * 
 * Usage:
 *   node sync-local.js
 * 
 * First time setup:
 *   1. Create a GitHub Personal Access Token at: https://github.com/settings/tokens
 *   2. Select scopes: repo (full control)
 *   3. Set environment variable: set GITHUB_TOKEN=your_token_here
 */

const https = require('https');
const XLSX = require('xlsx');

// ============ CONFIGURATION ============
const CONFIG = {
  // Your Google Sheet ID (from the URL)
  SHEET_ID: '1fyFoRxuOWI71S6ZoTkMXZpaEM3Mf00L3x-pV7NOFnYE',
  
  // GitHub repo details
  GITHUB_OWNER: 'Pranshul01051987',
  GITHUB_REPO: 'Project-Plan',
  
  // Get token from environment variable
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
};

// Label colors
const PHASE_LABELS = {
  'Phase 1': { color: '0052CC', description: 'Phase 1 tasks' },
  'Phase 2': { color: '5319E7', description: 'Phase 2 tasks' },
  'Phase 3': { color: '0E8A16', description: 'Phase 3 tasks' },
};

const QUARTER_LABELS = {
  'Q4 2025': { color: 'FBCA04', description: 'Q4 2025 deliverables' },
  'Q1 2026': { color: 'F9D0C4', description: 'Q1 2026 deliverables' },
  'Q2 2026': { color: 'C5DEF5', description: 'Q2 2026 deliverables' },
  'Q3 2026': { color: 'BFD4F2', description: 'Q3 2026 deliverables' },
  'Q4 2026': { color: 'D4C5F9', description: 'Q4 2026 deliverables' },
};

// ============ HELPERS ============

function log(emoji, message) {
  console.log(`${emoji}  ${message}`);
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

// ============ FETCH GOOGLE SHEET ============

async function fetchGoogleSheet() {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/export?format=xlsx`;
    
    log('📥', 'Fetching Google Sheet...');
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (res) => {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);
            log('✅', `Found ${rows.length} rows in sheet`);
            resolve(rows);
          });
        }).on('error', reject);
        return;
      }
      
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        log('✅', `Found ${rows.length} rows in sheet`);
        resolve(rows);
      });
    }).on('error', reject);
  });
}

// ============ GITHUB API ============

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
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

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

async function ensureLabel(name, color, description) {
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

// ============ SYNC LOGIC ============

function createIssueTitle(row) {
  const phase = row['Phase'] || '';
  const activity = row['Activity'] || '';
  const phasePrefix = phase.split(':')[0] || 'Task';
  return `[${phasePrefix}] ${activity}`;
}

function createIssueBody(row) {
  const parts = [];
  
  if (row['Task Detail']) {
    parts.push(`## 📝 Task Detail\n${row['Task Detail']}`);
  }
  
  if (row['PT1 Principle']) {
    parts.push(`## 🎯 PT1 Principle\n${row['PT1 Principle']}`);
  }
  
  if (row['Deliverable']) {
    parts.push(`## 📦 Deliverable\n${row['Deliverable']}`);
  }
  
  const startDate = parseDate(row['Start Date']);
  const endDate = parseDate(row['End Date']);
  if (startDate || endDate) {
    parts.push(`## 📅 Timeline\n**Start:** ${startDate || 'TBD'}  \n**End:** ${endDate || 'TBD'}`);
  }
  
  if (row['Owner']) {
    parts.push(`## 👤 Owner\n${row['Owner']}`);
  }
  
  if (row['Quarter']) {
    parts.push(`## 📆 Quarter\n${row['Quarter']}`);
  }
  
  parts.push(`\n---\n*Synced from Google Sheet on ${new Date().toISOString().split('T')[0]}*`);
  
  return parts.join('\n\n');
}

async function syncRow(row, existingIssues) {
  const activity = row['Activity'];
  if (!activity) return null;
  
  const title = createIssueTitle(row);
  const body = createIssueBody(row);
  const labels = [];
  
  // Add phase label
  const phase = row['Phase'] || '';
  for (const [key, value] of Object.entries(PHASE_LABELS)) {
    if (phase.includes(key)) {
      await ensureLabel(key, value.color, value.description);
      labels.push(key);
      break;
    }
  }
  
  // Add quarter label
  const quarter = row['Quarter'];
  if (quarter && QUARTER_LABELS[quarter]) {
    await ensureLabel(quarter, QUARTER_LABELS[quarter].color, QUARTER_LABELS[quarter].description);
    labels.push(quarter);
  }
  
  // Check if issue exists
  const existing = existingIssues.find(i => i.title === title);
  
  if (existing) {
    // Update existing
    log('🔄', `Updating: ${title}`);
    await githubRequest('PATCH',
      `/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/issues/${existing.number}`,
      { body, labels }
    );
    return 'updated';
  } else {
    // Create new
    log('➕', `Creating: ${title}`);
    await githubRequest('POST',
      `/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/issues`,
      { title, body, labels }
    );
    return 'created';
  }
}

// ============ MAIN ============

async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  PSC Project Plan → GitHub Issues Sync         ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  
  // Check token
  if (!CONFIG.GITHUB_TOKEN) {
    console.error('❌ ERROR: GITHUB_TOKEN environment variable not set!\n');
    console.log('To fix this:');
    console.log('  1. Go to: https://github.com/settings/tokens');
    console.log('  2. Click "Generate new token (classic)"');
    console.log('  3. Select scope: repo (Full control)');
    console.log('  4. Copy the token');
    console.log('  5. Run: set GITHUB_TOKEN=your_token_here');
    console.log('  6. Then run this script again\n');
    process.exit(1);
  }
  
  try {
    // Fetch sheet data
    const rows = await fetchGoogleSheet();
    
    // Get existing issues
    const existingIssues = await getExistingIssues();
    
    // Sync each row
    let created = 0, updated = 0, skipped = 0;
    
    for (const row of rows) {
      if (!row['Activity']) {
        skipped++;
        continue;
      }
      
      const result = await syncRow(row, existingIssues);
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  ✅ Sync Complete!                              ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log(`║  📊 Created: ${String(created).padEnd(4)} issues                      ║`);
    console.log(`║  🔄 Updated: ${String(updated).padEnd(4)} issues                      ║`);
    console.log(`║  ⏭️  Skipped: ${String(skipped).padEnd(4)} rows (no activity)         ║`);
    console.log('╚════════════════════════════════════════════════╝\n');
    
    console.log('🔗 View your issues at:');
    console.log(`   https://github.com/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/issues\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

