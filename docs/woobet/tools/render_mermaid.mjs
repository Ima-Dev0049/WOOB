import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderMermaidSVG } from 'beautiful-mermaid';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolsDir, '..');
const outDir = path.join(rootDir, 'diagrams');
mkdirSync(outDir, { recursive: true });

const theme = {
  bg: '#FFFFFF',
  fg: '#172033',
  line: '#64748B',
  accent: '#1D4ED8',
  muted: '#526075',
  surface: '#F3F6FB',
  border: '#9AA9BD',
};
const manifest = [];
let failures = 0;

for (const filename of readdirSync(rootDir).filter((f) => /^\d{2}_.*\.md$/.test(f)).sort()) {
  const markdown = readFileSync(path.join(rootDir, filename), 'utf8');
  const pattern = /```mermaid\s*\n([\s\S]*?)```/g;
  let match;
  let index = 0;
  while ((match = pattern.exec(markdown)) !== null) {
    index += 1;
    const id = `${path.basename(filename, '.md')}-${String(index).padStart(2, '0')}`;
    const before = markdown.slice(0, match.index);
    const headings = [...before.matchAll(/^#{1,6}\s+(.+)$/gm)];
    const section = headings.length ? headings.at(-1)[1].trim() : 'Diagramme';
    const item = { id, source: filename, index, section, file: `diagrams/${id}.svg` };
    try {
      const rendered = renderMermaidSVG(match[1].trim(), theme);
      if (!rendered.includes('<svg')) throw new Error('Le rendu ne contient pas de SVG.');
      // svglib ne résout pas les custom properties CSS : produire aussi un SVG
      // statique, autonome et sans import réseau pour le PDF et l'archivage.
      const concreteColors = {
        '--_text-sec': '#526075', '--_text-muted': '#7B8798', '--_text-faint': '#B4BECC',
        '--_text': '#172033', '--_line': '#64748B', '--_arrow': '#1D4ED8',
        '--_node-fill': '#F3F6FB', '--_node-stroke': '#9AA9BD',
        '--_group-fill': '#FFFFFF', '--_group-hdr': '#F3F6FB',
        '--_inner-stroke': '#D7DEE8', '--_key-badge': '#E7ECF4',
        '--bg': '#FFFFFF', '--fg': '#172033', '--line': '#64748B',
        '--accent': '#1D4ED8', '--muted': '#526075', '--surface': '#F3F6FB',
        '--border': '#9AA9BD',
      };
      let svg = rendered.replace(/<style>[\s\S]*?<\/style>/, "<style>text { font-family: 'DejaVu Sans', sans-serif; }</style>");
      for (const [token, color] of Object.entries(concreteColors)) {
        svg = svg.replaceAll(`var(${token})`, color);
      }
      if (/@import|color-mix|var\(/.test(svg)) {
        throw new Error('Le SVG autonome contient encore une couleur ou ressource dynamique.');
      }
      writeFileSync(path.join(outDir, `${id}.svg`), svg);
      item.status = 'rendered';
      item.bytes = Buffer.byteLength(svg);
    } catch (error) {
      failures += 1;
      item.status = 'error';
      item.error = error instanceof Error ? error.message : String(error);
    }
    manifest.push(item);
  }
}

writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${manifest.length} diagrammes trouvés ; ${manifest.length - failures} rendus ; ${failures} échecs.`);
for (const item of manifest.filter((x) => x.status === 'error')) {
  console.error(`${item.id}: ${item.error}`);
}
if (failures) process.exitCode = 1;
