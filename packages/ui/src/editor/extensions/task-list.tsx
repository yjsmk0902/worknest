import { TaskList } from '@tiptap/extension-list';

import { defaultClasses } from '@worknest/ui/editor/classes';

export const TaskListNode = TaskList.configure({
  HTMLAttributes: {
    class: defaultClasses.taskList,
  },
});
