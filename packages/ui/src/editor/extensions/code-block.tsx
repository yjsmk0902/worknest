import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';

import { defaultClasses } from '@worknest/ui/editor/classes';
import { CodeBlockNodeView } from '@worknest/ui/editor/views';
import { lowlight } from '@worknest/ui/lib/lowlight';

export const CodeBlockNode = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView, {
      as: 'code-block',
    });
  },
}).configure({
  lowlight,
  defaultLanguage: 'plaintext',
  HTMLAttributes: {
    class: defaultClasses.codeBlock,
  },
});
