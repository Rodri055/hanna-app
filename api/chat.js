export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = req.url || '';

  // ── /api/chat ──
  if (path.includes('chat')) {
    if (req.method !== 'POST') return res.status(405).json({ reply: 'Metodo no permitido' });
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ reply: 'Sin key de chat' });

    try {
      const { messages, systemPrompt } = req.body;
      const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ];
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: groqMessages, max_tokens: 400, temperature: 0.9 })
      });
      const data = await response.json();
      if (data.error) return res.status(500).json({ reply: data.error.message });
      const text = data.choices?.[0]?.message?.content || 'Tatita, repetís eso?';
      res.status(200).json({ reply: text });
    } catch (err) {
      res.status(500).json({ reply: 'Tata, intentá de nuevo' });
    }
    return;
  }

  // ── /api/speak ──
  if (path.includes('speak')) {
    if (req.method !== 'POST') return res.status(405).end();
    const elKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!elKey || !voiceId) return res.status(500).json({ error: 'Sin key de voz' });

    try {
      const { text } = req.body;
      // Limpiar emojis y caracteres especiales
      const clean = text.replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
                        .replace(/[\u2600-\u27BF]/g, '')
                        .replace(/[*_~`#]/g, '')
                        .trim();

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elKey
        },
        body: JSON.stringify({
          text: clean,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true }
        })
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('ElevenLabs error:', err);
        return res.status(500).json({ error: err });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length);
      res.status(200).send(buffer);
    } catch (err) {
      console.error('Speak error:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(404).json({ error: 'Not found' });
}
