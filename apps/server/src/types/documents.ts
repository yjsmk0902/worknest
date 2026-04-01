import { DocumentContent } from '@worknest/core';
import { SelectDocument } from '@worknest/server/data/schema';

export type CreateDocumentInput = {
  nodeId: string;
  content: DocumentContent;
  userId: string;
  workspaceId: string;
};

export type CreateDocumentOutput = {
  document: SelectDocument;
};

export type UpdateDocumentInput = {
  documentId: string;
  userId: string;
  workspaceId: string;
  updater: (content: DocumentContent) => DocumentContent | null;
};
