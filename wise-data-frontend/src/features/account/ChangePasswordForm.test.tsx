import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "@/test/render";
import { ChangePasswordForm } from "./ChangePasswordForm";

describe("ChangePasswordForm", () => {
  it("clears both passwords once the change is saved", async () => {
    const user = userEvent.setup();
    mockApi(() => ({}));
    renderWithProviders(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Contraseña actual"), "una contraseña vieja");
    await user.type(screen.getByLabelText("Nueva contraseña"), "una contraseña nueva y larga");
    await user.click(screen.getByRole("button", { name: /Cambiar/ }));

    await waitFor(() => expect(screen.getByLabelText("Contraseña actual")).toHaveValue(""));
    expect(screen.getByLabelText("Nueva contraseña")).toHaveValue("");
  });
});
