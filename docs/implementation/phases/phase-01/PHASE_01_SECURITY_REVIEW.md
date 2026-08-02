# Phase 1 Security Review

## Status and Classification

This document classifies the security posture of the Phase 1 extracted services. Absolute claims of "immunity" are strictly avoided.

### Classification Key
* **VERIFIED:** Formally proven via automated integration or E2E tests in the CI pipeline.
* **PARTIALLY VERIFIED:** Handled by architectural constraints (e.g. ORM wrappers) but lacking explicit negative tests.
* **NOT VERIFIED:** Theoretical protection without current automated verification.
* **NOT APPLICABLE:** Does not apply to the current architecture.

## The 15 Security Checks

### 1. Unknown fields removed from socket payloads
* **Status:** VERIFIED
* **Test Name:** `should drop unknown properties from payloads safely`
* **Source File & Lines:** `server/tests/socketContracts.test.js` (lines 78-85)
* **Result:** Joi `stripUnknown: true` removes malicious injection without crashing.
* **Remaining Risk:** None for tested payloads.

### 2. Invalid JWT rejected on API endpoints
* **Status:** VERIFIED
* **Test Name:** `should require authorization` / `should block unauthorized users`
* **Source File & Lines:** `server/tests/reports.test.js` (lines 81-84, 98-101)
* **Result:** Returns 401 Unauthorized.
* **Remaining Risk:** None for protected routes.

### 3. Wrong-session access rejected
* **Status:** VERIFIED
* **Test Name:** `should reject submission if player not found`
* **Source File & Lines:** `server/tests/AnswerSubmissionService.test.js` (lines 49-52)
* **Result:** Submitting an answer with a mismatched session/nickname fails gracefully.
* **Remaining Risk:** None.

### 4. Host-only endpoints reject player tokens
* **Status:** VERIFIED
* **Test Name:** `should block unauthorized users`
* **Source File & Lines:** `server/tests/reports.test.js` (lines 98-101)
* **Result:** API validates host role properly.
* **Remaining Risk:** None.

### 5. Concurrent duplicate answer submissions prevented
* **Status:** VERIFIED
* **Test Name:** `should handle concurrent duplicate answer submissions safely (Promise.all)`
* **Source File & Lines:** `server/tests/AnswerSubmissionService.test.js` (lines 102-135)
* **Result:** PostgreSQL `FOR UPDATE` lock guarantees exactly one answer row and one streak update.
* **Remaining Risk:** Database deadlocks if locks are acquired out of order in future complex operations.

### 6. Answer submitted for unstarted question rejected
* **Status:** VERIFIED
* **Test Name:** `should reject submission if question has not started yet`
* **Source File & Lines:** `server/tests/AnswerSubmissionService.test.js` (lines 54-63)
* **Result:** Fails gracefully before processing.
* **Remaining Risk:** None.

### 7. SQL Injection (SQLi)
* **Status:** PARTIALLY VERIFIED
* **Test Name:** N/A
* **Source File & Lines:** `server/services/AnswerSubmissionService.js`
* **Result:** Strictly utilizes Sequelize ORM.
* **Remaining Risk:** No automated DAST/SAST tool is currently asserting negative injection payloads.

### 8. Cross-Site Scripting (XSS)
* **Status:** NOT VERIFIED
* **Test Name:** N/A
* **Source File & Lines:** N/A
* **Result:** React handles most XSS, but no specific E2E test attempts payload execution.
* **Remaining Risk:** Malicious nicknames could potentially render raw HTML if improperly handled.

### 9. Denial of Service (DoS) via Socket Flooding
* **Status:** NOT VERIFIED
* **Test Name:** N/A
* **Source File & Lines:** N/A
* **Result:** No rate-limiting implemented on socket connections or submissions.
* **Remaining Risk:** A malicious client could flood `submit_answer` and exhaust resources.

### 10. JWT Expiration Enforced
* **Status:** PARTIALLY VERIFIED
* **Test Name:** N/A
* **Source File & Lines:** `server/middleware/auth.js`
* **Result:** `jsonwebtoken` library enforces expiration natively.
* **Remaining Risk:** No explicit automated test waiting for token expiry.

### 11. Secure Password Hashing
* **Status:** PARTIALLY VERIFIED
* **Test Name:** N/A
* **Source File & Lines:** `server/routes/auth.js`
* **Result:** `bcryptjs` is used for hashing passwords on registration.
* **Remaining Risk:** No explicit test asserting hash strength/salting.

### 12. CORS Policy Enforcement
* **Status:** PARTIALLY VERIFIED
* **Test Name:** N/A
* **Source File & Lines:** `server/index.js`
* **Result:** CORS middleware configured.
* **Remaining Risk:** Origins not strictly whitelisted in current dev setup.

### 13. CSRF Token Protection
* **Status:** NOT APPLICABLE
* **Test Name:** N/A
* **Source File & Lines:** N/A
* **Result:** Authentication relies on Bearer JWTs, not cookies, mitigating standard CSRF.
* **Remaining Risk:** N/A.

### 14. Graceful Error Handling on External Dependencies
* **Status:** VERIFIED
* **Test Name:** `should gracefully handle Python dependency failure without crashing Node`
* **Source File & Lines:** `server/tests/reports.test.js` (lines 111-125)
* **Result:** Node process survives missing Python executables with a 500 error.
* **Remaining Risk:** None.

### 15. Session Teardown Validation
* **Status:** VERIFIED
* **Test Name:** `should prevent answers on finished session`
* **Source File & Lines:** `server/tests/socketContracts.test.js` (lines 120-130)
* **Result:** Finished sessions reject socket events correctly.
* **Remaining Risk:** None.
