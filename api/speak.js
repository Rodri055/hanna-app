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
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[*_~`#>\[\]]/g, '')
      .replace(/\bHanna\b/gi, 'Jana')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return res.status(400).json({ error: 'Texto vacio' });

    // Edge TTS — mismo servicio que usa Microsoft Edge, gratis
    // Obtenemos el token de acceso primero
    const tokenRes = await fetch('https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0', {
      headers: {
        'Referer': 'https://www.bing.com/translator',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const tokenData = await tokenRes.json();
    const jwt = tokenData.token;
    const region = tokenData.region || 'eastus';

    // Generar audio con Azure Neural TTS
    const ssml = `<speak version='1.0' xml:lang='es-AR'>
      <voice name='es-AR-ElenaNeural'>
        <prosody rate='+8%' pitch='+15Hz'>${clean.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</prosody>
      </voice>
    </speak>`;

    const ttsRes = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'Mozilla/5.0'
      },
      body: ssml
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      throw new Error(`TTS ${ttsRes.status}: ${err}`);
    }

    const buffer = Buffer.from(await ttsRes.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.status(200).send(buffer);

  } catch (err) {
    console.error('Speak error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
