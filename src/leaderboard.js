// Talks to /api/leaderboard (api/leaderboard.js on Vercel, an in-memory copy under `npm run dev`).
import { useEffect, useState } from 'react';
import { CASES } from './scenes.js';

export const clockTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

async function call(init) {
  let res;
  try { res = await fetch('/api/leaderboard', init); } catch { throw new Error('The leaderboard is offline right now.'); }
  // A host without the function answers with HTML, so a failed parse means offline too.
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || 'The leaderboard is offline right now.');
  return data;
}

// The server re-checks every job against its clock and payout limits.
export const postRun = (name, history) => call({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, jobs: history.map((h, i) => ({ id: h.id, used: CASES[i].seconds - h.left, cash: h.total })) }),
});

// Returns [{ board, error }, setBoard]; board is { top, total } once it loads.
export function useLeaderboard() {
  const [state, setState] = useState({ board: null, error: '' });
  useEffect(() => {
    let active = true;
    call().then(
      board => { if (active) setState({ board, error: '' }); },
      error => { if (active) setState({ board: null, error: error.message }); },
    );
    return () => { active = false; };
  }, []);
  return [state, board => setState({ board, error: '' })];
}

// Top rows ranked 1..n, plus the player's own entry underneath when it didn't make the top ten.
export function boardRows(board, entry) {
  const rows = board.top.map((row, i) => ({ ...row, rank: i + 1 }));
  if (entry && !rows.some(row => row.id === entry.id)) rows.push({ ...entry, below: true });
  return rows;
}
