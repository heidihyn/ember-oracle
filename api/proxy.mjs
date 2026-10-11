// Vercel Function serving /api/* (vercel.json rewrites /api/<route> to /api/proxy?route=<route>).
// Set ARCADE_API_KEY in Vercel: Project Settings > Environment Variables.
import { createArcade } from '../lib/arcade.mjs';

async function handle(request) {
  const route = new URL(request.url).searchParams.get('route') || '';
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : null;
  const out = await createArcade(process.env).handle(request.method, route, body);
  return Response.json(out.body, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
}

export { handle as GET, handle as POST };
