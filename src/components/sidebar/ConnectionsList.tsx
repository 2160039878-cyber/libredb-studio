import React, { useId, useRef, useSyncExternalStore } from "react";
import { DatabaseConnection } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConnectionItem } from "./ConnectionItem";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { getKey, readJSON, writeJSON } from "@/lib/storage/local-storage";

const ORDER_COLLECTION = "connection_order";
const ORDER_CHANGE_EVENT = "libredb-connection-order-change";

function subscribeToOrder(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === getKey(ORDER_COLLECTION)) onChange();
  };
  window.addEventListener(ORDER_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ORDER_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// A string snapshot stays stable even though the stored array is parsed on every read.
function orderSnapshot() {
  const stored = readJSON<unknown>(ORDER_COLLECTION);
  return JSON.stringify(Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : []);
}
const serverOrderSnapshot = () => "[]";

interface ConnectionsListProps {
  connections: DatabaseConnection[];
  activeConnection: DatabaseConnection | null;
  onSelectConnection: (conn: DatabaseConnection) => void;
  onDeleteConnection: (id: string) => void;
  onEditConnection?: (conn: DatabaseConnection) => void;
  onAddConnection: () => void;
}

export function ConnectionsList({
  connections,
  activeConnection,
  onSelectConnection,
  onDeleteConnection,
  onEditConnection,
  onAddConnection,
}: ConnectionsListProps) {
  const order: string[] = JSON.parse(useSyncExternalStore(subscribeToOrder, orderSnapshot, serverOrderSnapshot));
  const positions = new Map(order.map((id, index) => [id, index]));
  const orderedConnections = [...connections].sort(
    (a, b) => (positions.get(a.id) ?? order.length) - (positions.get(b.id) ?? order.length),
  );
  const draggedId = useRef<string | null>(null);
  const instructionsId = useId();

  const moveConnection = (id: string, targetIndex: number) => {
    const sourceIndex = orderedConnections.findIndex((conn) => conn.id === id);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= orderedConnections.length || sourceIndex === targetIndex)
      return;
    const next = orderedConnections.map((conn) => conn.id);
    next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, id);
    if (!writeJSON(ORDER_COLLECTION, next)) {
      toast.error("Could not save the connection order.");
      return;
    }
    window.dispatchEvent(new Event(ORDER_CHANGE_EVENT));
  };

  return (
    <section>
      <div className="px-3 mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Connections</span>
        <div className="h-[1px] flex-1 bg-border/30 ml-3" />
      </div>
      <p id={instructionsId} className="sr-only">
        Drag to reorder connections, or focus a reorder handle and press Alt+Arrow Up or Alt+Arrow Down.
      </p>

      <ul aria-label="Saved connections" className="space-y-0.5">
        {connections.length === 0 ? (
          <li className="px-3 py-6 text-center border border-dashed border-border/50 rounded-lg mx-2">
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              No database connections established yet.
            </p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAddConnection}>
              Add Connection
            </Button>
          </li>
        ) : (
          orderedConnections.map((conn, index) => (
            // The row accepts pointer drops; its handle provides equivalent keyboard reordering.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <li
              key={conn.id}
              className="flex items-center"
              onDragOver={(event) => {
                if (!draggedId.current) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                if (!draggedId.current) return;
                event.preventDefault();
                moveConnection(draggedId.current, index);
                draggedId.current = null;
              }}
            >
              <button
                type="button"
                draggable
                aria-label={`Reorder ${conn.name}`}
                aria-describedby={instructionsId}
                title="Drag to reorder (Alt+↑ / Alt+↓)"
                className="shrink-0 p-1 ml-1 rounded text-fg-muted hover:text-fg cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-brand-tint"
                onDragStart={(event) => {
                  draggedId.current = conn.id;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", conn.id);
                }}
                onDragEnd={() => {
                  draggedId.current = null;
                }}
                onKeyDown={(event) => {
                  if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
                  event.preventDefault();
                  moveConnection(conn.id, index + (event.key === "ArrowUp" ? -1 : 1));
                }}
              >
                <GripVertical strokeWidth={1.5} className="w-3 h-3" />
              </button>
              <div className="flex-1 min-w-0">
                <ConnectionItem
                  connection={conn}
                  isActive={activeConnection?.id === conn.id}
                  onSelect={onSelectConnection}
                  onDelete={onDeleteConnection}
                  onEdit={onEditConnection}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
