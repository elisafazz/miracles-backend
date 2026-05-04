const apn = require('@parse/node-apn')

// Validate required env vars at cold start
const requiredEnv = ['APNS_KEY', 'APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_BUNDLE_ID', 'PUSH_SECRET']
for (const key of requiredEnv) {
  if (!process.env[key]) console.warn(`[push] Missing env var: ${key}`)
}

let provider = null

function getProvider() {
  if (provider) return provider
  // APNS_KEY_BASE64 stores the .p8 file base64-encoded (avoids Vercel newline issues)
  const rawKey = Buffer.from(process.env.APNS_KEY_BASE64 || '', 'base64').toString('utf8')
  provider = new apn.Provider({
    token: {
      // node-apn 7.x accepts the PEM string directly; no need to re-wrap in Buffer.
      key: rawKey,
      keyId: process.env.APNS_KEY_ID,
      teamId: process.env.APNS_TEAM_ID,
    },
    // Default to production: TestFlight and App Store builds both use production
    // APNs tokens. Set APNS_PRODUCTION=false explicitly only for local/sandbox testing.
    production: process.env.APNS_PRODUCTION !== 'false',
  })
  return provider
}

module.exports = async function handler(req, res) {
  // Only POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check. Accept both x-miracles-secret (preferred) and x-sunzzari-secret
  // (legacy header still emitted by the iOS app pending the miracles-phase-5
  // header rename in AnthropicService.swift / StatusService.swift).
  const secret = req.headers['x-miracles-secret'] || req.headers['x-sunzzari-secret']
  if (!secret || secret !== process.env.PUSH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { title, body, deviceToken } = req.body ?? {}

  if (!title || !body || !deviceToken) {
    return res.status(400).json({ error: 'Missing title, body, or deviceToken' })
  }

  const note = new apn.Notification()
  note.expiry = Math.floor(Date.now() / 1000) + 3600 // expire in 1 hour
  // Intentional: badge=0 means this push doesn't change the displayed badge.
  // The iOS app reconciles its own badge from `delivered.count` on app activation
  // (see ContentView.swift's onChange(of: scenePhase)). The server has no
  // per-recipient unread state to compute a meaningful badge total.
  note.badge = 0
  note.sound = 'default'
  note.alert = { title, body }
  note.topic = process.env.APNS_BUNDLE_ID

  try {
    const p = getProvider()
    const result = await p.send(note, deviceToken)

    if (result.failed.length > 0) {
      const err = result.failed[0].error ?? result.failed[0].response
      // Defensive: APNs error objects can carry circular refs that break JSON.stringify.
      let errLog
      try { errLog = JSON.stringify(err) } catch { errLog = String(err) }
      console.error('[push] APNs failure:', errLog)
      return res.status(502).json({ error: 'APNs delivery failed', detail: errLog })
    }

    return res.status(200).json({ ok: true, sent: result.sent.length })
  } catch (err) {
    console.error('[push] Exception:', err)
    return res.status(500).json({ error: err.message })
  }
}
