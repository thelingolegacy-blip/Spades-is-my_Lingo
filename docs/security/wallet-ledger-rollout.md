# Spades Wallet Ledger Security Boundary

## Current security disposition

Client writes to wallet balances, sweepstakes ticket counts, XP, levels, streaks, active entries, and purchased deck entitlements are denied by Firestore rules. The browser keeps the current practice/progression display in local storage only. This is a containment measure, not a completed cross-device wallet implementation.

## Required authoritative service

Before cloud progression sync is re-enabled, deploy a trusted server endpoint behind the LINGO wallet engine. The endpoint must:

1. Verify the Firebase ID token (issuer, audience, signature, expiry, subject) and require App Check for supported clients.
2. Accept an allow-listed action intent, not arbitrary balance deltas or a client-supplied resulting balance.
3. Derive reward amounts and progression transitions from server-owned game rules and validated game/session evidence.
4. Require an idempotency key scoped to the authenticated UID and action.
5. Atomically append an immutable ledger entry and update the materialized profile balance/progression using a Firestore transaction.
6. Reject negative balances, duplicate/replayed intents, concurrent overspending, invalid game state, out-of-range amounts, and all currency conversion/redemption paths.
7. Emit an auditable transaction ID and stable error codes without exposing service credentials.

## Minimum transaction contract

POST /api/wallet/v1/transactions

Request fields:
- action: server-allow-listed action name (for example daily_login_claim, game_result, cosmetic_unlock, or sweepstakes_entry)
- idempotencyKey: client-generated unique key for one intent
- evidence: action-specific game/session evidence; never a caller-authoritative balance or delta

Response fields:
- transactionId
- balance
- progression
- replayed (boolean)

The service must reject unknown actions and must not trust client-provided reward values. daily_login_claim must use server time and a server-owned claim record; game_result must validate the authoritative game result; cosmetic_unlock must validate catalog price and entitlement; sweepstakes entry must remain separately gated by legal and eligibility review.

## Deployment gates

- Configure a dedicated service identity with least-privilege access to the exact Firestore database.
- Store credentials only as Cloudflare secrets or the approved server secret manager; never commit secret material.
- Add emulator tests for transaction atomicity, idempotent replay, concurrent spending, insufficient balance, forged reward amounts, cross-user access, and disabled redemption.
- Keep client progression sync disabled until the endpoint is deployed, tested, and explicitly enabled.
- No production Worker route, Firebase rules deployment, payment activation, or release promotion is authorized by this pull request.
