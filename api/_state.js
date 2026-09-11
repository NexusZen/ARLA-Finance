import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';
import { quizQuestions } from '../src/quiz.js';

const REDIS_KEY = 'arla:quiz_state';

// In-Memory Fallback State (used when Redis credentials are not configured)
let memoryState = {
  status: 'waiting', // 'waiting' | 'active' | 'ended'
  currentIndex: 0,
  totalQuestions: quizQuestions.length,
  updatedAt: Date.now()
};

let unifiedClient = null;
let clientType = 'memory';

function getUnifiedRedis() {
  if (unifiedClient) return { client: unifiedClient, type: clientType };

  // 1. Standard Redis TCP URL (Provided by Official Redis Cloud on Vercel)
  const tcpUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL || (process.env.KV_URL && process.env.KV_URL.startsWith('redis') ? process.env.KV_URL : null);
  if (tcpUrl) {
    try {
      const io = new IORedis(tcpUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        lazyConnect: false,
        enableReadyCheck: false
      });
      io.on('error', (err) => console.warn('[IORedis] Warning:', err?.message || err));
      unifiedClient = io;
      clientType = 'redis-cloud';
      console.log('[State] Connected to Redis via TCP URL');
      return { client: unifiedClient, type: clientType };
    } catch (err) {
      console.warn('[IORedis] Failed to initialize from TCP URL:', err);
    }
  }

  // 2. Discrete Redis Cloud parameters (host, port, password)
  if (process.env.REDIS_HOST && process.env.REDIS_PASSWORD) {
    try {
      const io = new IORedis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        username: process.env.REDIS_USER || 'default',
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        enableReadyCheck: false
      });
      io.on('error', (err) => console.warn('[IORedis] Warning:', err?.message || err));
      unifiedClient = io;
      clientType = 'redis-cloud';
      console.log('[State] Connected to Redis via Host/Port/Password');
      return { client: unifiedClient, type: clientType };
    } catch (err) {
      console.warn('[IORedis] Failed to initialize from discrete params:', err);
    }
  }

  // 3. Upstash REST API (Upstash Redis or Vercel KV REST)
  const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (restUrl && restToken && restUrl.startsWith('http')) {
    try {
      unifiedClient = new UpstashRedis({ url: restUrl, token: restToken });
      clientType = 'upstash-rest';
      console.log('[State] Connected to Upstash Redis via REST');
      return { client: unifiedClient, type: clientType };
    } catch (err) {
      console.warn('[Upstash] Failed to initialize Upstash REST client:', err);
    }
  }

  clientType = 'memory';
  return { client: null, type: clientType };
}

/**
 * Normalizes and formats the public quiz state
 */
export function formatPublicState(rawState) {
  const status = rawState?.status || 'waiting';
  const totalQuestions = quizQuestions.length;
  let currentIndex = typeof rawState?.currentIndex === 'number' ? rawState.currentIndex : 0;
  if (currentIndex < 0) currentIndex = 0;
  if (currentIndex >= totalQuestions) currentIndex = totalQuestions - 1;

  return {
    status,
    currentIndex,
    totalQuestions,
    currentQuestion: status === 'active' ? quizQuestions[currentIndex] : null,
    allQuestions: quizQuestions,
    updatedAt: rawState?.updatedAt || Date.now(),
    storage: clientType
  };
}

/**
 * Retrieves the current quiz state from Redis or in-memory fallback
 */
export async function getQuizState() {
  const { client } = getUnifiedRedis();
  if (client) {
    try {
      const data = await client.get(REDIS_KEY);
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        return formatPublicState(parsed);
      }
    } catch (err) {
      console.warn('[Redis] Error fetching state from Redis:', err?.message || err);
    }
  }
  return formatPublicState(memoryState);
}

/**
 * Centrally updates quiz state based on controller action
 */
export async function executeQuizAction(action, index) {
  const currentState = await getQuizState();
  const total = quizQuestions.length;

  let newStatus = currentState.status;
  let newIndex = currentState.currentIndex;

  switch (action) {
    case 'start':
      newStatus = 'active';
      newIndex = 0;
      break;

    case 'next':
      if (newStatus === 'waiting') {
        newStatus = 'active';
        newIndex = 0;
      } else if (newStatus === 'active') {
        if (newIndex < total - 1) {
          newIndex++;
        } else {
          newStatus = 'ended';
        }
      }
      break;

    case 'prev':
      if (newStatus === 'ended') {
        newStatus = 'active';
        newIndex = total - 1;
      } else if (newStatus === 'active') {
        if (newIndex > 0) {
          newIndex--;
        }
      }
      break;

    case 'goto': {
      const target = parseInt(index, 10);
      if (!isNaN(target) && target >= 0 && target < total) {
        newStatus = 'active';
        newIndex = target;
      }
      break;
    }

    case 'reset':
      newStatus = 'waiting';
      newIndex = 0;
      break;

    default:
      throw new Error(`Unknown action: ${action}`);
  }

  const updatedRaw = {
    status: newStatus,
    currentIndex: newIndex,
    totalQuestions: total,
    updatedAt: Date.now()
  };

  const { client } = getUnifiedRedis();
  if (client) {
    try {
      const serialized = JSON.stringify(updatedRaw);
      await client.set(REDIS_KEY, serialized);
    } catch (err) {
      console.warn('[Redis] Failed to write state to Redis:', err?.message || err);
    }
  }

  // Always update memory fallback as well
  memoryState = updatedRaw;

  return formatPublicState(updatedRaw);
}
