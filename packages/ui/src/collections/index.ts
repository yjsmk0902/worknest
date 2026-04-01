import { Collection } from '@tanstack/react-db';

import { eventBus } from '@worknest/client/lib';
import {
  Download,
  LocalNode,
  NodeReaction,
  Upload,
  User,
} from '@worknest/client/types';
import { createAccountsCollection } from '@worknest/ui/collections/accounts';
import { createDownloadsCollection } from '@worknest/ui/collections/downloads';
import { createMetadataCollection } from '@worknest/ui/collections/metadata';
import { createNodeReactionsCollection } from '@worknest/ui/collections/node-reactions';
import { createNodesCollection } from '@worknest/ui/collections/nodes';
import { createServersCollection } from '@worknest/ui/collections/servers';
import { createTabsCollection } from '@worknest/ui/collections/tabs';
import { createTempFilesCollection } from '@worknest/ui/collections/temp-files';
import { createUploadsCollection } from '@worknest/ui/collections/uploads';
import { createUsersCollection } from '@worknest/ui/collections/users';
import { createWorkspacesCollection } from '@worknest/ui/collections/workspaces';

export class WorkspaceCollections {
  private readonly userId: string;

  public readonly users: Collection<User, string>;
  public readonly downloads: Collection<Download, string>;
  public readonly uploads: Collection<Upload, string>;
  public readonly nodes: Collection<LocalNode, string>;
  public readonly nodeReactions: Collection<NodeReaction, string>;

  constructor(userId: string) {
    this.userId = userId;
    this.users = createUsersCollection(userId);
    this.downloads = createDownloadsCollection(userId);
    this.uploads = createUploadsCollection(userId);
    this.nodes = createNodesCollection(userId);
    this.nodeReactions = createNodeReactionsCollection(userId);
  }

  public async cleanup(): Promise<void> {
    await Promise.all([
      this.users.cleanup(),
      this.downloads.cleanup(),
      this.uploads.cleanup(),
      this.nodes.cleanup(),
      this.nodeReactions.cleanup(),
    ]);
  }
}

export class AppCollections {
  public readonly servers = createServersCollection();
  public readonly accounts = createAccountsCollection();
  public readonly tabs = createTabsCollection();
  public readonly metadata = createMetadataCollection();
  public readonly workspaces = createWorkspacesCollection();
  public readonly tempFiles = createTempFilesCollection();

  private readonly workspaceCollections: Map<string, WorkspaceCollections> =
    new Map();

  private getWorkspaceCollections(userId: string) {
    if (!this.workspaceCollections.has(userId)) {
      if (!this.workspaces.has(userId)) {
        throw new Error(`Workspace not found`);
      }

      this.workspaceCollections.set(userId, new WorkspaceCollections(userId));
    }

    return this.workspaceCollections.get(userId)!;
  }

  public async preload(): Promise<void> {
    eventBus.subscribe((event) => {
      if (event.type === 'workspace.deleted') {
        try {
          const workspaceCollections = this.workspaceCollections.get(
            event.workspace.userId
          );
          if (workspaceCollections) {
            this.workspaceCollections.delete(event.workspace.userId);
          }
        } catch {
          // ignore
        }
      }
    });

    await Promise.all([
      this.servers.preload(),
      this.accounts.preload(),
      this.metadata.preload(),
      this.tabs.preload(),
      this.workspaces.preload(),
      this.tempFiles.preload(),
    ]);
  }

  public workspace(userId: string) {
    return this.getWorkspaceCollections(userId);
  }
}

export const collections = new AppCollections();
