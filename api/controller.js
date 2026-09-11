import { getQuizState, executeQuizAction } from './_state.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const state = await getQuizState();
      return res.status(200).json({ success: true, state });
    } catch (err) {
      console.error('[API Controller GET] Error:', err);
      return res.status(500).json({ error: 'Failed to retrieve state', details: String(err) });
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          try {
            body = JSON.parse(body.replace(/\\"/g, '"'));
          } catch {
            const actionMatch = body.match(/action[\\"'`\s:=]+([a-zA-Z0-9_-]+)/i);
            const indexMatch = body.match(/index[\\"'`\s:=]+([0-9]+)/i);
            body = {
              action: actionMatch ? actionMatch[1] : undefined,
              index: indexMatch ? parseInt(indexMatch[1], 10) : undefined
            };
          }
        }
      }

      const { action, index } = body || {};
      if (!action) {
        return res.status(400).json({ error: 'Missing action parameter' });
      }

      const updatedState = await executeQuizAction(action, index);
      return res.status(200).json({ success: true, state: updatedState });
    } catch (err) {
      console.error('[API Controller POST] Error:', err);
      return res.status(500).json({ error: 'Failed to execute action', details: String(err) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
