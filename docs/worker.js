/**
 * NIM Chat — Cloudflare Worker CORS Proxy
 * Deploy this at: https://workers.cloudflare.com
 * Free tier: 100,000 requests/day
 */

const NIM_API = 'https://integrate.api.nvidia.com/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.text();
    const auth = request.headers.get('Authorization');

    const upstream = await fetch(NIM_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
        'Accept': 'text/event-stream',
      },
      body,
    });

    // Stream the response back with CORS headers
    const response = new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        ...Object.fromEntries(upstream.headers.entries()),
        ...CORS_HEADERS,
      },
    });

    return response;

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
}
