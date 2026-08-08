# OKR Workflow Overview

How OKRs are managed from a workflow perspective. Use this when refining the UI, copy, or onboarding so the product reflects how the organization actually runs OKRs.

---

## The 4-Step Process

### Step 1: Annual IT Leadership Alignment

| | |
|---|---|
| **Who** | IT Lead Team + Company Executives |
| **Action** | Review company-wide annual goals |
| **Output** | 3–4 Top-Level IT Objectives for the Fiscal Year |
| **Goal** | Ensure IT’s big bets directly support the broader business strategy |

*Maps to: **Strategic** tier (annual) in the app.*

---

### Step 2: Divisional Annual Cascading

| | |
|---|---|
| **Who** | IT Lead Team + Divisional Heads (AI, Data, Ops, etc.) |
| **Action** | Each division defines its contribution to the top-level IT Objectives |
| **Output** | 3–4 Annual Divisional OKRs per department |
| **Focus** | Translating broad IT goals into functional, year-long pillars (e.g. “Improve Data Maturity”, “Scale AI Infrastructure”) |

*Maps to: **Functional/Divisional** tier (annual) in the app. UI label: “Divisional (Annual)”.*

---

### Step 3: Tactical Quarterly Execution

| | |
|---|---|
| **Who** | Divisional Heads + Individual Managers |
| **Action** | Break down annual divisional goals into 90-day sprints |
| **Output** | 2–3 Quarterly OKRs per Manager |
| **Focus** | Specific, measurable deliverables for that quarter |

*Maps to: **Tactical** tier (quarterly, Q1–Q4) in the app.*

---

### Step 4: The Continuous Feedback Loop

| | |
|---|---|
| **Who** | All levels (Managers up to IT Leadership) |
| **Action** | Update scoring and add qualitative notes on Key Result progress |
| **Cadence** | Bi-weekly or monthly |
| **Purpose** | Spot blockers early, celebrate wins, keep data-driven transparency across the org |

*Maps to: **Progress** tab (score slider, notes, history), **Updates** tab (feed), and dashboard filters/summary in the app.*

---

## Hierarchy at a Glance

| Level       | Timeline | Ownership     | Focus                        |
|------------|----------|---------------|------------------------------|
| **Strategic**  | Annual   | IT Lead Team  | Alignment to company strategy |
| **Functional** | Annual   | Divisional Heads | Departmental pillars        |
| **Tactical**   | Quarterly | Managers     | Execution & deliverables     |

**In the app:**

- **Data/API:** `level` is `strategic` \| `functional` \| `tactical`.
- **UI labels:** Dashboard and forms use “Strategic (Annual)”, “Divisional (Annual)”, “Tactical (Quarterly)”. “Divisional” is the user-facing name for the functional tier.
- **Parent chain:** Tactical → parent Functional → parent Strategic. Strategic has no parent.

---

## Example Flow

1. **Annual:** Leadership sets 3–4 Strategic objectives (e.g. “Drive digital transformation”).
2. **Annual:** Each division creates 3–4 Functional/Divisional OKRs that roll up to those Strategic objectives.
3. **Quarterly:** Managers create 2–3 Tactical OKRs per quarter that roll up to their division’s Functional OKRs.
4. **Ongoing:** Everyone updates KR scores and notes on a bi-weekly or monthly cadence; the dashboard and OKR modal (Progress, Updates, History) support this loop.

This document is the single reference for “how we manage OKRs” when making product or copy decisions.
