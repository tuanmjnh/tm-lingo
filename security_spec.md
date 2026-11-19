# TM-Lingo Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. Every learner profile, lesson progress record, and story reading position MUST belong to an existing parent document under `/parents/{parentId}`.
2. Only the authenticated, email-verified parent whose `request.auth.uid == parentId` may read, list, create, update, or delete resources under `/parents/{parentId}`.
3. Cross-parent access is impossible: no blanket reads, no unverified writes, and `allow list` strictly evaluates `resource.data.parentId == request.auth.uid`.
4. All document IDs (`parentId`, `learnerId`, `progressId`, `positionId`) must match `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
5. All string fields enforce explicit `.size()` bounds; arrays (`completedActivityIds`) enforce `.size() <= 20` and first-element type validation when non-empty.
6. Immutable ownership and audit timestamps (`parentId`, `learnerId`, `createdAt`) cannot change after creation; `createdAt` and `updatedAt` must equal `request.time`.
7. Shadow/extra fields (e.g., `role`, `isAdmin`, `isVerified`) are rejected via strict `hasOnly()` and `affectedKeys().hasOnly()`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `get /parents/uid-a/learners/learner-1` with `auth = null`.
2. **Unverified Email Write**: `create /parents/uid-a` with `auth.token.email_verified = false`.
3. **Cross-Parent Get**: `uid-b` attempts `get /parents/uid-a/learners/learner-1`.
4. **Cross-Parent List**: `uid-b` attempts `list /parents/uid-a/progress`.
5. **Identity Spoofing on Create**: `uid-a` creates `/parents/uid-a/learners/l1` with `parentId: "uid-b"`.
6. **Shadow Field Injection**: `uid-a` creates `/parents/uid-a` with extra key `isAdmin: true`.
7. **Orphaned Subcollection Write**: `uid-a` creates `/parents/uid-a/learners/l1` before `/parents/uid-a` exists.
8. **ID Poisoning**: `uid-a` writes to `/parents/uid-a/learners/bad$id!with*symbols`.
9. **Oversized String Exhaustion**: `uid-a` creates learner with 500-character `nickname`.
10. **Immutable Field Mutation**: `uid-a` updates learner changing `createdAt` or `parentId`.
11. **Client Timestamp Forgery**: `uid-a` creates progress with a backdated client timestamp instead of `request.time`.
12. **Array Overflow / Invalid Type**: `uid-a` writes `completedActivityIds` with 25 entries or numeric element `[123]`.
