import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { canUseAgentAccess } from '@/utils/agent-access';

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

describe('Agent access settings visibility', () => {
  beforeEach(() => {
    mockUserUid = '7';
  });

  it('shows the item to the workspace owner', () => {
    renderSettings('Owner');
    expect(screen.getByTestId('settings-menu-agent_access')).toBeTruthy();
  });

  it('shows it to every member, because each person manages their own agents', () => {
    renderSettings('Member');
    expect(screen.getByTestId('settings-menu-agent_access')).toBeTruthy();
  });

  it('hides it from guests', () => {
    renderSettings('Guest');
    expect(screen.queryByTestId('settings-menu-agent_access')).toBeNull();
  });

  it('applies the same rule through canUseAgentAccess', () => {
    expect(canUseAgentAccess(undefined)).toBe(false);
    expect(canUseAgentAccess({ role: 'Member', owner: { uid: 1, name: 'a' } } as never)).toBe(true);
    expect(canUseAgentAccess({ role: 'Owner' } as never)).toBe(true);
    expect(canUseAgentAccess({ role: 'Guest' } as never)).toBe(false);
  });
});
