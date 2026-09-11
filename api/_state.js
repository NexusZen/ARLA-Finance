import { Redis } from '@upstash/redis';
import { quizQuestions } from '../src/quiz.js';

const REDIS_KEY = 'arla:quiz_state';

// In-Memory Fallback State (used when Redis credentials are not configured)
let memoryState = {
  status: 'waiting', // 'waiting' | 'active' | 'ended'
  currentIndex: 0,
  totalQuestions: quizQuestions.length,
  updatedAt: Date.now()
};

let redisClient = null;

function getRedis() {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (url && token) {
    try {
      redisClient = new Redis({ url, token });
      return redisClient;
    } catch (err) {
      console.warn('[Redis] Failed to initialize Redis client, using in-memory fallback:', err);
    }
  }
  return null;
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
    updatedAt: rawState?.updatedAt || Date.now()
  };
}

/**
 * Retrieves the current quiz state from Redis or in-memory fallback
 */
export async function getQuizState() {
  const redis = getRedis();
  if (redis) {
    try {
      const data = await redis.get(REDIS_KEY);
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        return formatPublicState(parsed);
      }
    } catch (err) {
      console.warn('[Redis] Error fetching state from Redis, using memory fallback:', err);
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

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(REDIS_KEY, JSON.stringify(updatedRaw));
    } catch (err) {
      console.warn('[Redis] Failed to write state to Redis:', err);
    }
  }

  // Always update memory fallback as well
  memoryState = updatedRaw;

  return formatPublicState(updatedRaw);
}
