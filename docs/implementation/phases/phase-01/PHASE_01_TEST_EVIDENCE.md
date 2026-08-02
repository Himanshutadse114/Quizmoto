# Phase 1 Test Evidence: Golden Flow Assertions Mapping

This document provides explicit mapping between the 24-step verified Phase 0 Golden Flow and the automated assertions across our test suites.

## Evidence Matrix

| Step | Requirement | Test Layer | Test Name | File | Lines | Assertion | UI/DB Evidence | Result |
|---|---|---|---|---|---|---|---|---|
| 1 | Host Login | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 27-28 | `expect(loginRes.ok()).toBeTruthy()` | Valid token returned via API, host authenticated | PASSED |
| 2 | Dashboard Nav | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 31-33 | `hostPage.goto('/dashboard')` | Dashboard loads successfully | PASSED |
| 3 | Select Quiz | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 36-37 | `expect(quizRow).toBeVisible()` | Deterministic Quiz is visible | PASSED |
| 4 | Host Starts | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 38-41 | `hostPage.waitForURL(/lobby/)` | Host navigates to lobby | PASSED |
| 5 | Lobby (PIN) | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 42-45 | `expect(sessionPin).toBeTruthy()` | PIN generated in URL | PASSED |
| 6 | Wait Players | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | Implicit | N/A | Implicitly tested as players join | PASSED |
| 7 | Player A Joins | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 47-50 | `expect(playerAPage).toHaveURL(/player/)` | Player A navigates to wait screen | PASSED |
| 8 | Player B Joins | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 51-54 | `expect(playerBPage).toHaveURL(/player/)` | Player B navigates to wait screen | PASSED |
| 9 | Lobby Update | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 55-58 | `expect(PlayerA).toBeVisible()` | Host sees Player A and B | PASSED |
| 10 | Start Question | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 59-62 | `expect(QuestionText).toBeVisible()` | Question renders on host/player | PASSED |
| 11 | P_A Submit | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 64-67 | `expect(Answer Submitted).toBeVisible()` | Player A answers | PASSED |
| 12 | P_B Submit | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 68-71 | `expect(Answer Submitted).toBeVisible()` | Player B answers | PASSED |
| 13 | Answer Ack | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 67/71 | `expect(Answer Submitted).toBeVisible()` | UI displays waiting view | PASSED |
| 14 | Personal Result | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 74-76 | `expect('Correct!').toBeVisible()` | Players see correct/incorrect | PASSED |
| 15 | Leaderboard | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 77-80 | `expect('Live Standings').toBeVisible()` | Host views live standings | PASSED |
| 16 | Session Recov | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 87-88 | `playerAPage.reload()` | Player A reloads tab | PASSED |
| 17 | Recov Valid | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 91-92 | `expect('Correct!').toBeVisible()` | Player A recovers correct state | PASSED |
| 18 | Duplicate Block | `DATABASE INTEGRATION VERIFIED` | `should handle concurrent duplicate...` | `AnswerSubmissionService.test.js` | 101-135 | `expect(finalAnswers).to.equal(1)` | DB Row lock ensures 1 AnswerRow | PASSED |
| 19 | Subseq Ques | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 103-117 | `expect('Which planet...').toBeVisible()` | Questions 2 and 3 played | PASSED |
| 20 | Host Finishes | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 119-121 | `expect('Final Results').toBeVisible()` | Host clicks next on last question | PASSED |
| 21 | P_GameOver | `PLAYWRIGHT VERIFIED` | `Golden Flow (24-step)` | `golden-flow.spec.js` | 122 | `expect('GAME OVER!').toBeVisible()` | Players see Game Over | PASSED |
| 22 | Report Gen | `DATABASE INTEGRATION VERIFIED` | `should successfully lookup finished` | `reports.test.js` | 86-94 | `expect(res.body[0].status).to.equal('finished')` | Report DB row available | PASSED |
| 23 | Export (PDF) | `DATABASE INTEGRATION VERIFIED` | `should export PDF successfully` | `reports.test.js` | 111-118 | `expect(res.body.toString().startsWith('%PDF-')).to.be.true` | Exported file has PDF header | PASSED |
| 24 | Teardown | `SOCKET INTEGRATION VERIFIED` | `should prevent answers on finished session` | `socketContracts.test.js` | 120-130 | `expect(error).to.include('finished')` | Session prevents further play | PASSED |
