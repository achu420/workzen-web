import { ReactComponent as ToggleListIcon } from '@/assets/icons/toggle_list.svg';

import { useTranslation } from 'react-i18next';

function OutlineIcon({
  isExpanded,
  setIsExpanded,
  level,
}: {
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  level: number;
}) {
  const { t } = useTranslation();

  if (isExpanded) {
    return (
      <button
        data-testid="outline-toggle-collapse"
        type="button"
        aria-label={t('sideBar.collapsePage', { defaultValue: 'Collapse' })}
        aria-expanded={true}
        style={{
          paddingLeft: 1.125 * level + 'em',
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(false);
        }}
        className={'opacity-50 hover:opacity-100'}
      >
        <ToggleListIcon className={'rotate-90 transform rounded-[2px] hover:bg-fill-content-hover'} />
      </button>
    );
  }

  return (
    <button
      data-testid="outline-toggle-expand"
      type="button"
      aria-label={t('sideBar.expandPage', { defaultValue: 'Expand' })}
      aria-expanded={false}
      style={{
        paddingLeft: 1.125 * level + 'em',
      }}
      className={'opacity-50 hover:opacity-100'}
      onClick={(e) => {
        e.stopPropagation();
        setIsExpanded(true);
      }}
    >
      <ToggleListIcon className={'rounded-[2px] hover:bg-fill-content-hover'} />
    </button>
  );
}

export default OutlineIcon;
