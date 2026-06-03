/** Provider-layer network intercept — blocks Vertex AI / Anthropic hosts during probe runs. */

const BLOCKED_HOST_PATTERNS = [
  /vertexai\.googleapis\.com/i,
  /aiplatform\.googleapis\.com/i,
  /anthropic\.com/i,
  /api\.anthropic\.com/i,
];

import type { BlockedCallRecord, NetworkMockPlugin } from '../types/harness.js';

export type { BlockedCallRecord, NetworkMockPlugin };

export function createNetworkMock(): NetworkMockPlugin {
  const log: BlockedCallRecord[] = [];

  return {
    wrapFetch(base: typeof fetch): typeof fetch {
      return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();
        const host = (() => {
          try {
            return new URL(url).host;
          } catch {
            return url;
          }
        })();

        if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host) || re.test(url))) {
          log.push({
            url,
            method: init?.method ?? 'GET',
            at: new Date().toISOString(),
          });
          return new Response('blocked by BR Runtime network-mock', { status: 503 });
        }

        if (init?.headers) {
          const headers = new Headers(init.headers);
          if (headers.get('X-BR-Simulate-AI-Down') === '1') {
            return new Response('AI provider unavailable', { status: 503 });
          }
        }

        return base(input, init);
      };
    },
    getBlockedCallLog() {
      return [...log];
    },
    reset() {
      log.length = 0;
    },
    assertZeroBlockedCalls() {
      return { ok: log.length === 0, log: [...log] };
    },
  };
}

export function loadNetworkMock(): NetworkMockPlugin {
  return createNetworkMock();
}
