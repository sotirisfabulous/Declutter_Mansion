// Turns a `VITE_NO_SW=1 vite build --outDir dist-artifact` build into a page body for a claude.ai Artifact
// (the host supplies <html>/<head>/<body>, and service workers / web manifests don't apply there).
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-artifact/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head.split('\n').filter((l) => /<title>|rel="stylesheet"|<script/.test(l) && !/manifest|registerSW/.test(l)).join('\n');
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Creepster&family=Fredoka:wght@400;600;700&display=swap">';
writeFileSync('dist-artifact/artifact.html', `${keep}\n${fonts}\n${body.trim()}\n`);
console.log('dist-artifact/artifact.html written');
