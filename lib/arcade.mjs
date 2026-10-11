// Arcade jewelry API proxy, shared by the local server (server.mjs) and the Netlify Function.
// Design jobs are polled by the browser one step at a time, so no request outlives a serverless timeout.
import { randomUUID } from 'node:crypto';

export class ArcadeError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

const PIECE_WORDS = { ring: ['ring'], necklace: ['necklace', 'pendant'], bracelet: ['bracelet', 'bangle'], earrings: ['earring'] };

// The quickstart does not document an image field, so look in the likely places.
function findImage(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of ['imageUrl', 'previewUrl', 'thumbnailUrl', 'renderUrl', 'image']) {
    if (typeof obj[k] === 'string') return obj[k];
    if (obj[k]?.url) return obj[k].url;
  }
  for (const k of ['images', 'previews', 'media', 'renders']) {
    const first = Array.isArray(obj[k]) ? obj[k][0] : null;
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
  }
  return null;
}

let jewelryCats; // survives between requests on a warm server or function

export function createArcade(env = process.env) {
  const key = env.ARCADE_API_KEY || '';
  const base = (env.ARCADE_BASE_URL || 'https://platform.arcade.ai/v1').replace(/\/$/, '');
  const userAgent = env.ARCADE_USER_AGENT || 'ember-oracle-demo/0.1';
  // Per the quickstart, dropShip must be true for a quantity-1 line unless you have an active subscription.
  const hasSubscription = env.ARCADE_HAS_SUBSCRIPTION === 'true';

  async function call(endpoint, body, calls, note) {
    calls.push({ path: endpoint, body, note });
    const res = await fetch(base + endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': userAgent },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) throw new ArcadeError(data?.error?.message || data?.message || `Arcade ${endpoint} returned HTTP ${res.status}`, res.status, data);
    return data;
  }

  async function categories(calls) {
    if (!jewelryCats) {
      const data = await call('/categories/list', {}, calls, 'find categories whose world is "jewelry"');
      jewelryCats = (data.items || []).filter(c => c.world === 'jewelry');
    }
    return jewelryCats;
  }

  const routes = {
    // Starts one design job and returns its jobId.
    async 'design/start'({ prompt, piece }, calls) {
      if (!prompt) throw new ArcadeError('A design prompt is required.', 400);
      const cats = await categories(calls);
      if (!cats.length) throw new ArcadeError('Arcade returned no jewelry categories for this account.', 502);
      const words = PIECE_WORDS[piece] || [];
      const cat = cats.find(c => words.some(w => (c.name || '').toLowerCase().includes(w))) || cats[0];
      const job = await call('/patterns/create', { requestId: randomUUID(), prompt, categoryId: cat.categoryId }, calls, `design in "${cat.name}"`);
      return { jobId: job.jobId, status: job.status, category: { id: cat.categoryId, name: cat.name, imageUrl: cat.imageUrl || null } };
    },

    // Checks a design job once. When it has succeeded, also reads the product.
    async 'design/status'({ jobId }, calls) {
      if (!jobId) throw new ArcadeError('jobId is required.', 400);
      const job = await call('/jobs/get', { jobId }, calls, 'poll until succeeded or failed');
      if (job.status === 'failed') throw new ArcadeError(job.error?.message || 'The design job failed.', 502);
      if (job.status !== 'succeeded') return { done: false, status: job.status };
      const { patternId, productId } = job.result || {};
      const product = await call('/products/get', { productId }, calls, 'read images, title and unit price');
      // products/get lists images primary-first; imageUrl is only a thumbnail. Image URLs are short-lived.
      let images = (product.images || []).map(i => i?.url).filter(Boolean);
      if (!images.length && product.imageUrl) images = [product.imageUrl];
      if (!images.length && patternId) {
        try {
          const pattern = await call('/patterns/get', { patternId }, calls, 'read the design image');
          images = [pattern.imageUrl || pattern.thumbnailUrl].filter(Boolean);
        } catch { /* fall back to the drawn preview */ }
      }
      return {
        done: true, jobId, patternId, productId,
        title: product.title, unitPrice: product.unitPrice, selections: product.selections,
        selectionLabel: product.selectionLabel, maker: product.maker?.name || null,
        description: product.description || null, careInstructions: product.careInstructions || '',
        images, imageUrl: images[0] || findImage(product) || findImage(job.result),
      };
    },

    async checkout({ productId, quantity = 1 }, calls) {
      if (!productId) throw new ArcadeError('productId is required.', 400);
      const dropShip = quantity === 1 && !hasSubscription;
      const data = await call('/checkouts/create', { requestId: randomUUID(), lines: [{ productId, quantity }], dropShip }, calls, 'create checkout');
      return { checkoutId: data.checkoutId, checkoutUrl: data.checkoutUrl };
    },

    async order({ checkoutId }, calls) {
      if (!checkoutId) throw new ArcadeError('checkoutId is required.', 400);
      return { order: await call('/orders/get', { checkoutId }, calls, 'read the order after payment') };
    },
  };

  // Returns { status, body } for GET /api/health and POST /api/<route>.
  async function handle(method, route, body) {
    if (method === 'GET' && route === 'health') return { status: 200, body: { live: Boolean(key) } };
    const fn = method === 'POST' && routes[route];
    if (!fn) return { status: 404, body: { error: 'Not found' } };
    if (!key) return { status: 503, body: { error: 'ARCADE_API_KEY is not set on the server.' } };
    const calls = [];
    try {
      return { status: 200, body: { ...(await fn(body || {}, calls)), calls } };
    } catch (err) {
      console.error(`[arcade] ${route}:`, err.message, err.data ?? '');
      return { status: err.status && err.status < 600 ? err.status : 500, body: { error: err.message, calls } };
    }
  }

  return { handle };
}
