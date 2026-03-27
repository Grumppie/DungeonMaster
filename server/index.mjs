import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const memoryCachePath = path.join(rootDir, "data", "memory-index-cache.json");
const embeddingModel = "text-embedding-3-small";

let memoryIndexPromise = null;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost:8787");

    if (req.method === "GET" && url.pathname === "/api/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      return json(res, 200, {
        openaiKey: process.env.OPENAI_API_KEY || "",
        openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
        deepgramKey: process.env.DEEPGRAM_API_KEY || "",
        deepgramModel: process.env.DEEPGRAM_MODEL || "nova-3",
        deepgramVoice: process.env.DEEPGRAM_VOICE || "aura-2-thalia-en"
      });
    }

    if (req.method === "POST" && url.pathname === "/api/memory/query") {
      const body = await readJson(req);
      const query = String(body.query || "").trim();
      const maxResults = Number(body.maxResults || 5);
      if (!query) {
        return json(res, 400, { error: "query is required" });
      }
      const index = await ensureMemoryIndex();
      const queryEmbedding = await embedText(query);
      const results = index
        .map((item) => ({ ...item, score: cosineSimilarity(queryEmbedding, item.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(({ id, title, text, source, score }) => ({ id, title, text, source, score }));
      return json(res, 200, { results });
    }

    return json(res, 404, { error: "not found" });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: String(error) });
  }
});

server.listen(8787, () => {
  console.log("API server listening on http://localhost:8787");
  ensureMemoryIndex().then((index) => {
    console.log("Memory index ready with " + index.length + " chunks.");
  }).catch((error) => {
    console.error("Memory warmup failed:", error);
  });
});

async function ensureMemoryIndex() {
  if (!memoryIndexPromise) {
    memoryIndexPromise = buildMemoryIndex();
  }
  return memoryIndexPromise;
}

async function buildMemoryIndex() {
  const corpus = await loadCorpusDocuments();
  const chunks = corpus.flatMap((doc) => chunkDocument(doc));
  const corpusHash = hashCorpus(chunks);
  const cached = await readCachedIndex(corpusHash);
  if (cached) {
    return cached;
  }
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is missing. Memory index disabled.");
    return [];
  }
  const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
  const indexed = chunks.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings[index]
  }));
  await writeCachedIndex(corpusHash, indexed);
  return indexed;
}

async function loadCorpusDocuments() {
  const files = [
    { title: "DM Skill", source: "skill", path: path.join(process.env.USERPROFILE || "C:\\Users\\dell", ".codex", "skills", "dnd-5e-2014-dm", "SKILL.md") },
    { title: "Adjudication Checklist", source: "skill", path: path.join(process.env.USERPROFILE || "C:\\Users\\dell", ".codex", "skills", "dnd-5e-2014-dm", "references", "adjudication-checklist.md") },
    { title: "DM Agent Prompt", source: "prompt", path: path.join(rootDir, "prompts", "dm-agent-system.md") },
    { title: "DM Voice Prompt", source: "prompt", path: path.join(rootDir, "sole.md") },
    { title: "Character Sheets", source: "docs", path: path.join(rootDir, "docs", "character-sheets.md") },
    { title: "Rules Corpus", source: "rules", path: path.join(rootDir, "data", "rules-corpus.md") }
  ];

  const docs = [];
  for (const file of files) {
    if (existsSync(file.path)) {
      docs.push({
        title: file.title,
        source: file.source,
        text: await readFile(file.path, "utf8")
      });
    }
  }
  return docs;
}

function chunkDocument(doc) {
  const parts = doc.text
    .split(/\n(?=#|##|###|\- )/g)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.map((text, index) => ({
    id: doc.source + "-" + index,
    title: doc.title,
    source: doc.source,
    text
  }));
}

async function embedText(text) {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

async function embedTexts(inputs) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: inputs
    })
  });
  if (!response.ok) {
    throw new Error("Embedding request failed: " + response.status);
  }
  const payload = await response.json();
  return payload.data.map((item) => item.embedding);
}

function hashCorpus(chunks) {
  const hash = createHash("sha256");
  hash.update(embeddingModel);
  chunks.forEach((chunk) => {
    hash.update(chunk.id);
    hash.update(chunk.title);
    hash.update(chunk.source);
    hash.update(chunk.text);
  });
  return hash.digest("hex");
}

async function readCachedIndex(corpusHash) {
  if (!existsSync(memoryCachePath)) {
    return null;
  }
  try {
    const raw = await readFile(memoryCachePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.corpusHash !== corpusHash || !Array.isArray(parsed.index)) {
      return null;
    }
    return parsed.index;
  } catch (error) {
    console.warn("Failed to read memory cache:", error);
    return null;
  }
}

async function writeCachedIndex(corpusHash, index) {
  try {
    await mkdir(path.dirname(memoryCachePath), { recursive: true });
    await writeFile(memoryCachePath, JSON.stringify({
      corpusHash,
      model: embeddingModel,
      createdAt: new Date().toISOString(),
      index
    }));
  } catch (error) {
    console.warn("Failed to write memory cache:", error);
  }
}

function cosineSimilarity(left, right) {
  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i];
    leftMag += left[i] * left[i];
    rightMag += right[i] * right[i];
  }
  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(body));
}
