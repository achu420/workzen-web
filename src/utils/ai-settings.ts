import { Role, Workspace } from '@/application/types';
import { isSameUserUid, UserUid } from '@/application/user-uid';

/** AI provider keys are workspace-wide and billed to their owner, so only the owner configures them. */
export function canManageWorkspaceAI(workspace: Workspace | undefined, userUid: UserUid): boolean {
  return workspace?.role === Role.Owner || isSameUserUid(workspace?.owner?.uid, userUid);
}
