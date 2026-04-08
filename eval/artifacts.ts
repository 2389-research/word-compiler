import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { EvalRunArtifact } from "./types.js";

const DEFAULT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "runs");

export function saveArtifact(artifact: EvalRunArtifact, dir: string = DEFAULT_DIR): string {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${artifact.runId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2), "utf-8");
  return filePath;
}

export function loadArtifact(runId: string, dir: string = DEFAULT_DIR): EvalRunArtifact | null {
  const filePath = path.join(dir, `${runId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as EvalRunArtifact;
}

export function listArtifacts(
  dir: string = DEFAULT_DIR,
): Array<{ runId: string; timestamp: string; overallPass: boolean }> {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      const artifact = JSON.parse(raw) as EvalRunArtifact;
      return {
        runId: artifact.runId,
        timestamp: artifact.timestamp,
        overallPass: artifact.overallPass,
      };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
