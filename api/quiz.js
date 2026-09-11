import { getQuizState } from './_state.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const state = await getQuizState();
    return res.status(200).json(state);
  } catch (err) {
    console.error('[API Quiz] Error fetching state:', err);
    return res.status(500).json({ error: 'Failed to retrieve quiz state', details: String(err) });
  }
}
