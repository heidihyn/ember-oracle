// Builds public/index.html from public/app.html. app.html is a page fragment because it is also
// published as a hosted artifact, so this adds the document shell around it.
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
  const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
  await writeFile(path.join(pub, 'index.html'), wrapPage(await readFile(path.join(pub, 'app.html'), 'utf8')));
  console.log('Built public/index.html');
}
