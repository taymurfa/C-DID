# OKR Frontend Specification

Single reference for the OKR platform frontend: hierarchy model, dashboard, OKR detail modal, workflow, permissions, presentation mode, scoring, UX, routes, and data structures. Use with **docs/FRONTEND_REQUIREMENTS.md** and **FIGMA_FRONTEND_BRIEF.md** for redesign and implementation.

---

## 1. Required Tech Stack

| Requirement | Notes |
|-------------|--------|
| **React + TypeScript** | Keep. |
| **Tailwind CSS** | Keep. |
| **Shadcn/Radix UI** | Keep. |
| **Recharts** | For trend/score charts. |
| **Zustand or TanStack Query** | For state / server state; choose one and use consistently. |
| **Next.js App Router** | `frontend/app/`; routes can be reorganized. |

---

## 2. OKR Hierarchy Model

Objectives are organized in a **three-tier hierarchy**:

```
Strategic Objective
   ↓
Divisional Objective
   ↓
Tactical Objective
   ↓
Key Results
```

| Tier | Description |
|------|-------------|
| **Strategic** | Organization-wide goals |
| **Divisional** | Department-level goals (API may use `functional`) |
| **Tactical** | Execution-level objectives |

Each objective contains **Key Results (KRs)** used to measure progress.

---

## 3. Dashboard (Primary Landing Page)

- **Route:** `/dashboard` or `/app` (dashboard as main entry after login).
- **File:** `app/dashboard/page.tsx` or `app/page.tsx` for app shell.

### Dashboard Requirements

| ID | Requirement | Acceptance |
|----|-------------|------------|
| D1 | Top summary bar | Total objectives, average score, on-track %, days left in quarter |
| D2 | 3-tier hierarchy view | Strategic → Divisional → Tactical sections |
| D3 | OKR cards | Each objective as a card (see below) |
| D4 | Filter bar | Filter by tier, department, owner, status, score |
| D5 | Card click behavior | Opens OKR Detail Modal (or navigates to `/okrs/[id]`) |
| D6 | Collapsible tiers | Users can expand/collapse each tier section |

### OKR Card Requirements

Each card must display:

- **Score ring** (0–1 scale)
- Objective title
- Owner
- Department (division)
- Status pill
- Progress bar
- Score label

### Score Colours

| Score | Status |
|-------|--------|
| 0.7 – 1.0 | On Track |
| 0.4 – 0.69 | At Risk |
| 0.0 – 0.39 | Off Track |

---

## 4. OKR Detail Modal

Clicking an OKR opens a detail view (overlay modal or route-based `/okrs/[id]`).

### Modal Tabs (all six required)

| Tab | Requirements |
|-----|--------------|
| **Overview** | Title, owner, department, status badge; workflow actions; stat chips (overall score, # KRs, days remaining); KR summary with inline progress bars and score. |
| **Progress** | Per KR: score slider (0.0–1.0, step 0.1), notes, save; Recharts score history line chart; delta from previous update; expected vs actual; projected completion; behind-schedule warning. |
| **Updates** | Activity feed: score updates, comments, workflow transitions; avatar, name, timestamp, content; users can add comments. |
| **History** | Full audit log: score changes, workflow events, edits, file uploads/deletions; filter by event type, user, date; search. |
| **Dependencies** | Upstream (objectives this OKR depends on) and Downstream (objectives that depend on this); cards with title, department, owner, score, status; search and link. |
| **Files** | File grid; drag-and-drop and file picker; attach to Objective or KR; preview; secure download; soft delete with audit. |

**Modal shell:** Tab strip, tab router, **focus trap** (a11y).

---

## 5. Workflow System

### States

- **DRAFT** → **IN_REVIEW** → **APPROVED**
- **IN_REVIEW** → **REJECTED** → **IN_REVIEW** (Resubmit)

### Actions by State

| State | Allowed actions | Allowed roles |
|-------|-----------------|---------------|
| Draft | Submit for Review | Owner, Leader, Admin |
| In Review | Approve, Reject, Request Changes | Leader, Admin |
| Rejected | Resubmit | Owner, Admin |

### Transition Behavior

- Backend logs `WorkflowEvent`.
- UI shows success toast.
- Status badge updates immediately.

---

## 6. Permission Model

**Permissions = Role + Ownership + Department**

### Roles

| Role | Description |
|------|-------------|
| VIEW_ONLY | Read-only access |
| STANDARD | Contributes updates to owned work |
| LEADER | Department oversight |
| ADMIN | Full system access |

### Permission Rules (UI)

- **View Only:** No edit buttons, no create objective, no workflow actions; controls hidden or disabled.
- **Standard:** Update KRs they own, add comments; cannot edit others’ objectives or approve/reject.
- **Leader:** Edit objectives in their department, approve/reject; cannot modify other departments.
- **Admin:** Full control (edit any objective/KR, delete, workflow, manage users).

### Unauthorized Actions

- Message: *"You do not have permission to perform this action."*
- Action must not be executed.

---

## 7. Executive Presentation Mode

| ID | Requirement |
|----|-------------|
| P1 | Enter presentation mode from dashboard |
| P2 | Full-screen slide layout |
| P3 | One OKR per slide |
| P4 | Arrow navigation (and optional dot navigation) |
| P5 | ESC exits presentation |

**Slide content:** Objective title, department, owner, large score ring, KR progress bars, status, trend; at-risk objectives visually emphasized.

---

## 8. Scoring Rules

- **Key Result score:** 0.0 → 1.0, increment 0.1.
- **Objective score:** Average of KR scores; recalculated when any KR score changes.
- **Colours:** On Track 0.7–1.0; At Risk 0.4–0.69; Off Track 0.0–0.39.

---

## 9. UX Requirements

| ID | Requirement |
|----|-------------|
| U1 | Optimistic UI updates |
| U2 | Toast notifications on save/error |
| U3 | Loading skeletons (no blank screens) |
| U4 | Auto-recalculation of objective scores when KR changes |
| U5 | Optional presence indicator (“N others viewing”) |
| U6 | Optional edit conflict detection |
| U7 | Modal focus trap |
| U8 | WCAG 2.1 AA accessibility |

---

## 10. Routes and Integration

| ID | Requirement |
|----|-------------|
| R1 | API base URL via `NEXT_PUBLIC_API_URL` |
| R2 | Auth via Auth0 |
| R3 | Roles from user metadata (app_metadata or users API) |

**Existing OKR routes** (functionality must be preserved or merged):

- `/okrs`
- `/okrs/[id]`
- `/okrs/roll-up`
- `/okrs/tree/[id]`

---

## 11. Data Structures (Frontend)

### Objectives

- id, title, description, tier (level), parentId, ownerId, departmentId, status, fiscalYear, quarter, timestamps.

### Key Results

- id, objectiveId, ownerId, title, score (0–1), targetScore, notes, updatedAt.

### Additional

- Score history, workflow events, comments, attachments, users, departments.

---

## 12. Out of Scope (Frontend Spec)

- Backend architecture, database design, auth configuration, build order.

---

## Frontend Redesign Checklist

- [ ] Dashboard: summary bar, 3-tier collapsible tree, OKR cards (score ring, status, progress), filters (tier, department, owner, status, score), card opens detail modal.
- [ ] Modal: 6 tabs (Overview, Progress, Updates, History, Dependencies, Files); workflow actions; focus trap.
- [ ] Workflow: state machine and actions by role; toasts and immediate badge update.
- [ ] Permissions: VIEW_ONLY read-only; STANDARD/LEADER/ADMIN per matrix.
- [ ] Presentation mode: full-screen, one OKR per slide, navigation, ESC exit.
- [ ] Scoring: 0–1, 0.1 steps; objective = average of KRs; On Track / At Risk / Off Track colours.
- [ ] UX: optimistic updates, toasts, skeletons, auto-recalculate, WCAG 2.1 AA, keyboard/focus.
- [ ] Stack: React, TypeScript, Tailwind, Shadcn/Radix, Recharts, Zustand or TanStack Query, Next.js App Router.

Source: **docs/OKR_PLATFORM_BUILD_PLAN.md** (build plan); **docs/FRONTEND_REQUIREMENTS.md** (frontend checklist).
