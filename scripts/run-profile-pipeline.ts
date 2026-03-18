/**
 * Run the profile pipeline against writing samples in the DB.
 * Usage: ANTHROPIC_API_KEY=... npx tsx scripts/run-profile-pipeline.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import Database from "better-sqlite3";
import { listWritingSamples } from "../server/db/repositories/writing-samples.js";
import { runPipeline } from "../server/profile/pipeline.js";
import { createDefaultPipelineConfig } from "../src/profile/types.js";

async function main() {
  const db = new Database("./data/word-compiler.db");
  const samples = listWritingSamples(db);
  db.close();

  console.log(`Found ${samples.length} writing samples:`);
  for (const s of samples) {
    console.log(`  - ${s.filename ?? "untitled"} (${s.domain}, ${s.wordCount} words)`);
  }

  if (samples.length === 0) {
    console.error("No writing samples found in DB");
    process.exit(1);
  }

  const config = createDefaultPipelineConfig();
  config.sourceDomain = "tech_journalism";
  config.targetDomain = "literary_fiction";

  const client = new Anthropic();
  const guide = await runPipeline(samples, config, client);

  console.log("---GUIDE_JSON---");
  console.log(JSON.stringify(guide, null, 2));
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
