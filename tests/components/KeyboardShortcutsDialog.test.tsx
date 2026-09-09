import "../setup-dom";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import React, { useState } from "react";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";

afterEach(cleanup);

function Guide({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Show guide
      </button>
      <KeyboardShortcutsDialog open={open} onOpenChange={setOpen} enabled={enabled} />
    </>
  );
}

describe("KeyboardShortcutsDialog", () => {
  test("opens with ? and lists app shortcuts and the editor's registered bindings", () => {
    const { getByRole, queryByRole } = render(<Guide />);
    expect(queryByRole("dialog")).toBeNull();
    const event = new KeyboardEvent("keydown", { key: "?", shiftKey: true, cancelable: true });
    fireEvent(document, event);
    expect(event.defaultPrevented).toBe(true);
    const guide = within(getByRole("dialog", { name: "Keyboard shortcuts" }));
    for (const label of [
      "Command palette",
      "New query tab",
      "Show shortcuts",
      "Run query",
      "Format query",
      "Editor command palette",
      "Switch editor tab",
      "First / last editor tab",
      "Close dialog or profiler",
    ])
      expect(guide.getByText(label)).not.toBeNull();
    for (const binding of [
      "Ctrl / ⌘ + K",
      "Ctrl / ⌘ + Alt / Option + Shift + N",
      "?",
      "Ctrl / ⌘ + Enter",
      "Alt / Option + Shift + F",
      "F1",
      "← / →",
      "Home / End",
      "Escape",
    ])
      expect(guide.getByText(binding)).not.toBeNull();
  });

  test("preserves typing in inputs, editable content and Monaco", () => {
    const { getByLabelText, queryByRole } = render(
      <>
        <Guide />
        <input aria-label="Input" />
        <textarea aria-label="Query" />
        <select aria-label="Choice">
          <option>One</option>
        </select>
        <div contentEditable aria-label="Editable" />
        <div className="monaco-editor">
          <button type="button" aria-label="Editor control" />
        </div>
      </>,
    );
    for (const label of ["Input", "Query", "Choice", "Editable", "Editor control"]) {
      const event = new KeyboardEvent("keydown", { key: "?", bubbles: true, cancelable: true });
      fireEvent(getByLabelText(label), event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(queryByRole("dialog")).toBeNull();
  });

  test("ignores modified, composing, repeated and already handled keys", () => {
    const onOpenChange = mock(() => {});
    render(<KeyboardShortcutsDialog open={false} onOpenChange={onOpenChange} />);
    for (const key of [
      { key: "x" },
      { key: "?", ctrlKey: true },
      { key: "?", metaKey: true },
      { key: "?", altKey: true },
      { key: "?", repeat: true },
      { key: "?", isComposing: true },
    ])
      fireEvent.keyDown(document, key);
    const handled = new KeyboardEvent("keydown", { key: "?", cancelable: true });
    handled.preventDefault();
    fireEvent(document, handled);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test("does not handle ? inside another dialog", () => {
    const { getByLabelText, queryByRole } = render(
      <>
        <Guide />
        <dialog open>
          <button type="button" aria-label="Other dialog control" />
        </dialog>
      </>,
    );
    fireEvent.keyDown(getByLabelText("Other dialog control"), { key: "?" });
    expect(queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull();
  });

  test("can disable the global binding and removes the listener on unmount", () => {
    const onOpenChange = mock(() => {});
    const { rerender, unmount } = render(
      <KeyboardShortcutsDialog open={false} onOpenChange={onOpenChange} enabled={false} />,
    );
    fireEvent.keyDown(document, { key: "?" });
    expect(onOpenChange).not.toHaveBeenCalled();
    rerender(<KeyboardShortcutsDialog open={false} onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: "?" });
    expect(onOpenChange).toHaveBeenCalledWith(true);
    unmount();
    fireEvent.keyDown(document, { key: "?" });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  test("restores keyboard focus when closed", async () => {
    const { getByRole, queryByRole } = render(<Guide />);
    const trigger = getByRole("button", { name: "Show guide" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });
});
