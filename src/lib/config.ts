import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Env = Record<string, string | undefined>;

/**
 * `FOO_FILE` wins over `FOO`, uniformly for every variable rather than only
 * for secrets. One rule means there is no table of which names are "secret"
 * to keep in sync, and it costs the same five lines either way. The file
 * form is what sops-nix and systemd's LoadCredential produce.
 */
export function readEnv(name: string, env: Env = process.env): string | undefined {
  const file = env[`${name}_FILE`];
  if (file) {
    const value = readFileSync(file, "utf8").trim();
    return value === "" ? undefined : value;
  }
  const value = env[name];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

export interface Config {
  host: string;
  port: number;
  stateDir: string;
  dbPath: string;
  uploadsDir: string;
  siteUrl: string;
  blogUrl: string;
  siteHost: string;
  blogHost: string;
  adminUsername: string;
  adminPasswordHash: string;
}

export function loadConfig(env: Env = process.env): Config {
  const missing: string[] = [];
  const require_ = (name: string): string => {
    const value = readEnv(name, env);
    if (value === undefined) missing.push(name);
    return value ?? "";
  };

  const stateDir = readEnv("PORTFOLIO_STATE_DIR", env) ?? "/var/lib/portfolio";
  const siteUrl = require_("PORTFOLIO_SITE_URL");
  const blogUrl = require_("PORTFOLIO_BLOG_URL");
  const adminPasswordHash = require_("PORTFOLIO_ADMIN_PASSWORD_HASH");

  if (missing.length > 0) {
    throw new Error(
      `missing required configuration: ${missing
        .map((n) => `${n} (or ${n}_FILE)`)
        .join(", ")}`,
    );
  }

  return {
    host: readEnv("PORTFOLIO_HOST", env) ?? "127.0.0.1",
    port: Number(readEnv("PORTFOLIO_PORT", env) ?? "4321"),
    stateDir,
    dbPath: readEnv("PORTFOLIO_DB_PATH", env) ?? join(stateDir, "portfolio.db"),
    uploadsDir: readEnv("PORTFOLIO_UPLOADS_DIR", env) ?? join(stateDir, "uploads"),
    siteUrl: siteUrl.replace(/\/+$/, ""),
    blogUrl: blogUrl.replace(/\/+$/, ""),
    siteHost: new URL(siteUrl).host,
    blogHost: new URL(blogUrl).host,
    adminUsername: readEnv("PORTFOLIO_ADMIN_USERNAME", env) ?? "admin",
    adminPasswordHash,
  };
}

let cached: Config | undefined;

/**
 * Memoised rather than evaluated at import time: `astro build` imports every
 * module, and a build should never need production secrets to succeed.
 */
export function getConfig(): Config {
  cached ??= loadConfig();
  return cached;
}
