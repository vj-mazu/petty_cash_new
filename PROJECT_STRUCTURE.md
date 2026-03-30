# Project Structure

```
petty_cash_new/
├── ARCHITECTURE.md
├── CODE_TO_CHANGE.txt
├── package.json
├── render.yaml
├── start.bat
├── USAGE.md
│
├── backend/
│   ├── migrate.js
│   ├── package.json
│   ├── seed.js
│   ├── server.js
│   ├── setup-database.js
│   ├── start.js
│   │
│   ├── config/
│   │   └── database.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── ledgerController.js
│   │   ├── streamController.js
│   │   ├── systemSettingsController.js
│   │   ├── transactionController.js
│   │   └── userManagementController.js
│   │
│   ├── logs/
│   │
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── rateLimiting.js
│   │
│   ├── migrations/
│   │   ├── 001-enhanced-transaction-system.sql
│   │   ├── 002-remove-reference-from-anamath.sql
│   │   ├── 003-alter-anamath-remarks-nullable.sql
│   │   ├── 004-drop-anamath-reference-unique-constraint.sql
│   │   ├── 005-add-transaction-number.sql
│   │   ├── 006-add-transaction-number-to-anamath.sql
│   │   ├── 007-add-anamath-closing-fields.sql
│   │   ├── 008-update-user-roles.sql
│   │   ├── 009-add-suspend-functionality.sql
│   │   ├── 010-add-performance-indexes-correct.sql
│   │   ├── 011-add-new-feature-indexes.sql
│   │   ├── 012-add-user-management-hierarchy.sql
│   │   ├── 013-add-owner-role.sql
│   │   ├── 014-add-missing-columns-and-enums.sql
│   │   ├── 20260306102600-add-qa-performance-indexes.js
│   │   └── add-sequences.js
│   │
│   ├── models/
│   │   ├── AnamathEntry.js
│   │   ├── index.js
│   │   ├── Ledger.js
│   │   ├── OpeningBalance.js
│   │   ├── SystemSettings.js
│   │   ├── Transaction.js
│   │   └── User.js
│   │
│   ├── routes/
│   │   ├── anamathEntries.js
│   │   ├── auth.js
│   │   ├── balanceRecalculation.js
│   │   ├── combinedTransactions.js
│   │   ├── exports.js
│   │   ├── ledgers.js
│   │   ├── openingBalances.js
│   │   ├── systemSettings.js
│   │   ├── transactions.js
│   │   └── userManagement.js
│   │
│   ├── services/
│   │   ├── auditService.js
│   │   ├── balanceRecalculationService.js
│   │   ├── balanceScheduler.js
│   │   ├── cacheService.js
│   │   ├── combinedTransactionService.js
│   │   ├── criticalIndexes.js
│   │   ├── dailyBalanceService.js
│   │   ├── exportService.js
│   │   ├── logger.js
│   │   ├── openingBalanceService.js
│   │   ├── performanceCache.js
│   │   ├── performanceOptimizer.js
│   │   ├── systemMonitor.js
│   │   └── userManagementService.js
│   │
│   ├── utils/
│   │
│   └── validators/
│       └── index.js
│
└── frontend/
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── vercel.json
    │
    ├── public/
    │   ├── clear-storage.html
    │   ├── favicon.ico
    │   ├── index.html
    │   ├── logo192.png
    │   ├── logo512.png
    │   ├── manifest.json
    │   └── robots.txt
    │
    ├── src/
    │   ├── App.css
    │   ├── App.tsx
    │   ├── index.css
    │   ├── index.tsx
    │   ├── logo.svg
    │   ├── react-app-env.d.ts
    │   ├── reportWebVitals.ts
    │   ├── setupTests.ts
    │   │
    │   ├── components/
    │   │   ├── ConfirmModal.tsx
    │   │   ├── DateInput.tsx
    │   │   ├── ErrorBoundary.tsx
    │   │   ├── IndianNumberInput.tsx
    │   │   ├── KeyboardShortcutsHelp.tsx
    │   │   ├── Layout.tsx
    │   │   ├── LedgerTransactionDetails.tsx
    │   │   ├── LoadingSpinner.tsx
    │   │   ├── ProtectedRoute.tsx
    │   │   ├── ZoomControl.tsx
    │   │   │
    │   │   └── transactions/
    │   │       ├── AmountTransactionForm.tsx
    │   │       ├── AnamathTransactionForm.tsx
    │   │       ├── CombinedTransactionForm.tsx
    │   │       ├── CreditTransactionForm.tsx
    │   │       ├── DebitTransactionForm.tsx
    │   │       ├── index.ts
    │   │       ├── RunningBalanceDisplay.tsx
    │   │       └── TransactionActionButtons.tsx
    │   │
    │   ├── contexts/
    │   │   ├── AuthContext.tsx
    │   │   ├── OpeningBalanceContext.tsx
    │   │   ├── ThemeContext.tsx
    │   │   └── ZoomContext.tsx
    │   │
    │   ├── hooks/
    │   │   ├── useKeyboardShortcuts.ts
    │   │   └── useOpeningBalance.ts
    │   │
    │   ├── pages/
    │   │   ├── Anamath.tsx
    │   │   ├── AnamathFilters.tsx
    │   │   ├── ClosedAnamathRecords.tsx
    │   │   ├── CreateAnamath.tsx
    │   │   ├── CreateLedger.tsx
    │   │   ├── CreateTransaction.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── EditAnamath.tsx
    │   │   ├── EditLedger.tsx
    │   │   ├── Ledgers.tsx
    │   │   ├── LedgersView.tsx
    │   │   ├── Login.tsx
    │   │   ├── OpeningBalance.tsx
    │   │   ├── Register.tsx
    │   │   ├── Settings.tsx
    │   │   ├── TransactionFilters.tsx
    │   │   ├── Transactions.tsx
    │   │   ├── TransactionTypeSelection.tsx
    │   │   └── UserManagement.tsx
    │   │
    │   ├── services/
    │   │   ├── api.ts
    │   │   ├── openingBalanceService.ts
    │   │   └── userManagementApi.ts
    │   │
    │   ├── styles/
    │   │   └── globalResponsive.css
    │   │
    │   ├── types/
    │   │   └── xlsx-js-style.d.ts
    │   │
    │   └── utils/
    │       ├── anamathPDFGenerator.ts
    │       ├── balanceUtils.ts
    │       ├── directApi.ts
    │       ├── excelExporter.ts
    │       ├── export.ts
    │       ├── formatters.ts
    │       ├── indianNumberFormat.ts
    │       ├── numberToWords.ts
    │       ├── PDFGenerator.ts
    │       ├── permissions.ts
    │       ├── textUtils.ts
    │       ├── transactionPDFGenerator.ts
    │       └── transactionTestUtils.ts
    │
    └── build/
        ├── asset-manifest.json
        ├── clear-storage.html
        ├── index.html
        ├── manifest.json
        ├── robots.txt
        │
        └── static/
            ├── css/
            └── js/
```
