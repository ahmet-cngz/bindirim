import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import NotificationSettings from "./NotificationSettings";
import type { User } from "../../../types/models";

const user: User = {
  id: 1, email: "owner@example.com", date_joined: "2026-10-19T00:00:00Z",
  email_notifications_enabled: false, email_notifications_available: true,
};

test("saves the email preference and reflects the confirmed server value", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const { rerender } = render(<NotificationSettings user={user} onSave={onSave} />);
  fireEvent.click(screen.getByRole("switch"));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ email_notifications_enabled: true }));
  await waitFor(() => expect(screen.getByRole("switch")).toBeEnabled());
  rerender(<NotificationSettings user={{ ...user, email_notifications_enabled: true }} onSave={onSave} />);
  expect(screen.getByRole("switch")).toBeChecked();
});

test("blocks opt-in without provider configuration but allows opt-out", () => {
  const onSave = jest.fn();
  const { rerender } = render(<NotificationSettings user={{ ...user, email_notifications_available: false }} onSave={onSave} />);
  expect(screen.getByRole("switch")).toBeDisabled();
  expect(screen.getByText("E-posta bildirimleri henüz etkinleştirilmedi.")).toBeInTheDocument();
  rerender(<NotificationSettings user={{ ...user, email_notifications_available: false, email_notifications_enabled: true }} onSave={onSave} />);
  expect(screen.getByRole("switch")).toBeEnabled();
});

test("shows failed saves without changing the saved preference", async () => {
  render(<NotificationSettings user={user} onSave={jest.fn().mockRejectedValue(new Error("Save failed"))} />);
  fireEvent.click(screen.getByRole("switch"));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("switch")).not.toBeChecked();
  expect(screen.getByRole("switch")).toBeEnabled();
});
