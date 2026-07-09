# ⛽ Settlement: Smart Shift & Staff Manager

**Settlement** is a full-stack workforce scheduler and dispenser nozzle allocator designed for fuel stations. It automates nozzle assignments and shift schedules, enforcing strict safety rules, role requirements, and minimizing overtime costs.

---

## 🚀 Key Improvements & Updates

### 1. Optimal Backtracking Solver
The core auto-assignment engine uses a constraint-satisfaction backtracking search. Instead of a greedy allocation, the solver evaluates all possible assignments globally to:
- Maximize the number of filled nozzles.
- Prevent female operators (or those with hanging restrictions) from being placed in `H5/H6` hanging nozzles, while ensuring they are assigned to `N1–N4` first.
- Only leave operators in the **Extra** pool when all nozzles are fully assigned.

### 2. Compulsory Supervisor Promotion
Supervisor is a compulsory role. If the primary Supervisor is absent:
- The system automatically promotes a primary Operator to Supervisor before nozzle assignments are decided.
- It prioritizes promoting operators with `nozzleRestriction === true` first so that nozzle-capable staff remain available for dispenser duties.
- If this promotion leaves the team short on nozzles, the system calls Overtime (OT) workers.

### 3. Dynamic Date & Shift Caching
- Assignments are cached in local storage using dynamic key structures: `DASHBOARD_ASSIGNMENTS_${date}_${shift}`.
- Toggling shifts or dates loads the local cache instantly (zero lag) while performing background API syncs to fetch database overrides.

---

## 💼 Assignment Constraints & Rules

| Rule | Description | Target |
| :--- | :--- | :--- |
| **Nozzle Block** | Operators with `nozzleRestriction` cannot handle nozzles | N1 to N6 |
| **Hanging Block** | Females and staff with `hangingRestriction` are blocked | N5 & N6 (H5/H6) |
| **OT Cap** | Maximum overtime workers allowed per shift | Max 3 |
| **OT Safety** | Overtime workers cannot be assigned to adjacent nozzles | E.g. N1 & N2, N3 & N4, N5 & N6 |
| **Overtime Cost** | Overtime is blocked if primary shift has extra idle staff capable of working | System-wide |

---

## 🛠️ Tech Stack

- **Frontend**: React Native, Expo, React Navigation, AsyncStorage, ViewShot
- **Backend**: Node.js, Express, MongoDB (Mongoose), Cloudinary API, Twilio SMS API, Node-Cron

---

## ⚙️ Quick Start

### 1. Backend Setup
```bash
cd Backend
npm install
# Add MONGODB_URI, CLOUDINARY_*, and TWILIO_* keys in your .env file
npm start
```

### 2. Frontend Setup
```bash
cd Frontend
npm install
npx expo start
```
