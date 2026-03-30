# Convex Vector Store Plan

This repo can use Convex as the primary vector store. It already has the important base pieces:

- `corpusChunks.embedding` with a Convex `vectorIndex`
- semantic retrieval through `ctx.vectorSearch(...)`
- a corpus ingestion script that chunks, embeds, and imports data

That means the next step is not proving feasibility. The next step is hardening the current approach so it works for a hosted product.

## Current State

- Schema:
  - `corpusSources`
  - `corpusChunks`
- Search:
  - semantic retrieval in `convex/domain/retrieval/semanticSearch.js`
  - lexical fallback in `convex/corpusActions.js`
- Bulk ingestion:
  - `scripts/ingest-corpus.mjs`

## What Convex Should Own

Convex should own:

- document metadata
- chunk records
- embeddings
- vector search
- retrieval filtering
- ingestion job state

The frontend host should only own upload and query UX. The vector data should live with the Convex backend so retrieval, session scoping, and future agent tooling stay in one place.

## Recommended Architecture

### Keep the current custom table approach

Do not switch stores yet.

The repo already has a working low-level Convex vector path. Keep that, then add production constraints around it. Only move to a dedicated external vector database if scale or cross-product retrieval needs clearly exceed Convex.

### Add retrieval scoping

Right now the dangerous gap is global retrieval scope.

Add a scoping field to both `corpusSources` and `corpusChunks`, for example:

- `namespace`
- `ownerId`
- `campaignId`

Then add that field to the vector index `filterFields` and require it in retrieval requests. That prevents one campaign, tenant, or user from retrieving another campaign's content.

### Split ingestion into two modes

Use two ingestion paths:

1. Bulk seed path
   - Keep `scripts/ingest-corpus.mjs`
   - Use it for local seeding, test corpora, and large curated imports

2. Product ingestion path
   - Add backend ingestion jobs inside Convex
   - Use that for hosted user uploads and pasted content

The hosted app should not depend on `npx convex import`.

## Production Ingestion Flow

### Tables to add

- `knowledgeDocuments`
  - document metadata
  - ownership / namespace
  - raw text or file reference
  - ingest status
- `knowledgeImports`
  - job status
  - counts
  - failure reason
  - started / completed timestamps

### Backend flow

1. Client uploads text or file metadata
2. Mutation creates a `knowledgeDocument`
3. Mutation or scheduler creates a `knowledgeImport` job
4. Action parses and chunks content
5. Action generates embeddings
6. Mutation inserts chunk rows into `corpusChunks`
7. Mutation marks source and import job as ready

## Retrieval Flow

Update retrieval to require scope filters such as:

- `namespace`
- `campaignId`
- optional `sourceKey`
- optional `rulesDomain`

That should be threaded through:

- `convex/corpusActions.js`
- `convex/domain/retrieval/semanticSearch.js`
- any runtime retrieval request builders

## Deployment Shape

If the frontend is hosted separately, keep the split simple:

- frontend host: upload UI, play UI, account UX
- Convex: database, vector search, ingestion jobs, agent retrieval

For a Vercel-style deployment, deploy the frontend and Convex together but keep retrieval data fully inside Convex.

## First Implementation Slice

The first safe production slice should be:

1. Add `namespace` to `corpusSources`
2. Add `namespace` to `corpusChunks`
3. Add `namespace` to the vector index filter fields
4. Thread `namespace` through semantic retrieval
5. Add `knowledgeDocuments`
6. Add `knowledgeImports`
7. Add one hosted ingestion path for pasted text

That gets the system from local corpus seeding to a deployable multi-tenant retrieval model.

## Notes

- Convex vector search is already enough for this repo's current scale.
- `npx convex import` is still useful for bulk bootstrap, but it is not the right primitive for end-user ingestion in production.
- If the hosted platform name was meant to be Vercel or another frontend host, the architecture above still holds.
