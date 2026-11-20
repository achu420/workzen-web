// eslint-disable-next-line import/no-unresolved
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { useIsOfficialHosted } from '@/components/app/hooks/useServerInfo';

import { VersionList } from '../DocumentHistoryVersionList';

import type { ComponentProps } from 'react';


jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/app/hooks/useServerInfo', () => ({ useIsOfficialHosted: jest.fn() }));

beforeEach(() => {
  jest.mocked(useIsOfficialHosted).mockReturnValue(true);
});

function listProps(): ComponentProps<typeof VersionList> {
  return {
    versions: [
      { versionId: 'latest', parentId: 'previous', name: 'Latest version', createdAt: new Date('2026-09-11'), deletedAt: null, editors: [1] },
      { versionId: 'previous', parentId: null, name: 'Previous version', createdAt: new Date('2026-09-10'), deletedAt: null, editors: [2] },
    ],
    selectedVersionId: 'latest',
    onSelect: jest.fn(),
    isPro: false,
    dateFilter: 'all',
    onlyShowMine: false,
    onDateFilterChange: jest.fn(),
    onOnlyShowMineChange: jest.fn(),
    onRestoreClicked: jest.fn(),
    onClose: jest.fn(),
  };
}

async function openFilters() {
  fireEvent.keyDown(screen.getByRole('button', { name: 'versionHistory.filter' }), { key: 'ArrowDown' });
  await screen.findByRole('menu');
}

test('free plans keep Only Yours available while extended date ranges remain gated', async () => {
  const props = listProps();
  const { rerender } = render(<VersionList {...props} />);

  expect(screen.getByText('versionHistory.upgrade')).toBeInTheDocument();
  await openFilters();
  expect(screen.getByRole('menuitem', { name: 'versionHistory.all' })).toBeInTheDocument();
  for (const range of ['last7Days', 'last30Days', 'last60Days']) {
    expect(screen.queryByRole('menuitem', { name: `versionHistory.${range}` })).not.toBeInTheDocument();
  }

  fireEvent.click(screen.getByRole('menuitem', { name: 'versionHistory.onlyYours' }));
  expect(props.onOnlyShowMineChange).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('menu')).toBeInTheDocument();

  rerender(<VersionList {...props} onlyShowMine />);
  fireEvent.click(screen.getByRole('menuitem', { name: 'versionHistory.onlyYours' }));
  expect(props.onOnlyShowMineChange).toHaveBeenLastCalledWith(false);
  expect(props.onDateFilterChange).not.toHaveBeenCalled();
});

test('Pro date filters forward each original range and keep the dropdown open', async () => {
  const props = listProps();

  render(<VersionList {...props} isPro />);
  expect(screen.queryByText('versionHistory.upgrade')).not.toBeInTheDocument();
  await openFilters();

  for (const range of ['last7Days', 'last30Days', 'last60Days', 'all']) {
    fireEvent.click(screen.getByRole('menuitem', { name: `versionHistory.${range}` }));
    expect(props.onDateFilterChange).toHaveBeenLastCalledWith(range);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  }

  expect(props.onDateFilterChange).toHaveBeenCalledTimes(4);
  expect(props.onOnlyShowMineChange).not.toHaveBeenCalled();
});

test('selection, restore, and close keep their document callbacks and test IDs', () => {
  const props = listProps();
  const { rerender } = render(<VersionList {...props} />);

  expect(screen.getByTestId('version-history-item-latest')).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByTestId('version-history-item-previous'));
  expect(props.onSelect).toHaveBeenCalledWith('previous');
  rerender(<VersionList {...props} selectedVersionId='previous' />);
  expect(screen.getByTestId('version-history-item-latest')).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByTestId('version-history-item-previous')).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByTestId('version-history-restore-button'));
  expect(props.onRestoreClicked).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId('version-history-close-button'));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('restore remains disabled without a selection or callback and busy during restoration', () => {
  const props = listProps();
  const { rerender } = render(<VersionList {...props} selectedVersionId='' />);
  const restoreButton = () => screen.getByTestId('version-history-restore-button');

  expect(restoreButton()).toBeDisabled();
  fireEvent.click(restoreButton());
  expect(props.onRestoreClicked).not.toHaveBeenCalled();

  rerender(<VersionList {...props} onRestoreClicked={undefined} />);
  expect(restoreButton()).toBeDisabled();

  rerender(<VersionList {...props} isRestoring />);
  expect(restoreButton()).toBeDisabled();
  expect(restoreButton()).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(restoreButton());
  expect(props.onRestoreClicked).not.toHaveBeenCalled();

  rerender(<VersionList {...props} isRestoring={false} />);
  expect(restoreButton()).toBeEnabled();
  expect(restoreButton()).not.toHaveAttribute('aria-busy');
  fireEvent.click(restoreButton());
  expect(props.onRestoreClicked).toHaveBeenCalledTimes(1);
});

// Unknown and self-hosted servers both keep cloud upgrade prompts hidden.
test('non-hosted free plans do not show the cloud upgrade banner', () => {
  jest.mocked(useIsOfficialHosted).mockReturnValue(false);
  render(<VersionList {...listProps()} />);

  expect(screen.queryByText('versionHistory.upgrade')).not.toBeInTheDocument();
  expect(screen.getByTestId('version-history-restore-button')).toBeEnabled();
});

describe('create snapshot', () => {
  test('control is visible but disabled without a handler', () => {
    render(<VersionList {...listProps()} />);
    expect(screen.getByTestId('version-history-create-snapshot-button')).toBeDisabled();
  });

  test('empty name is rejected without calling the API', () => {
    const onCreateSnapshot = jest.fn().mockResolvedValue(true);

    render(<VersionList {...listProps()} onCreateSnapshot={onCreateSnapshot} />);
    fireEvent.click(screen.getByTestId('version-history-create-snapshot-button'));
    fireEvent.click(screen.getByTestId('version-history-create-snapshot-confirm'));

    expect(onCreateSnapshot).not.toHaveBeenCalled();
    expect(screen.getByText('versionHistory.createSnapshotNameEmpty')).toBeInTheDocument();
    // The dialog must stay open and usable after a validation failure.
    expect(screen.getByTestId('version-history-create-snapshot-name-input')).toBeInTheDocument();
  });

  test('a valid name calls the API, disables the button while in-flight, and closes on success', async () => {
    let resolveCreate: (value: boolean) => void = () => undefined;
    const onCreateSnapshot = jest.fn(
      () => new Promise<boolean>((resolve) => { resolveCreate = resolve; })
    );

    render(<VersionList {...listProps()} onCreateSnapshot={onCreateSnapshot} />);
    fireEvent.click(screen.getByTestId('version-history-create-snapshot-button'));
    fireEvent.change(screen.getByTestId('version-history-create-snapshot-name-input'), {
      target: { value: 'My milestone' },
    });
    fireEvent.click(screen.getByTestId('version-history-create-snapshot-confirm'));

    expect(onCreateSnapshot).toHaveBeenCalledWith('My milestone');
    expect(onCreateSnapshot).toHaveBeenCalledTimes(1);

    // Duplicate submission while in-flight must not call the API again.
    fireEvent.click(screen.getByTestId('version-history-create-snapshot-confirm'));
    expect(onCreateSnapshot).toHaveBeenCalledTimes(1);

    resolveCreate(true);
    await screen.findByTestId('version-history-create-snapshot-button');
    expect(screen.queryByTestId('version-history-create-snapshot-name-input')).not.toBeInTheDocument();
  });

  test('API failure keeps the dialog open and usable', async () => {
    const onCreateSnapshot = jest.fn().mockResolvedValue(false);

    render(<VersionList {...listProps()} onCreateSnapshot={onCreateSnapshot} />);
    fireEvent.click(screen.getByTestId('version-history-create-snapshot-button'));
    fireEvent.change(screen.getByTestId('version-history-create-snapshot-name-input'), {
      target: { value: 'Will fail' },
    });
    fireEvent.click(screen.getByTestId('version-history-create-snapshot-confirm'));

    await screen.findByTestId('version-history-create-snapshot-name-input');
    expect(onCreateSnapshot).toHaveBeenCalledWith('Will fail');
    // Modal stays usable: cancel still works.
    fireEvent.click(screen.getByTestId('version-history-create-snapshot-cancel'));
    expect(screen.queryByTestId('version-history-create-snapshot-name-input')).not.toBeInTheDocument();
  });
});

describe('delete version', () => {
  test('delete control is visible for eligible entries', () => {
    render(<VersionList {...listProps()} onDeleteVersion={jest.fn()} />);
    expect(screen.getByTestId('version-history-delete-button-latest')).toBeInTheDocument();
    expect(screen.getByTestId('version-history-delete-button-previous')).toBeInTheDocument();
  });

  test('delete control is absent without a handler', () => {
    render(<VersionList {...listProps()} />);
    expect(screen.queryByTestId('version-history-delete-button-latest')).not.toBeInTheDocument();
  });

  test('cancel makes no API call', () => {
    const onDeleteVersion = jest.fn();

    render(<VersionList {...listProps()} onDeleteVersion={onDeleteVersion} />);
    fireEvent.click(screen.getByTestId('version-history-delete-button-latest'));
    expect(screen.getByText('versionHistory.deleteVersionConfirmTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('version-history-delete-cancel'));

    expect(onDeleteVersion).not.toHaveBeenCalled();
    expect(screen.queryByText('versionHistory.deleteVersionConfirmTitle')).not.toBeInTheDocument();
  });

  test('confirm invokes the tombstone-delete API with the right version id', () => {
    const onDeleteVersion = jest.fn();

    render(<VersionList {...listProps()} onDeleteVersion={onDeleteVersion} />);
    fireEvent.click(screen.getByTestId('version-history-delete-button-previous'));
    fireEvent.click(screen.getByTestId('version-history-delete-confirm'));

    expect(onDeleteVersion).toHaveBeenCalledWith('previous');
    expect(onDeleteVersion).toHaveBeenCalledTimes(1);
  });

  test('delete buttons are disabled while a deletion is in flight, preventing duplicates', () => {
    const onDeleteVersion = jest.fn();

    render(<VersionList {...listProps()} onDeleteVersion={onDeleteVersion} isDeletingVersion />);
    expect(screen.getByTestId('version-history-delete-button-latest')).toBeDisabled();
    expect(screen.getByTestId('version-history-delete-button-previous')).toBeDisabled();
  });
});
