# miracles-backend

APNs push + Anthropic proxy backend for the Miracles iOS app. Mirrors the structure of sunzzari-backend; intentionally a separate Vercel project so the two apps remain fully isolated.

## Endpoints

- `POST /api/push` -- accepts `{title, body, deviceToken}`, sends APNs notification. Auth via `x-miracles-secret` (preferred) or `x-sunzzari-secret` (legacy; will be removed once the iOS app finishes the phase-5 header rename).
- `POST /api/analyze` -- proxies a request body to `https://api.anthropic.com/v1/messages`. Same auth header.

## Env vars (set in Vercel project settings)

| Var | Purpose |
|---|---|
| `APNS_KEY_BASE64` | base64-encoded `.p8` push key |
| `APNS_KEY_ID` | the key ID from App Store Connect |
| `APNS_TEAM_ID` | Apple Developer Team ID |
| `APNS_BUNDLE_ID` | `com.elisafazzari.miracles` |
| `APNS_PRODUCTION` | `true` for prod, `false` (or unset) for sandbox / TestFlight |
| `PUSH_SECRET` | shared secret with iOS app -- same value as `Constants.Status.pushSecret` |
| `ANTHROPIC_API_KEY` | Anthropic API key for /api/analyze |

## Deploy

1. `cd ~/Dropbox/claude_work/miracles-backend`
2. `npm install` (first time only)
3. Create GitHub repo `elisafazz/miracles-backend` (public, like sunzzari-backend).
4. `git init && git remote add origin git@github.com:elisafazz/miracles-backend.git && git push -u origin main`
5. In Vercel: New Project -> import from GitHub -> select `miracles-backend`.
6. Add the env vars listed above.
7. Deploy. Production URL should be `https://miracles-backend.vercel.app/` (matches the URL hard-coded in the iOS app's `Constants.Status.pushEndpoint`).

## Notes

- This is a Node.js Vercel serverless project (Node 20+). No build step.
- APNs requires a separate push key per bundle ID. Create the key in App Store Connect for `com.elisafazzari.miracles` and base64-encode the `.p8` for `APNS_KEY_BASE64`.
- The legacy `x-sunzzari-secret` header acceptance can be removed once the iOS app's `AnthropicService.swift` line 234 and `StatusService.swift` line 124 are updated to send `X-Miracles-Secret` (tracked as `miracles-phase-5`).
