---
id: data-pipeline
title: "Large Data Pipeline"
type: data-pipeline
triggers: [batch query, big dataset, frontend rendering, search]
checklist: [Data batched, Deduplication applied, Lazy loading enabled, Multi-field search supported]
---

# Large Data Pipeline

## Triggers
- batch query
- big dataset
- frontend rendering
- search

## Steps
### Step 1: Batch data fetch
Query in controlled batch sizes
- Action: `fetch`
- Depends on: none

### Step 2: Process data
Dedup + classify + aggregate
- Action: `process`
- Depends on: fetch

### Step 3: Optimize frontend
Lazy load images, video thumbnails with #t=0.1, object-fit: cover
- Action: `frontend`
- Depends on: process

### Step 4: Add search
Support multi-field search (name + ID)
- Action: `search`
- Depends on: frontend

### Step 5: Deduplicate display
Use Set to deduplicate marquee/list display names
- Action: `dedup`
- Depends on: process

## Checklist
- [ ] Data batched
- [ ] Deduplication applied
- [ ] Lazy loading enabled
- [ ] Multi-field search supported
