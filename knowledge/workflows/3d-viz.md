---
id: 3d-viz
title: "3D Visualization Layout"
type: 3d-viz
triggers: [Three.js, R3F, 3D scene, layout algorithm]
checklist: [Node distribution balanced, Surface offsets applied, Global layout verified, Local connections clean]
---

# 3D Visualization Layout

## Triggers
- Three.js
- R3F
- 3D scene
- layout algorithm

## Steps
### Step 1: Understand data scale
Analyze node count and category distribution
- Action: `analyze`
- Depends on: none

### Step 2: Weight-based sector allocation
Allocate sector angles by node count (not equal)
- Action: `allocate`
- Depends on: analyze

### Step 3: Apply surface offsets
Offset connection points to geometry surface (sphere=1.0, cube=1.2, torus=1.4)
- Action: `offset`
- Depends on: allocate

### Step 4: Handle overflow
Enable multi-ring spiral if nodes exceed sector capacity
- Action: `overflow`
- Depends on: allocate

### Step 5: Visual verification
Start dev server and screenshot verify layout + connections
- Action: `verify`
- Depends on: offset, overflow

## Checklist
- [ ] Node distribution balanced
- [ ] Surface offsets applied
- [ ] Global layout verified
- [ ] Local connections clean
