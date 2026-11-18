import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDraft } from "@/data/admin-mock";
import {
  createOpportunity,
  loginPulseUser,
  startPulseBroadcast,
  toPulseEvent,
} from "@/lib/pulse-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PULSE API integration", () => {
  it("maps backend opportunity status, registrations, skills, and capacity", () => {
    const event = toPulseEvent({
      id: "opportunity-1",
      title: "Tree Planting",
      category: "Environment",
      location: "Madurai, Tamil Nadu",
      city: "Madurai",
      startsAt: "2030-01-10T03:30:00.000Z",
      endsAt: "2030-01-10T06:30:00.000Z",
      capacity: 50,
      status: "FULL",
      broadcastStopped: true,
      registrations: [{ id: "registration-1" }],
      skills: [{ skillName: "Teamwork" }],
    });

    expect(event).toMatchObject({
      id: "opportunity-1",
      name: "Tree Planting",
      status: "Live",
      apiStatus: "FULL",
      broadcastStopped: true,
      registered: 1,
      needed: 50,
      tags: ["Teamwork"],
    });
  });

  it("rejects publishing an event whose date has passed before making an API request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createOpportunity("test-token", { ...defaultDraft, date: "Jan 01, 2020" }),
    ).rejects.toThrow("Choose a future event date and time");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in using the API and rejects volunteer-only accounts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({
          token: "admin-jwt",
          data: { id: "admin-1", email: "admin@example.org", name: "Admin", role: "ADMIN" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({
          token: "volunteer-jwt",
          data: {
            id: "volunteer-1",
            email: "student@example.org",
            name: "Student",
            role: "VOLUNTEER",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginPulseUser("admin@example.org", "password")).resolves.toMatchObject({
      token: "admin-jwt",
      user: { role: "ADMIN" },
    });
    await expect(loginPulseUser("student@example.org", "password")).rejects.toThrow(
      "admin or organiser account",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("explains when a frontend route returns HTML instead of an API response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "Content-Type": "text/html; charset=utf-8" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginPulseUser("admin@example.org", "password")).rejects.toThrow(
      "The notification API returned a non-JSON response (404)",
    );
  });

  it("starts a real broadcast with the admin token and an idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({
        data: {
          campaignId: "campaign-1",
          escalationScheduled: true,
          tier1: { sent: 5, status: "completed" },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "request-key" });

    await expect(startPulseBroadcast("admin-jwt", "opportunity-1")).resolves.toMatchObject({
      campaignId: "campaign-1",
      tier1: { sent: 5, status: "completed" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/opportunities\/opportunity-1\/broadcast$/),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer admin-jwt",
          "Idempotency-Key": "request-key",
        },
      }),
    );
  });
});
