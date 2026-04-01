import { EditorCommand, EditorCommandProps } from '@worknest/client/types';
import { BlockquoteCommand } from '@worknest/ui/editor/commands/blockquote';
import { BulletListCommand } from '@worknest/ui/editor/commands/bullet-list';
import { CodeBlockCommand } from '@worknest/ui/editor/commands/code-block';
import { DatabaseCommand } from '@worknest/ui/editor/commands/database';
import { DatabaseInlineCommand } from '@worknest/ui/editor/commands/database-inline';
import { DividerCommand } from '@worknest/ui/editor/commands/divider';
import { FileCommand } from '@worknest/ui/editor/commands/file';
import { FolderCommand } from '@worknest/ui/editor/commands/folder';
import { Heading1Command } from '@worknest/ui/editor/commands/heading1';
import { Heading2Command } from '@worknest/ui/editor/commands/heading2';
import { Heading3Command } from '@worknest/ui/editor/commands/heading3';
import { OrderedListCommand } from '@worknest/ui/editor/commands/ordered-list';
import { PageCommand } from '@worknest/ui/editor/commands/page';
import { ParagraphCommand } from '@worknest/ui/editor/commands/paragraph';
import { TableCommand } from '@worknest/ui/editor/commands/table';
import { TodoCommand } from '@worknest/ui/editor/commands/todo';

export type { EditorCommand, EditorCommandProps };

export {
  BlockquoteCommand,
  BulletListCommand,
  CodeBlockCommand,
  DividerCommand,
  FileCommand,
  FolderCommand,
  Heading1Command,
  Heading2Command,
  Heading3Command,
  OrderedListCommand,
  PageCommand,
  ParagraphCommand,
  TableCommand,
  TodoCommand,
  DatabaseCommand,
  DatabaseInlineCommand,
};
