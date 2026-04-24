export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, systemPrompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ reply: 'Falta la API key' });

    const geminiMsgs = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiMsgs,
      generationConfig: { temperature: 0.9, maxOutputTokens: 600 }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();
    if (data.error) {
      console.error('Gemini error:', JSON.stringify(data.error));
      return res.status(500).json({ reply: '¡Tati! No te escuché bien 💕' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '¡Tatita! ¿Me repetís eso? 😊';
    res.status(200).json({ reply: text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: '¡Tata! Intentá de nuevo en un ratito 💕' });
  }
}
