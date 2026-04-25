import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

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

    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      'es-AR-ElenaNeural',
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );

    const chunks = [];

    await new Promise((resolve, reject) => {
      tts.toStream(clean, {
        rate: '+8%',
        pitch: '+15Hz',
      }).then(stream => {
        stream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on('end', resolve);
        stream.on('error', reject);
      }).catch(reject);
    });

    if (chunks.length === 0) throw new Error('No se generó audio');

    const buffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.status(200).send(buffer);

  } catch (err) {
    console.error('Speak error:', err);
    res.status(500).json({ error: err.message || 'Error desconocido' });
  }
}
