import type { AIProviderModel } from '@/application/services/domains/ai-settings';

export const MAX_RENDERED_MODELS = 200;

export function formatContextLength(length?: number): string | null {
  if (!length || length <= 0) return null;
  if (length >= 1_000_000) return `${Number((length / 1_000_000).toFixed(1))}M`;
  if (length >= 1000) return `${Math.round(length / 1000)}k`;
  return String(length);
}

export function filterModels(models: AIProviderModel[], query: string): AIProviderModel[] {
  const needle = query.trim().toLowerCase();

  if (!needle) return models;
  return models.filter((model) => model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle));
}
