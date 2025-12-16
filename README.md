# PSC Conformance Delivery Process Plan

Automatically syncs your Google Sheet project plan to GitHub Issues, which appear in your GitHub Project roadmap.

## 🔄 How It Works

```
Google Sheet → GitHub Actions (hourly) → GitHub Issues → GitHub Project Roadmap
```

1. **You update** your Google Sheet
2. **GitHub Actions** runs every hour (or manually)
3. **Issues are created/updated** in this repository
4. **Issues appear** in your GitHub Project roadmap automatically

## 🚀 Setup

### Step 1: Make Google Sheet Public
- Open your [Google Sheet](https://docs.google.com/spreadsheets/d/1fyFoRxuOWI71S6ZoTkMXZpaEM3Mf00L3x-pV7NOFnYE)
- Click **Share** → **Anyone with the link** → **Viewer**

### Step 2: Create GitHub Repository
```bash
cd C:\Users\pransriv\psc-project-dashboard
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Pranshul01051987/psc-project-dashboard.git
git push -u origin main
```

### Step 3: Link to GitHub Project
1. Go to your [GitHub Project](https://github.com/users/Pranshul01051987/projects/1)
2. Click **...** → **Settings** → **Manage access**
3. Add this repository so issues appear in your roadmap

### Step 4: Run the Sync
- Go to **Actions** tab in your repo
- Click **Sync Google Sheet to GitHub Issues**
- Click **Run workflow**

## 📋 What Gets Synced

| Sheet Column | GitHub Issue |
|--------------|--------------|
| Activity | Issue Title |
| Task Detail | Issue Body |
| PT1 Principle | Issue Body |
| Deliverable | Issue Body |
| Phase | Label (Phase 1, Phase 2, Phase 3) |
| Quarter | Label (Q4 2025, Q1 2026, etc.) |
| Start/End Date | Timeline in body |
| Owner | Mentioned in body |

## ⏰ Sync Schedule

- **Automatic**: Every hour
- **Manual**: Go to Actions → Run workflow

## 🏷️ Labels Created

**Phases:**
- `Phase 1` (blue)
- `Phase 2` (purple)
- `Phase 3` (green)

**Quarters:**
- `Q4 2025`, `Q1 2026`, `Q2 2026`, etc.

## 📊 View in GitHub Project

Your issues will automatically appear in:
- **Table view**: See all tasks
- **Board view**: Kanban-style
- **Roadmap view**: Timeline visualization

## 🔧 Customization

Edit `scripts/sync-issues.js` to:
- Change label colors
- Modify issue body format
- Add custom fields

Edit `.github/workflows/sync-sheet-to-issues.yml` to:
- Change sync frequency (cron schedule)
- Use a different sheet ID
