---
id: feature-dev
title: "Feature Development Workflow"
type: feature-dev
triggers: [new feature, complex feature, multi-file change]
checklist: [Plan approved, Dependencies identified, Tests written, Code reviewed]
---

# Feature Development Workflow

## Triggers
- new feature
- complex feature
- multi-file change

## Steps
### Step 1: Structured planning
Break feature into clear steps with dependencies
- Action: `plan`
- Depends on: none

### Step 2: Identify dependencies
Map which steps depend on which
- Action: `deps`
- Depends on: plan

### Step 3: Implement step by step
Execute in dependency order, verify each step
- Action: `implement`
- Depends on: deps

### Step 4: Verify each step
Test and verify before moving to next step
- Action: `verify`
- Depends on: implement

## Checklist
- [ ] Plan approved
- [ ] Dependencies identified
- [ ] Tests written
- [ ] Code reviewed
