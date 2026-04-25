export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Metodo no permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GROQ_API_KEY no configurada');
    return res.status(500).json({ reply: 'Sin key configurada' });
  }

  try {
    const { messages, systemPrompt } = req.body;

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        max_tokens: 600,
        temperature: 0.9
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error('Groq error:', JSON.stringify(data.error));
      return res.status(500).json({ reply: data.error.message });
    }

    const text = data.choices?.[0]?.message?.content || 'Tatita, repetis eso?';
    res.status(200).json({ reply: text });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ reply: 'Tata, intenta de nuevo' });
  }
}
