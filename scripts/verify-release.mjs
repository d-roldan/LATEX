import { execFileSync } from 'node:child_process';

const tag = process.argv[2];
if (!/^V\d+\.\d+\.\d+$/.test(tag ?? '')) {
  console.error('Uso: node scripts/verify-release.mjs Vx.x.x');
  process.exit(2);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const notes = `docs/releases/RELEASE_NOTES_${tag}.md`;
try {
  if (git('cat-file', '-t', tag).trim() !== 'tag') throw new Error('El tag no es anotado.');
  const commit = git('rev-parse', `${tag}^{commit}`).trim();
  if (commit !== git('rev-parse', 'HEAD').trim()) {
    throw new Error('El tag no apunta al commit actual.');
  }
  const object = git('cat-file', '-p', tag);
  const separator = object.indexOf('\n\n');
  if (separator < 0) throw new Error('Tag sin anotación.');
  const annotation = object.slice(separator + 2).replace(/\r\n/g, '\n').trimEnd();
  const committed = git('show', `${commit}:${notes}`).replace(/\r\n/g, '\n').trimEnd();
  if (annotation !== committed) throw new Error('La anotación difiere del Markdown incluido en el commit.');
  if (!committed.includes(tag)) throw new Error('La nota no menciona la versión del tag.');
  const releaseIndex = git('show', `${commit}:docs/releases/README.md`);
  const docsIndex = git('show', `${commit}:docs/README.md`);
  if (!releaseIndex.includes(`RELEASE_NOTES_${tag}.md`) || !docsIndex.includes(`RELEASE_NOTES_${tag}.md`)) {
    throw new Error('Los índices no enlazan la versión del tag.');
  }
  console.log(`Verificado ${tag}: anotación completa, nota en commit ${commit} e índices presentes.`);
} catch (error) {
  console.error(`Release inválida: ${error.message}`);
  process.exit(1);
}
