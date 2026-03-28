export function buildGeneratorPrompt(sprint: number, planContent: string): string {
  return `## Harness Task [Sprint ${sprint}]

You are a Generator. Implement the following plan.

### Plan
${planContent}

### Requirements
- Output your implementation result and key decisions
- If anything is unclear, use your best judgment`;
}

export function buildEvaluatorPrompt(
  sprint: number,
  round: number,
  planContent: string,
  resultContent: string
): string {
  return `## Harness Review [Sprint ${sprint}, Round ${round}]

You are an Evaluator. Evaluate the implementation against the plan.

### Original Plan
${planContent}

### Implementation Result
${resultContent}

### Evaluation Requirements
- Score on: functional completeness, code quality, plan adherence (1-10 each)
- Final verdict: PASS or FAIL
- If FAIL, provide specific revision suggestions
- Last line MUST be: \`VERDICT: PASS\` or \`VERDICT: FAIL\``;
}

export function buildRevisionPrompt(
  sprint: number,
  round: number,
  planContent: string,
  resultContent: string,
  reviewContent: string
): string {
  return `## Harness Revision [Sprint ${sprint}, Round ${round}]

You are a Generator. The Evaluator rejected your implementation. Revise based on feedback.

### Original Plan
${planContent}

### Your Previous Implementation
${resultContent}

### Evaluator Feedback
${reviewContent}

### Requirements
- Address each feedback item
- Output the complete revised result`;
}

export type Verdict = 'PASS' | 'FAIL' | 'UNPARSEABLE';

export function parseVerdict(evaluatorOutput: string): Verdict {
  const lines = evaluatorOutput.trim().split('\n');
  // Search from the end for the VERDICT line
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === 'VERDICT: PASS') return 'PASS';
    if (line === 'VERDICT: FAIL') return 'FAIL';
  }
  return 'UNPARSEABLE';
}
