import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_URLS = [
  'https://hook.eu2.make.com/8txtgm1ou36nd0t1w3jrx891kpqy90mv',
  'https://hook.eu2.make.com/gew2qe8azxbg884131aa8ynd8gcycrmj',
  'https://hook.eu2.make.com/av4hh2h3xnnnr18j5twe6eqwbslhu913',
];

const vercelHandler = async (req: VercelRequest, res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).send('OK');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, payload } = req.body as { url: string; payload: unknown };

  if (!url || !ALLOWED_URLS.includes(url)) {
    return res.status(400).json({ error: 'Invalid or disallowed webhook URL' });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    return res.status(response.status).send(text);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: `Webhook proxy failed: ${message}` });
  }
};

export default vercelHandler;
