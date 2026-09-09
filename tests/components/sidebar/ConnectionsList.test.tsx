import "../../setup-dom";
import "../../helpers/mock-sonner";
import "../../helpers/mock-navigation";

import { mock } from "bun:test";

// Mock framer-motion with proper React elements
mock.module("framer-motion", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const handler = {
    get(_target: unknown, prop: string) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const MotionComponent = React.forwardRef(
        (
          {
            children,
            initial,
            animate,
            exit,
            variants,
            whileHover,
            whileTap,
            layoutId,
            transition,
            ...rest
          }: Record<string, unknown>,
          ref: React.Ref<HTMLElement>,
        ) => {
          return React.createElement(prop, { ...rest, ref }, children);
        },
      );
      MotionComponent.displayName = `Motion${prop}`;
      return MotionComponent;
    },
  };
  const MockAnimatePresence = ({ children }: Record<string, unknown>) => children;
  MockAnimatePresence.displayName = "AnimatePresence";
  return {
    motion: new Proxy({}, handler),
    AnimatePresence: MockAnimatePresence,
    useAnimation: () => ({ start: mock(() => {}), stop: mock(() => {}) }),
    useInView: () => true,
  };
});

// Mock db-ui-config (ConnectionItem uses it)
mock.module("@/lib/db-ui-config", () => ({
  getDBIcon: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require("react");
    const MockDBIcon = (props: Record<string, unknown>) =>
      React.createElement("span", { ...props, "data-testid": "db-icon" });
    MockDBIcon.displayName = "MockDBIcon";
    return MockDBIcon;
  },
  getDBConfig: () => ({ icon: () => null, color: "text-hue-blue", label: "PostgreSQL", defaultPort: "5432" }),
  getDBColor: () => "text-hue-blue",
}));

import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import React from "react";

import { ConnectionsList } from "@/components/sidebar/ConnectionsList";
import { mockPostgresConnection, mockMySQLConnection } from "../../fixtures/connections";

// =============================================================================
// ConnectionsList Tests
// =============================================================================

describe("ConnectionsList", () => {
  const defaultOnSelect = mock(() => {});
  const defaultOnDelete = mock(() => {});
  const defaultOnEdit = mock(() => {});
  const defaultOnAdd = mock(() => {});

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    defaultOnSelect.mockClear();
    defaultOnDelete.mockClear();
    defaultOnEdit.mockClear();
    defaultOnAdd.mockClear();
  });

  const orderedProps = () => ({
    connections: [mockPostgresConnection, mockMySQLConnection],
    activeConnection: mockPostgresConnection,
    onSelectConnection: defaultOnSelect,
    onDeleteConnection: defaultOnDelete,
    onEditConnection: defaultOnEdit,
    onAddConnection: defaultOnAdd,
  });

  test("dragging connections persists the order without selecting or changing a connection", () => {
    const props = orderedProps();
    const { getByRole, getAllByRole, unmount } = render(<ConnectionsList {...props} />);
    const handle = getByRole("button", { name: "Reorder Test PostgreSQL" });
    const transfer = { setData: mock(() => {}), effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(handle, { dataTransfer: transfer });
    fireEvent.dragOver(getAllByRole("listitem")[1], { dataTransfer: transfer });
    fireEvent.drop(getAllByRole("listitem")[1], { dataTransfer: transfer });
    expect(getAllByRole("listitem")[0].textContent).toContain("Test MySQL");
    expect(JSON.parse(localStorage.getItem("libredb_connection_order")!)).toEqual([
      mockMySQLConnection.id,
      mockPostgresConnection.id,
    ]);
    expect(defaultOnSelect).not.toHaveBeenCalled();
    expect(defaultOnDelete).not.toHaveBeenCalled();
    expect(localStorage.getItem("libredb_connections")).toBeNull();
    unmount();
    const restored = render(<ConnectionsList {...props} />);
    expect(restored.getAllByRole("listitem")[0].textContent).toContain("Test MySQL");
  });

  test("supports keyboard ordering and keeps focus on the moved drag handle", () => {
    const { getByRole, getAllByRole } = render(<ConnectionsList {...orderedProps()} />);
    const handle = getByRole("button", { name: "Reorder Test PostgreSQL" });
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(localStorage.getItem("libredb_connection_order")).toBeNull();
    fireEvent.keyDown(handle, { key: "ArrowUp", altKey: true });
    expect(localStorage.getItem("libredb_connection_order")).toBeNull();
    fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });
    expect(getAllByRole("listitem")[1].textContent).toContain("Test PostgreSQL");
    expect(document.activeElement).toBe(handle);
    fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(handle, { key: "ArrowUp", altKey: true });
    expect(getAllByRole("listitem")[0].textContent).toContain("Test PostgreSQL");
    fireEvent.click(handle);
    expect(defaultOnSelect).not.toHaveBeenCalled();
  });

  test("ignores external drops, cancelled drags and dropping onto the same connection", () => {
    const { getByRole, getAllByRole } = render(<ConnectionsList {...orderedProps()} />);
    const transfer = { setData: mock(() => {}), effectAllowed: "", dropEffect: "" };
    const handle = getByRole("button", { name: "Reorder Test PostgreSQL" });
    fireEvent.dragOver(getAllByRole("listitem")[1], { dataTransfer: transfer });
    fireEvent.drop(getAllByRole("listitem")[1], { dataTransfer: transfer });
    fireEvent.dragStart(handle, { dataTransfer: transfer });
    fireEvent.drop(getAllByRole("listitem")[0], { dataTransfer: transfer });
    fireEvent.dragStart(handle, { dataTransfer: transfer });
    fireEvent.dragEnd(handle);
    fireEvent.drop(getAllByRole("listitem")[1], { dataTransfer: transfer });
    expect(localStorage.getItem("libredb_connection_order")).toBeNull();
  });

  test("ignores invalid or missing stored IDs and appends new connections in their original order", () => {
    localStorage.setItem("libredb_connection_order", JSON.stringify(["missing", 42, mockMySQLConnection.id]));
    const { getAllByRole, unmount } = render(<ConnectionsList {...orderedProps()} />);
    expect(getAllByRole("listitem")[0].textContent).toContain("Test MySQL");
    unmount();
    localStorage.setItem("libredb_connection_order", JSON.stringify({ invalid: true }));
    const fallback = render(<ConnectionsList {...orderedProps()} />);
    expect(fallback.getAllByRole("listitem")[0].textContent).toContain("Test PostgreSQL");
  });

  test("updates mounted lists after another browser tab changes or clears the order", () => {
    const { getAllByRole, unmount } = render(<ConnectionsList {...orderedProps()} />);
    localStorage.setItem("libredb_connection_order", JSON.stringify([mockMySQLConnection.id]));
    act(() => window.dispatchEvent(new window.StorageEvent("storage", { key: "unrelated" })));
    expect(getAllByRole("listitem")[0].textContent).toContain("Test PostgreSQL");
    act(() => window.dispatchEvent(new window.StorageEvent("storage", { key: "libredb_connection_order" })));
    expect(getAllByRole("listitem")[0].textContent).toContain("Test MySQL");
    localStorage.clear();
    act(() => window.dispatchEvent(new window.StorageEvent("storage", { key: null })));
    expect(getAllByRole("listitem")[0].textContent).toContain("Test PostgreSQL");
    unmount();
    act(() => window.dispatchEvent(new window.StorageEvent("storage", { key: null })));
  });

  test("keeps the visible order when storage cannot save it", () => {
    const { getByRole, getAllByRole } = render(<ConnectionsList {...orderedProps()} />);
    const write = spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    try {
      fireEvent.keyDown(getByRole("button", { name: "Reorder Test PostgreSQL" }), { key: "ArrowDown", altKey: true });
      expect(getAllByRole("listitem")[0].textContent).toContain("Test PostgreSQL");
    } finally {
      write.mockRestore();
    }
  });

  test('renders "Connections" header', () => {
    const { queryByText } = render(
      <ConnectionsList
        connections={[]}
        activeConnection={null}
        onSelectConnection={defaultOnSelect}
        onDeleteConnection={defaultOnDelete}
        onAddConnection={defaultOnAdd}
      />,
    );

    expect(queryByText("Connections")).not.toBeNull();
  });

  test("shows empty state when no connections", () => {
    const { queryByText } = render(
      <ConnectionsList
        connections={[]}
        activeConnection={null}
        onSelectConnection={defaultOnSelect}
        onDeleteConnection={defaultOnDelete}
        onAddConnection={defaultOnAdd}
      />,
    );

    expect(queryByText("No database connections established yet.")).not.toBeNull();
    // Empty state has an "Add Connection" button
    expect(queryByText("Add Connection")).not.toBeNull();
  });

  test("renders ConnectionItem for each connection", () => {
    const connections = [mockPostgresConnection, mockMySQLConnection];

    const { queryByText } = render(
      <ConnectionsList
        connections={connections}
        activeConnection={null}
        onSelectConnection={defaultOnSelect}
        onDeleteConnection={defaultOnDelete}
        onEditConnection={defaultOnEdit}
        onAddConnection={defaultOnAdd}
      />,
    );

    // Each connection name should be rendered
    expect(queryByText("Test PostgreSQL")).not.toBeNull();
    expect(queryByText("Test MySQL")).not.toBeNull();
  });

  test("isActive prop passed correctly based on activeConnection", () => {
    const connections = [mockPostgresConnection, mockMySQLConnection];

    const { container } = render(
      <ConnectionsList
        connections={connections}
        activeConnection={mockPostgresConnection}
        onSelectConnection={defaultOnSelect}
        onDeleteConnection={defaultOnDelete}
        onEditConnection={defaultOnEdit}
        onAddConnection={defaultOnAdd}
      />,
    );

    // The active connection (PostgreSQL) should have active styling
    const items = container.querySelectorAll('[class*="cursor-pointer"]');
    const pgItem = Array.from(items).find((el) => el.textContent?.includes("Test PostgreSQL"));
    const mysqlItem = Array.from(items).find((el) => el.textContent?.includes("Test MySQL"));

    // Active item should have bg-brand-solid/10 class
    expect(pgItem?.className.includes("bg-brand-solid/10")).toBe(true);
    // Inactive item should not
    expect(mysqlItem?.className.includes("bg-brand-solid/10")).toBeFalsy();
  });

  test("onAddConnection fires from empty state button", () => {
    const { getByText } = render(
      <ConnectionsList
        connections={[]}
        activeConnection={null}
        onSelectConnection={defaultOnSelect}
        onDeleteConnection={defaultOnDelete}
        onAddConnection={defaultOnAdd}
      />,
    );

    const addButton = getByText("Add Connection");
    fireEvent.click(addButton);

    expect(defaultOnAdd).toHaveBeenCalledTimes(1);
  });

  test("clicking a connection calls onSelectConnection with that connection", () => {
    const { container } = render(
      <ConnectionsList
        connections={[mockPostgresConnection, mockMySQLConnection]}
        activeConnection={null}
        onSelectConnection={defaultOnSelect}
        onDeleteConnection={defaultOnDelete}
        onEditConnection={defaultOnEdit}
        onAddConnection={defaultOnAdd}
      />,
    );

    const items = container.querySelectorAll('[class*="cursor-pointer"]');
    const mysqlItem = Array.from(items).find((el) => el.textContent?.includes("Test MySQL"));
    fireEvent.click(mysqlItem!);

    expect(defaultOnSelect).toHaveBeenCalledTimes(1);
    expect(defaultOnSelect).toHaveBeenCalledWith(mockMySQLConnection);
  });

  test("delete button click calls onDeleteConnection with the connection id", () => {
    const { container } = render(
      <ConnectionsList
        connections={[mockPostgresConnection]}
        activeConnection={null}
        onSelectConnection={defaultOnSelect}
        onDeleteConnection={defaultOnDelete}
        onEditConnection={defaultOnEdit}
        onAddConnection={defaultOnAdd}
      />,
    );

    // First button is edit (Pencil), second is delete (Trash2)
    const buttons = container.querySelectorAll("button:not([draggable])");
    fireEvent.click(buttons[1]!);

    expect(defaultOnDelete).toHaveBeenCalledTimes(1);
    expect(defaultOnDelete).toHaveBeenCalledWith(mockPostgresConnection.id);
    // stopPropagation: the item itself must not be selected
    expect(defaultOnSelect).not.toHaveBeenCalled();
  });

  test("edit button click calls onEditConnection with the connection", () => {
    const { container } = render(
      <ConnectionsList
        connections={[mockPostgresConnection]}
        activeConnection={null}
        onSelectConnection={defaultOnSelect}
        onDeleteConnection={defaultOnDelete}
        onEditConnection={defaultOnEdit}
        onAddConnection={defaultOnAdd}
      />,
    );

    // First button is edit (Pencil), second is delete (Trash2)
    const buttons = container.querySelectorAll("button:not([draggable])");
    fireEvent.click(buttons[0]!);

    expect(defaultOnEdit).toHaveBeenCalledTimes(1);
    expect(defaultOnEdit).toHaveBeenCalledWith(mockPostgresConnection);
    expect(defaultOnSelect).not.toHaveBeenCalled();
  });

  test("omitting onEditConnection renders no edit button", () => {
    const { container } = render(
      <ConnectionsList
        connections={[mockPostgresConnection]}
        activeConnection={null}
        onSelectConnection={defaultOnSelect}
        onDeleteConnection={defaultOnDelete}
        onAddConnection={defaultOnAdd}
      />,
    );

    // Only the delete button remains when onEdit is not passed down
    const buttons = container.querySelectorAll("button:not([draggable])");
    expect(buttons.length).toBe(1);
    fireEvent.click(buttons[0]!);
    expect(defaultOnDelete).toHaveBeenCalledTimes(1);
  });

  test("does not show empty state when connections exist", () => {
    const { queryByText } = render(
      <ConnectionsList
        connections={[mockPostgresConnection]}
        activeConnection={null}
        onSelectConnection={defaultOnSelect}
        onDeleteConnection={defaultOnDelete}
        onAddConnection={defaultOnAdd}
      />,
    );

    expect(queryByText("No database connections established yet.")).toBeNull();
  });
});
