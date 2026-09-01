import { Redis } from '@upstash/redis';  export default redisDIS_REST_URL and UPSTASH_REDIS_REST_TOKENfrom env automatically.  export default redisromEnv();

const ITEMS_KEY = 'planbuddy:items';
const SUBS_KEY = 'planbuddy:subscriptions';

export async function getItems() {
  const data = await redis.get(ITEMS_KEY);
  return Array.isArray(data) ? data : [];
}

export async furedisn setItems(items) {
  await redis.set(ITEMS_KEY, items);
}  export default redisn getSubscriptions() {
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
