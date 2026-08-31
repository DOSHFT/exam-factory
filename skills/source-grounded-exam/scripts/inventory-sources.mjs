import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from './lib/cli.mjs';
import { readJson, sha256, stableStringify, validateBlueprint } from './lib/contracts.mjs';

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt']);
const normalizeNewlines = text => text.replace(/\r\n?/g, '\n');
const normalizePath = path => path.replaceAll('\\', '/');
const sourceId = relativePath => `src-${sha256(normalizePath(relativePath)).slice(0, 16)}`;
const headings = text => text.split('\n').flatMap((line, index) => {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
  return match ? [{ level: match[1].length, text: match[2], line: index + 1 }] : [];
});

function pathFromInput(value) {
  return value instanceof URL ? fileURLToPath(value) : value;
}

function unsupportedExtension(path) {
  const extension = extname(path).toLowerCase();
  return extension && !SUPPORTED_EXTENSIONS.has(extension);
}

async function collectFiles(sourcePath) {
  const sourceStat = await stat(sourcePath);
  if (sourceStat.isFile()) {
    if (!SUPPORTED_EXTENSIONS.has(extname(sourcePath).toLowerCase())) throw new Error(`Unsupported source extension: ${sourcePath}`);
    return [resolve(sourcePath)];
  }
  if (!sourceStat.isDirectory()) throw new Error(`Source path is not a file or directory: ${sourcePath}`);

  const entries = await readdir(sourcePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const childPath = resolve(sourcePath, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(childPath));
    else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(childPath);
  }
  return files;
}

export async function createSourceManifest(blueprint, blueprintPath) {
  const blueprintFile = pathFromInput(blueprintPath);
  const blueprintDirectory = dirname(resolve(blueprintFile));
  const fileEntries = [];

  for (const source of blueprint.sourcePaths) {
    const sourcePath = resolve(blueprintDirectory, source);
    if (unsupportedExtension(sourcePath)) {
      let sourceStat;
      try {
        sourceStat = await stat(sourcePath);
      } catch (error) {
        if (error.code === 'ENOENT') throw new Error(`Unsupported source extension: ${sourcePath}`);
        throw error;
      }
      if (!sourceStat.isDirectory()) throw new Error(`Unsupported source extension: ${sourcePath}`);
    }
    const sourceStat = await stat(sourcePath);
    const files = await collectFiles(sourcePath);
    const absoluteSource = isAbsolute(source);
    const canonicalPrefix = absoluteSource
      ? (sourceStat.isDirectory() ? basename(sourcePath) : '')
      : '';
    for (const absolutePath of files) fileEntries.push({ absolutePath, absoluteSource, canonicalPrefix, sourceRoot: sourcePath });
  }

  const absolutePaths = fileEntries
    .sort((a, b) => normalizePath(a.absolutePath).localeCompare(normalizePath(b.absolutePath)));
  const canonicalPaths = new Set();
  const sources = [];
  for (const { absolutePath, absoluteSource, canonicalPrefix, sourceRoot } of absolutePaths) {
    const text = normalizeNewlines(await readFile(absolutePath, 'utf8'));
    const relativePath = normalizePath(canonicalPrefix
      ? join(canonicalPrefix, relative(sourceRoot, absolutePath))
      : (absoluteSource ? basename(absolutePath) : relative(blueprintDirectory, absolutePath)));
    if (canonicalPaths.has(relativePath)) throw new Error(`Duplicate canonical source path: ${relativePath}`);
    canonicalPaths.add(relativePath);
    sources.push({
      id: sourceId(relativePath),
      relativePath,
      absolutePath,
      sha256: sha256(text),
      characters: text.length,
      lines: text.split('\n').length,
      headings: headings(text),
    });
  }

  const schemaVersion = '1.0.0';
  const blueprintHash = sha256(blueprint);
  const publicSources = sources.map(({ absolutePath, ...publicFields }) => publicFields);
  return {
    schemaVersion,
    blueprintHash,
    manifestHash: sha256({ schemaVersion, blueprintHash, sources: publicSources }),
    sources,
  };
}

async function main() {
  const { blueprint: blueprintPath, output: outputPath, overwrite } = parseArgs(process.argv.slice(2), ['blueprint', 'output']);
  const blueprint = await readJson(blueprintPath);
  const errors = validateBlueprint(blueprint);
  if (errors.length) throw new Error(`Invalid blueprint:\n${errors.join('\n')}`);
  const manifest = await createSourceManifest(blueprint, pathToFileURL(resolve(blueprintPath)));
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  if (overwrite !== 'true') await access(outputPath).then(() => { throw new Error(`Refusing to overwrite existing output: ${outputPath}`); }).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  await writeFile(outputPath, `${stableStringify(manifest)}\n`, { encoding: 'utf8', flag: overwrite === 'true' ? 'w' : 'wx' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
