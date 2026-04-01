---
id: "engineering-patterns"
title: "Engineering Patterns Memory"
type: "custom"
tags: [memory, template]
template: true
---

# Engineering Patterns Memory
> Consolidated from: engineering-workflows.md, coding.md, testing.md, security.md
> Verified patterns only - each earned through real experience

---

## Daily Workflow Patterns (Always Apply)

### 1. UI Modification → Visual Verification Loop
```
Code change → npm run dev → Navigate → Verify render → Check console → Mark complete
```
**Never** mark UI tasks complete without visual verification.

### 2. Feature Implementation → Dependency-Ordered Steps
```
Step 1: [task] — depends: none
Step 2: [task] — depends: Step 1
Step 3: [task] — depends: Step 1, 2
```
Break into steps, annotate dependencies, execute in order.

### 3. Database Changes → Transactional
```sql
BEGIN;
-- changes
SELECT ... -- verify
COMMIT;  -- or ROLLBACK
```
Always through Bytebase MCP. Always include rollback.

---

## Advanced Patterns (Trigger-Based)

### TDD Full Flow (new features, critical logic)
RED → GREEN → REFACTOR → Property tests → Mutation tests
- Coverage ≥ 80%, all edge cases, critical paths have property tests

### DB Migration Orchestration (schema changes)
1. Dependency analysis → 2. Forward + rollback scripts → 3. Integrity check
4. Backward-compatible views → 5. Test env first → 6. Prod with checkpoints

### Self-Healing Components (core UI, design system)
Scan → Regression tests → Responsive variants → Performance bench
→ TypeScript interfaces → Storybook → Unit tests → Auto-fix

### 3D Visualization (Three.js / R3F)
- **Sector angles**: Weight by node count (50 Skills ≠ 3 Hooks)
- **Overflow**: Multi-ring spiral when nodes > sector capacity
- **Connection points**: Surface offset, NOT center
  - Sphere: 1.0, Cube: 1.2, Torus: 1.4
- **Verify**: Screenshot global layout + local connections

### Big Data + Frontend
- **Fetch**: Batch queries, controlled size
- **Process**: Dedup (Set) + classify + aggregate
- **Render**: Lazy load images, video `#t=0.1`, `object-fit: cover`
- **Search**: Multi-field (username + numeric ID)
- **Display names**: Always deduplicate for marquee/lists

---

## Code Quality Standards

### Immutability (CRITICAL)
```typescript
// ALWAYS new object, NEVER mutate
return { ...user, name };  // NOT: user.name = name
```

### File Organization
- 200-400 lines typical, 800 max
- Organize by feature/domain, not by type
- High cohesion, low coupling

### Error Handling
```typescript
try {
  return await riskyOperation();
} catch (error) {
  console.error('Failed:', error);
  throw new Error('User-friendly message');
}
```

### Input Validation (Zod at boundaries)
```typescript
const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
});
```

### Common Patterns
- API Response: `{ success, data?, error?, meta? }`
- Custom Hooks: useDebounce, useLocalStorage
- Repository: `findAll, findById, create, update, delete`

---

## Task Type → Workflow Matrix

| Task | Minimum | Recommended |
|------|---------|-------------|
| Simple UI change | Visual verify | - |
| New feature | Structured planning | + TDD |
| DB change | Transactional | + Migration orchestration |
| Core component | Visual verify + planning | + Self-healing |
| Multi-file refactor | Structured planning | + TDD |
| 3D visualization | Visual verify + 3D rules | Screenshot loop |
| Big data display | Structured planning + data rules | Batch + dedup + lazy |

---

## Security Checklist (Pre-Commit)
- [ ] No hardcoded secrets (env vars only)
- [ ] User inputs validated (Zod)
- [ ] SQL injection prevention (parameterized)
- [ ] XSS prevention (sanitized HTML)
- [ ] Auth/authz verified
- [ ] Rate limiting on endpoints
- [ ] Error messages don't leak data

---
_Updated: 2026-03-02 | Source: rules/domain/*.md consolidated_
