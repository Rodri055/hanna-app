export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { text } = req.body;
    const clean = (text || '')
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u2600-\u27BF]/g, '')
      .replace(/[*_~`#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return res.status(400).json({ error: 'Texto vacío' });

    // Obtener token de Microsoft Edge TTS (gratis, sin key)
    const tokenRes = await fetch('https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0', {
      headers: {
        'Referer': 'https://www.bing.com/translator',
        'User-Agent': 'Mozilla/5.0',
      }
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.token;
    const region = tokenData.region || 'eastus';

    // Llamar a Azure TTS con el token
    const ssml = `<speak version='1.0' xml:lang='es-AR'>
      <voice xml:lang='es-AR' xml:gender='Female' name='es-AR-ElenaNeural'>
        <prosody rate='+10%' pitch='+5%'>${clean}</prosody>
      </voice>
    </speak>`;

    const ttsRes = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'Mozilla/5.0'
      },
      body: ssml
    });

    if (!ttsRes.ok) throw new Error(`TTS error: ${ttsRes.status}`);

    const buffer = Buffer.from(await ttsRes.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.status(200).send(buffer);

  } catch (err) {
    console.error('Speak error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
