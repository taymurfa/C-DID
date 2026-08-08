# OKR Platform — Cursor Build Plan

## Project Overview

Build a full-stack OKR (Objectives & Key Results) management platform for an enterprise IT organisation. The platform manages a **3-tier hierarchy**: Strategic (annual, IT Leadership) → Functional/Divisional (annual, Division Heads) → Tactical (quarterly, Managers).

---

## Stack Decision: Python backend (locked in)

**We are keeping the existing Python backend.** Implement the full OKR spec on the current stack.

| Layer | Choice |
|-------|--------|
| **Backend** | **Flask** (Python) — keep and extend |
| **Database** | **MongoDB** — same schema concepts via collections |
| **Auth** | **Auth0** — add roles (e.g. in `app_metadata` or a `users` collection synced on login) |
| **Real-time** | **Socket.io** (Flask-SocketIO) or polling — to be added |
| **Files** | **Cloudinary** (extend existing) or add **S3** for OKR attachments |

The data model below is the **target logical model**; implement it using MongoDB documents and Flask blueprints (see [Backend implementation notes](#backend-implementation-notes-python--mongodb) at the end).

---

## Tech Stack (target)

- **Frontend:** React + TypeScript, Tailwind CSS, Shadcn/Radix UI *(already in repo)*
- **Backend:** **Flask** (Python) — extend existing `backend/app/`
- **Database:** **MongoDB** — collections for objectives, key_results, score_history, workflow_events, comments, attachments, users, departments
- **Auth:** **Auth0** + role-based access (roles in app_metadata or `users` collection)
- **Real-time:** Flask-SocketIO or polling from frontend
- **File storage:** Cloudinary (extend) or S3 for OKR attachments
- **Charts:** Recharts *(already in repo)*
- **State:** Zustand or React Query (TanStack) on frontend

---

## Data Model (logical schema — implement in MongoDB)

```prisma
// Core hierarchy
model Objective {
  id          String   @id @default(cuid())
  title       String
  description String?
  tier        Tier     // STRATEGIC | DIVISIONAL | TACTICAL
  parentId    String?  // → Objective
  parent      Objective?  @relation("ObjectiveHierarchy", fields: [parentId], references: [id])
  children    Objective[] @relation("ObjectiveHierarchy")
  ownerId     String   // → User
  departmentId String? // → Department
  status      WorkflowStatus  // DRAFT | IN_REVIEW | APPROVED | REJECTED
  fiscalYear  Int
  quarter     String?  // only for TACTICAL (Q1–Q4)
  createdAt   DateTime
  updatedAt   DateTime
  keyResults  KeyResult[]
  workflowEvents WorkflowEvent[]
  comments    Comment[]
  attachments Attachment[]
}

model KeyResult {
  id           String   @id @default(cuid())
  objectiveId  String   // → Objective
  ownerId      String?  // → User
  title        String
  score        Float?   // 0.0–1.0, 0.1 steps
  targetScore  Float    @default(1.0)
  notes        String?
  updatedAt    DateTime
  scoreHistory ScoreHistory[]
}

model ScoreHistory {
  id          String   @id @default(cuid())
  keyResultId String   // → KeyResult
  score       Float
  notes       String?
  recordedBy  String   // → User
  recordedAt  DateTime
}

model WorkflowEvent {
  id           String   @id @default(cuid())
  objectiveId  String   // → Objective
  fromStatus   WorkflowStatus
  toStatus     WorkflowStatus
  actorId      String   // → User
  reason       String?
  timestamp    DateTime
}

model Comment {
  id           String   @id @default(cuid())
  objectiveId  String   // → Objective
  authorId     String   // → User
  body         String
  createdAt    DateTime
}

model Attachment {
  id           String   @id @default(cuid())
  objectiveId  String
  keyResultId  String?  // nullable
  fileName     String
  fileSize     Int
  fileType     String
  url          String   // S3/Supabase/Cloudinary URL
  uploadedBy   String   // → User
  uploadedAt   DateTime
  deletedAt    DateTime?  // soft delete
}

model User {
  id            String   @id @default(cuid())
  name          String?
  email         String   @unique
  role          Role     // ADMIN | LEADER | STANDARD | VIEW_ONLY
  departmentId  String?  // → Department
}

model Department {
  id   String @id @default(cuid())
  name String
}

enum Tier { STRATEGIC DIVISIONAL TACTICAL }
enum WorkflowStatus { DRAFT IN_REVIEW APPROVED REJECTED }
enum Role { ADMIN LEADER STANDARD VIEW_ONLY }
```

---

## OKR Scoring Rules

- Each Key Result scored **0.0 → 1.0** in **0.1 increments**.
- Objective score = **average of its KR scores**.
- Colour thresholds:
  - **On Track:** 0.7–1.0
  - **At Risk:** 0.4–0.69
  - **Off Track:** 0.0–0.39

---

## Screens to Build

### 1. Dashboard (main landing page)

- **Top summary bar:** total objectives, average score, on-track %, days left in quarter.
- **3-tier hierarchy view** (all visible, collapsible):
  - Strategic objectives (expandable)
  - └─ Divisional OKRs per Strategic
  - └─ Tactical OKRs per Divisional
- Each card: **score ring (0–1)**, title, owner, department, **status pill**, progress bar.
- **Filter bar:** tier, department, status, owner, score range.
- Clicking a card opens the **OKR Detail Modal**.

### 2. OKR Detail Modal (6 tabs)

| Tab | Contents |
|-----|----------|
| **Overview** | Title, owner, dept, status badge, workflow actions; 3 stat chips (overall score, # KRs, days left); KR summary with inline score bars. |
| **Progress** | Per KR: score slider (0.0–1.0, 0.1 steps), notes, save; line chart (Recharts); delta; expected vs actual; projected completion + velocity; behind-schedule warning. |
| **Updates** | Chronological feed: score changes, comments, status transitions; add comment at top; avatar, name, timestamp, content. |
| **History** | Full audit: score changes, workflow, edits, file uploads/deletes; filter by event type, date, actor; search. |
| **Dependencies** | Upstream (“This relates to”) / Downstream (“What depends on this”); cards with title, dept, owner, score, status, at-risk; search & link. |
| **Files** | Grid: thumbnail, name, size, date; drag-and-drop + file picker; associate to Objective or KR; preview; secure download; soft-delete with audit. |

### 3. Workflow State Machine

- **States:** `DRAFT → IN_REVIEW → APPROVED` (or `REJECTED`; from `REJECTED` → `IN_REVIEW` via Resubmit).

| Current State | Action | Required Role |
|---------------|--------|----------------|
| DRAFT | Submit for Review | Owner, Leader, Admin |
| IN_REVIEW | Approve | Leader, Admin |
| IN_REVIEW | Reject | Leader, Admin |
| IN_REVIEW | Request Changes | Leader, Admin |
| REJECTED | Resubmit | Owner, Admin |

- On transition: log **WorkflowEvent**, toast, update badge immediately.

### 4. Permissions Matrix

| Role | Can Do |
|------|--------|
| VIEW_ONLY | Read only, no edits |
| STANDARD | Edit KRs they own, add comments |
| LEADER | Edit objectives in their dept, approve/reject |
| ADMIN | Full access, delete, all workflow transitions |

### 5. Executive Presentation Mode

- “Present” on dashboard → full-screen overlay, one OKR per slide.
- Content: title, dept, owner, large score ring, KR progress bars, status, trend.
- Navigate: arrow keys / click; at-risk highlighted; ESC to exit (restore scroll).

---

## Component Structure

```
frontend/components/
  dashboard/
    DashboardHeader.tsx    ← stats bar
    TierSection.tsx       ← collapsible Strategic / Divisional / Tactical
    OKRCard.tsx           ← card with score ring, status pill
    FilterBar.tsx
  modal/
    OKRModal.tsx          ← shell + tab router
    tabs/
      OverviewTab.tsx
      ProgressTab.tsx
      UpdatesTab.tsx
      HistoryTab.tsx
      DependenciesTab.tsx
      FilesTab.tsx
    WorkflowActions.tsx
  shared/
    ScoreRing.tsx         ← 0–1, colour by threshold
    ProgressBar.tsx
    StatusPill.tsx
    ScoreSlider.tsx       ← 0.0–1.0, 0.1 steps
    TrendChart.tsx        ← Recharts line
  presentation/
    PresentationMode.tsx
```

---

## Key UX Behaviours

- **Optimistic UI** — score updates reflect instantly, then sync to DB.
- **Toasts** — success/error on every save/action.
- **Loading skeletons** — no blank screens.
- **Auto-recalculate** — objective score when any KR score changes.
- **Presence** — “N others viewing” in modal (Socket.io or Supabase Realtime).
- **Conflict detection** — prompt to resolve if two users edit same KR.
- **Focus trap** — modal traps focus (a11y).
- **WCAG 2.1 AA** — contrast, screen reader labels, keyboard.

---

## Build Order (recommended sequence for Cursor)

Execute in this order so each step has the data and APIs it needs.

| # | Step | Notes |
|---|------|--------|
| 1 | **Database schema + seed data** | MongoDB collections (objectives, key_results, score_history, workflow_events, comments, attachments, users, departments) + Python seed script. Realistic mock: 3–4 Strategic, 3–4 Divisional per Strategic, 2–3 Tactical per Divisional; 2–4 KRs each; mixed scores; users in all 4 roles; 8 weeks of score history; mix of workflow states. |
| 2 | **API routes** | Flask CRUD: Objectives, Key Results, score updates (write + append score_history), workflow transitions (write workflow_events), comments, attachments. Enforce permissions per role in each route. |
| 3 | **Dashboard layout** | 3-tier hierarchy with real data, filter bar (tier, department, status, owner, score range). |
| 4 | **OKR Card** | Score ring, progress bar, status pill; click opens modal. |
| 5 | **Modal shell + Overview tab** | Frame, tab strip, Overview content (title, owner, dept, status, workflow buttons, stat chips, KR summary). |
| 6 | **Progress tab** | Score slider (0.0–1.0, 0.1), notes, save; Recharts line for history; delta; expected vs actual; velocity / projected completion; behind-schedule warning. |
| 7 | **Workflow state machine** | Buttons by state + role; transition API; WorkflowEvent logging; toast + badge update. |
| 8 | **Updates + History tabs** | Updates: feed (scores, comments, status); add comment. History: audit list, filters, search. |
| 9 | **Permissions layer** | Role checks on all buttons and API routes; VIEW_ONLY read-only UI. |
| 10 | **Dependencies tab** | Upstream/downstream lists; search & link; dependency cards (score, status, at-risk). |
| 11 | **Files tab** | Upload (drag-drop + picker), grid, associate to Objective/KR, preview, download, soft-delete + audit. |
| 12 | **Executive Presentation Mode** | Full-screen slide view, navigation, at-risk highlight, ESC to exit. |
| 13 | **Real-time** | Presence (“N viewing”), live score/workflow updates; conflict prompt. |
| 14 | **Accessibility pass** | Focus trap, ARIA, contrast, keyboard. |

---

## Seed Data to Generate

- **3–4 Strategic objectives** (IT Leadership, annual).
- **3–4 Divisional OKRs per Strategic** (e.g. AI, Data, Ops, Security).
- **2–3 Tactical OKRs per Divisional** (e.g. Q3 2025).
- **2–4 Key Results per objective**, scores spread across on-track / at-risk / off-track.
- **Users** in all 4 roles (Admin, Leader, Standard, View-Only), across departments.
- **Score history** for last ~8 weeks (for trend charts).
- **Workflow states** spread across OKRs (Draft, In Review, Approved, Rejected).
- **Departments** matching divisions (e.g. AI, Data, Ops, Security).

---

## File / Route Map (current repo reference)

- **Frontend app router:** `frontend/app/` — consider Dashboard at `app/page.tsx` or `app/dashboard/page.tsx`; OKR list at `app/okrs/page.tsx`; modal can open from list/tree without changing URL or use `app/okrs/[id]/page.tsx` with modal overlay.
- **Existing OKR pages:** `frontend/app/okrs/page.tsx`, `frontend/app/okrs/[id]/page.tsx`, `frontend/app/okrs/roll-up/page.tsx`, `frontend/app/okrs/tree/[id]/page.tsx` — can be refactored to use new Dashboard + OKRModal + TierSection.
- **API:** `backend/app/routes/okrs.py` (objectives, key-results, workflow transitions); add or extend routes for comments, attachments, and permission checks.
- **State:** Add Zustand or TanStack Query in `frontend/lib/` or `frontend/store/`.

Use this document as the single source of truth for the Cursor build; implement one step at a time in the order above.

---

## Backend implementation notes (Python + MongoDB)

- **Objectives:** Extend `backend/app/models/objective.py` with `status` (DRAFT | IN_REVIEW | APPROVED | REJECTED), keep `parentObjectiveId`, `ownerId`, `division` (or add `departmentId`). Use existing `backend/app/routes/okrs.py` and add workflow endpoints (e.g. `POST /api/objectives/<id>/submit`, `/approve`, `/reject`).
- **Key results:** In `key_result.py`, treat `score` as 0.0–1.0 (normalise from 0–100 if needed), add `targetScore` (default 1.0), ensure `ownerId` for permission checks.
- **ScoreHistory:** New collection `score_history` (or `kr_snapshots`): `keyResultId`, `score`, `notes`, `recordedBy`, `recordedAt`. New route or method to append on KR score update.
- **WorkflowEvent:** New collection `workflow_events`: `objectiveId`, `fromStatus`, `toStatus`, `actorId`, `reason`, `timestamp`. Write on every workflow transition.
- **Comment:** New collection `comments`: `objectiveId`, `authorId`, `body`, `createdAt`. CRUD in a new blueprint or under `okrs.py`.
- **Attachment:** New collection `attachments`: `objectiveId`, `keyResultId` (optional), `fileName`, `fileSize`, `fileType`, `url`, `uploadedBy`, `uploadedAt`, `deletedAt`. Upload handler (Cloudinary or S3) returns `url`; store metadata in MongoDB.
- **User / Department:** Either sync Auth0 `app_metadata` (role, departmentId) into a `users` collection on login, or read from Auth0 JWT. Add `departments` collection and seed with divisions (AI, Data, Ops, Security).
- **Permissions:** In Flask, a small `permissions` or `auth` helper that, given `current_user` (id, role, departmentId), returns whether they can edit/approve/delete per objective/KR. Call before every mutation and in endpoints that return “allowed actions.”
