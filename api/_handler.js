// Shared by the Vercel Functions in this folder: each file serves one /api route through the Arcade proxy.
// Files starting with "_" are not deployed as routes. Set ARCADE_API_KEY in Vercel: Settings > Environment Variables.
import { createArcade } from '../lib/arcade.mjs';

export function route(name) {
  const handle = async (request) => {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : null;
    const out = await createArcade(process.env).handle(request.method, name, body);
    return Response.json(out.body, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
  };
  return { GET: handle, POST: handle };
}
