// In-memory stand-in for the few Redis commands the leaderboard uses, so `npm run dev`,
// `npm run preview` and the tests get a working board without the real database. Expiry is ignored.
export function memoryRedis() {
  const sets = new Map();
  const strings = new Map();
  const set = key => sets.get(key) ?? sets.set(key, []).get(key);
  // ZREVRANGE order: highest score first, equal scores by member, descending.
  const desc = key => [...set(key)].sort((a, b) => b.score - a.score || (a.member < b.member ? 1 : a.member > b.member ? -1 : 0));
  const index = (i, n) => (i < 0 ? n + i : i);
  const run = ([command, key, ...args]) => {
    switch (command) {
      case 'ZADD':
        sets.set(key, [...set(key).filter(e => e.member !== args[1]), { score: Number(args[0]), member: args[1] }]);
        return 1;
      case 'ZCARD':
        return set(key).length;
      case 'ZREVRANGE': {
        const all = desc(key);
        return all.slice(index(args[0], all.length), index(args[1], all.length) + 1).map(e => e.member);
      }
      case 'ZREVRANK': {
        const rank = desc(key).findIndex(e => e.member === args[0]);
        return rank < 0 ? null : rank;
      }
      case 'ZREMRANGEBYRANK': {
        // Ranks count up from the lowest score.
        const asc = desc(key).reverse();
        const drop = new Set(asc.slice(Math.max(0, index(args[0], asc.length)), index(args[1], asc.length) + 1).map(e => e.member));
        sets.set(key, set(key).filter(e => !drop.has(e.member)));
        return drop.size;
      }
      case 'SET':
        if (args.includes('NX') && strings.has(key)) return null;
        strings.set(key, String(args[0]));
        return 'OK';
      case 'INCR': {
        const value = Number(strings.get(key) ?? 0) + 1;
        strings.set(key, String(value));
        return value;
      }
      default:
        throw new Error(`memoryRedis does not support ${command}`);
    }
  };
  return async commands => commands.map(run);
}
