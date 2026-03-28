export type ProviderId = 'claude' | 'codex' | 'gemini';

export interface ModelVariant {
  id: string;
  name: string;
  cliFlag: string | null;
}

export interface ProviderDef {
  label: string;
  variants: ModelVariant[];
  defaultVariant: string;
}

export const MODEL_VARIANTS: Record<ProviderId, ProviderDef> = {
  claude: {
    label: 'Claude Code',
    variants: [
      { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', cliFlag: 'sonnet' },
      { id: 'claude-opus-4-6', name: 'Opus 4.6', cliFlag: 'opus' },
    ],
    defaultVariant: 'claude-sonnet-4-6',
  },
  codex: {
    label: 'Codex',
    variants: [
      { id: 'codex-gpt-5-4', name: 'GPT 5.4', cliFlag: 'gpt-5.4' },
      { id: 'codex-gpt-5-4-mini', name: 'GPT 5.4 Mini', cliFlag: 'gpt-5.4-mini' },
    ],
    defaultVariant: 'codex-gpt-5-4',
  },
  gemini: {
    label: 'Gemini CLI',
    variants: [
      { id: 'gemini-cli', name: 'Gemini CLI', cliFlag: null },
    ],
    defaultVariant: 'gemini-cli',
  },
};

export function getAgentType(model: string): ProviderId {
  if (model.startsWith('claude')) return 'claude';
  if (model.startsWith('codex')) return 'codex';
  return 'gemini';
}

export function getModelDisplayName(modelId: string): string {
  const provider = getAgentType(modelId);
  const variant = MODEL_VARIANTS[provider].variants.find(v => v.id === modelId);
  return variant?.name ?? modelId;
}

export function getModelFullLabel(modelId: string): string {
  const provider = getAgentType(modelId);
  const def = MODEL_VARIANTS[provider];
  const variant = def.variants.find(v => v.id === modelId);
  return variant ? `${def.label} · ${variant.name}` : modelId;
}

export function getSiblingVariants(modelId: string): ModelVariant[] {
  const provider = getAgentType(modelId);
  return MODEL_VARIANTS[provider].variants;
}

export function migrateModel(model: string): string {
  if (model === 'claude-code') return 'claude-sonnet-4-6';
  if (model === 'codex') return 'codex-gpt-5-4';
  return model;
}
