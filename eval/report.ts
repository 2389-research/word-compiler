import type { EvalRunArtifact, EvalReport } from "./types.js";

export function generateReport(artifact: EvalRunArtifact): EvalReport {
  const detPassed = artifact.deterministicChecks.filter((c) => c.passed).length;
  const detTotal = artifact.deterministicChecks.length;
  const detRate = detTotal > 0 ? detPassed / detTotal : 1;

  const judgePassed = artifact.judgeScores.filter((s) => s.passed).length;
  const judgeTotal = artifact.judgeScores.length;
  const judgeRate = judgeTotal > 0 ? judgePassed / judgeTotal : 1;

  const failures: string[] = [];

  for (const check of artifact.deterministicChecks) {
    if (!check.passed) {
      failures.push(`[DET] ${check.name}: ${check.detail}`);
    }
  }
  for (const score of artifact.judgeScores) {
    if (!score.passed) {
      failures.push(`[JUDGE] ${score.dimension}: score ${score.score} — ${score.reasoning.slice(0, 120)}`);
    }
  }

  const summary = artifact.overallPass
    ? `PASS — ${detPassed}/${detTotal} deterministic, ${judgePassed}/${judgeTotal} judge checks passed.`
    : `FAIL — ${failures.length} failure(s). See details below.`;

  const markdown = buildMarkdownReport(artifact, detRate, judgeRate, failures);

  return {
    summary,
    deterministicPassRate: detRate,
    judgePassRate: judgeRate,
    overallPass: artifact.overallPass,
    failures,
    markdown,
  };
}

function buildMarkdownReport(
  artifact: EvalRunArtifact,
  detRate: number,
  judgeRate: number,
  failures: string[],
): string {
  const lines: string[] = [];

  lines.push(`# Eval Report — ${artifact.runId}`);
  lines.push(`**Date:** ${artifact.timestamp}`);
  lines.push(`**Generator:** ${artifact.generatorModel} | **Judge:** ${artifact.judgeModel}`);
  lines.push(`**Bible version:** ${artifact.bibleVersion}`);
  lines.push(`**Overall:** ${artifact.overallPass ? "PASS" : "FAIL"}`);
  lines.push("");

  // Scores summary
  lines.push("## Scores");
  lines.push(`- Voice consistency: ${artifact.voiceConsistencyScore.toFixed(1)}`);
  lines.push(`- Continuity: ${artifact.continuityScore.toFixed(1)}`);
  lines.push(`- Deterministic pass rate: ${(detRate * 100).toFixed(0)}%`);
  lines.push(`- Judge pass rate: ${(judgeRate * 100).toFixed(0)}%`);
  lines.push("");

  // Deterministic checks
  lines.push("## Deterministic Checks");
  for (const check of artifact.deterministicChecks) {
    const icon = check.passed ? "[PASS]" : "[FAIL]";
    lines.push(`- ${icon} **${check.name}**: ${check.detail}`);
  }
  lines.push("");

  // Judge scores
  if (artifact.judgeScores.length > 0) {
    lines.push("## Judge Evaluations");
    for (const score of artifact.judgeScores) {
      const icon = score.passed ? "[PASS]" : "[FAIL]";
      lines.push(`- ${icon} **${score.dimension}**: ${score.score} — ${score.reasoning.slice(0, 200)}`);
    }
    lines.push("");
  }

  // Failures
  if (failures.length > 0) {
    lines.push("## Failures");
    for (const f of failures) {
      lines.push(`- ${f}`);
    }
    lines.push("");
  }

  // Per-scene summary
  lines.push("## Per-Scene Summary");
  for (const scene of artifact.scenes) {
    const totalWords = scene.chunks.reduce((sum, c) => sum + c.metrics.wordCount, 0);
    const totalFlags = scene.chunks.reduce((sum, c) => sum + c.auditFlags.length, 0);
    lines.push(`- **${scene.sceneId}**: ${totalWords} words, ${scene.chunks.length} chunks, ${totalFlags} audit flags`);
  }
  lines.push("");

  // Cost
  lines.push("## Cost");
  lines.push(`- Generator: ${artifact.cost.generatorInputTokens} in / ${artifact.cost.generatorOutputTokens} out`);
  lines.push(`- Judge: ${artifact.cost.judgeInputTokens} in / ${artifact.cost.judgeOutputTokens} out`);

  return lines.join("\n");
}
