import type { AssistantReply } from "@tablaria/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { AssistantButton, AssistantProvider } from "./Assistant";

const TABLE_ID = "6a7b8c9d-1111-4aaa-8bbb-000000000001";
const RECORD_ID = "6a7b8c9d-2222-4aaa-8bbb-000000000002";

const reply: AssistantReply = {
  message: "Quedan 3 taladros, por debajo del mínimo de 5.",
  sources: [{ tableId: TABLE_ID, tableName: "Productos", recordId: RECORD_ID, label: "Taladro" }],
  remaining: 14,
};

describe("Assistant", () => {
  beforeEach(() => localStorage.clear());

  it("warns what is sent before the first question, then answers with links to its sources", async () => {
    const fetchMock = mockApi((url) =>
      url.pathname === "/api/assistant/chat" ? reply : { enabled: true, limit: 15, remaining: 15 },
    );
    const user = userEvent.setup();
    renderWithProviders(<AssistantProvider><AssistantButton /></AssistantProvider>, { route: `/app/tables/${TABLE_ID}`, path: "/app/tables/:tableId" });

    await user.click(await screen.findByRole("button", { name: "Asistente" }));
    expect(screen.getByText(/envía tu pregunta y los datos de las tablas que puedes ver/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Entendido, empezar" }));

    await user.click(screen.getByRole("button", { name: "¿Qué está bajo mínimo?" }));

    expect(await screen.findByText(reply.message)).toBeVisible();
    expect(screen.getByRole("link", { name: "Taladro" })).toHaveAttribute(
      "href",
      `/app/tables/${TABLE_ID}?record=${RECORD_ID}`,
    );
    expect(screen.getByText("Te quedan 14 preguntas de 15 hoy.")).toBeVisible();
    // It starts from the table the user has open.
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      messages: [{ role: "user", content: "¿Qué está bajo mínimo?" }],
      tableId: TABLE_ID,
    });
  });

  it("says when today's questions are used up", async () => {
    localStorage.setItem("tablaria:assistant-notice", "1");
    mockApi(() => ({ enabled: true, limit: 5, remaining: 0 }));
    const user = userEvent.setup();
    renderWithProviders(<AssistantProvider><AssistantButton /></AssistantProvider>);

    await user.click(await screen.findByRole("button", { name: "Asistente" }));
    expect(screen.getByLabelText("Tu pregunta")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preguntar" })).toBeDisabled();
  });

  it("is not offered when the API has no model", async () => {
    const fetchMock = mockApi(() => ({ enabled: false, limit: 15, remaining: 15 }));
    renderWithProviders(<AssistantProvider><AssistantButton /></AssistantProvider>);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Asistente" })).not.toBeInTheDocument();
  });

  it("opens with Ctrl+K from anywhere", async () => {
    localStorage.setItem("tablaria:assistant-notice", "1");
    mockApi(() => ({ enabled: true, limit: 15, remaining: 15 }));
    const user = userEvent.setup();
    renderWithProviders(<AssistantProvider><AssistantButton /></AssistantProvider>);

    await screen.findByRole("button", { name: "Asistente" });
    await user.keyboard("{Control>}k{/Control}");
    expect(await screen.findByLabelText("Tu pregunta")).toBeVisible();
  });
});
