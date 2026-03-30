export default async function globalSetup(config) {
  const { baseURL } = config.projects[0]?.use ?? {};

  if (!baseURL) {
    throw new Error("Playwright baseURL is not configured.");
  }

  const candidateUrls = [baseURL];
  if (baseURL.includes("localhost")) {
    candidateUrls.push(baseURL.replace("localhost", "127.0.0.1"));
  } else if (baseURL.includes("127.0.0.1")) {
    candidateUrls.push(baseURL.replace("127.0.0.1", "localhost"));
  }

  const attempted = [];
  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      attempted.push(`${url} -> ${response.status}`);
      if (response.ok || response.status === 302 || response.status === 304) {
        return;
      }
    } catch (error) {
      attempted.push(`${url} -> ${String(error)}`);
    }
  }

  throw new Error(
    `Playwright could not reach the local app. Start it with "npm run dev" before running E2E tests.\nAttempts:\n${attempted.join("\n")}`,
  );
}
