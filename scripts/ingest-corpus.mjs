import "dotenv/config";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { GoogleGenAI } from "@google/genai";

const filePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(filePath), "..");
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const embeddingDimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 1536);

function normalizeEmbedding(values) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return values;
  }
  return values.map((value) => value / magnitude);
}

function readPayload() {
  const scriptPath = path.join(repoRoot, "scripts", "build_corpus_payload.py");
  const result = spawnSync("python", [scriptPath], {
    cwd: repoRoot,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || "Failed to build corpus payload.");
  }

  return JSON.parse(result.stdout);
}

function runConvexImport(tableName, filePath, format = null) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const formatArg = format ? ` --format ${format}` : "";
  const command = `npx convex import --table ${tableName} --replace -y${formatArg} ${normalizedPath}`;
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", command], {
    cwd: repoRoot,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to import ${tableName}.`);
  }
}

function buildImportTables(payload) {
  const createdAt = Date.now();
  const corpusSources = payload.sources.map((source) => ({
    sourceKey: source.sourceKey,
    sourceLabel: source.sourceLabel,
    sourceType: source.sourceType,
    sourcePath: source.sourcePath ?? undefined,
    authorityLevel: source.authorityLevel,
    rulesDomain: source.rulesDomain,
    visibility: source.visibility,
    chunkCount: source.chunks.length,
    contentHash: source.contentHash,
    importStatus: "ready",
    indexedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  }));

  const corpusChunks = payload.sources.flatMap((source) =>
    source.chunks.map((chunk) => ({
      sourceKey: source.sourceKey,
      sourceLabel: source.sourceLabel,
      sourceType: source.sourceType,
      authorityLevel: source.authorityLevel,
      rulesDomain: source.rulesDomain,
      visibility: source.visibility,
      chunkIndex: chunk.chunkIndex,
      chunkText: chunk.chunkText,
      metadata: chunk.metadata,
      embedding: chunk.embedding,
      createdAt,
      updatedAt: createdAt,
    })),
  );

  return {
    corpusSources,
    corpusChunks,
  };
}

function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function loadEmbeddingCache(cachePath) {
  try {
    const raw = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveEmbeddingCache(cachePath, cache) {
  await fs.writeFile(cachePath, JSON.stringify(cache), "utf-8");
}

async function embedTexts(texts) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_AI_API_KEY is required for corpus embedding.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.embedContent({
    model: embeddingModel,
    contents: texts,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: embeddingDimensions,
    },
  });

  return response.embeddings.map((entry) => normalizeEmbedding(entry.values));
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function attachEmbeddings(payload, cachePath) {
  const cache = await loadEmbeddingCache(cachePath);
  const pending = [];

  for (const source of payload.sources) {
    for (const chunk of source.chunks) {
      const cacheKey = hashText(chunk.chunkText);
      if (cache[cacheKey]) {
        chunk.embedding = cache[cacheKey];
        continue;
      }
      pending.push({ cacheKey, chunk });
    }
  }

  if (!pending.length) {
    return;
  }

  process.stdout.write(
    `Generating embeddings for ${pending.length} chunks with ${embeddingModel}.\n`,
  );

  const batchSize = 48;
  for (let index = 0; index < pending.length; index += batchSize) {
    const batch = pending.slice(index, index + batchSize);
    let embeddings = null;
    let lastError = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        embeddings = await embedTexts(batch.map((entry) => entry.chunk.chunkText));
        break;
      } catch (error) {
        lastError = error;
        await wait(1000 * (attempt + 1));
      }
    }

    if (!embeddings) {
      throw lastError;
    }

    for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
      const embedding = embeddings[itemIndex];
      batch[itemIndex].chunk.embedding = embedding;
      cache[batch[itemIndex].cacheKey] = embedding;
    }
    process.stdout.write(
      `Embedded ${Math.min(index + batch.length, pending.length)}/${pending.length} chunks.\n`,
    );
    await saveEmbeddingCache(cachePath, cache);
  }
}

async function main() {
  const payload = readPayload();
  const tempRoot = process.env.TEMP || process.env.TMP || repoRoot;
  const importDir = path.join(tempRoot, "dnd-agent-convex-import");
  const embeddingCachePath = path.join(
    repoRoot,
    "data",
    "cache",
    `embedding-cache-${embeddingModel}-${embeddingDimensions}.json`,
  );

  await attachEmbeddings(payload, embeddingCachePath);

  const { corpusSources, corpusChunks } = buildImportTables(payload);
  const sourcePath = path.join(importDir, "corpusSources.json");
  const chunkPath = path.join(importDir, "corpusChunks.jsonl");

  await fs.mkdir(importDir, { recursive: true });
  await fs.writeFile(sourcePath, JSON.stringify(corpusSources), "utf-8");
  await fs.writeFile(
    chunkPath,
    corpusChunks.map((chunk) => JSON.stringify(chunk)).join("\n"),
    "utf-8",
  );

  process.stdout.write(
    `Preparing ${payload.sourceCount} sources and ${payload.chunkCount} chunks from local data.\n`,
  );
  process.stdout.write(`Writing import files to ${importDir}\n`);
  runConvexImport("corpusSources", sourcePath);
  process.stdout.write(`Imported ${corpusSources.length} corpus sources.\n`);
  runConvexImport("corpusChunks", chunkPath, "jsonLines");
  process.stdout.write(`Imported ${corpusChunks.length} corpus chunks.\n`);

  process.stdout.write("Corpus ingestion complete.\n");
}

await main();
