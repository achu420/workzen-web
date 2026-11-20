import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AIProviderModel } from '@/application/services/domains/ai-settings';
import { ReactComponent as CheckIcon } from '@/assets/icons/check.svg';
import { ReactComponent as CloseIcon } from '@/assets/icons/close.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { ModelBadges } from './ModelCombobox';
import { filterModels, MAX_RENDERED_MODELS } from './modelUtils';

interface ModelMultiSelectProps {
  models: AIProviderModel[];
  value: string[];
  onChange: (models: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
  container?: HTMLElement | null;
}

/** Chips plus a searchable checklist. An empty selection means every model is offered. */
export function ModelMultiSelect({ models, value, onChange, loading, disabled, container }: ModelMultiSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const matches = useMemo(() => filterModels(models, query), [models, query]);
  const selected = useMemo(() => new Set(value), [value]);
  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((item) => item !== id) : [...value, id]);

  return (
    <div className='flex flex-col gap-2' data-testid='ai-enabled-models'>
      <div className='flex flex-wrap items-center gap-1.5'>
        {value.length === 0 && (
          <span className='text-sm text-text-secondary' data-testid='ai-all-models'>
            {t('settings.aiProvider.allModels', { defaultValue: 'All models' })}
          </span>
        )}
        {value.map((id) => (
          <span
            key={id}
            data-testid={`ai-model-chip-${id}`}
            className='flex max-w-full items-center gap-1 rounded-full bg-fill-content-hover py-0.5 pl-2.5 pr-1 text-xs text-text-primary'
          >
            <span className='truncate'>{id}</span>
            <button
              type='button'
              disabled={disabled}
              aria-label={t('settings.aiProvider.removeModel', { defaultValue: 'Remove {{model}}', model: id })}
              className='rounded-full p-0.5 hover:bg-fill-content-hover'
              onClick={() => toggle(id)}
            >
              <CloseIcon className='h-3 w-3' />
            </button>
          </span>
        ))}
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setQuery('');
          }}
        >
          <PopoverTrigger asChild>
            <Button type='button' variant='outline' size='sm' disabled={disabled} data-testid='ai-enabled-models-add'>
              {t('settings.aiProvider.chooseModels', { defaultValue: 'Choose models' })}
            </Button>
          </PopoverTrigger>
          <PopoverContent align='start' container={container} className='w-[420px] max-w-[90vw] p-2'>
            <Input
              autoFocus
              className='w-full'
              value={query}
              placeholder={t('settings.aiProvider.searchModels', { defaultValue: 'Search or type a model id' })}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className='appflowy-scroller mt-2 max-h-[260px] overflow-y-auto'>
              {loading && (
                <div className='px-2 py-3 text-sm text-text-secondary'>
                  {t('settings.aiProvider.loadingModels', { defaultValue: 'Loading models...' })}
                </div>
              )}
              {!loading && matches.length === 0 && (
                <div className='px-2 py-3 text-sm text-text-secondary'>
                  {t('settings.aiProvider.noModels', { defaultValue: 'No models found' })}
                </div>
              )}
              {matches.slice(0, MAX_RENDERED_MODELS).map((model) => (
                <button
                  type='button'
                  key={model.id}
                  role='checkbox'
                  aria-checked={selected.has(model.id)}
                  data-testid={`ai-enabled-option-${model.id}`}
                  className='flex w-full items-center gap-2 rounded-300 px-2 py-1.5 text-left text-sm hover:bg-fill-content-hover'
                  onClick={() => toggle(model.id)}
                >
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-primary', selected.has(model.id) && 'border-fill-theme-thick bg-fill-theme-thick text-text-on-fill')}>
                    {selected.has(model.id) && <CheckIcon className='h-3 w-3' />}
                  </span>
                  <span className='min-w-0 flex-1 truncate text-text-primary'>{model.name || model.id}</span>
                  <ModelBadges model={model} />
                </button>
              ))}
              {matches.length > MAX_RENDERED_MODELS && (
                <div className='px-2 py-2 text-xs text-text-tertiary'>
                  {t('settings.aiProvider.keepTyping', { defaultValue: 'Showing the first {{count}} - keep typing to narrow the list', count: MAX_RENDERED_MODELS })}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <p className='text-xs text-text-tertiary'>
        {t('settings.aiProvider.enabledModelsHelp', { defaultValue: 'Only these models appear in the AI chat and editor model pickers. Leave empty to show all models.' })}
      </p>
    </div>
  );
}
