# ⛽ SmartPump: Intelligent Fuel Station Shift & Staff Manager

[![React Native](https://img.shields.io/badge/Frontend-React%20Native%20%7C%20Expo-blue?style=for-the-badge&logo=react)](https://reactnative.dev)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-darkgreen?style=for-the-badge&logo=mongodb)](https://www.mongodb.com)
[![Twilio](https://img.shields.io/badge/SMS-Twilio-red?style=for-the-badge&logo=twilio)](https://www.twilio.com)
[![Cloudinary](https://img.shields.io/badge/Cloud-Cloudinary-blueviolet?style=for-the-badge&logo=cloudinary)](https://cloudinary.com)

**SmartPump** is a production-grade, full-stack mobile and backend application designed to automate shift scheduling, employee role allocation, and rule-based nozzle assignments at busy fuel stations. By replacing manual registers with a smart scheduling engine and instant messaging, it eliminates human error, optimizes overtime costs, and ensures strict safety compliance.

---

## 📌 Table of Contents

* [🚀 The Problem & The Solution](#-the-problem--the-solution)
* [🧠 Smart Auto-Assignment Algorithm](#-smart-auto-assignment-algorithm)
* [🛠️ Tech Stack](#️-tech-stack)
* [📱 Mobile App Features (Frontend)](#-mobile-app-features-frontend)
* [⚡ API & Automation Features (Backend)](#-api--automation-features-backend)
* [📐 System Architecture](#-system-architecture)
* [⚙️ Setup & Installation](#️-setup--installation)
* [💼 Business Rules & Constraints](#-business-rules--constraints)
* [🛡️ License](#️-license)

---

## 🚀 The Problem & The Solution

### **The Challenge**
Managing shifts at fuel stations is highly complex:
1. **Diverse Roles**: Staff are split into Supervisors, Air Boys, and Operators.
2. **Physical Constraints**: Specific nozzles (like hanging nozzles H5/H6) require male staff with no physical restrictions due to safety/ergonomic requirements.
3. **Complex Rules**: Certain operators are barred from nozzle duties entirely (nozzle restriction), or cannot handle hanging nozzles.
4. **Overtime Bloat**: Stations often incur unnecessary Overtime (OT) costs when shift staff can be promoted internally to cover vacancies.
5. **Safety Constraints**: Having adjacent nozzles staffed by overtime workers poses a fatigue/safety risk, which must be blocked.

### **The Solution**
**SmartPump** automates this entire workflow in one tap. The manager enters the date, selects a shift (Morning/Evening), clicks **"Auto Assign"**, and the system instantly generates an optimized, complaint shift chart, stores a visual layout snapshot in the cloud, and shares it with the team.

---

## 🧠 Smart Auto-Assignment Algorithm

The core of the application is a **4-Phase Rule-Based Scheduling Engine** that resolves constraints in millisecond time:

```mermaid
graph TD
    A[Start Auto-Assignment] --> B[Phase 1: Filter Available Primary Staff]
    B --> C[Assign Supervisor, Air Boy & Primary Operators to Nozzles N1-N6]
    C --> D[Phase 2: Internal Promotion]
    D --> E{Supervisor or Air Boy empty?}
    E -- Yes --> F[Promote eligible Primary Operators to fill vacancies]
    E -- No --> G[Phase 3: Assign Extra Staff]
    F --> G
    G --> H[Phase 4: Overtime OT Allocation]
    H --> I{Extra staff exists?}
    I -- Yes --> J[Block OT Allocation - Save Costs!]
    I -- No --> K[Pull Backup Shift staff for empty slots up to Max 3 OT]
    K --> L[Enforce Safety: Block adjacent OT nozzle pairings]
    J --> M[Complete Schedule & Return Summary]
    L --> M
```

### **Algorithm Breakdown**
1. **Phase 1: Primary Allocation**: Assigns available primary shift workers based on their specific roles and restrictions. Priority is given to staffing the physically demanding hanging nozzles (H5/H6) first.
2. **Phase 2: Internal Promotion**: If a Supervisor or Air Boy is missing, the system promotes a primary operator (prioritizing restricted operators for Air Boy duty) to save overtime costs.
3. **Phase 3: Extra Pool**: Leftover primary staff are assigned to the "Extra" pool to handle general duties.
4. **Phase 4: Intelligent Overtime**: If gaps remain, backup shift staff are pulled as Overtime (OT).
   * **Max OT Limit**: Capped at 3 staff members per shift.
   * **Cost Guard**: OT is blocked entirely if there is an "Extra" worker available in the primary shift.
   * **Adjacent OT Block**: Prevent two OT workers from standing adjacent to each other (e.g., N1 & N2, or N3 & N4) to maintain safety/alertness levels.

---

## 🛠️ Tech Stack

### **Frontend (Mobile Client)**
* **React Native / Expo** (SDK 54) - High-performance cross-platform application.
* **React Navigation** (v7) - Smooth, native-feeling screen flows.
* **React Native ViewShot** - Captures visual map structures dynamically.
* **Expo Image & Image Picker** - High-speed avatar uploads & caching.
* **Lucide React Native** - Modern icon library.

### **Backend (Service Layer)**
* **Node.js & Express** - Scalable REST API with custom CORS configuration.
* **Mongoose & MongoDB** - Schema modeling and persistent database storage.
* **Twilio SMS API** - Delivers auto-generated shift reports to staff.
* **Cloudinary Node SDK** - Cloud storage for generated visual map snapshots.
* **Node-Cron** - Automated scheduler to trigger shift alerts.

---

## 📱 Mobile App Features (Frontend)

* **Visual Fuel Station Layout Grid**: Rendered mapping representing dispensers (MPDs), Air station, Supervisor desk, and Hanging nozzles (H5/H6).
* **Multi-Selection Assignment**: Select multiple staff and assign them to roles, mark them present, or mark them absent in one tap.
* **Auto-Assign Trigger**: Runs the server-side algorithm and renders roles with specific badges (e.g., `OT`, `⭐ Promoted`).
* **Visual Map Snapshot Generation**: Converts the current layout rendering into a compressed Base64 image and uploads it to Cloudinary.
* **One-Tap Share**: Shares the layout map directly to WhatsApp, Telegram, or email.
* **Offline Caching**: Uses `AsyncStorage` to cache staff profiles and the latest schedules, ensuring usability in remote fuel stations with low connectivity.

---

## ⚡ API & Automation Features (Backend)

* `/api/shifting` (GET/POST): Fetch and add members with avatar uploads via Multer-Cloudinary.
* `/api/auto-assign` (POST): Processes dates, shifts, and executes the scheduling engine.
* `/api/save-map` (POST): Stores base64 snapshots to Cloudinary and saves assignments to MongoDB.
* `/api/stats` (GET): Generates analytics dashboard stats (role count, shift distribution, gender ratios, restricted staff).
* `/api/settings` (POST): Allows dynamic configuration of morning/evening shift notification triggers.
* `/api/test-sms` (POST): Instant testing endpoint for checking SMS delivery via Twilio.

---

## 📐 System Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │          React Native (Expo) Client          │
                  └──────────────┬──────────────────▲────────────┘
                                 │                  │
                Sends Layout,    │                  │  Fetches Staff,
                Base64 Image,    │                  │  Schedules &
                & Settings       │                  │  Dashboard Stats
                                 ▼                  │
                  ┌─────────────────────────────────┴────────────┐
                  │             Express Node.js API              │
                  └──────┬───────────────┬──────────────────┬────┘
                         │               │                  │
       Saves Base64      │               │ Queries/Saves    │ Triggers SMS
       as JPG Url        │               │ Data             │ Reports
                         ▼               ▼                  ▼
                  ┌────────────┐   ┌────────────┐   ┌────────────┐
                  │ Cloudinary │   │  MongoDB   │   │ Twilio SMS │
                  └────────────┘   └────────────┘   └────────────┘
```

---

## ⚙️ Setup & Installation

### **Prerequisites**
* Node.js (v18+)
* MongoDB (Local instance or Atlas Connection URI)
* Cloudinary & Twilio developer accounts

### **1. Clone & Configure the Backend**
```bash
cd Backend
npm install
```
Create a `.env` file in the `Backend` directory:
```env
PORT=5000
MONGODB_URI=mongodb+srv://your_username:your_password@cluster.mongodb.net/smartpump
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone
MANAGER_PHONE_NUMBER=your_alerts_receiver_phone
```
Run the server:
```bash
npm start
```

### **2. Configure the Frontend**
```bash
cd Frontend
npm install
```
Configure your backend API base URL inside `Frontend/src/api/axiosInstance.js`.

Start the Expo bundler:
```bash
npx expo start
```
*Press `a` for Android Emulator, `i` for iOS Simulator, or scan the QR code with **Expo Go** on your device.*

---

## 💼 Business Rules & Constraints

For reference, the system enforces the following safety and operational logic:

| Rule Name | Scope | Description | Target / Logic |
| :--- | :--- | :--- | :--- |
| **Nozzle Restriction** | Safety / Skills | Blocked from nozzle handling if set to `true` | Cannot be assigned to N1 to N6 |
| **Hanging Restriction** | Physical Safety | Blocked from hanging nozzles (H5/H6) | Cannot be assigned to N5 or N6 |
| **Gender Policy** | Ergonomics | Female workers are restricted from H5/H6 | Assigned to N1-N4 or Supervisor/Air |
| **OT Capping** | Financials | Limit maximum overtime personnel to 3 | Capped at `MAX_TOTAL_OT = 3` |
| **OT Block Override** | Financials | No OT allowed if primary extra staff is idle | `Extra != null` blocks OT assignments |
| **OT Adjacent Blocking** | Safety | No adjacent overtime workers allowed | E.g. If N1 is OT, N2 cannot be OT |

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Created with ❤️ for smart workforce management and operational excellence.*
