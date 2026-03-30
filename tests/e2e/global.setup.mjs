export default async function globalSetup(config) {
  const { baseURL } = config.projects[0]?.use ?? {};

  if (!baseURL) {
    throw new Error("Playwright baseURL is not configured.");
  }

  let response;
  try {
    response = await fetch(baseURL, { redirect: "manual" });
  } catch (error) {
    throw new Error(
      `Playwright could not reach ${baseURL}. Start the local app with "npm run dev" before running E2E tests.\n${String(error)}`,
    );
  }

  if (!response.ok && response.status !== 302 && response.status !== 304) {
    throw new Error(`Playwright reached ${baseURL}, but received unexpected status ${response.status}.`);
  }
}
