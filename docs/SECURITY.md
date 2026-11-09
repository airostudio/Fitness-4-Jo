# Security & privacy notes

## Verified by automated tests
- RLS enabled on every public table; for each personal table another user reads/updates/deletes nothing and cannot insert rows owned by someone else; `anon` is denied; sets cannot reference another user's session (composite FK).
- Supporters have no table access; `supporter_view` returns only permitted sections, excludes health data and unshared journal entries, and revocation blocks the very next request (including accept, view and encouragement).
- Admins can edit reference data but read zero rows of personal tables.
- Account deletion leaves no row referencing the user in any table.
- API: unauthenticated → 401/redirect; malformed/oversized input rejected before database access; client-supplied user ids are rejected (strict schemas); ownership always comes from the verified session.
- Idempotent sync (duplicate ops no-op), last-writer-wins conflicts reported, never claims "synced" without server acknowledgement.

## Not covered / known limitations
- Tests run the real migrations in PGlite with Supabase-compatible stubs for `auth.*`, roles and storage — they have **not** been run against a live Supabase project. Run the release checklist's second-user test after first deploy.
- Auth flows (sign-in, magic link, recovery) are implemented with Supabase Auth but could not be exercised end-to-end without a live project; the gating logic is unit-tested.
- No strict CSP (Next inline scripts would need nonces); security headers (nosniff, frame deny, referrer, permissions) are set. No rate limiting on `/api/sync` beyond auth and size limits — add Vercel Firewall rules if exposed widely.
- Remote deletions propagate to other devices on next pull only for records without pending local changes.
- Offline: workout and previously-visited pages work offline; pages never visited show an offline notice. Sign-out wipes the account's IndexedDB data and SW runtime cache.
- No demonstration videos are bundled (none are licensed); the UI says so. Admins can add approved, licensed media.
- Privacy policy and terms are drafts for legal review.
