# Frontend Requirements — OKR Platform

This document distils requirements from **docs/OKR_PLATFORM_BUILD_PLAN.md** (and related context) so the frontend can be refactored and redesigned while still meeting the spec. Treat this as the checklist for any redesign.

**Workflow context:** How the org runs OKRs (4-step process, who owns each tier, cadence) is documented in **docs/OKR_WORKFLOW_OVERVIEW.md**. Use it to align copy, onboarding, and hierarchy labels (Strategic → Divisional → Tactical).

---

## 1. Tech stack (must keep)

| Requirement | Notes |
|-------------|--------|
| **React + TypeScript** | App is React + TS; keep. |
| **Tailwind CSS** | In use; keep. |
| **Shadcn/Radix UI** | In repo; keep. |
| **Recharts** | For trend/score charts; keep. |
| **Zustand or TanStack Query** | For state / server state; choose one and use. |
| **Next.js App Router** | `frontend/app/`; routes can be reorganized. |

---

## 2. Dashboard (main landing)

| ID | Requirement | Acceptance |
|----|-------------|------------|
| D1 | **Top summary bar** | Total objectives, average score, on-track %, days left in quarter. |
| D2 | **3-tier hierarchy** | Strategic → Divisional → Tactical; all visible, collapsible. |
| D3 | **Card per OKR** | Score ring (0–1), title, owner, department, status pill, progress bar. |
| D4 | **Filter bar** | Tier, department, status, owner, score range. |
| D5 | **Card click** | Opens OKR Detail Modal (not necessarily a new route). |
| D6 | **Route** | Dashboard at `app/page.tsx` or `app/dashboard/page.tsx`; OKR list/tree as needed; modal can be overlay without changing URL or use `app/okrs/[id]` with overlay. |

---

## 3. OKR Detail Modal (6 tabs)

| ID | Tab | Requirements |
|----|-----|--------------|
| M1 | **Overview** | Title, owner, dept, status badge; workflow actions; 3 stat chips (overall score, # KRs, days left); KR summary with inline score bars. |
| M2 | **Progress** | Per KR: score slider (0.0–1.0, 0.1 steps), notes, save; Recharts line for history; delta; expected vs actual; velocity / projected completion; behind-schedule warning. |
| M3 | **Updates** | Chronological feed: score changes, comments, status transitions; add comment at top; avatar, name, timestamp, content. |
| M4 | **History** | Full audit: score changes, workflow, edits, file uploads/deletes; filter by event type, date, actor; search. |
| M5 | **Dependencies** | Upstream (“This relates to”) / Downstream (“What depends on this”); cards with title, dept, owner, score, status, at-risk; search & link. |
| M6 | **Files** | Grid: thumbnail, name, size, date; drag-and-drop + file picker; associate to Objective or KR; preview; secure download; soft-delete with audit. |

**Modal shell:** Tab strip + tab router; focus trap (a11y).

---

## 4. Workflow

| ID | Requirement | Notes |
|----|-------------|--------|
| W1 | **States** | DRAFT → IN_REVIEW → APPROVED (or REJECTED); REJECTED → IN_REVIEW via Resubmit. |
| W2 | **Actions by state** | DRAFT: Submit for Review (Owner, Leader, Admin). IN_REVIEW: Approve / Reject / Request Changes (Leader, Admin). REJECTED: Resubmit (Owner, Admin). |
| W3 | **On transition** | Log WorkflowEvent (backend), show toast, update status badge immediately in UI. |

---

## 5. Permissions (UI)

| Role | Must support |
|------|----------------|
| **VIEW_ONLY** | Read only; no edit controls. |
| **STANDARD** | Edit KRs they own; add comments. |
| **LEADER** | Edit objectives in their dept; approve/reject. |
| **ADMIN** | Full access; delete; all workflow transitions. |

All buttons and actions must respect role (hide/disable as per backend rules).

---

## 6. Executive Presentation Mode

| ID | Requirement |
|----|-------------|
| P1 | “Present” entry from dashboard → full-screen overlay. |
| P2 | One OKR per slide: title, dept, owner, large score ring, KR progress bars, status, trend. |
| P3 | Navigate: arrow keys / click; at-risk highlighted. |
| P4 | ESC to exit and restore scroll. |

---

## 7. OKR scoring (UI rules)

| ID | Rule |
|----|------|
| S1 | Key Result score: **0.0 → 1.0**, **0.1** increments. |
| S2 | Objective score = average of its KR scores (display + auto-recalculate when KR changes). |
| S3 | **Colour thresholds:** On Track 0.7–1.0; At Risk 0.4–0.69; Off Track 0.0–0.39. |

---

## 8. UX behaviours

| ID | Requirement |
|----|-------------|
| U1 | **Optimistic UI** — score updates reflect instantly, then sync to backend. |
| U2 | **Toasts** — success/error on every save/action. |
| U3 | **Loading skeletons** — no blank screens. |
| U4 | **Auto-recalculate** — objective score when any KR score changes. |
| U5 | **Presence** (optional) — “N others viewing” in modal (Socket.io or similar). |
| U6 | **Conflict detection** (optional) — prompt if two users edit same KR. |
| U7 | **Focus trap** — modal traps focus (a11y). |
| U8 | **WCAG 2.1 AA** — contrast, screen reader labels, keyboard. |

---

## 9. Component surface (logical)

The build plan suggests this structure; redesign can change file/component names and layout as long as behaviour is covered:

- **Dashboard:** stats bar, tier sections (collapsible), OKR card, filter bar.
- **Modal:** shell, tab router, Overview / Progress / Updates / History / Dependencies / Files tabs, workflow actions.
- **Shared:** Score ring (0–1, colour by threshold), progress bar, status pill, score slider (0.0–1.0, 0.1), trend chart (Recharts).
- **Presentation:** Presentation mode component.

---

## 10. Routes / integration

| ID | Requirement |
|----|-------------|
| R1 | **API base** | Use `NEXT_PUBLIC_API_URL` (e.g. Flask at port 5000). |
| R2 | **Auth** | Auth0; roles from app_metadata or users API; frontend must pass tokens and respect role in UI. |
| R3 | **Existing OKR routes** | Plan references `app/okrs/page.tsx`, `app/okrs/[id]/page.tsx`, `app/okrs/roll-up/page.tsx`, `app/okrs/tree/[id]/page.tsx`; can be refactored into Dashboard + OKRModal + tier sections. |

---

## 11. Data concepts (frontend must handle)

- **Objectives:** id, title, description, tier (STRATEGIC | DIVISIONAL | TACTICAL), parentId, ownerId, departmentId, status (DRAFT | IN_REVIEW | APPROVED | REJECTED), fiscalYear, quarter (TACTICAL: Q1–Q4), timestamps.
- **Key results:** id, objectiveId, ownerId, title, score (0–1), targetScore, notes, updatedAt.
- **Score history:** for trend charts and Progress tab.
- **Workflow events, comments, attachments:** for History, Updates, Files tabs.
- **Users & departments:** for filters, owners, permissions.

---

## 12. Out of scope for “frontend requirements”

- Backend implementation (Flask, MongoDB, Auth0, file storage) — must be present and match these requirements.
- Exact build order (e.g. seed data before dashboard) — ordering is for implementation, not for this checklist.

---

## Quick checklist for redesign

When refactoring/redesigning the frontend, ensure:

- [ ] Dashboard: summary bar, 3-tier collapsible tree, OKR cards (score ring, status, progress), filters, open modal on card click.
- [ ] Modal: 6 tabs (Overview, Progress, Updates, History, Dependencies, Files) with content as above; workflow actions; focus trap.
- [ ] Workflow: state machine and actions by role; toasts and immediate badge update.
- [ ] Permissions: VIEW_ONLY read-only; STANDARD/LEADER/ADMIN actions match matrix.
- [ ] Presentation mode: full-screen, one OKR per slide, navigation, ESC exit.
- [ ] Scoring: 0–1, 0.1 steps; objective = average of KRs; On Track / At Risk / Off Track colours.
- [ ] UX: optimistic updates, toasts, skeletons, auto-recalculate, WCAG 2.1 AA, keyboard/focus.
- [ ] Stack: React, TypeScript, Tailwind, Shadcn/Radix, Recharts, Zustand or TanStack Query, Next.js App Router.

Source: **docs/OKR_PLATFORM_BUILD_PLAN.md** (single source of truth for the build).  
This list is a derivative checklist for frontend-only refactor/redesign.
