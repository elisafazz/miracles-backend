// Hard caps to prevent a leaked PUSH_SECRET from being used to drain the
// Anthropic API key. iOS clients can only call models on the allowlist with
// max_tokens up to MAX_TOKENS_CAP -- they cannot inject a different model or
// raise the cap. (Sparring review 2026-05-04: Gemini CRITICAL #2.)
//
// TODO(miracles-phase-5): split PUSH_SECRET into ANALYZE_SECRET so a compromise
// of the push path doesn't expose Anthropic credentials.
const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
])
const MAX_TOKENS_CAP = 1024

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Accept both x-miracles-secret (preferred) and x-sunzzari-secret (legacy
  // header still emitted by the iOS app pending the miracles-phase-5 rename).
  const secret = req.headers['x-miracles-secret'] || req.headers['x-sunzzari-secret']
  if (!secret || secret !== process.env.PUSH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  const body = req.body ?? {}
  if (!ALLOWED_MODELS.has(body.model)) {
    return res.status(400).json({ error: `Model not allowed: ${body.model}` })
  }
  const requestedMaxTokens = Number(body.max_tokens) || MAX_TOKENS_CAP
  const cappedBody = {
    ...body,
    max_tokens: Math.min(requestedMaxTokens, MAX_TOKENS_CAP),
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(cappedBody),
    })

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    console.error('[analyze] Exception:', err)
    return res.status(500).json({ error: err.message })
  }
}
