# Spades Is My Lingo™ - Firebase Security Specification

## 1. Data Invariants
1. **User Ownership (Identity Guard)**: A user can only read, write, or update their own user profile `/users/{userId}` where `userId == request.auth.uid`.
2. **Subcollection Relational Isolation**: A user can only access, create, or update a score-tracker session under `/users/{userId}/sessions/{sessionId}` where `userId == request.auth.uid`. No cross-user session leaks are possible.
3. **No Self-Assigned Privileges**: Users cannot escalate permissions or set arbitary roles or custom claims.
4. **Volume Boundaries**: Numeric parameters such as level, streakDays, XP, chips, and sweepstakesTickets must be non-negative and capped to realistic upper bounds to prevent "Denial of Wallet" and overflow vulnerability states.
5. **Timestamp Temporal Integrity**: Modified records must have `updatedAt` validated precisely using the server's `request.time`.

---

## 2. The "Dirty Dozen" Payloads (Vulnerability Vector Analysis)

### Vector 1: Profile Spoofing & Coin Manipulation
1. **Payload 01: Spoofed Profile Creation (Identity Hijack)**
   - Attempting to write a profile for user `victim_123` while authenticated as `attacker_456`.
   - *Target Path*: `/users/victim_123`
   - *Malicious payload*: `{"uid": "victim_123", "email": "victim@domain.com", "chips": 1000000}`
   - *Expected Result*: `PERMISSION_DENIED`

2. **Payload 02: Coin Injection Attack (Illegal Minting)**
   - Attempting to update chips from `2,500` directly to `99,999,999` using a direct update.
   - *Target Path*: `/users/attacker_456`
   - *Malicious update*: Increments chips by `99,997,499` without any valid gameplay context.
   - *Expected Result*: `PERMISSION_DENIED` (Unless strictly managed by game logic constraints, or updates are filtered using `affectedKeys()`).

3. **Payload 03: Profile Email Spoofing**
   - Attempting to register an unverified or spoofed email representing an administrator.
   - *Target Path*: `/users/attacker_456`
   - *Malicious payload*: `{"uid": "attacker_456", "email": "admin@lingolegacy.com"}` where `email_verified` is false or missing.
   - *Expected Result*: `PERMISSION_DENIED`

4. **Payload 04: Cosmetic Unlock Theft**
   - Attempting to insert a rare deck skin (`deck_gold`) into `purchasedDecks` list without paying coins.
   - *Target Path*: `/users/attacker_456`
   - *Malicious payload*: Updating `purchasedDecks` to include luxury skins while keeping chips unchanged.
   - *Expected Result*: `PERMISSION_DENIED` (Updates to skins must either deduct coins or be verified).

### Vector 2: Tracker Session Hijacking & Score Poisoning
5. **Payload 05: Session Interception (Cross-User Read)**
   - Trying to read `/users/victim_123/sessions/session_789` while logged in as `attacker_456`.
   - *Target Path*: `/users/victim_123/sessions/session_789`
   - *Expected Result*: `PERMISSION_DENIED`

6. **Payload 06: Session Spoofing (Cross-User Write)**
   - Attempting to insert/write a session for `victim_123` as `attacker_456`.
   - *Target Path*: `/users/victim_123/sessions/session_789`
   - *Malicious payload*: `{"id": "session_789", "userId": "victim_123", "teamAName": "Hacker", "teamBName": "Loser"}`
   - *Expected Result*: `PERMISSION_DENIED`

7. **Payload 07: Score Overwrite (Integer Overflow)**
   - Injecting high double-precision or extreme floats as scores to crash rendering or exceed limits.
   - *Target Path*: `/users/attacker_456/sessions/session_789`
   - *Malicious payload*: `{"id": "session_789", "userId": "attacker_456", "teamAScore": 9e37, "teamAName": "Attacker"}`
   - *Expected Result*: `PERMISSION_DENIED`

8. **Payload 08: Blank Team Identity Spoofing**
   - Creating a session with blank or invalid names to bypass UI validations.
   - *Target Path*: `/users/attacker_456/sessions/session_789`
   - *Malicious payload*: `{"id": "session_789", "userId": "attacker_456", "teamAName": "", "teamBName": ""}`
   - *Expected Result*: `PERMISSION_DENIED`

### Vector 3: Global System Bypass & Schema Defiance
9. **Payload 09: Timestamp Forgery**
   - Injecting a historic hardcoded or client-crafted `updatedAt` string to bypass streak timers.
   - *Target Path*: `/users/attacker_456`
   - *Malicious payload*: `{"updatedAt": "2020-01-01T00:00:00Z"}` (instead of server time).
   - *Expected Result*: `PERMISSION_DENIED`

10. **Payload 10: Ghost Property Injection (Shadow Update)**
    - Attempting a "Shadow Update" by introducing fields not in the blueprint (e.g., `isAdmin: true` or `cheatModeActive: true`).
    - *Target Path*: `/users/attacker_456`
    - *Malicious payload*: `{"uid": "attacker_456", "isAdmin": true, "chips": 1000}`
    - *Expected Result*: `PERMISSION_DENIED`

11. **Payload 11: Id Poisoning Attack**
    - Writing a user profile with a 1.5MB junk-character string as the `userId` document ID.
    - *Target Path*: `/users/long_malicious_junk_string_over_128_characters_...`
    - *Expected Result*: `PERMISSION_DENIED`

12. **Payload 12: Blanket Data Query scraping**
    - Attempting a list request on `/users` collection to scrape all active player emails and profiles without specifying single owned ID.
    - *Target Path*: `/users` (Collection list query)
    - *Expected Result*: `PERMISSION_DENIED`

---

## 3. The Test Runner Spec (`firestore.rules.test.ts`)
To fully verify our Zero-Trust architecture, we will write a clean testing configuration that mirrors these constraints. The live rules will guarantee each of these vectors is locked solid.
