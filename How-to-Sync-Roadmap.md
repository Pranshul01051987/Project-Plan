# PSC Conformance Delivery Process Plan
## How to Refresh Your GitHub Roadmap

---

## 📁 Important Links & Files

| Item | Location / URL |
|------|----------------|
| **📊 Google Sheet (Source)** | https://docs.google.com/spreadsheets/d/1UQjIuiwo-MX3VhvSWn_yfuA_SQbv_s_mfFZeuBYAbhs/edit?usp=sharing |
| **📄 Local Excel File** | `C:\Users\pransriv\psc-project-dashboard\project-plan.xlsx` |
| **🔄 Sync Script** | `C:\Users\pransriv\psc-project-dashboard\sync.bat` |
| **🗺️ GitHub Roadmap** | https://github.com/users/Pranshul01051987/projects/1 |
| **📋 GitHub Issues** | https://github.com/Pranshul01051987/Project-Plan/issues |

---

## ✨ Method 1: One-Click Sync (Recommended)

### Step 1: Update Your Google Sheet
1. Open the Google Sheet: [Click here to open](https://docs.google.com/spreadsheets/d/1UQjIuiwo-MX3VhvSWn_yfuA_SQbv_s_mfFZeuBYAbhs/edit?usp=sharing)
2. Make your changes (add rows, update dates, change status, etc.)

### Step 2: Download as Excel
1. In Google Sheets, go to: **File → Download → Microsoft Excel (.xlsx)**
2. Save the file to: `C:\Users\pransriv\psc-project-dashboard\`
3. Rename it to: **project-plan.xlsx**
4. Replace the existing file if prompted

### Step 3: Run the Sync
1. Open File Explorer
2. Navigate to: `C:\Users\pransriv\psc-project-dashboard`
3. Double-click: **sync.bat**
4. Wait for the sync to complete (you'll see a success message)

### Step 4: View Your Updated Roadmap
1. Open your browser
2. Go to: https://github.com/users/Pranshul01051987/projects/1
3. Your roadmap is now updated!

---

## 💻 Method 2: PowerShell Commands

If the batch file doesn't work, use these manual commands:

### Step 1: Open PowerShell
- Press `Win + R`
- Type `powershell`
- Press Enter

### Step 2: Run These Commands
Copy and paste each command, pressing Enter after each:

```
cd C:\Users\pransriv\psc-project-dashboard
```

```
$env:GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"
```

```
node sync-local.cjs
```

---

## 📊 What Gets Synced

| Google Sheet Column | Where It Goes in GitHub |
|---------------------|------------------------|
| Phase | Issue title + Label |
| Activity | Issue title |
| Task Detail | Issue body |
| PT1 Principle | Issue body |
| Deliverable | Issue body |
| Owner | Issue body |
| Quarter | Issue body + Label |
| Start Date | Issue body + Roadmap timeline bar |
| End Date | Issue body + Roadmap timeline bar |
| Status | Issue body + Label |

---

## 🔄 What Happens When You Sync

| Action in Google Sheet | Result in GitHub |
|------------------------|------------------|
| Add a new row | Creates a new issue and adds it to the roadmap |
| Change text | Updates the issue body |
| Change dates | Moves the timeline bar on the roadmap |
| Change status | Updates the status label (Started/Not Started) |
| Delete a row | Issue remains (manual deletion required in GitHub) |

---

## 🔧 Troubleshooting

### "node is not recognized"
- Node.js is not installed. Download from: https://nodejs.org/

### "File not found" error
- Make sure your Excel file is saved as `project-plan.xlsx` in the correct folder:
- `C:\Users\pransriv\psc-project-dashboard\project-plan.xlsx`

### "Token expired" error
- Your GitHub token may have expired. Create a new one at: https://github.com/settings/tokens
- Make sure to select **repo** and **project** scopes.

### Changes not showing on roadmap
- Refresh the GitHub page (Ctrl + F5)
- Make sure you're viewing the correct project view

---

## 👥 Project Access

| User | Role |
|------|------|
| Pranshul01051987 | Owner |
| jcomaske | Admin |
| Shmanzoor (Shehnila Manzoor) | Admin |

---

## 📋 Quick Reference Card

**Google Sheet:**
https://docs.google.com/spreadsheets/d/1UQjIuiwo-MX3VhvSWn_yfuA_SQbv_s_mfFZeuBYAbhs/edit?usp=sharing

**GitHub Roadmap:**
https://github.com/users/Pranshul01051987/projects/1

**Sync Command:**
Double-click `C:\Users\pransriv\psc-project-dashboard\sync.bat`

---

*Document created: December 16, 2025*
