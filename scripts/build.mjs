import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");
const cleanOnly = process.argv.includes("--clean");

function isGeneratedAsset(name) {
  return (
    name.endsWith("-min.js") ||
    name.endsWith(".min.js") ||
    name.endsWith("-min.css") ||
    name.endsWith(".min.css")
  );
}

function minifyCss(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function writeText(targetPath, contents) {
  await ensureDir(path.dirname(targetPath));
  await writeFile(targetPath, contents, "utf8");
}

async function copySourceTree(sourceDir, targetDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  await ensureDir(targetDir);

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copySourceTree(sourcePath, targetPath);
      continue;
    }

    if (isGeneratedAsset(entry.name)) {
      continue;
    }

    const source = await readFile(sourcePath, "utf8");
    await writeText(targetPath, source);
  }
}

async function buildGeneratedAssets() {
  const dataTableJs = await readFile(path.join(srcDir, "data-table.js"), "utf8");
  const dataTableCss = await readFile(path.join(srcDir, "data-table.css"), "utf8");

  await writeText(path.join(distDir, "data-table.min.js"), `${dataTableJs.trim()}\n`);
  await writeText(path.join(distDir, "data-table.min.css"), `${minifyCss(dataTableCss)}\n`);
}

async function main() {
  const distExists = await stat(distDir).then(() => true).catch(() => false);

  if (distExists) {
    await rm(distDir, { recursive: true, force: true });
  }

  if (cleanOnly) {
    return;
  }

  await copySourceTree(srcDir, distDir);
  await buildGeneratedAssets();
}

await main();
