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

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { render, fireEvent, cleanup, within, act } from "@testing-library/react";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { storage } from "@/lib/storage";
import { mockToastError } from "../../helpers/mock-sonner";

import { ConnectionsList } from "@/components/sidebar/ConnectionsList";
import { mockPostgresConnection, mockMySQLConnection } from "../../fixtures/connections";

// =============================================================================
// ConnectionsList Tests
// =============================================================================

describe("ConnectionsList", () => {
  test("passes duplicate requests to the connection editor", () => {
    const onDuplicateConnection = mock(() => {});
    const view = render(
      <ConnectionsList
        connections={[mockPostgresConnection]}
        activeConnection={null}
        onSelectConnection={mock(() => {})}
        onDeleteConnection={mock(() => {})}
        onAddConnection={mock(() => {})}
        onDuplicateConnection={onDuplicateConnection}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Duplicate connection" }));
    expect(onDuplicateConnection).toHaveBeenCalledWith(mockPostgresConnection);
  });
  const defaultOnSelect = mock(() => {});
  const defaultOnDelete = mock(() => {});
  const defaultOnEdit = mock(() => {});
  const defaultOnAdd = mock(() => {});

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    mockToastError.mockClear();
    defaultOnSelect.mockClear();
    defaultOnDelete.mockClear();
    defaultOnEdit.mockClear();
    defaultOnAdd.mockClear();
  });

  const favoriteProps = () => ({
    connections: [
      mockPostgresConnection,
      mockMySQLConnection,
      { ...mockPostgresConnection, id: "managed", name: "Managed DB", managed: true },
    ],
    activeConnection: mockPostgresConnection,
    onSelectConnection: defaultOnSelect,
    onDeleteConnection: defaultOnDelete,
    onEditConnection: defaultOnEdit,
    onAddConnection: defaultOnAdd,
  });

  test("favorites persist across remount and preserve the order and settings of other connections", () => {
    const props = favoriteProps();
    const original = structuredClone(props.connections);
    const view = render(<ConnectionsList {...props} />);
    fireEvent.click(view.getByRole("button", { name: "Add Test MySQL to favorites" }));
    expect(defaultOnSelect).not.toHaveBeenCalled();
    expect(within(view.getByRole("group", { name: "Favorites" })).getByText("Test MySQL") !== null).toBe(true);
    expect(view.container.textContent!.indexOf("Favorites")).toBeLessThan(
      view.container.textContent!.indexOf("Connections"),
    );
    const remaining = view.getByRole("group", { name: "Connections" });
    expect(remaining.textContent!.indexOf("Test PostgreSQL")).toBeLessThan(
      remaining.textContent!.indexOf("Managed DB"),
    );
    view.unmount();
    const restored = render(<ConnectionsList {...props} />);
    expect(
      restored.getByRole("button", { name: "Remove Test MySQL from favorites" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(restored.getByRole("button", { name: "Remove Test MySQL from favorites" }));
    expect(restored.queryByRole("group", { name: "Favorites" }) === null).toBe(true);
    expect(storage.getFavoriteConnectionIds()).toEqual([]);
    expect(props.connections).toEqual(original);
    expect(storage.getConnections()).toEqual([]);
  });

  test("managed connections can be favorited and every mounted list sees the toggle", () => {
    const props = favoriteProps();
    const first = render(<ConnectionsList {...props} />);
    const second = render(<ConnectionsList {...props} />);
    fireEvent.click(within(first.container).getByRole("button", { name: "Add Managed DB to favorites" }));
    expect(within(second.container).getByRole("button", { name: "Remove Managed DB from favorites" }) !== null).toBe(
      true,
    );
    expect(storage.getFavoriteConnectionIds()).toEqual(["managed"]);
    expect(storage.getConnections()).toEqual([]);
    act(() => storage.saveConnection(mockPostgresConnection));
    expect(within(second.container).getByRole("group", { name: "Favorites" }).textContent).toContain("Managed DB");
  });

  test("all-favorite lists have no empty connections group and server rendering uses an empty preference", () => {
    const props = favoriteProps();
    localStorage.setItem("libredb_favorite_connections", JSON.stringify(props.connections.map((conn) => conn.id)));
    const html = ReactDOMServer.renderToString(<ConnectionsList {...props} />);
    expect(html).not.toContain('aria-label="Favorites"');
    const view = render(<ConnectionsList {...props} />);
    expect(view.queryByRole("group", { name: "Connections" }) === null).toBe(true);
    expect(view.queryByText("No database connections established yet.") === null).toBe(true);
    expect(view.getByRole("group", { name: "Favorites" }).querySelectorAll('[aria-pressed="true"]').length).toBe(3);
  });

  test("a failed favorite write leaves the list unchanged and reports the failure", () => {
    const view = render(<ConnectionsList {...favoriteProps()} />);
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error("Storage full");
    };
    try {
      fireEvent.click(view.getByRole("button", { name: "Add Test MySQL to favorites" }));
      expect(view.queryByRole("group", { name: "Favorites" }) === null).toBe(true);
      expect(mockToastError).toHaveBeenCalledWith("Could not save the connection favorite.");
    } finally {
      localStorage.setItem = original;
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
    const buttons = container.querySelectorAll("button");
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
    const buttons = container.querySelectorAll("button");
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

    // Delete and favorite remain when onEdit is not passed down.
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
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
