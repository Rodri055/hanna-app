export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Metodo no permitido' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GEMINI_API_KEY no configurada');
    return res.status(500).json({ reply: 'Sin key configurada' });
  }

  try {
    const { messages, systemPrompt } = req.body;
    const geminiMsgs = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiMsgs,
          generationConfig: { temperature: 0.9, maxOutputTokens: 600 }
        })
      }
    );

    const data = await response.json();
    if (data.error) {
      console.error('Gemini error:', JSON.stringify(data.error));
      return res.status(500).json({ reply: data.error.message });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Tatita, repetis eso?';
    res.status(200).json({ reply: text });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ reply: 'Tata, intenta de nuevo' });
  }
}
