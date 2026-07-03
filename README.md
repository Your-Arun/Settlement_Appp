# ⛽ Settlement: Smart Shift & Staff Manager

[![React Native](https://img.shields.io/badge/Frontend-React%20Native%20%7C%20Expo-blue?style=flat-square&logo=react)](https://reactnative.dev)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-green?style=flat-square&logo=node.js)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-darkgreen?style=flat-square&logo=mongodb)](https://www.mongodb.com)

**Settlement** is a full-stack mobile & backend solution that automates employee shift scheduling and dispenser nozzle assignments at fuel stations. It uses a custom rule-based scheduling engine to handle safety constraints, roles, and optimize overtime costs.

---

## 🔥 Key Features

* **🧠 Smart Auto-Assign**: 1-tap algorithm that automatically assigns staff (Supervisor, Air Boy, Operators) to fuel nozzles (N1-N6).
* **🛑 Safety Rules**: Enforces gender limits on hanging nozzles (H5/H6) and prevents restricted staff from nozzle duties.
* **💰 Cost Guard**: Automatically promotes internal staff to fill vacant roles before allocating costly Overtime (OT).
* **📱 Visual Layout & Sharing**: Interactive UI layout representing dispensers. Captures and shares the visual shift chart directly to WhatsApp/socials.
* **💬 Automated SMS alerts**: Integrates Twilio with Node-Cron to dispatch shift reports automatically.

---

## 🛠️ Tech Stack

* **Frontend**: React Native, Expo, React Navigation, ViewShot, AsyncStorage
* **Backend**: Node.js, Express, MongoDB (Mongoose), Cloudinary (Image storage), Twilio API, Node-Cron

---

## ⚙️ Quick Start

### **1. Backend Setup**
```bash
cd Backend
npm install
# Add MONGODB_URI, CLOUDINARY_*, and TWILIO_* keys in .env
npm start
```

### **2. Frontend Setup**
```bash
cd Frontend
npm install
npx expo start
```

---

## 💼 Assignment Constraints & Rules

| Rule | Description | Target |
| :--- | :--- | :--- |
| **Nozzle Block** | Operators with `nozzleRestriction` cannot handle nozzles | N1 to N6 |
| **Hanging Block** | Females and staff with `hangingRestriction` are blocked | N5 & N6 (H5/H6) |
| **OT Cap** | Maximum overtime workers allowed per shift | Max 3 |
| **OT Safety** | Overtime workers cannot be assigned to adjacent nozzles | E.g. N1 & N2 |
| **Overtime Cost** | Overtime is blocked if primary shift has extra idle staff | System-wide |

---
*Created with ❤️ for smart workforce management.*
