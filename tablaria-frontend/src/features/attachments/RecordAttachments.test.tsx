import type { Attachment } from "@tablaria/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { RecordAttachments } from "./RecordAttachments";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const TABLE_ID = "6a7b8c9d-1111-4aaa-8bbb-000000000001";
const RECORD_ID = "6a7b8c9d-2222-4aaa-8bbb-000000000002";
const BASE = `/api/tables/${TABLE_ID}/records/${RECORD_ID}/attachments`;

const photo: Attachment = {
  id: "6a7b8c9d-3333-4aaa-8bbb-000000000003",
  name: "taladro.jpg",
  contentType: "image/jpeg",
  size: 840_000,
  createdAt: "",
};
const manual: Attachment = {
  id: "6a7b8c9d-4444-4aaa-8bbb-000000000004",
  name: "manual.pdf",
  contentType: "application/pdf",
  size: 2_400_000,
  createdAt: "",
};

function mockAttachments(attachments: Attachment[], demo = false) {
  return mockApi((url, init) => {
    if (url.pathname === "/api/auth/me") {
      return { id: "user", email: "ana@example.com", demoExpiresAt: demo ? "2030-01-01T00:00:00.000Z" : null };
    }
    if (init.method === "POST") {
      return { ...photo, id: "6a7b8c9d-5555-4aaa-8bbb-000000000005", name: "nueva.png" };
    }
    return attachments;
  });
}

describe("RecordAttachments", () => {
  it("shows photos as images and documents as tiles, each opening the file", async () => {
    mockAttachments([photo, manual]);
    renderWithProviders(<RecordAttachments tableId={TABLE_ID} recordId={RECORD_ID} canEdit={false} />);

    const image = await screen.findByRole("img", { name: "taladro.jpg" });
    expect(image).toHaveAttribute("src", `${BASE}/${photo.id}`);
    expect(screen.getByRole("link", { name: /manual\.pdf/ })).toHaveAttribute("href", `${BASE}/${manual.id}`);
    expect(screen.getByText(/2,3\sMB/)).toBeVisible();
    expect(screen.getByText("2 de 10")).toBeVisible();
    // Viewers can open files, not change them.
    expect(screen.queryByRole("button", { name: "Añadir archivos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Eliminar/ })).not.toBeInTheDocument();
  });

  it("uploads the files an editor picks, and refuses other types before sending them", async () => {
    const fetchMock = mockAttachments([]);
    renderWithProviders(<RecordAttachments tableId={TABLE_ID} recordId={RECORD_ID} canEdit />);
    const user = userEvent.setup({ applyAccept: false });

    await screen.findByText(/Añade fotos o documentos/);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    await user.upload(input!, [
      new File(["png"], "nueva.png", { type: "image/png" }),
      new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }),
    ]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE}?name=nueva.png`,
        expect.objectContaining({ method: "POST", headers: { "Content-Type": "image/png" } }),
      ),
    );
    const uploads = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(uploads).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/^No se puede subir logo\.svg/));
  });

  it("asks before deleting a file", async () => {
    const fetchMock = mockAttachments([photo]);
    renderWithProviders(<RecordAttachments tableId={TABLE_ID} recordId={RECORD_ID} canEdit />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Eliminar taladro.jpg" }));
    await user.click(screen.getByRole("button", { name: "Eliminar archivo" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`${BASE}/${photo.id}`, expect.objectContaining({ method: "DELETE" })),
    );
  });

  it("explains that the demo cannot upload", async () => {
    mockAttachments([], true);
    renderWithProviders(<RecordAttachments tableId={TABLE_ID} recordId={RECORD_ID} canEdit />);

    expect(await screen.findByText(/En la demo no se pueden subir archivos/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Añadir archivos" })).not.toBeInTheDocument();
  });
});
