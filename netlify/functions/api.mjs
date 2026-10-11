// Netlify Function serving /api/* with the same Arcade proxy as the local server.
// Set ARCADE_API_KEY in Netlify: Site configuration > Environment variables.
import { createArcade } from '../../lib/arcade.mjs';

export default async (req) => {
  const route = new URL(req.url).pathname.replace(/^\/api\//, '');
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : null;
  const out = await createArcade(process.env).handle(req.method, route, body);
  return Response.json(out.body, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/*' };
