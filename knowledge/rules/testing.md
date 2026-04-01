---
id: "testing"
title: "Testing Requirements"
category: "domain"
tags: ["testing requirements", "standards", "tdd checklist", "troubleshooting", "agents"]
source: "C:/Users/Administrator/.claude/rules/domain/testing.md"
---

# Testing Requirements

> Quick reference. Full TDD workflow → `engineering-workflows.md` Phase 2.1

## Standards
- **Coverage**: ≥ 80%
- **Types**: Unit + Integration + E2E (Playwright)
- **Approach**: TDD mandatory (RED → GREEN → REFACTOR)

## TDD Checklist
1. Write test first → must FAIL
2. Write minimal implementation → must PASS
3. Refactor → keep passing
4. Property tests for critical paths
5. Verify coverage ≥ 80%

## Troubleshooting
1. Check test isolation (no shared state)
2. Verify mocks match real interfaces
3. Fix implementation, not tests (unless tests are wrong)

## Agents
- **tdd-guide**: New features, enforces write-tests-first
- **e2e-runner**: Playwright E2E specialist
