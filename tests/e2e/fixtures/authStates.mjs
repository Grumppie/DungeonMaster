import fs from "node:fs";
import path from "node:path";

const authDir = path.resolve(process.cwd(), "playwright/.auth");

export const hostAuthStatePath = path.join(authDir, "host.json");
export const guestAuthStatePath = path.join(authDir, "guest.json");

export function ensureAuthStateDir() {
  fs.mkdirSync(authDir, { recursive: true });
}

export function requireAuthState(filePath, role) {
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  const fileName = path.basename(filePath);
  throw new Error(
    `Missing Playwright auth state for ${role} at ${filePath}. Run "npm run test:e2e:bootstrap:${fileName.replace(".json", "")}" first.`,
  );
}
