# Figma Frontend Redesign Brief — OKR Tracker

Use this document to brief designers (or Figma AI) for a frontend redesign. It includes project context, user roles, all screens, components, and design constraints.

---

## 1. Project Description

**Product name:** OKR Tracker (internally “Goals”)

**One-liner:** Align strategy to execution. Track objectives and key results across your organization.

**What it is:** A web app for setting and tracking **Objectives and Key Results (OKRs)** in a 3-tier hierarchy: **Strategic** (top) → **Functional** (middle) → **Tactical** (bottom). Users create objectives, attach key results with progress (0–100%), and view dashboards by role. The app supports multiple user roles, divisions, sharing via link, and an AI chatbot.

**Tech stack (for implementation reference):** Next.js (App Router), TypeScript, Tailwind CSS, Geist font. Design should work with a component-based UI (buttons, cards, inputs, selects, tabs, modals) and support **light and dark** themes via CSS variables.

**Target users:** Internal teams (leadership, managers, contributors) in organizations that run OKRs. Some users are view-only; others create/edit OKRs and manage users.

---

## 2. User Roles & Permissions

Design should account for these roles (different nav and dashboard content):

| Role        | Description |
|------------|-------------|
| **View only** | Can see dashboard and OKR details; no edit, no “New objective,” minimal filters (search only). |
| **Standard** | Can create/edit own objectives and key results; sees “My objectives” on dashboard. |
| **Leader**   | Sees department-level stats and team OKRs; “Your department” block on dashboard. |
| **Admin**    | Full access + **User management** (assign roles, departments). Admin link in sidebar and dashboard. |
| **Developer**| Same as standard but may have extra dev tooling in future. |

**Test role:** The app has a “Test role” dropdown in the sidebar so stakeholders can preview each role’s UI; design for that selector (compact, low prominence).

---

## 3. Global Layout & Shell

- **Layout:** Fixed **sidebar (left) + main content**. Sidebar can **collapse** to icon-only (chevron toggle).
- **Sidebar contents (top → bottom):**
  - Logo + product name (“Goals”); when collapsed, icon only.
  - **Primary CTA:** “New objective” button (hidden for view_only).
  - **Main nav:** Dashboard, Objectives, Analytics, Divisions (icons + labels; when collapsed, icons only).
  - **Admin block** (admins only): “User management” link.
  - **Overview stats** (when expanded, non–view_only): counts for Strategic, Functional, Tactical, Key Results.
  - **Account:** Documentation, Integrations (hidden for view_only), Settings (profile).
  - **Test role** dropdown (when expanded).
  - Collapse/expand control (e.g. chevron on the edge of the sidebar).
- **Main area:** Optional **page header** (title + short description), then scrollable content with a max-width container (e.g. 7xl).
- **Chatbot:** Floating button (e.g. bottom-right) that opens a chat panel; AI assistant, used across the app.

**Responsiveness:** Sidebar behavior (collapse, overlay on small screens) and filter bar wrapping should be considered for tablet/mobile.

---

## 4. Screens & Pages (Full List)

### 4.1 Unauthenticated

- **Landing / Login (`/`)**  
  - Hero: “OKR Tracker” title, short tagline.  
  - Actions: “Login with Google”, “Login with Email”.  
  - Email flow: toggle to “Login with Email” → email + password; optional “Sign up” (name, email, password).  
  - Error state: display auth errors (e.g. Auth0 not configured, invalid credentials).  
  - When logged in: “Welcome, [name]” + “Go to Dashboard” / “Profile”.

### 4.2 Authenticated App (with sidebar)

- **Dashboard (`/dashboard`)**  
  - **Header:** Page title “Dashboard”, subtitle “3-tier OKR hierarchy and progress”.  
  - **Dashboard header block:**  
    - FY and quarter (e.g. “FY 2025 · Q2”).  
    - Stat cards: Total objectives, Average progress (%), On track (%), Days left (in quarter).  
    - Role-specific: “My objectives” (standard), “Your department” + on-track % (leader), “Admin → User management” (admin).  
  - **Filter bar:** Search, Tier (Strategic/Functional/Tactical), Division, Status (draft/in_review/approved/rejected), Score range; optional Sort and “Reset to default”. View_only: search only (minimal bar).  
  - **Content:** OKR cards grouped by tier (e.g. Strategic, then Functional, then Tactical). Each card: status pill, level, division, title, owner, progress bar + percentage and status label (On track / At risk / Behind). Cards are clickable (open detail or navigate).

- **Objectives list (`/okrs`)**  
  - List/tree of all objectives; entry point to create and browse OKRs.

- **New objective (`/okrs/new`)**  
  - Form: title, description, level (strategic/functional/tactical), division, owner, etc. Submit creates objective.

- **Objective detail (`/okrs/[id]`)**  
  - Single objective view with key results; can be the same content as in the OKR detail modal (see below).

- **OKR tree (`/okrs/tree/[id]`)**  
  - Tree visualization for one objective hierarchy.

- **Roll-up (`/okrs/roll-up`)**  
  - Roll-up view of OKRs (e.g. aggregation by division or tier).

- **Analytics (`/analytics`)**  
  - Title: “Analytics”, subtitle “Detailed insights and key result tracking”.  
  - Charts and metrics (design placeholders for score trends, completion, etc.).

- **Divisions (`/divisions`)**  
  - Title: “Divisions”, subtitle “Performance by organizational division”.  
  - View of performance or OKR counts by division.

- **Profile (`/profile`)**  
  - Title: “Profile”, “Manage your profile information”.  
  - **States:**  
    - No profile: “You haven’t created a profile yet” + “Create Profile”.  
    - Editing: Form (display name, bio, profile image upload).  
    - View: Header with avatar (or initial), display name, email; “About” (bio); Member since / Last updated; **OKR modal tabs** preferences (checkboxes for Overview, Progress, Updates, History, Dependencies, Files); “Go to Dashboard”, “Edit Profile”.

- **Create/Edit profile (`/profile/new`, `/profile/edit`)**  
  - Form: display name, bio, image upload; submit/cancel.

- **Settings**  
  - Linked from sidebar as “Settings” → profile; no separate settings page required unless you add one.

- **Documentation (`/docs`)**  
  - Static or docs-style content; design a simple docs layout.

- **Integrations (`/integrations`)**  
  - Placeholder or list of integrations; hidden for view_only.

- **Admin – User management (`/admin/users`)**  
  - List of users with: user id, name/email, **role** (admin/leader/standard/view_only/developer), **department**.  
  - Inline or row-level edit: change role (dropdown), department (input). Save/cancel.  
  - Admin-only; accessible from sidebar and dashboard.

### 4.3 OKR Detail (Modal or Full Page)

Used when opening an objective from the dashboard or list. Contains:

- **Header:** Objective title, status, level, division, owner; actions (edit, delete, share, etc.) by permission.
- **Tabs (user-configurable visibility in profile):**  
  - **Overview** – summary, description, key result list.  
  - **Progress** – key result progress (sliders/bars, scores).  
  - **Updates** – timeline or comments.  
  - **History** – change log.  
  - **Dependencies** – linked objectives.  
  - **Files** – attachments.
- Optional: “N others viewing” when multiple viewers.
- Design for both **modal** (overlay) and **full-page** variant (e.g. `/okrs/[id]`).

### 4.4 Shared OKR (Public / Unauthenticated)

- **Share by link (`/share/[token]`)**  
  - No sidebar.  
  - Content: single objective + key results (read-only).  
  - “Go home” or “Back” for logged-out users.  
  - States: loading, error (message + go home), success (OKR content).

### 4.5 Items (Legacy CRUD)

- **Items list and item detail (`/items`, `/items/[id]`)**  
  - Simple CRUD for “items” (title, description). Include in the redesign if still in scope; otherwise treat as secondary.

---

## 5. Key UI Components to Redesign

- **Sidebar** – nav links, collapse, “New objective” CTA, stats block, account block, test role dropdown.  
- **App layout** – shell (sidebar + main), page header (title + description).  
- **Dashboard header** – FY/quarter badge, stat cards (with icons), role-specific cards.  
- **Filter bar** – search input, tier/division/status/score dropdowns, sort, reset.  
- **OKR card** – status pill, level + division, title, owner, progress bar, status label (On track / At risk / Behind), left border color by score (green/amber/red).  
- **Status pill** – Draft (neutral), In Review (amber), Approved (green), Rejected (red).  
- **OKR detail modal** – header, tab list, tab panels (overview, progress, updates, history, dependencies, files).  
- **Forms** – objective form, key result form, profile form (display name, bio, image), login/register (email/password, name).  
- **Buttons** – primary, secondary, outline, ghost; icon-only for collapse.  
- **Cards** – content cards, stat blocks, profile header card.  
- **Inputs & selects** – text, email, password, search; dropdowns for tier, division, status, role.  
- **Chatbot** – floating trigger, chat panel (message list + input).  
- **Empty states** – no profile, no objectives, no search results.  
- **Error states** – auth errors, “Failed to load” for share link.

---

## 6. Design Tokens & Theming

- **Fonts:** Geist Sans (primary), Geist Mono (code).  
- **Border radius:** ~0.625rem (10px) default; cards/buttons can use same or slightly larger.  
- **Colors (semantic):**  
  - **Primary** – main actions, links (e.g. dark navy/black in light mode).  
  - **Background / Card / Muted** – page background, card background, muted text.  
  - **Success** – on track, approved (green).  
  - **Warning** – at risk, in review (amber).  
  - **Destructive** – behind, rejected, delete (red).  
  - **Sidebar** – distinct background and accent for active nav.  
- **Dark mode:** All screens and components must work in dark theme (same structure, inverted or adjusted colors).  
- **Accessibility:** Contrast (WCAG AA), focus states, touch targets (e.g. 44px), and labels for icons.

---

## 7. Content & Copy Conventions

- **Tiers:** “Strategic”, “Functional”, “Tactical”.  
- **Statuses:** “Draft”, “In Review”, “Approved”, “Rejected”.  
- **Progress labels:** “On track”, “At risk”, “Behind” (or equivalent).  
- **Roles:** “View only”, “Standard”, “Leader”, “Admin”, “Developer”.  
- **Fiscal:** “FY 2025 · Q2” style.  
- **Placeholders:** “Search objectives…”, “Your name”, “your@email.com”, etc.

---

## 8. Out of Scope for This Brief

- Backend API or database design.  
- Auth flows (Auth0/Google) beyond the login UI.  
- Exact chart specs for Analytics (high-level layout and style only).  
- Mobile app; focus is responsive web.

---

## 9. Deliverables to Align On

- **Figma:**  
  - Global layout (sidebar + main) in light and dark.  
  - All screens listed in §4 (key states: loading, empty, error where relevant).  
  - Component library for §5 (with variants for state and theme).  
  - Optional: prototype for main flows (login → dashboard → open OKR → edit profile).  
- **Handoff:** Components and screens named so they map to the routes and component names in this doc (e.g. `Dashboard`, `OKRCard`, `Sidebar`, `FilterBar`, `OKRDetailView`).

Use this brief as the single source of truth for scope when redesigning the frontend in Figma.
