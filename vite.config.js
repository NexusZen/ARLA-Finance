import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { quizQuestions } from './src/quiz.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// In-Memory Global Quiz State
const quizState = {
  status: 'waiting', // 'waiting' | 'active' | 'ended'
  currentIndex: 0,
  totalQuestions: quizQuestions.length
};

const sseClients = new Set();

function getPublicState() {
  return {
    status: quizState.status,
    currentIndex: quizState.currentIndex,
    totalQuestions: quizState.totalQuestions,
    currentQuestion: quizState.status === 'active' ? quizQuestions[quizState.currentIndex] : null,
    allQuestions: quizQuestions
  };
}

function broadcastState() {
  const payload = JSON.stringify(getPublicState());
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function quizServerPlugin() {
  return {
    name: 'quiz-server-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
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
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(getPublicState()));
          return;
        }

        // GET /api/quiz or GET /api/controller
        if (req.method === 'GET' && (pathname === '/api/quiz' || pathname === '/api/controller')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(getPublicState()));
          return;
        }

        // GET /api/quiz/stream (Server-Sent Events)
        if (req.method === 'GET' && pathname === '/api/quiz/stream') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });
          res.write(`data: ${JSON.stringify(getPublicState())}\n\n`);
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
          req.on('end', () => {
            try {
              let data = {};
              if (body) {
                try {
                  data = JSON.parse(body);
                } catch {
                  // Fallback: handle unquoted keys or query-string style
                  const actionMatch = body.match(/action["':=\s]+([a-zA-Z0-9_-]+)/);
                  if (actionMatch) {
                    data.action = actionMatch[1];
                  }
                  const indexMatch = body.match(/index["':=\s]+([0-9]+)/);
                  if (indexMatch) {
                    data.index = parseInt(indexMatch[1], 10);
                  }
                }
              }
              const action = data.action;
              console.log('[Controller API] Received action:', action, 'raw body:', body);

              if (action === 'start') {
                quizState.status = 'active';
                quizState.currentIndex = 0;
              } else if (action === 'next') {
                if (quizState.status === 'active') {
                  if (quizState.currentIndex < quizState.totalQuestions - 1) {
                    quizState.currentIndex++;
                  } else {
                    quizState.status = 'ended';
                  }
                }
              } else if (action === 'prev') {
                if (quizState.status === 'active' && quizState.currentIndex > 0) {
                  quizState.currentIndex--;
                }
              } else if (action === 'goto') {
                const target = parseInt(data.index, 10);
                if (!isNaN(target) && target >= 0 && target < quizState.totalQuestions) {
                  quizState.status = 'active';
                  quizState.currentIndex = target;
                }
              } else if (action === 'reset') {
                quizState.status = 'waiting';
                quizState.currentIndex = 0;
              }

              broadcastState();

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, state: getPublicState() }));
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
