import { Role, Workspace } from '@/application/types';

/**
 * Every member can create tokens for their own agents (a token carries that person's access, and everything an agent
 * does with it is recorded under the token's name and its owner). Only guests are left out. The server enforces the
 * same rule, and lets owners and admins see and revoke everyone's tokens.
 */
export function canUseAgentAccess(workspace: Workspace | undefined): boolean {
  return Boolean(workspace) && workspace?.role !== Role.Guest;
}
