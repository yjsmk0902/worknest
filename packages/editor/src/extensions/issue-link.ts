import { Node, mergeAttributes, InputRule, PasteRule } from "@tiptap/core";

/**
 * Regex pattern for issue keys like WORK-142, AB-1, PROJ-9999.
 * Matches 2-5 uppercase letters followed by a dash and 1+ digits.
 */
const ISSUE_KEY_REGEX = /([A-Z]{2,5}-\d+)/g;
const ISSUE_KEY_INPUT_REGEX = /([A-Z]{2,5}-\d+)\s$/;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    issueLink: {
      /** Insert an issue link node. */
      insertIssueLink: (issueKey: string) => ReturnType;
    };
  }
}

/**
 * TipTap extension for inline issue link nodes.
 *
 * Automatically converts patterns like `WORK-142` into styled,
 * clickable issue link nodes via InputRule and PasteRule.
 *
 * The node renders as an inline element with primary color styling
 * and navigates to the issue page on click.
 */
export const IssueLink = Node.create({
  name: "issueLink",

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      issueKey: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-issue-key"),
        renderHTML: (attributes) => ({
          "data-issue-key": attributes.issueKey,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="issue-link"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "issue-link",
        class:
          "bg-primary/10 text-primary rounded px-1 cursor-pointer font-mono text-sm hover:bg-primary/20 hover:underline",
      }),
      node.attrs.issueKey,
    ];
  },

  addCommands() {
    return {
      insertIssueLink:
        (issueKey: string) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { issueKey },
            })
            .run();
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: ISSUE_KEY_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const issueKey = match[1];
          if (!issueKey) return;

          const { tr } = state;
          const start = range.from;
          const end = range.to;

          const node = this.type.create({ issueKey });
          tr.replaceWith(start, end, [node, state.schema.text(" ")]);
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: ISSUE_KEY_REGEX,
        handler: ({ state, range, match }) => {
          const issueKey = match[1];
          if (!issueKey) return;

          const { tr } = state;
          const start = range.from;
          const end = range.to;

          const node = this.type.create({ issueKey });
          tr.replaceWith(start, end, node);
        },
      }),
    ];
  },
});
