/**
 * Hotkey Store tests.
 *
 * Tests the Zustand hotkey store's context management:
 * - activeContext default and setActiveContext
 * - pushContext / popContext stack operations
 * - Edge cases (empty stack, multiple push/pop)
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from "vitest";
import { useHotkeyStore } from "../../src/stores/hotkey-store";

// ── Helpers ───────────────────────────────────────────────────────────

function resetStore() {
  useHotkeyStore.setState({
    activeContext: "global",
    contextStack: [],
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("useHotkeyStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("initial state", () => {
    it("has activeContext set to 'global'", () => {
      const state = useHotkeyStore.getState();
      expect(state.activeContext).toBe("global");
    });

    it("has an empty contextStack", () => {
      const state = useHotkeyStore.getState();
      expect(state.contextStack).toEqual([]);
    });
  });

  describe("setActiveContext", () => {
    it("changes activeContext to the given value", () => {
      useHotkeyStore.getState().setActiveContext("editor");
      expect(useHotkeyStore.getState().activeContext).toBe("editor");
    });

    it("changes activeContext to 'modal'", () => {
      useHotkeyStore.getState().setActiveContext("modal");
      expect(useHotkeyStore.getState().activeContext).toBe("modal");
    });

    it("does not modify the contextStack", () => {
      useHotkeyStore.getState().setActiveContext("editor");
      expect(useHotkeyStore.getState().contextStack).toEqual([]);
    });
  });

  describe("pushContext", () => {
    it("adds the current context to the stack and updates activeContext", () => {
      useHotkeyStore.getState().pushContext("modal");

      const state = useHotkeyStore.getState();
      expect(state.activeContext).toBe("modal");
      expect(state.contextStack).toEqual(["global"]);
    });

    it("stacks multiple contexts in correct order", () => {
      useHotkeyStore.getState().pushContext("editor");
      useHotkeyStore.getState().pushContext("modal");
      useHotkeyStore.getState().pushContext("command-palette");

      const state = useHotkeyStore.getState();
      expect(state.activeContext).toBe("command-palette");
      expect(state.contextStack).toEqual(["global", "editor", "modal"]);
    });
  });

  describe("popContext", () => {
    it("removes the last context from the stack and restores activeContext", () => {
      useHotkeyStore.getState().pushContext("modal");
      useHotkeyStore.getState().popContext();

      const state = useHotkeyStore.getState();
      expect(state.activeContext).toBe("global");
      expect(state.contextStack).toEqual([]);
    });

    it("falls back to 'global' when popping from an empty stack", () => {
      useHotkeyStore.getState().popContext();

      const state = useHotkeyStore.getState();
      expect(state.activeContext).toBe("global");
      expect(state.contextStack).toEqual([]);
    });

    it("restores through multiple push/pop operations correctly", () => {
      useHotkeyStore.getState().pushContext("editor");
      useHotkeyStore.getState().pushContext("modal");
      useHotkeyStore.getState().pushContext("command-palette");

      // Pop command-palette -> modal
      useHotkeyStore.getState().popContext();
      expect(useHotkeyStore.getState().activeContext).toBe("modal");
      expect(useHotkeyStore.getState().contextStack).toEqual(["global", "editor"]);

      // Pop modal -> editor
      useHotkeyStore.getState().popContext();
      expect(useHotkeyStore.getState().activeContext).toBe("editor");
      expect(useHotkeyStore.getState().contextStack).toEqual(["global"]);

      // Pop editor -> global
      useHotkeyStore.getState().popContext();
      expect(useHotkeyStore.getState().activeContext).toBe("global");
      expect(useHotkeyStore.getState().contextStack).toEqual([]);
    });

    it("stays at 'global' when popping multiple times from empty stack", () => {
      useHotkeyStore.getState().popContext();
      useHotkeyStore.getState().popContext();
      useHotkeyStore.getState().popContext();

      const state = useHotkeyStore.getState();
      expect(state.activeContext).toBe("global");
      expect(state.contextStack).toEqual([]);
    });
  });

  describe("push and pop interleaved with setActiveContext", () => {
    it("push after setActiveContext preserves the manually set context in stack", () => {
      useHotkeyStore.getState().setActiveContext("editor");
      useHotkeyStore.getState().pushContext("modal");

      const state = useHotkeyStore.getState();
      expect(state.activeContext).toBe("modal");
      expect(state.contextStack).toEqual(["editor"]);
    });

    it("popContext after setActiveContext restores from stack (not the manually set value)", () => {
      useHotkeyStore.getState().pushContext("editor");
      // Manually override
      useHotkeyStore.getState().setActiveContext("detail");
      // Pop should still restore from stack
      useHotkeyStore.getState().popContext();

      const state = useHotkeyStore.getState();
      expect(state.activeContext).toBe("global");
      expect(state.contextStack).toEqual([]);
    });
  });
});
