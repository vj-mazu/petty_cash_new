# Petty Cash Management System — Architecture Document

## 1. System Overview

A full-stack web application for managing petty cash operations, designed for Indian business workflows with support for ₹ (INR) currency formatting, DD/MM/YYYY dates, and a 4-tier user hierarchy. Built to handle 10M+ transaction records with optimized pagination, caching, and indexing.

```
┌─────────────────────────────────┐
│         Frontend (React)        │
│   React 19 · TypeScript · TW   │
│         Port 3000               │
└────────────┬────────────────────┘
             │  REST API (JSON)
             ▼
┌─────────────────────────────────┐
│        Backend (Express)        │
│   Express 5.1 · Node.js        │
│         Port 5000               │
├─────────────────────────────────┤
│  Middleware: Helmet · CORS ·    │
│  Compression · Rate Limiting ·  │
│  JWT Auth · Morgan Logger       │
└────────────┬────────────────────┘
             │  Sequelize ORM
             ▼
┌─────────────────────────────────┐
│       PostgreSQL Database       │
│  Sequelize 6 · SSL · Pool: 25  │
└─────────────────────────────────┘
```

---

## 2. Technology Stack

### Backend
| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express | 5.1.0 |
| ORM | Sequelize | 6.37.7 |
| Database | PostgreSQL | 14+ |
| Auth | jsonwebtoken (JWT) | 9.0.2 |
| Password Hashing | bcryptjs | 3.0.2 |
| Rate Limiting | express-rate-limit | 8.1.0 |
| Migrations | Umzug | 3.8.2 |
| Scheduler | node-cron | 3.0.3 |
| Cache | node-cache | 5.1.2 |
| Security | helmet | 8.1.0 |

### Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| UI Library | React | 19.1.1 |
| Language | TypeScript | 5.9.3 |
| CSS | Tailwind CSS | 3.x |
| Routing | react-router-dom | 7.8.2 |
| HTTP Client | Axios | 1.11.0 |
| Charts | Recharts | 3.1.2 |
| Animations | Framer Motion | 12.x |
| PDF Export | jsPDF + jspdf-autotable | 3.0.4 |
| Excel Export | xlsx-js-style | 1.2.0 |
| Forms | react-hook-form + yup | 7.62.0 |
| Icons | lucide-react | 0.542.0 |
| Toasts | react-toastify | 11.0.5 |

---

## 3. Backend Architecture

### 3.1 Directory Structure

```
backend/
├── server.js              # Express app setup, middleware, startup
├── start.js               # Production entry point
├── migrate.js             # Umzug migration runner
├── setup-database.js      # Database creation utility
├── seed.js                # Data seeding
├── config/
│   └── database.js        # Sequelize connection (pool, SSL, IPv4)
├── controllers/
│   ├── authController.js          # Login, register, profile
│   ├── ledgerController.js        # Ledger CRUD + summaries
│   ├── transactionController.js   # Transaction CRUD + suspend/approve
│   ├── streamController.js        # Streaming export for large datasets
│   ├── systemSettingsController.js
│   └── userManagementController.js
├── middleware/
│   ├── auth.js            # JWT verification + role authorization
│   ├── errorHandler.js    # Global error handler + 404
│   └── rateLimiting.js    # Rate limit rules
├── migrations/            # 14 SQL/JS migrations (Umzug)
├── models/
│   ├── User.js
│   ├── Ledger.js
│   ├── Transaction.js
│   ├── AnamathEntry.js
│   ├── OpeningBalance.js
│   ├── SystemSettings.js
│   └── index.js           # Association definitions
├── routes/                # Express routers (1 per domain)
├── services/              # Business logic layer (14 services)
├── utils/
└── validators/
    └── index.js           # express-validator chains
```

### 3.2 Request Flow

```
Client Request
     │
     ▼
  Express App
     │
     ├── helmet()          — Security headers
     ├── compression()     — Gzip responses > 1KB
     ├── cors()            — Origin whitelist
     ├── morgan()          — HTTP access logs
     ├── apiLimiter        — 200 req/min per IP
     │
     ▼
  Router (routes/*.js)
     │
     ├── authenticate()    — JWT verification
     ├── authorize(roles)  — Role-based gate
     ├── validate()        — express-validator
     │
     ▼
  Controller (controllers/*.js)
     │
     ├── Cache lookup      — node-cache (multi-tier TTLs)
     ├── Model query       — Sequelize ORM
     ├── Cache write       — invalidateAfterWrite()
     │
     ▼
  JSON Response
```

### 3.3 Database Models & Relationships

```
┌──────────┐    1:N     ┌─────────────────┐
│   User   │───────────▶│   Transaction   │
│          │  createdBy  │                 │
│          │  updatedBy  │                 │
│          │  suspendedBy│                 │
└──────────┘            └────────┬────────┘
     │                           │
     │ 1:N                      │ N:1
     ▼                          ▼
┌──────────┐            ┌──────────┐
│  Ledger  │◀───────────│ Ledger   │
└──────────┘   ledgerId └──────────┘
     │
     │ 1:N
     ▼
┌──────────────────┐
│  OpeningBalance  │  (1 per ledger per day)
└──────────────────┘

┌──────────┐    1:N     ┌──────────────────┐
│   User   │───────────▶│  AnamathEntry    │
│          │  createdBy  │                  │
│          │  closedBy   │                  │
└──────────┘            └──────────────────┘
                               │ N:1
                               ▼
                        ┌──────────┐
                        │  Ledger  │
                        └──────────┘

Transaction ◀──── combinedWithAnamathId ────▶ AnamathEntry
```

#### User Model
| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | Auto-generated |
| username | STRING | Unique, 3-30 chars |
| email | STRING | Unique, validated |
| password | STRING | bcrypt hashed |
| role | ENUM | admin, owner, manager, staff |
| isActive | BOOLEAN | Default: true |
| lastLogin | DATE | |
| createdBy | UUID (FK) | Who created this user |
| managedBy | UUID (FK) | Manager hierarchy |

#### Transaction Model
| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| date | DATEONLY | |
| description | STRING | Optional |
| reference | STRING | Optional |
| debitAmount | DECIMAL(15,2) | Default: 0 |
| creditAmount | DECIMAL(15,2) | Default: 0 |
| ledgerId | UUID (FK) | Required |
| createdBy / updatedBy | UUID (FK) | |
| transactionType | STRING | regular, combined, anamath |
| referenceNumber | STRING | |
| isCombined | BOOLEAN | |
| combinedWithAnamathId | UUID (FK) | Links to AnamathEntry |
| transactionNumber | BIGINT | Unique, PostgreSQL sequence |
| isSuspended | BOOLEAN | |
| suspendedAt / suspendedBy | DATE, UUID | |
| remarks | TEXT | |
| status | ENUM | pending, approved, rejected |

#### Ledger Model
| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| name | STRING | Unique per user |
| description | STRING | |
| type | STRING | asset, liability, equity, revenue, expense |
| isActive | BOOLEAN | |
| createdBy | UUID (FK) | |

#### AnamathEntry Model
| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| date | DATEONLY | |
| amount | DECIMAL(15,2) | |
| remarks | TEXT | |
| transactionNumber | BIGINT | Unique, sequence-based |
| ledgerId | UUID (FK) | Optional |
| createdBy | UUID (FK) | |
| isClosed | BOOLEAN | |
| closedAt / closedBy | DATE, UUID | |
| status | ENUM | pending, approved, rejected |

#### OpeningBalance Model
| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| date | DATEONLY | |
| ledgerId | UUID (FK) | Unique with date |
| openingAmount | DECIMAL(15,2) | |
| closingAmount | DECIMAL(15,2) | |
| totalCredits | DECIMAL(15,2) | |
| totalDebits | DECIMAL(15,2) | |
| isManuallySet | BOOLEAN | Manual override flag |
| createdBy | UUID (FK) | |

### 3.4 Authentication & Authorization

**JWT Flow:**
1. User logs in → server verifies password → returns JWT (7-day expiry)
2. Frontend stores token in `sessionStorage` (cleared on browser close)
3. Every API request includes `Authorization: Bearer <token>` header
4. Middleware decodes JWT, loads user from cache/DB, attaches to `req.user`
5. Role authorization middleware checks `req.user.role` against allowed roles

**Role Hierarchy (highest → lowest):**

| Role | Level | Can Create | Can Manage | Can Approve | System Settings |
|------|-------|-----------|-----------|-------------|----------------|
| Admin | 4 | Owners, Managers, Staff | All users | All transactions | ✅ |
| Owner | 3 | Managers, Staff | Managed users | Transactions, Anamath | ❌ |
| Manager | 2 | Staff | Managed staff | Own staff's work | ❌ |
| Staff | 1 | — | — | — | ❌ |

### 3.5 Caching Strategy

Two cache layers run in parallel:

**Layer 1 — CacheService (transactional data):**
| Cache Key | TTL | Purpose |
|-----------|-----|---------|
| Transactions | 30 seconds | Fast-changing data |
| Summaries | 5 minutes | Aggregated views |
| Balances | 10 minutes | Opening/closing balances |

**Layer 2 — PerformanceCache (reference data):**
| Cache Key | TTL | Purpose |
|-----------|-----|---------|
| User data | 1 hour | Auth lookups |
| Ledger list | 30 minutes | Dropdown data |
| Balance data | 5 minutes | Dashboard totals |
| Stats | 3 minutes | Dashboard cards |

**Invalidation:**
- `invalidateAfterWrite()` — flushes both cache layers atomically after any transaction create/update/delete/suspend operation
- `invalidateAll()` — full flush of both layers

### 3.6 Performance Optimizations

| Optimization | Detail |
|-------------|--------|
| **Connection Pool** | 25 max connections, 5 min warm, 30s acquire timeout |
| **Covering Indexes** | `idx_10m_cursor_pagination`, `idx_critical_transactions_date`, etc. |
| **Partial Indexes** | `WHERE is_suspended = false` — skip suspended rows |
| **PostgreSQL Sequences** | O(1) transaction numbering via `nextval()` |
| **Cursor Pagination** | Keyset pagination by (date, id) for 10M+ scale |
| **Streaming Exports** | `stream-json` for large CSV/PDF exports without memory overflow |
| **Gzip Compression** | All responses > 1KB compressed |
| **ANALYZE** | Post-migration statistics refresh |
| **Critical Indexes** | Applied at startup via `criticalIndexes.js` service |

### 3.7 Migration System

Uses **Umzug** with SequelizeStorage. Migrations tracked in `sequelize_meta` table.

**Execution order at startup:**
1. `sequelize.sync({ alter: true })` — auto-creates/alters columns from model definitions
2. `runMigration()` — Umzug runs pending `.sql` and `.js` migrations alphabetically
3. `applyCriticalIndexes()` — creates covering indexes for 10M+ scale
4. `addSequences()` — PostgreSQL sequences for transaction numbering
5. `performanceOptimizer.applyAll()` — additional indexes and constraints

**Migration files (14 total):**
```
001-enhanced-transaction-system.sql     — Opening balances, anamath tables, transaction enhancements
002-remove-reference-from-anamath.sql   — Schema cleanup
003-alter-anamath-remarks-nullable.sql  — Allow null remarks
004-drop-anamath-reference-unique-constraint.sql
005-add-transaction-number.sql          — Transaction numbering
006-add-transaction-number-to-anamath.sql
007-add-anamath-closing-fields.sql      — isClosed, closedAt, closedBy
008-update-user-roles.sql               — Role enum values
009-add-suspend-functionality.sql       — Suspend/unsuspend columns
010-add-performance-indexes-correct.sql — Strategic indexes
011-add-new-feature-indexes.sql
012-add-user-management-hierarchy.sql   — managedBy column
013-add-owner-role.sql                  — Owner role enum value
014-add-missing-columns-and-enums.sql   — Status columns, isManuallySet, manager role
```

### 3.8 Background Services

| Service | Trigger | Purpose |
|---------|---------|---------|
| **Balance Scheduler** | node-cron @ 6:00 AM daily | Rolls over closing → opening balances |
| **System Monitor** | On-demand health endpoint | DB, memory, cache health checks |
| **Audit Service** | On transaction edit/delete | File-based audit trail logging |
| **Performance Optimizer** | On startup | Applies/verifies database indexes |

### 3.9 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| All API routes | 200 requests | 1 minute |
| Auth (login/register) | 30 requests | 15 minutes |

### 3.10 Error Handling

- Global `errorHandler` middleware catches unhandled errors
- `notFound` middleware returns 404 for unknown routes
- Frontend `ErrorBoundary` component catches React rendering errors
- File-based logger with 10MB rotation and 5-file retention

---

## 4. Frontend Architecture

### 4.1 Directory Structure

```
frontend/src/
├── App.tsx                # Route definitions + provider tree
├── index.tsx              # React root render
├── index.css              # Tailwind imports + global styles
├── components/
│   ├── ErrorBoundary.tsx          # React error boundary
│   ├── Layout.tsx                 # App shell (sidebar + content)
│   ├── ProtectedRoute.tsx         # Role-gated route wrapper
│   ├── LoadingSpinner.tsx         # Loading states
│   ├── ConfirmModal.tsx           # Confirmation dialogs
│   ├── DateInput.tsx              # DD/MM/YYYY date picker
│   ├── LedgerTransactionDetails.tsx
│   └── transactions/             # Transaction form variants
│       ├── CreditTransactionForm.tsx
│       ├── DebitTransactionForm.tsx
│       ├── AnamathTransactionForm.tsx
│       └── CombinedTransactionForm.tsx
├── contexts/
│   ├── AuthContext.tsx            # JWT storage, login/logout, user state
│   ├── ThemeContext.tsx           # Light/dark mode toggle
│   ├── ZoomContext.tsx            # UI zoom levels (fit/110/130/150%)
│   └── OpeningBalanceContext.tsx  # Balance state
├── hooks/
│   ├── useKeyboardShortcuts.ts   # Global hotkeys
│   └── useOpeningBalance.ts      # Balance operations
├── pages/                        # 20+ page components
├── services/
│   ├── api.ts                    # Axios instance + all API methods
│   ├── directApi.ts              # Direct fetch (bypass interceptors)
│   └── openingBalanceService.ts  # Balance calculations
├── types/                        # TypeScript interfaces
├── utils/
│   ├── indianNumberFormat.ts     # ₹1,00,000 formatting
│   ├── formatters.ts             # Currency/number helpers
│   ├── permissions.ts            # 12 role-check functions
│   ├── textUtils.ts              # Title case
│   ├── export.ts                 # Excel export
│   ├── balanceUtils.ts           # Balance calculations
│   └── PDFGenerator.ts           # PDF generation
└── styles/                       # Additional CSS
```

### 4.2 Provider Hierarchy

```
<ErrorBoundary>
  <ThemeProvider>          ← Light/Dark mode
    <ZoomProvider>         ← UI zoom level
      <AuthProvider>       ← JWT + user state
        <OpeningBalanceProvider>
          <BrowserRouter>
            <AppWithShortcuts />  ← Global keyboard shortcuts
          </BrowserRouter>
        </OpeningBalanceProvider>
      </AuthProvider>
    </ZoomProvider>
  </ThemeProvider>
</ErrorBoundary>
```

### 4.3 Route Map

| Path | Component | Access |
|------|-----------|--------|
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/dashboard` | Dashboard | All authenticated |
| `/ledgers` | Ledgers | All authenticated |
| `/ledgers/create` | CreateLedger | All authenticated |
| `/ledgers/:id/edit` | EditLedger | Admin only |
| `/transactions` | TransactionTypeSelection | All authenticated |
| `/transactions/list` | Transactions | All authenticated |
| `/transactions/create/credit` | CreateTransaction | All authenticated |
| `/transactions/create/debit` | CreateTransaction | All authenticated |
| `/transactions/create/anamath` | CreateAnamath | All authenticated |
| `/transactions/create/combined` | CombinedTransactionForm | All authenticated |
| `/transactions/filters` | TransactionFilters | All authenticated |
| `/anamath` | Anamath | All authenticated |
| `/anamath/closed` | ClosedAnamathRecords | All authenticated |
| `/anamath/:id/edit` | EditAnamath | All authenticated |
| `/user-management` | UserManagement | All authenticated |
| `/settings` | Settings | Admin only |
| `/opening-balance` | OpeningBalance | Opening balance access |

### 4.4 API Client (api.ts)

- **Base URL:** `REACT_APP_API_URL` or `http://localhost:5000/api`
- **Timeout:** 15 seconds
- **Request Interceptor:** Attaches JWT from `sessionStorage`
- **Response Interceptor:** Auto-logout + redirect to `/login` on 401

**API Objects:**  
`authApi` · `ledgerApi` · `transactionApi` · `anamathApi` · `systemSettingsApi` · `openingBalanceApi`

### 4.5 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+D | Go to Dashboard |
| Ctrl+Shift+T | Go to Transactions |
| Ctrl+Shift+N | New Transaction |
| Ctrl+Shift+A | Go to Anamath |
| Ctrl+Shift+L | Ledger Summary |
| Ctrl+Shift+E | Export (context-dependent) |

---

## 5. Deployment

### 5.1 Render.com (Production)

Defined in `render.yaml`:
- **Web Service:** `petti-cash-backend` (Node.js)
- **Database:** `petti-cash-db` (PostgreSQL, free tier)
- **Auto-configured:** JWT_SECRET generated, DATABASE_URL from managed DB

### 5.2 Local Development

`start.bat` handles:
1. Install backend dependencies (if needed)
2. Install frontend dependencies (if needed)
3. Start backend on port 5000 (new terminal)
4. Start frontend on port 3000 (new terminal)

### 5.3 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes (prod) | — | PostgreSQL connection string |
| `DB_HOST` | Yes (dev) | localhost | Database host |
| `DB_USER` | Yes (dev) | postgres | Database user |
| `DB_PASSWORD` | Yes (dev) | — | Database password |
| `DB_NAME` | Yes (dev) | cash_management | Database name |
| `DB_PORT` | No | 5432 | Database port |
| `JWT_SECRET` | **Yes** | — | Server exits if missing |
| `PORT` | No | 5000 | Backend port |
| `NODE_ENV` | No | development | Environment mode |
| `CLIENT_URL` | No | http://localhost:3000 | CORS origin |
| `AUTO_MIGRATE` | No | true | Run migrations on startup |
| `BCRYPT_ROUNDS` | No | 10 | Password hashing rounds |
| `REACT_APP_API_URL` | No | http://localhost:5000/api | Frontend API base URL |

---

## 6. Security Measures

| Measure | Implementation |
|---------|---------------|
| **Helmet** | Security headers (CSP, HSTS, etc.) |
| **CORS** | Origin whitelist (CLIENT_URL) |
| **JWT** | HS256, 7-day expiry, sessionStorage |
| **bcrypt** | Password hashing (configurable rounds) |
| **Rate Limiting** | 200 req/min global, 30 auth/15min |
| **Parameterized SQL** | All Sequelize queries use replacements |
| **Input Validation** | express-validator on all endpoints |
| **Error Boundary** | Frontend catch-all for render errors |
| **JWT_SECRET Validation** | Server refuses to start without it |
| **Random Admin Password** | `crypto.randomBytes` for initial setup |
| **SSL/TLS** | Database connections use SSL |
