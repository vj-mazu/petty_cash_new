# Petty Cash Management System — Usage Guide

## 1. Getting Started

### 1.1 Prerequisites

- **Node.js** 18 or higher
- **PostgreSQL** 14 or higher
- **npm** (comes with Node.js)

### 1.2 Local Setup

1. **Clone the repository** and navigate to the project root.

2. **Create a `.env` file** in the `backend/` directory:

   ```env
   DB_HOST=localhost
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=cash_management
   DB_PORT=5432
   JWT_SECRET=your-secret-key-here
   CLIENT_URL=http://localhost:3000
   NODE_ENV=development
   ```

3. **Start the application** (Windows):

   Double-click `start.bat` — this automatically:
   - Installs backend & frontend dependencies (first run only)
   - Starts the backend server on port **5000**
   - Starts the frontend dev server on port **3000**

4. **Manual start** (any OS):

   ```bash
   # Terminal 1 — Backend
   cd backend
   npm install
   node server.js

   # Terminal 2 — Frontend
   cd frontend
   npm install --legacy-peer-deps
   npm start
   ```

5. **First login:**  
   On first startup, the system creates an admin account automatically. The temporary password is printed to the backend console. Log in and change it immediately.

### 1.3 Deploy to Render.com

The project includes a `render.yaml` for one-click deployment:
- Push to a GitHub repository
- Connect to Render.com → **New Blueprint Instance** → select the repo
- Render auto-creates the PostgreSQL database and web service
- `JWT_SECRET` is auto-generated; set `CLIENT_URL` to your frontend URL

---

## 2. User Roles & Permissions

The system has a 4-tier role hierarchy:

| Role | What They Can Do |
|------|-----------------|
| **Admin** | Full control: manage all users, system settings, edit/delete all transactions, approve/reject entries |
| **Owner** | Create managers & staff, approve transactions & anamath entries, manage assigned users |
| **Manager** | Create staff accounts, manage their own staff's transactions |
| **Staff** | Create transactions and anamath entries (pending approval) |

> **Note:** There can only be **one Admin** account in the system.

---

## 3. Dashboard

After logging in, you land on the **Dashboard** which shows:

- **System name** heading (configurable in Settings)
- **Quick stats** — total ledgers, today's transactions, pending items
- **Ledger Summary** — overview of all ledger balances
- **Quick action buttons** — navigate to common tasks

---

## 4. Ledger Management

Ledgers are the core books of accounts. Each ledger tracks its own debit/credit transactions and maintains daily opening/closing balances.

### Creating a Ledger

1. Navigate to **Ledgers** → click **Create Ledger**
2. Enter the ledger **name** (must be unique)
3. Optionally add a **description**
4. Select the ledger **type**: Asset, Liability, Equity, Revenue, or Expense
5. Click **Create**

### Viewing Ledgers

The Ledgers page has two tabs:
- **Manage Ledgers** — list of all ledgers with edit/delete options
- **Ledger Summary** — financial overview of all ledger balances

> **Keyboard shortcut:** `Ctrl+Shift+L` opens the Ledger Summary view.

### Editing a Ledger

Only **Admin** users can edit ledgers:
1. Go to **Ledgers** → **Manage Ledgers** tab
2. Click the **Edit** button on a ledger row
3. Modify name, description, or type → **Save**

---

## 5. Transactions

### 5.1 Transaction Types

Navigate to **Transactions** to see the type selection screen:

| Type | Description |
|------|-------------|
| **Credit** | Money received into a ledger |
| **Debit** | Money paid out from a ledger |
| **Anamath** | Miscellaneous/suspense entries |
| **Combined** | Atomic transaction + anamath entry pair |

### 5.2 Creating a Transaction

1. Go to **Transactions** → select the type (Credit, Debit, Anamath, or Combined)
2. Fill in the form:
   - **Date** — in DD/MM/YYYY format (type directly or use the picker)
   - **Ledger** — select from dropdown
   - **Amount** — enter in Indian number format (e.g., `1,00,000`)
   - **Description** — optional note
   - **Reference** — optional reference number
   - **Remarks** — optional additional details
3. Click **Submit**

Each transaction gets an auto-assigned **transaction number** (e.g., T001, T002, ...).

> **Keyboard shortcut:** `Ctrl+Shift+N` opens the new transaction screen.

### 5.3 Viewing Transactions

Go to **Transactions** → **View All** (`/transactions/list`):

- Transactions display in a sortable, paginated table
- Click column headers (**Date**, **Amount**, **Type**, etc.) to sort
- Use the **search bar** to find by amount, description, or transaction number
- Amounts show in ₹ Indian format (e.g., ₹1,00,000.00)

> **Keyboard shortcut:** `Ctrl+Shift+T` opens the transaction list.

### 5.4 Transaction Filters

Click **Filters** or go to **Transactions** → **Filters** to apply:

- **Date range** — filter by start and end date
- **Ledger** — filter by specific ledger
- **Type** — Credit, Debit, or Anamath
- **Amount range** — minimum and maximum amount

Click **Apply Filters** to see results, or **Clear** to reset.

### 5.5 Suspend / Unsuspend

Admin and Owner can **suspend** a transaction to temporarily exclude it from balance calculations:

1. In the transaction list, click the **Suspend** action
2. Confirm in the modal
3. Suspended transactions appear with a visual indicator
4. Click **Unsuspend** to reactivate

### 5.6 Approve / Reject

When Staff or Manager creates a transaction, it starts as **Pending**:

1. Admin/Owner sees pending transactions highlighted in yellow
2. Click **✓ Approve** to approve or **✗ Reject** to reject
3. Only **approved** transactions count toward balances

### 5.7 Editing & Deleting Transactions

- **Edit:** Click the edit icon on any transaction row
- **Delete:** Click the delete icon (Admin/Owner only)
- **30-day rule:** Transactions older than 30 days cannot be deleted

### 5.8 Exporting Transactions

From the transaction list:
- **PDF** — generates a formatted PDF with company header, date range, and totals
- **Excel** — exports to .xlsx with Indian number formatting

> **Keyboard shortcut:** `Ctrl+Shift+E` triggers export.

---

## 6. Anamath Entries

Anamath entries are miscellaneous/suspense items that don't fit standard debit/credit categories.

### Creating an Anamath Entry

1. Go to **Transactions** → select **Anamath**
2. Enter date, amount, remarks, and optionally link to a ledger
3. Submit — entry gets auto-assigned an **Anamath ID** (e.g., A001, A002, ...)

### Viewing Anamath Records

Navigate to **Anamath** (sidebar) to see all open entries:
- Search by Anamath ID (A001), ledger name, remarks, or amount
- Filter by ledger or date
- Sort by any column
- Each entry shows its **status** (Approved, Pending, Rejected)

### Approving / Rejecting

Admin and Owner can approve or reject pending anamath entries:
- Click **✓** (green check) to approve
- Click **✗** (red X) to reject
- Status updates immediately (optimistic UI)

### Closing Anamath Records

When an anamath entry is settled:
1. Click the **Archive** icon on the entry
2. Confirm in the modal
3. The entry moves to **Closed Records**

### Viewing Closed Records

Click the **Closed** button (purple) in the Anamath header to see all closed/settled entries. Closed records can be reopened if needed.

### Editing Anamath Entries

Click the **Edit** icon to modify date, amount, remarks, or ledger assignment.

---

## 7. Combined Transactions

A combined transaction creates a **regular transaction** and an **anamath entry** atomically:

1. Go to **Transactions** → **Combined**
2. Fill in:
   - Transaction details (date, ledger, amount, type)
   - Anamath details (amount, remarks)
3. Submit — both are created together, linked via `combinedWithAnamathId`

If either fails, both are rolled back (database transaction).

---

## 8. Opening Balances

The system maintains daily opening and closing balances for each ledger.

### Automatic Balance Rollover

Every day at **6:00 AM**, the system automatically:
1. Calculates closing balances from the previous day
2. Sets them as opening balances for the new day

### Manual Opening Balance

Admin users can manually set an opening balance:
1. Go to **Opening Balance** (sidebar)
2. Select a ledger and date
3. Enter the opening amount
4. Click **Set Balance**

Manual balances are flagged as `isManuallySet` and won't be overwritten by automatic recalculation.

### Balance Recalculation

If balances get out of sync (e.g., after bulk edits):
1. An admin can trigger a **full recalculation** from the Opening Balance page
2. This recalculates all balances from the earliest transaction date forward

---

## 9. User Management

### Creating Users

Admin/Owner/Manager can create users (within their role hierarchy):
1. Go to **User Management** (sidebar)
2. Click **Create User**
3. Enter username, email, password, and assign a role
4. The new user is linked to the creator via `managedBy`

### Managing Users

The User Management page shows:
- **Stats** — total users, active, inactive, by role
- **User list** — with expandable hierarchy (Admin → Owner → Manager → Staff)
- **Actions per user:**
  - **Edit** — change role or details
  - **Enable/Disable** — toggle account access
  - **Delete** — remove the account (Admin/Owner only)
  - **Transfer** — reassign staff to a different manager

> When a Manager is disabled, all their Staff are also disabled automatically (cascade).

---

## 10. System Settings

Admin-only page at **Settings**:

| Setting | Description |
|---------|-------------|
| Company Name | Shown in headers and exports (e.g., "MRN INDUSTRIES") |
| Currency | Default currency symbol |
| Date Format | Display format |
| Default Opening Balance | Starting balance for new ledgers (default: ₹5,00,000) |

---

## 11. Search & Filtering

### Global Search Behavior

All list pages support real-time search with 300ms debounce:
- **Transactions** — search by amount, description, reference, transaction number
- **Anamath** — search by Anamath ID (A001), ledger name, remarks, amount
- **Ledgers** — search by name or description

Search is **case-insensitive**.

### Filter Panels

Click the **Filters** button on any list to expand advanced filters:
- Date range, ledger, type, amount range
- Filters auto-apply and reset pagination to page 1
- Click **Clear** to remove all filters

---

## 12. Export & Reports

### PDF Export

All exports include:
- **Company header** (from System Settings)
- **Date range** of exported records
- **Serial numbers** for each row
- **Indian number formatting** (₹1,00,000.00)
- **Footer** with generation timestamp

### Excel Export

Exports to `.xlsx` format with:
- Formatted headers
- Indian currency formatting
- Column auto-width

### Streaming Export (Large Datasets)

For datasets exceeding 100K records, the system uses streaming export to avoid memory issues:
- Backend streams data in chunks
- Frontend receives and assembles the file progressively

---

## 13. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` | Go to Dashboard |
| `Ctrl+Shift+T` | Go to Transactions |
| `Ctrl+Shift+N` | New Transaction |
| `Ctrl+Shift+A` | Go to Anamath |
| `Ctrl+Shift+L` | Ledger Summary |
| `Ctrl+Shift+E` | Export |

---

## 14. Dark Mode

Toggle dark mode from the **theme button** in the sidebar/header. The preference persists across sessions using `localStorage`.

All UI components — tables, forms, modals, cards, charts — fully support dark mode.

---

## 15. Zoom Levels

Adjust the UI zoom from the settings/header area:

| Level | Scale |
|-------|-------|
| Fit | Auto-fit to screen |
| 110% | Slightly larger |
| 130% | Medium zoom |
| 150% | Maximum zoom |

Useful for presentations, accessibility, or high-DPI displays.

---

## 16. Indian Number Formatting

All monetary values throughout the application use the **Indian numbering system**:

| Standard | Indian | Display |
|----------|--------|---------|
| 100,000 | 1,00,000 | ₹1,00,000.00 |
| 1,000,000 | 10,00,000 | ₹10,00,000.00 |
| 10,000,000 | 1,00,00,000 | ₹1,00,00,000.00 |

This applies to:
- All table displays
- Form inputs (auto-formatted as you type)
- PDF exports
- Excel exports
- Dashboard summaries

---

## 17. Date Format

The application uses **DD/MM/YYYY** format throughout:

- Custom `DateInput` component for direct date typing
- All table columns show dates as `29/03/2026`
- Filter inputs accept DD/MM/YYYY
- Exports use DD/MM/YYYY

---

## 18. Troubleshooting

| Issue | Solution |
|-------|---------|
| **"JWT_SECRET not set"** | Add `JWT_SECRET=your-secret` to `.env` file |
| **Database connection error** | Verify PostgreSQL is running and `.env` credentials are correct |
| **CORS error on frontend** | Set `CLIENT_URL=http://localhost:3000` in backend `.env` |
| **Blank page after error** | The ErrorBoundary will show a reload button; click it |
| **Stale data after edit** | Click the **Refresh** button; cache auto-clears within 30 seconds |
| **Rate limited (429)** | Wait 1 minute; the limit is 200 requests per minute |
| **Can't delete old transaction** | Transactions older than 30 days cannot be deleted (by design) |
| **Balance mismatch** | As Admin, trigger a balance recalculation from the Opening Balance page |
| **User can't log in** | Check if their account is disabled in User Management |
