/** Mock fetch simulating Firebase emulator responses for --mock CLI and tests. */
export function createMockFetch(): typeof fetch {
  const rateCounts = new Map<string, number>();

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);

    if (url.includes('/igv/engagements')) {
      if (headers.get('X-BR-Simulate-Auth-Down') === '1') {
        return new Response('auth unavailable', { status: 503 });
      }
      const auth = headers.get('Authorization');
      if (!auth) return new Response('Missing authorization header', { status: 401 });
      if (auth.includes('invalid')) {
        return new Response('Facilitator access required', { status: 403 });
      }
      return new Response('[]', { status: 200 });
    }

    if (url.includes('/igv/validate-code') && method === 'POST') {
      const key = headers.get('X-Forwarded-For') ?? 'default';
      const n = (rateCounts.get(key) ?? 0) + 1;
      rateCounts.set(key, n);
      if (n > 5) return new Response('Too many requests', { status: 429 });
      return new Response('invalid code', { status: 400 });
    }

    if (url.includes('/documents/')) {
      if (headers.get('X-BR-Simulate-Firestore-Down') === '1') {
        return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE' } }), { status: 503 });
      }
      return new Response(
        JSON.stringify({
          error: { status: 'PERMISSION_DENIED', message: 'Missing or insufficient permissions.' },
        }),
        { status: 403 },
      );
    }

    if (url.includes('/v0/b/') && method === 'POST') {
      return new Response('Permission denied', { status: 403 });
    }

    return new Response('not found', { status: 404 });
  };
}
