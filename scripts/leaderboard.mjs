// Leaderboard rules and HTTP handler, run against the in-memory Redis stand-in. Needs no server or network.
import assert from 'node:assert/strict';
import { BoardError, cleanName, createBoard, handle, validateRun } from '../api/_leaderboard.js';
import { memoryRedis } from '../api/_memory.js';
import { CASES } from '../src/scenes.js';

// A finished run: `used` seconds and `cash` per job, in job order.
const run = (name, parts) => ({ name, jobs: CASES.map((c, i) => ({ id: c.id, used: parts[i][0], cash: parts[i][1] })) });
const even = (used, cash) => run('Tester', CASES.map(() => [used, cash]));
const rejects = (body, pattern) => assert.throws(() => validateRun(body), e => e instanceof BoardError && pattern.test(e.message));

// Validation
assert.deepEqual(validateRun(even(30, 1000)), { name: 'Tester', cash: 5000, time: 150 });
rejects({ name: 'x', jobs: [] }, /all five jobs/);
rejects({ jobs: CASES.slice(0, 4).map(c => ({ id: c.id, used: 1, cash: 1 })) }, /all five jobs/);
rejects({ jobs: [...CASES].reverse().map(c => ({ id: c.id, used: 1, cash: 1 })) }, /out of order/);
rejects(even(CASES[0].seconds + 1, 0), /time is impossible/);
rejects(even(-1, 0), /time is impossible/);
rejects(even(2.5, 0), /time is impossible/);
const kwik = CASES[0];
const most = kwik.payout + (kwik.seconds - 10) * 40 + Math.round(kwik.payout * 0.25);
assert.equal(validateRun(run('Max', CASES.map((c, i) => (i ? [0, 0] : [10, most])))).cash, most);
rejects(run('Greedy', CASES.map((c, i) => (i ? [0, 0] : [10, most + 1]))), /payout is impossible/);
rejects('nope', /JSON run/);
console.log('PASS validation: five jobs in order, clock and payout limits per job');

// Names
assert.equal(cleanName('  Night\u0000  shift \n'), 'Night shift');
assert.equal(cleanName(''), 'The Cleaner');
assert.equal(cleanName(null), 'The Cleaner');
assert.equal(Array.from(cleanName('🔥'.repeat(30))).length, 18);
assert.equal(cleanName('ＶＩＣＥ'), 'VICE');
console.log('PASS names: trimmed, control characters removed, 18 characters, default alias');

// Ranking: most cash first, then less time, then the earlier run.
const board = createBoard(memoryRedis());
const a = await board.submit(even(40, 2000), 'a');
const b = await board.submit(even(30, 2000), 'b');
const c = await board.submit(even(20, 1000), 'c');
const d = await board.submit(even(30, 2000), 'd');
assert.deepEqual([a, b, c, d].map(r => r.entry.rank), [1, 1, 3, 2]);
const { top, total } = await board.top();
assert.equal(total, 4);
assert.deepEqual(top.map(e => e.id), [b.entry.id, d.entry.id, a.entry.id, c.entry.id]);
assert.deepEqual(Object.keys(top[0]).sort(), ['at', 'cash', 'id', 'name', 'time']);
console.log('PASS ranking: cash, then time, then the earlier run');

// Rate limit per address
const limited = createBoard(memoryRedis());
for (let i = 0; i < 20; i++) await limited.submit(even(10, 10), 'spammer');
await assert.rejects(limited.submit(even(10, 10), 'spammer'), e => e.status === 429);
await limited.submit(even(10, 10), 'someone-else');
console.log('PASS rate limit: 20 posts per address per window');

// HTTP handler
const http = createBoard(memoryRedis());
const request = (method, body) => new Request('http://localhost/api/leaderboard', { method, headers: { 'content-type': 'application/json' }, body });
let res = await handle(request('GET'), http);
assert.equal(res.status, 200);
assert.deepEqual(await res.json(), { top: [], total: 0 });
assert.match(res.headers.get('cache-control'), /s-maxage/);
res = await handle(request('POST', JSON.stringify(even(25, 3000))), http);
assert.equal(res.status, 200);
const posted = await res.json();
assert.equal(posted.entry.rank, 1);
assert.equal(posted.total, 1);
assert.equal(res.headers.get('cache-control'), 'no-store');
assert.equal((await handle(request('POST', '{broken'), http)).status, 400);
assert.equal((await handle(request('POST', JSON.stringify({ jobs: [] })), http)).status, 400);
assert.equal((await handle(request('DELETE'), http)).status, 405);
assert.equal((await handle(request('GET'), null)).status, 503);
const failing = createBoard(async () => { throw new Error('down'); });
const quiet = console.error;
console.error = () => {};
assert.equal((await handle(request('GET'), failing)).status, 502);
console.error = quiet;
console.log('PASS handler: GET top ten, POST rank, bad input 400, unknown method 405, not set up 503, storage down 502');
