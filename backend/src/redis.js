// backend/src/redis.js
import Redis from "ioredis";

let redis = null;
if (process.env.UPSTASH_REDIS_URL) {
  redis = new Redis(process.env.UPSTASH_REDIS_URL, { tls: {} });
  redis.on("error", (e) => console.error("[redis] error", e.message));
  console.log("✅ Redis connected");
} else {
  console.log("⚠️  UPSTASH_REDIS_URL not set — using in-memory fallback");
}

const mem = new Map(); // fallback

export const cache = {
  async get(key) { return redis ? redis.get(key) : mem.get(key) ?? null; },
  async set(key, val) { return redis ? redis.set(key, val) : void mem.set(key, val); }
};
