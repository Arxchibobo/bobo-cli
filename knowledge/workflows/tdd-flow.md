---
id: tdd-flow
title: "TDD Full Flow"
type: tdd
triggers: [new feature, bug fix, refactor, critical logic]
checklist: [Tests pass, Coverage >= 80%, Edge cases covered, Property tests for critical paths]
---

# TDD Full Flow

## Triggers
- new feature
- bug fix
- refactor
- critical logic

## Steps
### Step 1: Plan architecture
Use sequential thinking to plan the architecture
- Action: `plan`
- Depends on: none

### Step 2: RED - Write failing tests
Write unit tests covering all edge cases - must FAIL
- Action: `write-test`
- Depends on: plan

### Step 3: GREEN - Minimal implementation
Write minimal code to make tests pass
- Action: `implement`
- Depends on: write-test

### Step 4: REFACTOR
Clean up code while keeping tests green
- Action: `refactor`
- Depends on: implement

### Step 5: Property tests
Add property-based tests for critical functions
- Action: `property-test`
- Depends on: refactor

### Step 6: Mutation tests
Verify test quality with mutation testing
- Action: `mutation-test`
- Depends on: property-test

## Checklist
- [ ] Tests pass
- [ ] Coverage >= 80%
- [ ] Edge cases covered
- [ ] Property tests for critical paths
