# TM-Lingo Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. Every learner profile (ages 3–18), lesson progress record, and story reading position MUST belong to an existing account root document under `/parents/{parentId}` (where `accountType` is `'parent'` or `'student'`).
2. Only the authenticated, email-verified owner (`request.auth.uid == parentId`) may read, list, create, update, or delete resources under `/parents/{parentId}`.
3. Cross-account private access is impossible: no blanket reads, no unverified writes, and `allow list` strictly filters on `resource.data.parentId == request.auth.uid` with zero `get()`/`exists()` calls.
4. Independent student accounts (`accountType == 'student'`) may optionally generate short-lived 6-character uppercase invite codes under `/familyInvites/{inviteCode}` (`^[A-Z0-9]{6}$`, max TTL 14 days, zero PII).
5. Parents CANNOT list `/familyInvites`; they may only `get` an exact 6-character code and atomically claim it (`writeBatch`) together with creating `/observerLinks/{parentUid}_{studentUid}`. Both rules mutually verify atomicity via `existsAfter()` and `get()`/`getAfter()`.
6. `/observerLinks/{linkId}` contains strictly non-PII learning summary metrics (display nickname, age/grade, lesson/activity counts, streak, goal). Only `parentUid` or `studentUid` may read or list (via `resource.data` equality, zero `get()`/`exists()`). Only the student may update metrics; either party may revoke or delete the link at any time.
7. All document IDs enforce strict character/length regexes (`^[a-zA-Z0-9_\-]+$` or `^[A-Z0-9]{6}$`); all strings enforce `.size()` bounds; arrays enforce `.size() <= 50` and first-element type validation.
8. Immutable ownership/audit fields (`parentId`, `learnerId`, `studentUid`, `parentUid`, `inviteCode`, `createdAt`) cannot change after creation; timestamps MUST equal `request.time`.
9. Shadow/extra fields (e.g., `role`, `isAdmin`, `email`) are rejected via strict `hasAll()` + `hasOnly()` and action-scoped `affectedKeys().hasOnly()`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `get /parents/uid-a/learners/learner-1` with `auth = null`.
2. **Unverified Email Write**: `create /parents/uid-a` with `auth.token.email_verified = false`.
3. **Cross-Account Private Get**: `uid-b` attempts `get /parents/uid-a/learners/learner-1`.
4. **Cross-Account Private List**: `uid-b` attempts `list /parents/uid-a/progress`.
5. **Identity Spoofing on Create**: `uid-a` creates `/parents/uid-a/learners/l1` with `parentId: "uid-b"`.
6. **Shadow Field Injection**: `uid-a` creates `/parents/uid-a` with extra key `isAdmin: true` or `email: "a@b.com"`.
7. **Orphaned Subcollection Write**: `uid-a` creates `/parents/uid-a/learners/l1` before `/parents/uid-a` exists.
8. **ID Poisoning**: `uid-a` writes to `/parents/uid-a/learners/bad$id!with*symbols` or `/familyInvites/abc`.
9. **Oversized String Exhaustion**: `uid-a` creates learner with 500-character `nickname` or `ageYears: 99`.
10. **Invite Enumeration / Scraping**: Parent `uid-p` attempts `list /familyInvites` to steal student codes.
11. **Forged Observer Link (Bypassing Invite)**: Parent `uid-p` attempts `create /observerLinks/uid-p_uid-s` without claiming an active, non-expired `/familyInvites/{code}` in the same atomic batch.
12. **Self-Link or Parent Metric Tampering**: Student attempts to claim their own invite (`studentUid == parentUid`), or Parent attempts to update `completedLessonsCount` on `/observerLinks/{linkId}`.
