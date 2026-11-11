import 'server-only';
import dns from 'node:dns';
import type { LookupFunction } from 'node:net';
import { Agent } from 'undici';

/**
 * Some internet providers (notably Reliance Jio in India) block TMDB at the DNS
 * level: their resolvers return a dead address for *.themoviedb.org. TMDB itself is
 * reachable, so we resolve its hostnames through public DNS servers instead.
 *
 * Configure with TMDB_DNS_SERVERS:
 *   unset     → "1.1.1.1,8.8.8.8" locally, system DNS on Vercel
 *   "system"  → always use the operating system's DNS
 *   "a,b,..." → use these DNS servers
 */
function servers(): string[] | null {
  const raw = process.env.TMDB_DNS_SERVERS?.trim();
  if (raw?.toLowerCase() === 'system') return null;
  if (raw)
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return process.env.VERCEL ? null : ['1.1.1.1', '8.8.8.8'];
}

let agent: Agent | null | undefined;

/** An undici dispatcher that resolves hosts via public DNS, or null to use the default. */
export function tmdbDispatcher(): Agent | null {
  if (agent !== undefined) return agent;
  const list = servers();
  if (!list) return (agent = null);

  const resolver = new dns.promises.Resolver({ timeout: 3000, tries: 2 });
  resolver.setServers(list);

  const lookup: LookupFunction = (hostname, options, callback) => {
    resolver
      .resolve4(hostname)
      .then((found) => {
        if (!found.length) throw new Error('No addresses');
        // Shuffle: some edge addresses are intermittently unreachable on certain ISPs,
        // so spread connections (and retries) across all of them.
        const addresses = found.slice().sort(() => Math.random() - 0.5);
        if (options?.all)
          callback(
            null,
            addresses.map((address) => ({ address, family: 4 })),
          );
        else callback(null, addresses[0], 4);
      })
      // Fall back to the system resolver if public DNS is unreachable.
      .catch(() => dns.lookup(hostname, options, callback as never));
  };

  agent = new Agent({
    // Fail fast on a dead address (instead of 10s) so the retry can try another one;
    // with several addresses, Node tries them in turn (happy eyeballs).
    connect: {
      lookup,
      timeout: 4000,
      autoSelectFamily: true,
      autoSelectFamilyAttemptTimeout: 1500,
    },
    keepAliveTimeout: 30_000,
  });
  return agent;
}
