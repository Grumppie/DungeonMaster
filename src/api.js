let resolvedApiBase = null;

function currentHost() {
  if (typeof window === "undefined" || !window.location?.hostname) {
    return "127.0.0.1";
  }
  return window.location.hostname;
}

function candidateApiBases() {
  const host = currentHost();
  return [
    "/api",
    `http://${host}:8000/api`,
    "http://127.0.0.1:8000/api",
    "http://localhost:8000/api",
  ];
}

function unique(values) {
  return [...new Set(values)];
}

export function getApiAssetUrl(path) {
  const base = resolvedApiBase || `http://${currentHost()}:8000/api`;
  return `${base}${path}`;
}

export async function fetchApiJson(path) {
  let lastError = null;
  for (const base of unique(resolvedApiBase ? [resolvedApiBase, ...candidateApiBases()] : candidateApiBases())) {
    try {
      const response = await fetch(`${base}${path}`);
      if (!response.ok) {
        throw new Error(`${path} failed with ${response.status}`);
      }
      resolvedApiBase = base;
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `API unavailable. Start FastAPI on port 8000 with \`npm run dev:api\` or \`python -m uvicorn server.app:app --reload --port 8000\`. ${String(lastError)}`
  );
}

export async function postApiJson(path, body) {
  let lastError = null;
  for (const base of unique(resolvedApiBase ? [resolvedApiBase, ...candidateApiBases()] : candidateApiBases())) {
    try {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`${path} failed with ${response.status}`);
      }
      resolvedApiBase = base;
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `API unavailable. Start FastAPI on port 8000 with \`npm run dev:api\` or \`python -m uvicorn server.app:app --reload --port 8000\`. ${String(lastError)}`
  );
}
