import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@worknest/ui';

// Platform detection
const isMac =
  typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform);

const modSymbol = isMac ? '\u2318' : 'Ctrl';

interface ShortcutEntry {
  label: string;
  keys: string[];
  alt?: string[];
}

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutEntry[];
}

const categories: ShortcutCategory[] = [
  {
    title: '\uC804\uC5ED',
    shortcuts: [
      { label: 'Command Palette \uC5F4\uAE30', keys: [modSymbol, 'K'] },
      { label: '\uB2E8\uCD95\uD0A4 \uB3C4\uC6C0\uB9D0', keys: [modSymbol, '/'] },
      { label: '\uC0AC\uC774\uB4DC\uBC14 \uD1A0\uAE00', keys: [modSymbol, '\\'] },
    ],
  },
  {
    title: '\uC774\uC288 \uB124\uBE44\uAC8C\uC774\uC158',
    shortcuts: [
      { label: '\uC774\uC804 \uC774\uC288', keys: ['K'], alt: ['\u2191'] },
      { label: '\uB2E4\uC74C \uC774\uC288', keys: ['J'], alt: ['\u2193'] },
      { label: '\uC774\uC288 \uC5F4\uAE30', keys: ['Enter'] },
      { label: '\uC774\uC288 \uC120\uD0DD', keys: ['X'], alt: ['Space'] },
      { label: '\uC774\uC288 \uC0DD\uC131 (Quick Add)', keys: ['C'] },
      { label: '\uD328\uB110 \uB2EB\uAE30 / \uC120\uD0DD \uD574\uC81C', keys: ['Esc'] },
    ],
  },
  {
    title: '\uC774\uC288 \uC0C1\uC138',
    shortcuts: [
      { label: '\uC0C1\uD0DC \uBCC0\uACBD', keys: ['S'] },
      { label: '\uB2F4\uB2F9\uC790 \uBCC0\uACBD', keys: ['A'] },
      { label: '\uB77C\uBCA8 \uBCC0\uACBD', keys: ['L'] },
      { label: '\uC6B0\uC120\uC21C\uC704 \uBCC0\uACBD', keys: ['P'] },
      { label: '\uD0C0\uC785 \uBCC0\uACBD', keys: ['T'] },
      { label: '\uB9C8\uAC10\uC77C \uC124\uC815', keys: ['D'] },
      { label: '\uC81C\uBAA9 \uD3B8\uC9D1', keys: ['F2'] },
    ],
  },
];

function KeyBadge({ children }: { children: string }) {
  return (
    <span
      className="inline-flex min-w-[24px] items-center justify-center rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
      aria-label={children}
    >
      {children}
    </span>
  );
}

function ShortcutRow({ shortcut }: { shortcut: ShortcutEntry }) {
  return (
    <div
      className="flex h-9 items-center justify-between"
      role="listitem"
    >
      <span className="text-sm text-muted-foreground">{shortcut.label}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key) => (
          <KeyBadge key={key}>{key}</KeyBadge>
        ))}
        {shortcut.alt && (
          <>
            <span className="text-xs text-muted-foreground">{'\uB610\uB294'}</span>
            {shortcut.alt.map((key) => (
              <KeyBadge key={key}>{key}</KeyBadge>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

interface KeyboardShortcutsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsSheet({
  open,
  onOpenChange,
}: KeyboardShortcutsSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[80vh] max-w-[640px] overflow-y-auto p-6"
        aria-labelledby="keyboard-shortcuts-title"
      >
        <DialogHeader>
          <DialogTitle id="keyboard-shortcuts-title">
            {'\uD0A4\uBCF4\uB4DC \uB2E8\uCD95\uD0A4'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {'\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uD0A4\uBCF4\uB4DC \uB2E8\uCD95\uD0A4 \uBAA9\uB85D'}
          </DialogDescription>
        </DialogHeader>

        {categories.map((category, idx) => (
          <div
            key={category.title}
            role="group"
            aria-label={category.title}
            className={idx > 0 ? 'mt-6' : 'mt-2'}
          >
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              {category.title}
            </h3>
            <div role="list">
              {category.shortcuts.map((shortcut) => (
                <ShortcutRow key={shortcut.label} shortcut={shortcut} />
              ))}
            </div>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
