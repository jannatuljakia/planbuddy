import { Redis } from '@upstash/redis';

// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env automatically.
const redis = Redis.fromEnv();

const ITEMS_KEY = 'planbuddy:items';
const SUBS_KEY = 'planbuddy:subscriptions';

export async function getItems() {
  const data = await redis.get(ITEMS_KEY);
  return Array.isArray(data) ? data : [];
}

export async function setItems(items) {
  await redis.set(ITEMS_KEY, items);
}

export async function getSubscriptions() {
  const data = await redis.get(SUBS_KEY);
  return Array.isArray(data) ? data : [];
}

export async function addSubscription(sub) {
  const subs = await getSubscriptions();
  const exists = subs.some((s) => s.endpoint === sub.endpoint);
  if (!exists) {
    subs.push(sub);
    await redis.set(SUBS_KEY, subs);
  }
}

export async function removeSubscription(endpoint) {
  const subs = await getSubscriptions();
  const filtered = subs.filter((s) => s.endpoint !== endpoint);
  await redis.set(SUBS_KEY, filtered);
}

export default redis;
