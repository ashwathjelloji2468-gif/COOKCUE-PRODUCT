<p align="center">
  <img src="public/cookcue-logo.png" alt="CookCue Logo" width="220" />
</p>

<h1 align="center">CookCue</h1>

<p align="center">
  <strong>Institutional Kitchen Intelligence & Production Forecasting Platform</strong><br>
  <em>"Plan what to cook. Understand what comes back."</em>
</p>

<p align="center">
  <a href="https://github.com/ashwathjelloji2468-gif/COOKCUE-PRODUCT/actions/workflows/ci.yml">
    <img src="https://img.shields.io/badge/Unit%20Tests-321%2F321%20Passed-emerald?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest Unit Tests" />
  </a>
  <a href="https://github.com/ashwathjelloji2468-gif/COOKCUE-PRODUCT/actions/workflows/e2e.yml">
    <img src="https://img.shields.io/badge/Playwright%20E2E-10%2F10%20Journeys-emerald?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright E2E" />
  </a>
  <a href="https://nextjs.org/">
    <img src="https://img.shields.io/badge/Next.js-15.2%20App%20Router-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
  <a href="https://www.prisma.io/">
    <img src="https://img.shields.io/badge/Prisma-6.5%20PostgreSQL-38B2AC?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma ORM" />
  </a>
</p>

---

## Executive Summary

**CookCue** is an enterprise-grade food service intelligence and operational execution platform designed for high-volume institutional kitchens, campus cafeterias, corporate dining facilities, and catering contractors.

High-capacity catering operations consistently struggle with food loss and stockouts. Traditional mess and kitchen management relies on guesswork, unstandardized headcounts, and disconnected paper logs, resulting in **15%–35% food waste** or acute shortage crises. 

CookCue closes the loop between **morning meal preparation** and **evening service return**. By treating cooked quantity and unserved leftover audits as continuous data streams, CookCue's baseline forecast engine calculates precise, per-diner consumption metrics while giving operational head cooks and facility managers full override and dual-approval governance.

---

## Key Highlights & Architectural Strengths

- **Predictive Preparation Engine**: Algorithmic baseline forecasting derived from verified consumption history ($\text{served} = \text{cooked} - \text{leftover}$), auto-adjusting for diner attendance, anomalies, and stockout conditions.
- **Strict Role-Based Multi-Tenancy**: Complete isolation across dining facilities, catering contractors, and central executive consoles with zero cross-tenant leakage.
- **Tamper-Evident Service Auditing**: Immutable service snapshot locks that freeze completed services, preventing retrospective record tampering.
- **Edge-Ready Zero-Trust Auth**: High-performance, Web Crypto API HMAC-SHA256 session token signing and verification running within Next.js Edge Middleware.
- **Comprehensive Quality Assurance**: 100% test pass rate with **321 Vitest unit tests** and **10 End-to-End browser journeys** automated on GitHub Actions CI/CD.

---

## System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer ["Client & Edge Security Layer"]
        Browser["Desktop & Tablet Browser UI"]
        EdgeMiddleware["Next.js Edge Middleware<br/>(Web Crypto HMAC-SHA256)"]
        RBAC["RBAC Gatekeeper<br/>(Founder | Contractor | Head Cook)"]
    end

    subgraph AppLayer ["Next.js 15 Application Server"]
        AppRouter["Next.js App Router (React 19)"]
        ServerActions["Secure Server Actions"]
        ForecastEngine["Forecasting & Recommendation Baseline"]
        EmailService["Transactional Email & Notification Dispatcher"]
    end

    subgraph DataLayer ["Data & Storage Layer"]
        Prisma["Prisma ORM 6.5"]
        Postgres[(PostgreSQL Database)]
        AuditLog[(Tamper-Proof Audit Vault)]
    end

    Browser -->|Encrypted HTTPS| EdgeMiddleware
    EdgeMiddleware --> RBAC
    RBAC --> AppRouter
    AppRouter --> ServerActions
    ServerActions --> ForecastEngine
    ServerActions --> Prisma
    ServerActions --> EmailService
    Prisma --> Postgres
    Prisma --> AuditLog
```

---

## End-to-End Operational Workflow

CookCue standardizes the daily kitchen cycle into four strictly guarded operational stages:

```mermaid
sequenceDiagram
    autonumber
    actor HeadCook as Head Cook / Chef
    actor Manager as Mess Manager / Supervisor
    participant System as CookCue Engine
    participant DB as PostgreSQL Database

    Note over HeadCook, System: STAGE 1: MORNING PLANNING & REQUISITION
    HeadCook->>System: Open Morning Plan for Target Service (e.g. Lunch)
    System->>DB: Query historical consumption & diner forecast
    System-->>HeadCook: Present Pure Baseline Recommendations (kg/portion)
    HeadCook->>System: Review suggestions & apply manager batch overrides
    HeadCook->>System: Submit Draft Plan
    Manager->>System: Review & Dual-Approve Cooking Plan
    System->>DB: Store Approved Plan & Snapshot Target Quantities

    Note over HeadCook, System: STAGE 2: KITCHEN PREPARATION & DISPATCH
    HeadCook->>System: Generate Procurement & Station Requisitions
    System-->>HeadCook: Station-wise portion dispatch lists

    Note over HeadCook, System: STAGE 3: SERVICE CLOSEOUT & RETURNS
    HeadCook->>System: Enter Service Closeout (Actual Diners, Leftovers, Stockouts)
    System->>DB: Persist Observations with Audit Log
    Manager->>System: Finalize Service Closeout
    System->>DB: Lock Snapshot (Immutable Service State)

    Note over HeadCook, System: STAGE 4: LEARNING & ADAPTIVE FORECASTING
    System->>DB: Calculate Net Consumed = Cooked - Leftover
    System->>DB: Update Per-Diner Consumption Multipliers & Outlier Flags
```

---

## Core Product Capabilities

### 1. Adaptive Baseline Recommendation Engine
- **Consumption Normalization**: Tracks actual per-diner consumption rates rather than simple gross cooking volumes.
- **Stockout & Outlier Protection**: Flags abnormal service days (e.g., severe weather, unexpected campus holidays, early bin exhaustion) and excludes them from baseline averages so forecasts remain stable.
- **Manager In-The-Loop Control**: Algorithmic baselines guide decisions, but certified kitchen managers retain final discretion to override quantities based on real-time kitchen intelligence.

### 2. Multi-Tier Role-Based Access Control (RBAC)

| Role | Access Scope | Key Capabilities |
| :--- | :--- | :--- |
| **Founder / Super Admin** | Global Cross-Tenant | Onboarding approvals, facility provisioning, system telemetry, enterprise audits. |
| **Contractor Operator** | Contractor Portfolio | Facility fleet analytics, contract compliance, multi-kitchen performance oversight. |
| **Head Cook / Mess Manager** | Assigned Single Kitchen | Morning meal planning, dish catalog, service closeout, variance analysis. |
| **Kitchen Staff** | Assigned Station | Station recipe viewing, real-time batch logging, problem reporting. |

### 3. Service Immutability & Audit Trails
- **Zero Retrospective Alterations**: Once a service closeout is finalized, the session is cryptographically marked as immutable. Any attempt to modify meal plans or recorded returns post-finalization is rejected by the server actions.
- **Full Operational Audit Trail**: Every modification to dish recipes, planned quantities, and recorded leftovers generates a structured audit log entry tracking previous vs. new values and user attribution.

### 4. Multi-Path Onboarding & Enterprise Verification
- Self-serve catering contractor onboarding pipeline.
- Automated email verification challenge loop.
- Founder console verification, license audit, and manual approval workflow.
- Secure, single-use activation tokens with cryptographic expiration policies.

---

## Verified End-to-End Test Suite

CookCue maintains an automated test suite verifying every layer of the application:

```
Test Files  47 passed (47)
     Tests  321 passed (321)
  Duration  8.42s (transform 1.1s, setup 3.8s, collect 3.9s, tests 4.2s)
```

### The 10 Playwright E2E Enterprise Journeys

```mermaid
flowchart LR
    J1["1. Auth & Sign Out"] --> J2["2. Session Integrity"]
    J2 --> J3["3. Multi-Tenant RBAC"]
    J3 --> J4["4. Catalog & Menu"]
    J4 --> J5["5. Morning Plan & Override"]
    J5 --> J6["6. Closeout & Auditing"]
    J6 --> J7["7. Snapshot Immutability"]
    J7 --> J8["8. Unplanned Meals"]
    J8 --> J9["9. Operations Dashboard"]
    J9 --> J10["10. Enterprise Onboarding"]
```

1. **Authentication, Credential Verification, and Sign Out**: Validates credentials, sets hardened HTTP-only cookies, enforces Edge session checks, and tests logout invalidation.
2. **Session Integrity & Expiration**: Tests token tampering rejection, payload corruption detection, signature mismatch handling, and expired cookie evictions.
3. **Founder vs. Kitchen Operator RBAC**: Enforces strict URL protection and ensures kitchen operators cannot read or cross-mutate sibling facilities.
4. **Station Dish Catalog Management**: Tests creation, allergen tagging, metric units (`kg`, `litres`, `portions`), and menu cycle allocations.
5. **Morning Cooking Plan**: Generates recommendation baselines, verifies manager manual overrides, tests dual approvals, and ensures database persistence.
6. **Service Closeout & Actuals Recording**: Verifies actual diner attendance, unserved leftovers, and audit persistence.
7. **Snapshot Immutability**: Confirms finalized closeout snapshots reject retrospective plan modifications.
8. **Unplanned Meal Entry & Closeout Resilience**: Handles ad-hoc meal additions, unexpected surge dishes, and closeout retry recovery.
9. **Operational Results Dashboard**: Evaluates real-time KPI metrics (wastage %, variance, stockout indicators) and meal-type filters.
10. **Multi-Path Onboarding**: End-to-end applicant submission, email delivery verification, founder dashboard approval, and one-time password activation.

---

## Technology Stack

```
Frontend Architecture       Next.js 15.2 (App Router, Server Actions, React 19)
Styling & UI Components     Tailwind CSS v4, Radix UI Primitives, Lucide Icons, Motion
Type System & Validation    TypeScript 5.7, Zod Schemas
Database & ORM              PostgreSQL 16, Prisma ORM 6.5
Authentication & Security   Web Crypto API (SubtleCrypto HMAC-SHA256), Secure HttpOnly Cookies
Email Delivery              Nodemailer (Local dev capture + SMTP production transport)
Unit & Component Testing    Vitest 4.1, Testing Library
End-to-End Testing          Playwright 1.64 (Chromium Headless & Real Browser)
Continuous Integration      GitHub Actions (Automated Postgres, Prisma Migrate, Seed & E2E Matrix)
```

---

## Local Development Quickstart

### Prerequisites
- **Node.js**: `>= 20.0.0`
- **Docker**: For running the local PostgreSQL container
- **Package Manager**: `npm`

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ashwathjelloji2468-gif/COOKCUE-PRODUCT.git
cd COOKCUE-PRODUCT
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your `.env` contains:
```env
DATABASE_URL="postgresql://messwise:messwise@localhost:5434/messwise"
SESSION_SECRET="your_secure_random_session_secret_at_least_32_characters_long"
PORT=3001
```

### 3. Spin Up PostgreSQL
```bash
docker-compose up -d
```

### 4. Run Migrations & Seed Initial Facilities
```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run db:seed-demo
```

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or `http://localhost:3001` if configured) to access the CookCue portal.

---

## Running Verification Suites

### Run All 321 Vitest Unit Tests
```bash
npm run test
```

### Run All 10 Playwright E2E Journeys
```bash
# Build the application
npm run build

# Execute Playwright in headless mode
npx playwright test
```

### Run Specific Test Journeys with UI Inspector
```bash
npx playwright test --ui
```

---

## Repository Structure

```
├── .github/workflows/          # GitHub Actions CI/CD workflows (CI & Playwright E2E)
├── docker-compose.yml          # Container configuration for local PostgreSQL service
├── e2e/                        # Playwright comprehensive E2E journey specifications
│   └── kitchen-journey.spec.ts # 10 full enterprise kitchen journeys
├── prisma/
│   ├── schema.prisma           # Relational schema (Contractors, Kitchens, Meals, Audits)
│   ├── seed.ts                 # Base facility and user credential seeders
│   └── seed-demo.ts            # Realistic kitchen dishes and historical service records
├── public/                     # Static assets (CookCue logos, vector icons)
├── scripts/                    # Background jobs (forecasting calculations, reminders)
├── src/
│   ├── app/                    # Next.js App Router pages, layouts, and server endpoints
│   │   ├── (auth)/             # Login, email verification, activation flows
│   │   ├── contractor/         # Contractor fleet management views
│   │   ├── founder/            # Founder administrative oversight consoles
│   │   └── kitchen/            # Head Cook daily planning and closeout stations
│   ├── components/             # Reusable UI components, modals, and data tables
│   ├── lib/
│   │   ├── auth/               # Edge Web Crypto HMAC token generation & verification
│   │   ├── email/              # Transactional email dispatcher
│   │   └── prisma.ts           # Global Prisma client singleton
│   ├── middleware.ts           # Edge security, session verification & RBAC redirects
│   └── server/actions/         # Type-safe Next.js Server Actions with Zod validation
└── tests/                      # 47 Vitest unit & integration test suites
```

---

## Security & Compliance Architecture

- **SubtleCrypto Realm Isolation**: Session verification utilizes native V8 `Uint8Array` Web Crypto instances, preventing realm boundary type mismatches in isolated Edge runtimes.
- **Client-Side Secret Shielding**: Strict separation between runtime environment variables and build-time configurations ensures sensitive secrets (`SESSION_SECRET`, database connection strings) are never compiled into public browser JavaScript bundles.
- **Fail-Closed Redirection**: Middleware executes defensive, fail-closed access evaluations. Malformed tokens, expired sessions, or unauthorized role queries immediately purge session state and redirect to `/login` with an auditable error parameter.

---

<p align="center">
  <strong>Built with precision for commercial and institutional culinary operations.</strong><br>
  © 2026 CookCue Technologies Inc. All rights reserved.
</p>
