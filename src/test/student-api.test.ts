import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getStudentNotifications,
  loginStudent,
  markStudentNotificationRead,
} from "@/lib/student-api";

const API_BASE_URL = (import.meta.env["VITE_API_URL"] || "/api").replace(/\/+$/, "");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("student notification API", () => {
  it("authenticates students and rejects accounts without the volunteer role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "student-jwt",
          data: {
            id: "student-1",
            name: "Student",
            email: "student@example.org",
            role: "VOLUNTEER",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "admin-jwt",
          data: { id: "admin-1", name: "Admin", email: "admin@example.org", role: "ADMIN" },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginStudent("MT4507", "password")).resolves.toMatchObject({
      token: "student-jwt",
      user: { role: "VOLUNTEER" },
    });
    await expect(loginStudent("admin@example.org", "password")).rejects.toThrow("student account");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE_URL}/student/auth/login`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ identifier: "MT4507", password: "password" }),
      }),
    );
  });

  it("loads student-scoped notifications and marks an item as read", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "notification-1",
              type: "opportunity_matching",
              title: "🌱 New opportunity",
              body: "Join us",
              deepLink: "/opportunities/event-1",
              readAt: null,
              createdAt: "2030-01-01T00:00:00.000Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { read: true } }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getStudentNotifications("student-jwt")).resolves.toHaveLength(1);
    await markStudentNotificationRead("student-jwt", "notification/1");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_BASE_URL}/student/notifications/notification%2F1/read`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer student-jwt" }),
      }),
    );
  });
});
