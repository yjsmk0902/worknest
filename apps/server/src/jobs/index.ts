// import { assistantRespondHandler } from '@worknest/server/jobs/assistant-response';
import { cleanupHandler } from '@worknest/server/jobs/cleanup';
// import { documentEmbedHandler } from '@worknest/server/jobs/document-embed';
// import { documentEmbedScanHandler } from '@worknest/server/jobs/document-embed-scan';
import { documentUpdatesMergeHandler } from '@worknest/server/jobs/document-updates-merge';
import { emailPasswordResetSendHandler } from '@worknest/server/jobs/email-password-reset-sent';
import { emailVerifySendHandler } from '@worknest/server/jobs/email-verify-send';
import { emailWorkspaceInvitationSendHandler } from '@worknest/server/jobs/email-workspace-invitation-send';
import { nodeCleanHandler } from '@worknest/server/jobs/node-clean';
// import { nodeEmbedHandler } from '@worknest/server/jobs/node-embed';
// import { nodeEmbedScanHandler } from '@worknest/server/jobs/node-embed-scan';
import { nodeUpdatesMergeHandler } from '@worknest/server/jobs/node-updates-merge';
import { workspaceCleanHandler } from '@worknest/server/jobs/workspace-clean';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JobMap {}

export type JobInput = JobMap[keyof JobMap]['input'];

export type JobHandler<T extends JobInput> = (input: T) => Promise<void>;

type JobHandlerMap = {
  [K in keyof JobMap]: JobHandler<JobMap[K]['input']>;
};

export const jobHandlerMap: JobHandlerMap = {
  'email.verify.send': emailVerifySendHandler,
  'email.password.reset.send': emailPasswordResetSendHandler,
  'email.workspace.invitation.send': emailWorkspaceInvitationSendHandler,
  'workspace.clean': workspaceCleanHandler,
  'node.clean': nodeCleanHandler,
  // 'node.embed': nodeEmbedHandler,
  // 'document.embed': documentEmbedHandler,
  // 'assistant.respond': assistantRespondHandler,
  // 'node.embed.scan': nodeEmbedScanHandler,
  // 'document.embed.scan': documentEmbedScanHandler,
  'node.updates.merge': nodeUpdatesMergeHandler,
  'document.updates.merge': documentUpdatesMergeHandler,
  cleanup: cleanupHandler,
};
