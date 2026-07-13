# ⛽ PUMP MANAGEMENT APP — COMPLETE LOGIC DOCUMENTATION

> **Bhasha:** Hinglish (Hindi + English mixed) — Saare rules samajhne ke liye  
> **File:** `LOGIC_README.md`  
> **Last Updated:** July 2026

---

## 📋 TABLE OF CONTENTS

1. [App Overview](#1-app-overview)
2. [Member Data Model](#2-member-data-model)
3. [Positions / Zones](#3-positions--zones)
4. [Restriction Rules](#4-restriction-rules)
5. [Auto-Assign Logic — Step by Step](#5-auto-assign-logic--step-by-step)
6. [Scoring System (Group-Spread)](#6-scoring-system-group-spread)
7. [OT (Overtime) Rules](#7-ot-overtime-rules)
8. [Manual Assignment Rules](#8-manual-assignment-rules)
9. [Save & Share Map](#9-save--share-map)
10. [SMS Auto-Send](#10-sms-auto-send)
11. [Caching Logic](#11-caching-logic)
12. [API Endpoints](#12-api-endpoints)
13. [Quick Examples](#13-quick-examples)

---

## 1. App Overview

Yeh app ek **petrol pump** ke liye shift management karta hai.  
Do shifts hoti hain: **Morning** aur **Evening**.

**Main kaam:**
- Staff members ko positions par assign karna
- Auto-assign button se automatic assignment karna
- Daily map save karna aur WhatsApp par share karna
- History dekhna

---

## 2. Member Data Model

Har staff member ke yeh fields hote hain:

| Field | Type | Values | Matlab |
|-------|------|---------|--------|
| `name` | String | — | Naam |
| `role` | String | `operator`, `supervisor`, `air boy` | Kaam |
| `shift` | String | `morning`, `evening` | Kaunsi shift |
| `phoneNumber` | String | — | Unique phone |
| `gender` | String | `male`, `female` | Gender |
| `available` | String | `present`, `absent` | Aaj aaya ya nahi |
| `avatar` | String | Cloudinary URL | Photo |
| `nozzleRestriction` | Boolean | true/false | Kisi bhi nozzle par NA |
| `hangingRestriction` | Boolean | true/false | Sirf H5/H6 par NA |

---

## 3. Positions / Zones

App mein 9 positions hain:

```
┌─────────────────────────────────────────────┐
│  👮 SUPERVISOR         📅 Date               │
│                                             │
│  ┌──────────────────┐    ┌────────────┐     │
│  │  N2  │ MPD │ N1  │    │   H-5 (N5) │     │
│  │  N3  │     │ N4  │    │   H-6 (N6) │     │
│  └──────────────────┘    └────────────┘     │
│                                             │
│  [Extra]    [Air Boy]                       │
│                                             │
│  📝 Caption/Note                            │
│  🚫 Absent List                             │
└─────────────────────────────────────────────┘
```

### Position Groups (H-Pairs):

| Group | Positions | Type |
|-------|-----------|------|
| **Group 0** | N1, N2 (H1/H2) | Normal Nozzle |
| **Group 1** | N3, N4 (H3/H4) | Normal Nozzle |
| **Group 2** | N5, N6 (H5/H6) | **Hanging** — zyada restriction |
| Special | Supervisor | Role-based |
| Special | Air | Air Boy role |
| Special | Extra | Extra operator |

---

## 4. Restriction Rules

### Rule 1 — `nozzleRestriction = true`
> **Matlab:** Yeh bande ko **kisi bhi nozzle (N1–N6)** par assign NAHI kar sakte  
> **Kahan assign ho sakta hai:** Supervisor, Air Boy, Extra

### Rule 2 — `gender = 'female'`
> **Matlab:** Female ko **H5 aur H6 par assign NAHI** kar sakte  
> **N1, N2, N3, N4 par assign ho sakti hain** (agar nozzleRestriction nahi hai)

### Rule 3 — `hangingRestriction = true`
> **Matlab:** Yeh bande ko **sirf H5 aur H6 par assign NAHI** kar sakte  
> **N1, N2, N3, N4 par assign ho sakte hain** (agar nozzleRestriction nahi hai)

### Summary Table:

| Restriction | N1/N2/N3/N4 | H5/H6 |
|-------------|-------------|-------|
| Koi restriction nahi | ✅ Yes | ✅ Yes |
| `hangingRestriction = true` | ✅ Yes | ❌ No |
| `gender = 'female'` | ✅ Yes | ❌ No |
| `nozzleRestriction = true` | ❌ No | ❌ No |

---

## 5. Auto-Assign Logic — Step by Step

Jab **"Auto Assign"** button dabate hain, backend mein 4 phases run hote hain:

### ⚙️ Pre-Step: Data Fetch

```
1. Current shift ke saare PRESENT members fetch karo
2. Opposite shift ke saare PRESENT members fetch karo (OT ke liye)
3. Dono lists mein se role ke hisaab se groups banao:
   - primarySupervisors
   - primaryAirBoys
   - primaryOperators  ← Main pool
   - backupAirBoys     ← OT ke liye
   - backupOperators   ← OT ke liye
4. Har group ko SHUFFLE karo (fairness ke liye, random order)
```

---

### 📌 PHASE 1: Primary Roles Fill

**Step 1.1 — Supervisor assign karo:**
```
Agar primary shift mein supervisor present hai:
  → Usse Supervisor position par assign karo
```

**Step 1.2 — Air Boy assign karo:**
```
Agar primary shift mein air boy present hai:
  → Usse Air position par assign karo
```

**Step 1.3 — Supervisor Vacant? Promote karo:**
```
Agar koi supervisor present NAHI hai:
  → primaryOperators mein se ek ko promote karo
  → PREFER: nozzleRestriction = true wala operator (waise bhi nozzle par nahi ja sakta)
  → Usse Supervisor banao, flag: promotedToSupervisor = true
  → primaryOperators ki list se hata do
```

---

### 🧠 PHASE 2: Nozzle Assignment (Group-Spread Backtracking)

**Nozzle Order:**

| Shift | Priority Order |
|-------|----------------|
| Morning | N1 → N2 → N3 → N4 → N5 → N6 |
| Evening | N5 → N6 → N1 → N2 → N3 → N4 |

> Evening shift mein H5/H6 pehle fill hote hain kyunki wo evening shift ki primary responsibility hai.

**Algorithm (Backtracking + Group Scoring):**

```
Saare possible combinations try karo.
Har combination ko ek SCORE do:

SCORE = (filled nozzles × 10) + (distinct groups covered × 5)

Groups:
  - Group 0 = N1 ya N2 filled → group covered
  - Group 1 = N3 ya N4 filled → group covered
  - Group 2 = N5 ya N6 filled → group covered

Highest score wala combination select karo.
```

**Kyon zaruri hai yeh scoring?**

| Scenario | Bina Scoring | Scoring ke saath |
|----------|-------------|-----------------|
| 3 operators, Morning | N1+N2+N3 fill (score=30) ❌ H5/H6 khali | N1+N3+N5 fill (score=45) ✅ |
| 2 operators, Morning | N1+N2 fill (score=20) ❌ | N1+N3 fill (score=25) ✅ |
| 6 operators | N1+N2+N3+N4+N5+N6 (score=90) ✅ | Same ✅ |

**Operator Eligibility check:**
```
canAssignToNozzle(operator, nozzle):
  if nozzleRestriction == true → BLOCK (koi bhi nozzle nahi)
  if nozzle is N5 or N6:
    if gender == 'female' → BLOCK
    if hangingRestriction == true → BLOCK
  else:
    → ALLOW
```

---

### 🔄 PHASE 3: Internal Promotion & Extra

Nozzle assignment ke baad jo operators bache (leftoverOperators):

**Step 3.1 — Air Boy Vacant? Promote karo:**
```
Agar Air position khali hai:
  → leftoverOperators mein se ek operator ko promote karo
  → PREFER: nozzleRestriction = true wala (waise bhi nozzle par nahi ja sakta)
  → Flag: promotedToAir = true
```

**Step 3.2 — Extra position:**
```
Agar aur bhi leftover operators hain:
  → Pehle wale ko Extra position par daalo
```

---

### 🕐 PHASE 4: Overtime (OT) Assignment

OT sirf **opposite shift ke members** ko milti hai.  
**MAX 3 OT allowed** ek shift mein.

**Step 4.1 — Air OT:**
```
Agar Air position abhi bhi khali hai:
  → backupAirBoys mein se ek dhoondo
  → Assign karo, naam mein "(OT)" lagao
  → totalOTCount++
```

**Step 4.2 — Nozzle OT (Priority: N5→N6→N1→N2→N3→N4):**
```
Har khali nozzle ke liye:
  
  ❗ MORNING SHIFT SPECIAL RULE:
     H5 ya H6 par OT kabhi NAHI denge
     (continue — skip karo)
  
  ❗ EVENING SHIFT SPECIAL RULE:
     H5 ya H6 par OT tabhi denge jab:
     - Dusra wala (N5 ka pair N6, N6 ka pair N5) already filled ho
     - Aur woh primary shift member ho (OT nahi)
  
  ❗ ADJACENT PAIR RULE:
     Agar N1 par OT hai → N2 par OT NAHI milegi (aur ulta)
     Agar N3 par OT hai → N4 par OT NAHI milegi
     Agar N5 par OT hai → N6 par OT NAHI milegi
     (Ek pair mein zyada se zyada 1 OT)
  
  Eligible OT candidate:
     → backupOperators mein se
     → nozzleRestriction = false
     → H5/H6 ke liye: male + hangingRestriction = false
```

---

## 6. Scoring System (Group-Spread)

**Formula:**
```
score = (filled nozzles × 10) + (distinct groups covered × 5)
```

**Groups:**
- Group 0: N1 ya N2 mein se koi ek filled → +5
- Group 1: N3 ya N4 mein se koi ek filled → +5
- Group 2: N5 ya N6 mein se koi ek filled → +5

**Real Examples:**

```
3 Operators present, Morning shift:

Option A: N1 + N2 + N3 fill karo
  Score = 3×10 + 2 groups×5 = 30 + 10 = 40

Option B: N1 + N3 + N5 fill karo
  Score = 3×10 + 3 groups×5 = 30 + 15 = 45 ✅ WINNER

Result: Ek operator H1/H2 mein, ek H3/H4 mein, ek H5/H6 mein
```

```
2 Operators present, Morning shift:

Option A: N1 + N2 fill karo
  Score = 2×10 + 1 group×5 = 20 + 5 = 25

Option B: N1 + N3 fill karo
  Score = 2×10 + 2 groups×5 = 20 + 10 = 30 ✅ WINNER

Result: Ek H1/H2 mein, ek H3/H4 mein
```

```
1 Operator present, Morning shift:

N1 fill karo: Score = 10 + 5 = 15
(Koi bhi single nozzle same score, so random/first eligible)
```

---

## 7. OT (Overtime) Rules

### Morning Shift OT Rules:

| Nozzle | OT Allowed? | Reason |
|--------|-------------|--------|
| N1 | ✅ Yes | Normal nozzle |
| N2 | ✅ Yes | Normal nozzle |
| N3 | ✅ Yes | Normal nozzle |
| N4 | ✅ Yes | Normal nozzle |
| N5 | ❌ **NEVER** | Morning mein H5/H6 OT nahi |
| N6 | ❌ **NEVER** | Morning mein H5/H6 OT nahi |

### Evening Shift OT Rules:

| Nozzle | OT Allowed? | Condition |
|--------|-------------|-----------|
| N5 | ⚠️ Conditional | Tabhi jab N6 primary member se filled ho |
| N6 | ⚠️ Conditional | Tabhi jab N5 primary member se filled ho |
| N1/N2/N3/N4 | ✅ Yes | Normal rules |

### Adjacent Pair Blocking:

```
N1 + N2 = Pair (ek mein OT → dusre mein OT nahi)
N3 + N4 = Pair
N5 + N6 = Pair
```

### Max OT Count:
```
MAX_TOTAL_OT = 3  (total OT assignments per shift)
```

---

## 8. Manual Assignment Rules

User khud bhi kisi ko kisi zone par drag/tap kar ke assign kar sakta hai.

**Validation (Frontend pe bhi hota hai):**
```
1. Ek zone par ek hi member (single slot)
2. nozzleRestriction = true → N1-N6 par assign NAHI hoga
   → Toast error dikhega: "Complete Restriction"
3. N5/N6 par:
   - female → Toast error: "female NOT allowed on H5/H6"
   - hangingRestriction = true → Toast error: "hanging restriction"
```

**Absent/Present Toggle:**
```
Staff ko select karo → "Mark as Absent" dabao
  → DB mein available = 'absent' update
  → Available Staff list se hat jaata hai

Absent staff select karo → "Mark as Present" dabao
  → DB mein available = 'present' update
  → Available Staff list mein aa jaata hai
```

---

## 9. Save & Share Map

**"Save & Share" button:**
```
1. ViewShot se current map ka screenshot lo (JPEG, quality 0.7)
2. Base64 mein convert karo
3. Backend ko bhejo:
   - date, shift, image (base64), caption, assignments
4. Backend Cloudinary par upload karta hai
5. DB mein MapSnapshot save hoti hai (date+shift unique index)
6. App native share dialog open karta hai (WhatsApp, etc.)
```

**MapSnapshot fields:**
```
date: "2026-07-13"
shift: "Morning"
image: "https://res.cloudinary.com/..."
caption: "Note"
assignments: { Supervisor: {...}, N1: {...}, ... }
```

---

## 10. SMS Auto-Send

**Technology:** Twilio (WhatsApp/SMS)

**Schedule:**
```
Morning time → Settings mein set karo (e.g., "06:00")
Evening time → Settings mein set karo (e.g., "14:00")

Cron job automatically:
  → Aaj ki date ki shift ka map DB se dhoondta hai
  → Saare members ko message bhejta hai
```

**Message Format:**
```
⛽ PUMP DUTY LIST
📅 2026-07-13 (Morning)

👮 Supervisor: Ramesh
⛽ Nozzle 1: Suresh
⛽ Nozzle 2: Ganesh
⛽ Nozzle 3: Mahesh
⛽ Nozzle 4: Dinesh
🪝 Nozzle 5: Rajesh
🪝 Nozzle 6: Naresh
👷 Extra: ❌ Empty
💨 Air Boy: Mukesh

🚫 Absent: Somesh, Hitesh

📝 Note: All clear
```

---

## 11. Caching Logic

App offline-friendly hai:

```
Members Cache:
  Key: "DASHBOARD_MEMBERS_V1"
  → Fetch on app open
  → Background mein fresh data aata hai

Assignments Cache:
  Key: "DASHBOARD_ASSIGNMENTS_{date}_{shift}"
  → Har baar jab date ya shift badle, cache load hota hai
  → Pehle cache dikhao, phir backend se sync karo
  → Jab bhi assignments change ho, turant cache update karo
```

---

## 12. API Endpoints

| Method | Endpoint | Kaam |
|--------|----------|------|
| GET | `/shifting` | Saare members list |
| POST | `/shifting` | Naya member add |
| PUT | `/shifting/:id` | present/absent toggle |
| PUT | `/members/:id` | Member edit (full) |
| DELETE | `/members/:id` | Member delete |
| POST | `/auto-assign` | Auto assignment run |
| POST | `/save-map` | Map save (Cloudinary) |
| GET | `/get-map` | Ek din ki map fetch |
| GET | `/all-maps` | Saari maps history |
| DELETE | `/delete-map/:id` | Map delete |
| POST | `/settings` | SMS timing update |
| POST | `/test-sms` | SMS manually trigger |
| GET | `/stats` | Dashboard statistics |

---

## 13. Quick Examples

### Example A — Subah 3 Operator Present (Morning Shift)

```
Primary Operators: [Raju, Sita (female), Mohan]
Supervisor: absent → Raju promote hoga? Nahi, koi supervisor nahi
                   → Pehle eligible operator promote hoga

Wait — agar supervisor nahi hai:
  Raju promote to Supervisor (nozzle restriction check)

Bache: [Sita, Mohan]

Nozzle Assignment:
  Sita → female, hangingRestriction na ho toh N1/N3 ja sakti hai, H5/H6 nahi
  Mohan → sab ja sakta hai

Group-spread scoring:
  Sita → N1 (Group 0), Mohan → N3 (Group 1)
  Score = 2×10 + 2×5 = 30

H5/H6 khaali rahega (kyunki eligible banda nahi)

Result: Supervisor=Raju, N1=Sita, N3=Mohan
        N2, N4, N5, N6 khali
```

### Example B — Subah 3 Operator Present, Sab Male (Morning Shift)

```
Primary Operators: [Raju, Mohan, Suresh]
(No supervisor, no air boy)

Phase 1: Raju → promoted to Supervisor

Phase 2: Mohan aur Suresh → nozzle assignment
  Best combo: Mohan=N1, Suresh=N3 (score=25)
  vs          Mohan=N1, Suresh=N5 (score=25) — same!
  
  Actually: N1+N3 = 2 groups, score=25
            N1+N5 = 2 groups, score=25
  → Koi bhi select ho sakta hai (random)

  But agar backtracking N1→N3 pehle try kare:
    N1+N3 → groups 0+1 covered
    N1+N5 → groups 0+2 covered
    Both same score (25)
  
  Note: Teen operators par ek Supervisor ban gaya,
        sirf 2 bachche nozzle par.
        3rd wale ko Extra milegi.
```

### Example C — Poori Shift (6 Operators, 1 Supervisor, 1 Air Boy)

```
8 log present:
  Supervisor: Shyam
  Air Boy: Kamlesh
  Operators: [A, B, C, D, E, F]

Phase 1: Shyam=Supervisor, Kamlesh=Air

Phase 2: A,B,C,D,E,F → 6 nozzles
  N1=A, N2=B, N3=C, N4=D, N5=E (male), N6=F (male)
  Score = 6×10 + 3×5 = 75 ✅ Perfect!

No leftovers, no OT needed.
```

---

## 🔧 Code Files Reference

| File | Kaam |
|------|------|
| [`Backend/controllers/shiftingController.js`](./Backend/controllers/shiftingController.js) | Saari assignment logic |
| [`Backend/models/Member.js`](./Backend/models/Member.js) | Member schema |
| [`Backend/models/MapSnapshot.js`](./Backend/models/MapSnapshot.js) | Map save schema |
| [`Backend/utils/smsBot.js`](./Backend/utils/smsBot.js) | SMS/WhatsApp logic |
| [`Backend/routes/shiftingRoutes.js`](./Backend/routes/shiftingRoutes.js) | API routes |
| [`Frontend/src/screens/Dashboard.js`](./Frontend/src/screens/Dashboard.js) | Main UI screen |

---

*Last updated: July 2026 | Pump Management App v1.0*
