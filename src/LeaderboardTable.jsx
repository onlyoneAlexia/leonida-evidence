import { clockTime } from './leaderboard.js';

const money = n => `$${n.toLocaleString('en-US')}`;

export default function LeaderboardTable({ rows, highlight, className }) {
  return (
    <table className={className}>
      <thead><tr><th scope="col">#</th><th scope="col">Fixer</th><th scope="col">Cash</th><th scope="col">Time</th></tr></thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.id} className={[row.id === highlight && 'you', row.below && 'below'].filter(Boolean).join(' ') || undefined}>
            <td>{row.rank}</td><td>{row.name}</td><td>{money(row.cash)}</td><td>{clockTime(row.time)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
