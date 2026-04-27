const SUPABASE_URL = 'https://tddrewgssppdhxgkgzxf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3oCWOyWJZM75SA5Ujre-eg_XcorlLx-';

async function getUltimaMemoria() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/conversaciones?order=fecha.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await res.json();
    return data?.[0] || null;
  } catch { return null; }
}

async function guardarMemoria(resumen, emociones, temas) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/conversaciones`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ resumen, emociones, temas })
    });
  } catch (e) { console.error('Error guardando memoria:', e); }
}

async function getMensajesFamilia() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/memorias_familia?order=fecha.desc&limit=10`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    return await res.json();
  } catch { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Metodo no permitido' });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).json({ reply: 'Sin key de chat' });

  try {
    const { messages, systemPrompt } = req.body;

    // Traer memoria de última conversación
    const ultimaMem = await getUltimaMemoria();
    const memsFamilia = await getMensajesFamilia();

    let contextoMemoria = '';
    if (ultimaMem) {
      const fecha = new Date(ultimaMem.fecha).toLocaleDateString('es-AR');
      contextoMemoria += `\n\nÚLTIMA CONVERSACIÓN (${fecha}): ${ultimaMem.resumen}`;
      if (ultimaMem.emociones) contextoMemoria += `\nEstado emocional: ${ultimaMem.emociones}`;
      if (ultimaMem.temas) contextoMemoria += `\nTemas hablados: ${ultimaMem.temas}`;
    }

    if (memsFamilia.length > 0) {
      contextoMemoria += '\n\nMENSAJES RECIENTES DE LA FAMILIA:\n';
      contextoMemoria += memsFamilia.map(m => `- ${m.quien}: "${m.texto}"`).join('\n');
    }

    const systemFinal = systemPrompt + contextoMemoria;

    const groqMessages = [
      { role: 'system', content: systemFinal },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        max_tokens: 400,
        temperature: 0.9
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ reply: data.error.message });
    const text = data.choices?.[0]?.message?.content || 'Tatita, repetís eso?';

    // Cada 5 mensajes guardar resumen de la conversación
    if (messages.length % 5 === 0 && messages.length > 0) {
      const resumenMessages = [
        { role: 'system', content: 'Resumí en 2 oraciones esta conversación. Indicá el estado emocional de la Tata y los temas principales. Respondé en formato JSON: {"resumen":"...","emociones":"...","temas":"..."}' },
        ...messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      ];
      const resumenRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: resumenMessages, max_tokens: 200, temperature: 0.3 })
      });
      const resumenData = await resumenRes.json();
      const resumenText = resumenData.choices?.[0]?.message?.content || '';
      try {
        const parsed = JSON.parse(resumenText.replace(/```json|```/g, '').trim());
        await guardarMemoria(parsed.resumen, parsed.emociones, parsed.temas);
      } catch { await guardarMemoria(resumenText, '', ''); }
    }

    res.status(200).json({ reply: text });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ reply: 'Tata, intentá de nuevo' });
  }
}
