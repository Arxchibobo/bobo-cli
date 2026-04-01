---
id: db-migration
title: "Database Migration Orchestration"
type: db-migration
triggers: [schema change, data migration, multi-table operation]
checklist: [Dependencies analyzed, Rollback script ready, Integrity verified, Compatible views built]
---

# Database Migration Orchestration

## Triggers
- schema change
- data migration
- multi-table operation

## Steps
### Step 1: Analyze dependencies
Map all tables, foreign keys, and dependencies
- Action: `analyze`
- Depends on: none

### Step 2: Write migration script
Create forward migration in single transaction
- Action: `write-migration`
- Depends on: analyze

### Step 3: Write rollback script
Create rollback script for failure recovery
- Action: `write-rollback`
- Depends on: analyze

### Step 4: Build compatibility views
Create backward-compatible views if needed
- Action: `compat-views`
- Depends on: write-migration

### Step 5: Test in staging
Execute migration in test environment
- Action: `test`
- Depends on: write-migration, write-rollback

### Step 6: Verify integrity
Run verification queries for data consistency
- Action: `verify`
- Depends on: test

## Checklist
- [ ] Dependencies analyzed
- [ ] Rollback script ready
- [ ] Integrity verified
- [ ] Compatible views built
