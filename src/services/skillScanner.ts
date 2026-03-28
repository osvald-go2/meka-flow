import { SkillInfo } from '../types';
import { getAgentType } from '../models';

const MOCK_SKILLS: SkillInfo[] = [
  { name: 'commit', description: 'Create a git commit with AI-generated message', filePath: 'mock', source: 'project' },
  { name: 'review-pr', description: 'Review a pull request for issues and improvements', filePath: 'mock', source: 'project' },
  { name: 'test-runner', description: 'Run project test suite and analyze failures', filePath: 'mock', source: 'user', pluginName: 'superpowers' },
  { name: 'refactor', description: 'Refactor selected code for better readability', filePath: 'mock', source: 'user', pluginName: 'superpowers' },
  { name: 'explain-code', description: 'Explain how a piece of code works', filePath: 'mock', source: 'user', pluginName: 'superpowers' },
  { name: 'fix-bug', description: 'Diagnose and fix a bug from error output', filePath: 'mock', source: 'project' },
  { name: 'create-test', description: 'Generate unit tests for a function or module', filePath: 'mock', source: 'project' },
  { name: 'polish', description: 'Final quality pass before shipping', filePath: 'mock', source: 'user', pluginName: 'impeccable' },
];

function isElectron(): boolean {
  return typeof window !== 'undefined' && window.aiBackend !== undefined;
}

export async function scanSkills(model: string, projectDir?: string | null): Promise<SkillInfo[]> {
  const platform = getAgentType(model);

  if (isElectron() && projectDir) {
    try {
      const scanned = await window.aiBackend.scanSkills(platform, projectDir);

      // Merge with system-level skills — real scanned skills take priority
      const seen = new Set(scanned.map((s: SkillInfo) => s.name));
      const merged = [...scanned, ...MOCK_SKILLS.filter(s => !seen.has(s.name))];
      return merged;
    } catch (e) {
      console.warn('[skillScanner] scan failed, falling back to mock:', e);
      return MOCK_SKILLS;
    }
  }

  // Browser mock
  return MOCK_SKILLS;
}
