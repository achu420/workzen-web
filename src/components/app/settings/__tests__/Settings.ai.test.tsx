import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { canManageWorkspaceAI } from '@/utils/ai-settings';

import { SettingsDialog } from '../Settings';

let mockWorkspaceInfo: { workspaces: { id: string; role?: string; owner: { uid: number } }[] };
let mockUserUid = '7';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}));
jest.mock('@/components/app/app.hooks', () => ({
  useCurrentWorkspaceId: () => 'workspace-1',
  useUserWorkspaceInfo: () => mockWorkspaceInfo,
  useIsOfficialHosted: () => false,
}));
jest.mock('@/components/main/app.hooks', () => ({ useCurrentUserOptional: () => ({ uid: mockUserUid }) }));
jest.mock('@/components/app/settings/AccountAppPanel', () => ({ AccountAppPanel: () => null }));
jest.mock('@/components/app/settings/ProfilePanel', () => ({ ProfilePanel: () => null }));
jest.mock('@/components/app/settings/MembersPanel', () => ({ MembersPanel: () => null }));
jest.mock('@/components/app/settings/ManageDataPanel', () => ({ ManageDataPanel: () => null }));

function renderSettings(role: string | undefined, ownerUid = 42) {
  mockWorkspaceInfo = { workspaces: [{ id: 'workspace-1', role, owner: { uid: ownerUid } }] };
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <SettingsDialog open onClose={jest.fn()} />
    </MemoryRouter>
  );
}

describe('AI settings visibility', () => {
  beforeEach(() => {
    mockUserUid = '7';
  });

  it('shows the AI item to the workspace owner', () => {
    renderSettings('Owner');
    expect(screen.getByTestId('settings-menu-ai')).toBeTruthy();
  });

  it('shows it when the signed-in user is the recorded owner even without a role', () => {
    mockUserUid = '42';
    renderSettings(undefined, 42);
    expect(screen.getByTestId('settings-menu-ai')).toBeTruthy();
  });

  it('hides it from members and guests', () => {
    const { unmount } = renderSettings('Member');

    expect(screen.queryByTestId('settings-menu-ai')).toBeNull();
    unmount();
    renderSettings('Guest');
    expect(screen.queryByTestId('settings-menu-ai')).toBeNull();
  });

  it('applies the same rule through canManageWorkspaceAI', () => {
    expect(canManageWorkspaceAI(undefined, '7')).toBe(false);
    expect(canManageWorkspaceAI({ role: 'Member', owner: { uid: 1, name: 'a' } } as never, '7')).toBe(false);
    expect(canManageWorkspaceAI({ role: 'Owner' } as never, '7')).toBe(true);
  });
});
