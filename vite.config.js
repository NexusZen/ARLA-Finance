import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { quizQuestions } from './src/quiz.js';

import { getQuizState, executeQuizAction } from './api/_state.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const sseClients = new Set();

async function broadcastState() {
  try {
    const state = await getQuizState();
    const payload = JSON.stringify(state);
    for (const client of sseClients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  } catch (err) {
    console.error('Error broadcasting state:', err);
  }
}

function quizServerPlugin() {
  return {
    name: 'quiz-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        // Route: GET /controller -> serve controller.html
        if (req.method === 'GET' && pathname === '/controller') {
          req.url = '/controller.html';
          return next();
        }

        // Route: GET /quiz -> serve quiz.html for browser navigation, or JSON for api requests
        if (req.method === 'GET' && pathname === '/quiz') {
          const accept = req.headers['accept'] || '';
          if (accept.includes('text/html') || (!accept.includes('application/json') && !url.searchParams.has('json'))) {
            req.url = '/quiz.html';
            return next();
          }
          const state = await getQuizState();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(state));
          return;
        }

        // GET /api/quiz or GET /api/controller
        if (req.method === 'GET' && (pathname === '/api/quiz' || pathname === '/api/controller')) {
          const state = await getQuizState();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(state));
          return;
        }

        // GET /api/quiz/stream (Server-Sent Events)
        if (req.method === 'GET' && pathname === '/api/quiz/stream') {
          const state = await getQuizState();
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });
          res.write(`data: ${JSON.stringify(state)}\n\n`);
          sseClients.add(res);
          req.on('close', () => {
            sseClients.delete(res);
          });
          return;
        }

        // POST /controller or POST /api/controller
        if (req.method === 'POST' && (pathname === '/controller' || pathname === '/api/controller')) {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              let data = {};
              if (body) {
                try {
                  data = JSON.parse(body);
                } catch {
                  try {
                    data = JSON.parse(body.replace(/\\"/g, '"'));
                  } catch {
                    const actionMatch = body.match(/action[\\"'`\s:=]+([a-zA-Z0-9_-]+)/i);
                    if (actionMatch) {
                      data.action = actionMatch[1];
                    }
                    const indexMatch = body.match(/index[\\"'`\s:=]+([0-9]+)/i);
                    if (indexMatch) {
                      data.index = parseInt(indexMatch[1], 10);
                    }
                  }
                }
              }
              const action = data?.action;
              const index = data?.index;

              const updatedState = await executeQuizAction(action, index);
              broadcastState();

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, state: updatedState }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Failed to process request', details: String(err) }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [quizServerPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        quiz: resolve(__dirname, 'quiz.html'),
        controller: resolve(__dirname, 'controller.html')
      }
    }
  },
  server: {
    port: 5173,
    host: true
  },
  assetsInclude: ['**/*.glb']
});
