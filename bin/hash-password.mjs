#!/usr/bin/env node
// Generates the value for PORTFOLIO_ADMIN_PASSWORD_HASH_FILE.
// Reads the password from stdin when piped, otherwise prompts without echo.
import { createInterface } from "node:readline";
import { randomBytes, scryptSync } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

// Duplicated from src/lib/auth.ts rather than imported: this script has to
// run from a bare checkout and from the installed package, neither of which
// has the built server bundle on a predictable path.
function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8").trim();
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: true,
  });
  process.stderr.write("Password: ");
  rl.output.write = () => {}; // suppress echo
  const password = await new Promise((resolve) => rl.question("", resolve));
  rl.close();
  process.stderr.write("\n");
  return password.trim();
}

const password = await readPassword();
if (!password) {
  process.stderr.write("no password given\n");
  process.exit(1);
}
process.stdout.write(`${hashPassword(password)}\n`);
