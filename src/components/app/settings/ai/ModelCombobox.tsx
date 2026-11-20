import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AIProviderModel } from '@/application/services/domains/ai-settings';
import { ReactComponent as ArrowDownIcon } from '@/assets/icons/arrow_down.svg';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { filterModels, formatContextLength, MAX_RENDERED_MODELS } from './modelUtils';

interface ModelComboboxProps {
  models: AIProviderModel[];
  value: string;
  onChange: (model: string) => void;
  loading?: boolean;
  disabled?: boolean;
  container?: HTMLElement | null;
}

export function ModelBadges({ model }: { model: AIProviderModel }) {
  const { t } = useTranslation();
  const context = formatContextLength(model.context_length);

  return (
    <span className='flex shrink-0 items-center gap-1.5 text-xs text-text-tertiary'>
      {model.supports_vision && (
        <span className='rounded bg-fill-content-hover px-1.5 py-0.5 text-text-secondary' data-testid='model-vision-badge'>
          {t('settings.aiProvider.vision', { defaultValue: 'Vision' })}
        </span>
      )}
      {context && <span>{t('settings.aiProvider.context', { defaultValue: '{{size}} context', size: context })}</span>}
    </span>
  );
}

/** Searchable single-select. A model id that is not in the list can still be typed and used. */
export function ModelCombobox({ models, value, onChange, loading, disabled, container }: ModelComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const matches = useMemo(() => filterModels(models, query), [models, query]);
  const typed = query.trim();
  const canUseTyped = typed.length > 0 && !models.some((model) => model.id === typed);
  const select = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type='button'
          disabled={disabled}
          data-testid='ai-model-trigger'
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-300 border border-border-primary bg-fill-content px-3 text-left text-sm text-text-primary hover:border-border-primary-hover disabled:cursor-not-allowed disabled:text-text-tertiary'
          )}
        >
          <span className={cn('truncate', !value && 'text-text-tertiary')}>
            {value || t('settings.aiProvider.modelPlaceholder', { defaultValue: 'Choose a model' })}
          </span>
          <ArrowDownIcon className='h-4 w-4 shrink-0 text-icon-secondary' />
        </button>
      </PopoverTrigger>
      <PopoverContent align='start' container={container} className='w-[420px] max-w-[90vw] p-2'>
        <Input
          autoFocus
          className='w-full'
          value={query}
          data-testid='ai-model-search'
          placeholder={t('settings.aiProvider.searchModels', { defaultValue: 'Search or type a model id' })}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && typed) {
              event.preventDefault();
              select(matches.length === 1 ? matches[0].id : typed);
            }
          }}
        />
        <div className='appflowy-scroller mt-2 max-h-[260px] overflow-y-auto'>
          {loading && (
            <div className='px-2 py-3 text-sm text-text-secondary'>
              {t('settings.aiProvider.loadingModels', { defaultValue: 'Loading models...' })}
            </div>
          )}
          {!loading && matches.length === 0 && !canUseTyped && (
            <div className='px-2 py-3 text-sm text-text-secondary'>
              {t('settings.aiProvider.noModels', { defaultValue: 'No models found' })}
            </div>
          )}
          {canUseTyped && (
            <button
              type='button'
              data-testid='ai-model-use-typed'
              className='flex w-full items-center rounded-300 px-2 py-1.5 text-left text-sm text-text-action hover:bg-fill-content-hover'
              onClick={() => select(typed)}
            >
              {t('settings.aiProvider.useTyped', { defaultValue: 'Use "{{model}}"', model: typed })}
            </button>
          )}
          {matches.slice(0, MAX_RENDERED_MODELS).map((model) => (
            <button
              type='button'
              key={model.id}
              data-testid={`ai-model-option-${model.id}`}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-300 px-2 py-1.5 text-left text-sm hover:bg-fill-content-hover',
                model.id === value && 'bg-fill-content-hover'
              )}
              onClick={() => select(model.id)}
            >
              <span className='min-w-0'>
                <span className='block truncate text-text-primary'>{model.name || model.id}</span>
                {model.name && model.name !== model.id && (
                  <span className='block truncate text-xs text-text-tertiary'>{model.id}</span>
                )}
              </span>
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
  );
}
