// Cloudflare Pages Function: Universal Edge API Gateway Proxy
// Routes all /api/* requests from https://z21.zozdocs.com/ to the active local daemon tunnel

const TUNNEL_HOST = 'notify-thomson-remarks-affected.trycloudflare.com';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetUrl = `https://${TUNNEL_HOST}${url.pathname}${url.search}`;

  // Handle CORS Preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Private-Network': 'true',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Clone headers for outgoing request
  const reqHeaders = new Headers(context.request.headers);
  reqHeaders.set('Host', TUNNEL_HOST);
  reqHeaders.set('X-Forwarded-Host', url.host);
  reqHeaders.set('X-Forwarded-Proto', 'https');

  const requestInit = {
    method: context.request.method,
    headers: reqHeaders,
    redirect: 'follow'
  };

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    requestInit.body = context.request.body;
  }

  try {
    const upstreamResponse = await fetch(targetUrl, requestInit);

    // Forward upstream response with permissive CORS and no buffering
    const respHeaders = new Headers(upstreamResponse.headers);
    respHeaders.set('Access-Control-Allow-Origin', '*');
    respHeaders.set('Access-Control-Allow-Private-Network', 'true');
    respHeaders.set('X-Accel-Buffering', 'no');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: respHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Proxy to tunnel backend failed',
      details: err.message,
      target: targetUrl
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
