"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS = [
  ["Command palette", "Ctrl / ⌘ + K", "Standalone app"],
  ["New query tab", "Ctrl / ⌘ + Alt / Option + Shift + N", "Workspace"],
  ["Show shortcuts", "?", "Outside text fields"],
  ["Run query", "Ctrl / ⌘ + Enter", "Query editor"],
  ["Format query", "Alt / Option + Shift + F", "Query editor"],
  ["Editor command palette", "F1", "Query editor"],
  ["Switch editor tab", "← / →", "Tab strip"],
  ["First / last editor tab", "Home / End", "Tab strip"],
  ["Finish / cancel tab rename", "Enter / Escape", "Tab name"],
  ["Close dialog or profiler", "Escape", "Open dialog"],
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled?: boolean;
}

export function KeyboardShortcutsDialog({ open, onOpenChange, enabled = true }: KeyboardShortcutsDialogProps) {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "?" ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        event.isComposing
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), .monaco-editor, dialog, [role="dialog"], [role="alertdialog"]',
        )
      )
        return;
      event.preventDefault();
      onOpenChange(true);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-studio-workspace=""
        className="bg-overlay text-fg border-hairline max-h-[85vh] overflow-y-auto sm:max-w-xl"
        onOpenAutoFocus={() => {
          previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          previousFocus.current?.focus();
        }}
        onEscapeKeyDown={(event) => event.stopImmediatePropagation()}
      >
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press ? outside text fields to open this guide. Use F1 in the query editor for more editing commands.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-hairline">
          {SHORTCUTS.map(([action, keys, scope]) => (
            <div key={action} className="flex items-center justify-between gap-3 py-2.5 text-xs">
              <dt>
                <span className="block font-medium">{action}</span>
                <span className="text-fg-muted">{scope}</span>
              </dt>
              <dd className="text-right">
                <kbd className="rounded border border-hairline bg-fill px-1.5 py-1 font-mono leading-6">{keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
