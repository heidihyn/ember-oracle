# The Ember Oracle

A demo website for an AI fortune teller that designs and sells talisman jewelry through the
[Arcade jewelry API](https://docs.arcade.ai/jewelry-quickstart). The visitor talks to a glowing
crystal ball, gets a reading from their name, date of birth and what they are seeking, and is
offered three jewelry pieces designed live by Arcade. Choosing one places an Arcade checkout.

The fortune itself is scripted (sun sign, life path number, birthstone, moon phase, and keyword
matching on what the visitor writes). There is no AI agent behind it; the agent is out of scope.

## Run it locally

Needs Node 18 or newer. No npm install.

```sh
ARCADE_API_KEY=your_key node server.mjs     # live mode
node server.mjs                             # sample data mode
```

Open http://localhost:8787. The banner at the top says which mode you are in, and the
"Arcade calls" button lists every API request the page made.

## Deploy on GitHub Pages

Pages serves the `main` branch from the repo root (**Settings → Pages → Deploy from a branch → main / root**).
The root `index.html` is generated from `public/app.html`, so run `npm run build` and commit it after
changing the page.

GitHub Pages only serves static files, so there is nowhere to keep the Arcade key and the site runs
in sample data mode. For live designs and orders, use the Vercel setup below (or the local server).

## Deploy on Vercel (live Arcade mode)

1. In Vercel, choose **Add New → Project** and import this GitHub repo. Settings come from
   `vercel.json` (build `node scripts/build.mjs`, output `public`), so leave the framework as "Other".
2. Add `ARCADE_API_KEY` under **Environment Variables**, then deploy.
3. The functions in `api/` answer `/api/*`. The banner at the top of the page says "Live mode" when the key is set.

## Deploy on Netlify

1. In Netlify, choose **Add new project → Import an existing project** and pick this GitHub repo.
   The build settings come from `netlify.toml` (build `node scripts/build.mjs`, publish `public`).
2. Under **Project configuration → Environment variables**, add `ARCADE_API_KEY`. Without it the
   site runs in sample data mode.
3. Deploy. The page is served from `public/`, and `netlify/functions/api.mjs` answers `/api/*`.

Design jobs are polled from the browser (`/api/design/start`, then `/api/design/status`), so no
function call runs longer than one Arcade request.

## How the Arcade calls map to the flow

| Step in the demo | Arcade call (all POST, `https://platform.arcade.ai/v1`) |
| --- | --- |
| Find a jewelry category for each piece | `/categories/list`, keep items with `world: "jewelry"`, match ring / necklace / bracelet by name |
| Design each talisman | `/patterns/create` with `requestId`, `prompt`, `categoryId` |
| Wait for the design | `/jobs/get` every 2.5s (polled by the browser) until `succeeded` or `failed` |
| Show title and price | `/products/get` with the job's `productId` |
| Place the order | `/checkouts/create` with one line, `quantity: 1`, `dropShip: true`, then send the visitor to `checkoutUrl` |
| Check the order | `/orders/get` with the `checkoutId` (after payment) |

The key stays on the server. The browser only talks to `/api/health`, `/api/design/start`,
`/api/design/status`, `/api/checkout` and `/api/order`.

## Things the quickstart does not specify

- **Design image.** The quickstart does not name an image field. The server looks for `imageUrl`,
  `previewUrl`, `images[0]` and similar on the product and job result. If none is found the card keeps
  its drawn preview. Check a real `products/get` response and adjust `findImage` in `lib/arcade.mjs`.
- **Price units.** `unitPrice.amount` is shown as a major-unit amount (189 means $189.00).
- **Prompt matching.** Arcade rejects a prompt that doesn't fit the category (HTTP 400). Each prompt
  names its piece type ("ring", "pendant necklace", "chain bracelet") so it matches the category picked.

## Files

- `public/app.html`: the whole front end. It is a page fragment so it can also be published as a
  hosted artifact; `scripts/build.mjs` wraps it into `public/index.html`.
- `lib/arcade.mjs`: the Arcade proxy, shared by both servers.
- `server.mjs`: local server.
- `api/` and `vercel.json`: Vercel hosting (one small function per route).
- `netlify/functions/api.mjs` and `netlify.toml`: Netlify hosting.
- `index.html` and `.nojekyll`: GitHub Pages (sample data mode).
