---
id: ui-verify
title: "UI Verification Loop"
type: ui-verify
triggers: [UI modify, frontend change, component update]
checklist: [App starts, Visual elements render, No console errors, Responsive layout]
---

# UI Verification Loop

## Triggers
- UI modify
- frontend change
- component update

## Steps
### Step 1: Complete code modification
Finish all UI code changes
- Action: `code`
- Depends on: none

### Step 2: Start dev server
Run npm run dev to start the application
- Action: `npm run dev`
- Depends on: code

### Step 3: Navigate to component
Open browser and navigate to affected component
- Action: `navigate`
- Depends on: npm run dev

### Step 4: Verify visual rendering
Check visual elements render correctly
- Action: `verify`
- Depends on: navigate

### Step 5: Check console errors
Open DevTools and verify no console errors
- Action: `check-console`
- Depends on: navigate

### Step 6: Mark complete
Only mark task complete after visual verification
- Action: `complete`
- Depends on: verify, check-console

## Checklist
- [ ] App starts
- [ ] Visual elements render
- [ ] No console errors
- [ ] Responsive layout
