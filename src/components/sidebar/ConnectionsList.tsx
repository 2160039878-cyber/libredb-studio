import React, { useSyncExternalStore } from "react";
import { DatabaseConnection } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConnectionItem } from "./ConnectionItem";
import { storage, type StorageChangeDetail } from "@/lib/storage";
import { toast } from "sonner";

function subscribeToFavorites(onChange: () => void) {
  const listener = (event: Event) => {
    if ((event as CustomEvent<StorageChangeDetail>).detail.collection === "favorite_connections") onChange();
  };
  window.addEventListener("libredb-storage-change", listener);
  return () => window.removeEventListener("libredb-storage-change", listener);
}

// A primitive snapshot stays stable across reads; the stored array is parsed afresh.
const favoriteSnapshot = () => JSON.stringify(storage.getFavoriteConnectionIds());
const serverFavoriteSnapshot = () => "[]";

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
  const favorites = new Set<string>(
    JSON.parse(useSyncExternalStore(subscribeToFavorites, favoriteSnapshot, serverFavoriteSnapshot)),
  );
  const groups = [
    { label: "Favorites", items: connections.filter((conn) => favorites.has(conn.id)) },
    { label: "Connections", items: connections.filter((conn) => !favorites.has(conn.id)) },
  ].filter((group) => group.items.length > 0 || (group.label === "Connections" && connections.length === 0));

  const toggleFavorite = (id: string) => {
    if (!storage.toggleConnectionFavorite(id)) toast.error("Could not save the connection favorite.");
  };

  return (
    <section className="space-y-4">
      {groups.map(({ label, items }) => (
        <fieldset key={label} aria-label={label} className="min-w-0">
          <div className="px-3 mb-2 flex items-center justify-between">
            <span
              className={
                label === "Favorites"
                  ? "text-xs font-medium px-1.5 py-0.5 rounded-sm text-hue-amber bg-hue-amber-tint/10"
                  : "text-xs font-medium text-muted-foreground"
              }
            >
              {label}
            </span>
            <div className="h-[1px] flex-1 bg-border/30 ml-3" />
          </div>

          <div className="space-y-0.5">
            {connections.length === 0 ? (
              <div className="px-3 py-6 text-center border border-dashed border-border/50 rounded-lg mx-2">
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  No database connections established yet.
                </p>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAddConnection}>
                  Add Connection
                </Button>
              </div>
            ) : (
              items.map((conn) => (
                <ConnectionItem
                  key={conn.id}
                  connection={conn}
                  isActive={activeConnection?.id === conn.id}
                  onSelect={onSelectConnection}
                  onDelete={onDeleteConnection}
                  onEdit={onEditConnection}
                  isFavorite={favorites.has(conn.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))
            )}
          </div>
        </fieldset>
      ))}
    </section>
  );
}
