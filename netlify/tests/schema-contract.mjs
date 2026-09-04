import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, "..", "database", "001_initial.sql"), "utf8");

const requiredTables = [
  "users",
  "campaigns",
  "campaign_memberships",
  "character_templates",
  "characters",
];

for (const table of requiredTables) {
  if (!new RegExp(`CREATE TABLE\\s+${table}\\s*\\(`, "i").test(schema)) {
    throw new Error(`Missing required table: ${table}`);
  }
}

const requiredGuards = [
  "CHECK (role IN ('admin', 'dm', 'player'))",
  "UNIQUE (campaign_id, user_id)",
  "REFERENCES users(id) ON DELETE RESTRICT",
  "REFERENCES campaigns(id) ON DELETE CASCADE",
  "JSONB NOT NULL",
];

for (const guard of requiredGuards) {
  if (!schema.includes(guard)) {
    throw new Error(`Missing schema guard: ${guard}`);
  }
}

if (/CREATE TABLE\s+(sessions|tokens)\b/i.test(schema)) {
  throw new Error("Session/token persistence must be designed explicitly, not added implicitly to the initial domain migration.");
}

console.log("Netlify database schema contract passed.");
