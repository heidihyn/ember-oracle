// Builds index.html (repo root, served by GitHub Pages) and public/index.html (Netlify, Vercel) from
// public/app.html. app.html is a page fragment because it is also published as a hosted artifact, so
// this adds the document shell around it. Run `npm run build` and commit index.html after editing app.html.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function wrapPage(fragment) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Speak to the crystal ball. It reads your stars, then designs talisman jewelry for the road ahead.">
</head>
<body>
${fragment}
</body>
</html>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const html = wrapPage(await readFile(path.join(root, 'public', 'app.html'), 'utf8'));
  await writeFile(path.join(root, 'public', 'index.html'), html);
  await writeFile(path.join(root, 'index.html'), html);
  console.log('Built index.html and public/index.html');
}
