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

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    console.error('[analyze] Exception:', err)
    return res.status(500).json({ error: err.message })
  }
}
