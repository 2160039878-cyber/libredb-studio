"use client";

import type { ReactElement } from "react";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { clipboardCellText } from "@/lib/export/clipboard";
import { cellOf } from "@/lib/export/csv";
import { jsonText } from "@/lib/export/json";

interface ResultContextMenuProps {
  children: ReactElement;
  getRow: () => Record<string, unknown>;
  column?: string;
  onCopy: (text: string) => void;
}

export function ResultContextMenu({ children, getRow, column, onCopy }: ResultContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent onClick={(event) => event.stopPropagation()}>
        {column !== undefined && (
          <ContextMenuItem onSelect={() => onCopy(clipboardCellText(cellOf(getRow(), column)))}>
            Copy Cell
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => onCopy(jsonText(getRow(), 2))}>Copy Row as JSON</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
