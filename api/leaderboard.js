// Vercel function for /api/leaderboard, backed by the Upstash Redis database linked to the project.
import { createBoard, handle, upstash } from './_leaderboard.js';

const { KV_REST_API_URL, KV_REST_API_TOKEN, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
const url = KV_REST_API_URL || UPSTASH_REDIS_REST_URL;
const token = KV_REST_API_TOKEN || UPSTASH_REDIS_REST_TOKEN;
const board = url && token ? createBoard(upstash(url, token)) : null;

export const GET = request => handle(request, board);
export const POST = request => handle(request, board);
