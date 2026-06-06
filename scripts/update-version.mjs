import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const publicDir = join(process.cwd(), "public");
const versionFile = join(publicDir, "version.json");
const version = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

mkdirSync(publicDir, { recursive: true });
writeFileSync(versionFile, `${JSON.stringify({ version }, null, 2)}\n`);

console.log(`App version: ${version}`);
