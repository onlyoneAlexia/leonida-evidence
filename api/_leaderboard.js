// Leaderboard rules, shared by the Vercel function (api/leaderboard.js), the dev server and the tests.
// Files starting with "_" are not deployed as routes of their own.
// Only runs that finish all five jobs are posted. Most cash wins; less clock time breaks ties, then the earlier run.
import { CASES } from '../src/scenes.js';

const KEY = 'ler:board';
const KEEP = 1000;
const TOP = 10;
const NAME_MAX = 18;
const POSTS_PER_WINDOW = 20;
const WINDOW_SECONDS = 600;

export class BoardError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function cleanName(raw) {
  const name = String(raw ?? '').normalize('NFKC').replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim();
  return Array.from(name).slice(0, NAME_MAX).join('').trim() || 'The Cleaner';
}

// Mirrors scoreCase in src/App.jsx: payout, $40 per second left, and a 25% clean bonus at most.
export function validateRun(body) {
  if (!body || typeof body !== 'object') throw new BoardError('Expected a JSON run.');
  const { jobs } = body;
  if (!Array.isArray(jobs) || jobs.length !== CASES.length) throw new BoardError('Only runs that finish all five jobs count.');
  let cash = 0;
  let time = 0;
  jobs.forEach((job, i) => {
    const c = CASES[i];
    if (job?.id !== c.id) throw new BoardError('The jobs are out of order.');
    const { used, cash: earned } = job;
    if (!Number.isInteger(used) || used < 0 || used > c.seconds) throw new BoardError(`That time is impossible for ${c.title}.`);
    const most = c.payout + (c.seconds - used) * 40 + Math.round(c.payout * 0.25);
    if (!Number.isInteger(earned) || earned < 0 || earned > most) throw new BoardError(`That payout is impossible for ${c.title}.`);
    cash += earned;
    time += used;
  });
  return { name: cleanName(body.name), cash, time };
}

// Cash and seconds saved in one sortable number (the whole run's clock is under 1000 s).
const scoreOf = (cash, time) => cash * 1000 + (999 - time);
// Equal scores sort by member, descending, so a member that counts down with time puts earlier runs first.
const memberOf = entry => `${String(9e12 - entry.at).padStart(13, '0')}|${JSON.stringify(entry)}`;
const entryOf = member => JSON.parse(member.slice(member.indexOf('|') + 1));

// `redis` runs a batch of commands and resolves to their results in order (an Upstash pipeline, or memoryRedis).
export function createBoard(redis) {
  const read = async () => {
    const [members, total] = await redis([['ZREVRANGE', KEY, 0, TOP - 1], ['ZCARD', KEY]]);
    return { top: members.map(entryOf), total };
  };
  return {
    top: read,
    async submit(body, ip = 'unknown') {
      const run = validateRun(body);
      const limit = `ler:rate:${ip}`;
      const [, posts] = await redis([['SET', limit, 0, 'EX', WINDOW_SECONDS, 'NX'], ['INCR', limit]]);
      if (posts > POSTS_PER_WINDOW) throw new BoardError('Too many runs posted from here. Try again in a few minutes.', 429);
      const entry = { id: crypto.randomUUID().slice(0, 8), ...run, at: Date.now() };
      const member = memberOf(entry);
      const [, rank] = await redis([['ZADD', KEY, scoreOf(run.cash, run.time), member], ['ZREVRANK', KEY, member], ['ZREMRANGEBYRANK', KEY, 0, -(KEEP + 1)]]);
      return { ...(await read()), entry: { ...entry, rank: rank + 1 } };
    },
  };
}

// Upstash's REST pipeline: one HTTPS request per batch of commands.
export function upstash(url, token) {
  return async commands => {
    const res = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(commands) });
    if (!res.ok) throw new Error(`Upstash responded ${res.status}`);
    return (await res.json()).map(r => {
      if (r.error) throw new Error(r.error);
      return r.result;
    });
  };
}

const json = (body, status = 200, cache = 'no-store') => Response.json(body, { status, headers: { 'Cache-Control': cache } });

// GET lists the top ten; POST adds a finished run and answers with its rank.
export async function handle(request, board) {
  if (!board) return json({ error: 'The leaderboard is not set up yet.' }, 503);
  try {
    if (request.method === 'GET') return json(await board.top(), 200, 'public, s-maxage=10, stale-while-revalidate=30');
    if (request.method !== 'POST') return json({ error: 'Use GET or POST.' }, 405);
    let body;
    try { body = await request.json(); } catch { throw new BoardError('Expected a JSON run.'); }
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    return json(await board.submit(body, ip));
  } catch (error) {
    if (error instanceof BoardError) return json({ error: error.message }, error.status);
    console.error('Leaderboard error:', error);
    return json({ error: 'The leaderboard is unavailable right now.' }, 502);
  }
}
