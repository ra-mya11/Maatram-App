import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStudentNotifications: vi.fn(),
  loginStudent: vi.fn(),
  markStudentNotificationRead: vi.fn(),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
  STUDENT_TOKEN_KEY: "maatram-student-notification-token",
  STUDENT_USER_KEY: "maatram-student-notification-user",
}));

vi.mock("@/lib/student-api", () => ({
  getStudentNotifications: mocks.getStudentNotifications,
  loginStudent: mocks.loginStudent,
  markStudentNotificationRead: mocks.markStudentNotificationRead,
  SOCKET_URL: "https://api.example.org",
  STUDENT_TOKEN_KEY: mocks.STUDENT_TOKEN_KEY,
  STUDENT_USER_KEY: mocks.STUDENT_USER_KEY,
}));

vi.mock("@/lib/web-push", () => ({
  subscribeToPush: mocks.subscribeToPush,
  unsubscribeFromPush: mocks.unsubscribeFromPush,
}));

vi.mock("socket.io-client", () => ({
  io: () => ({ on: vi.fn(), disconnect: vi.fn() }),
}));

import { StudentNotifications } from "@/components/StudentNotifications";

describe("student push notifications", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    mocks.getStudentNotifications.mockResolvedValue([]);
    mocks.loginStudent.mockResolvedValue({
      token: "student-jwt",
      user: { id: "student-1", name: "Student", email: "student@example.org", role: "VOLUNTEER" },
    });
    mocks.subscribeToPush.mockResolvedValue(true);
  });

  it("requests push subscription only after the student explicitly clicks enable", async () => {
    render(<StudentNotifications onUnreadChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Maatram ID or email"), {
      target: { value: "MT4507" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect account" }));

    await screen.findByText("Notifications for Student");
    expect(mocks.subscribeToPush).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Enable browser notifications" }));

    await waitFor(() => expect(mocks.subscribeToPush).toHaveBeenCalledWith("student-jwt"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Browser notifications are enabled on this device.",
    );
  });

  it("reuses the QR login session without showing a second account login form", async () => {
    sessionStorage.setItem(mocks.STUDENT_TOKEN_KEY, "student-jwt");
    sessionStorage.setItem(
      mocks.STUDENT_USER_KEY,
      JSON.stringify({
        id: "student-1",
        name: "Student",
        email: "student@example.org",
        role: "VOLUNTEER",
      }),
    );

    render(<StudentNotifications onUnreadChange={vi.fn()} />);

    expect(await screen.findByText("Notifications for Student")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect account" })).not.toBeInTheDocument();
  });
});
