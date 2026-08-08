# AudioFrontend / coreEngine Auth Fix Plan

## Current findings

- `audioFrontend` stores `system_token`, `system_refresh_token`, and `system_user` in `localStorage` after OTP verification.
- `playerStore` hydration logic in `audioFrontend/src/store/player/index.ts` invalidates stored user data unless the `id` contains a dot (`.`).
  - This is almost certainly wrong for user IDs generated in `coreEngine` (UUID strings) and is causing authentication to disappear after refresh.
- `audioFrontend/src/lib/api.ts` has no refresh-token retry flow for expired access tokens.
- `coreEngine` already exposes `/auth/refresh-token` and implements refresh token creation and validation.

## Root causes

1. Frontend storage hydration bug: invalid `system_user` validation logic clears both user and token on page load.
2. Missing frontend refresh token flow: expired `accessToken` leads to broken authenticated API calls.

## Fix plan

1. Correct `playerStore` hydration logic in `audioFrontend/src/store/player/index.ts`:
   - Remove the incorrect `id` `.` validation.
   - Keep `system_user`, `system_token`, and `system_refresh_token` if present and valid JSON.
2. Add refresh flow in `audioFrontend/src/lib/api.ts`:
   - Detect `401` responses.
   - Attempt `POST /auth/refresh-token` with stored `system_refresh_token`.
   - On success, save new access and refresh tokens.
   - Retry the original request once.
   - On refresh failure, clear session.
3. Ensure `setSystemSession` stores both tokens and user data.
4. Optionally add convenience helpers for refreshing the frontend session and centralizing token reads/writes.

## Files to update

- `audioFrontend/src/store/player/index.ts`
- `audioFrontend/src/lib/api.ts`
- `audioFrontend/AUTH_FIX_PLAN.md`

## Next steps

- Apply the hydration fix and refresh-token retry flow.
- Test login, refresh, page reload, and protected API access.
- Verify that `system_user` persists across browser reloads.
