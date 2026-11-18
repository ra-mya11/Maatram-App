import type { AdminEvent, EventDraft } from "@/data/admin-mock";
import palmSeedsImage from "@/assets/admin/palm-seeds-event-image.png";

const API_BASE_URL = (import.meta.env["VITE_API_URL"] || "/api").replace(/\/+$/, "");

export type PulseUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "ORGANISER" | "VOLUNTEER";
};

export type ApiOpportunity = {
  id: string;
  title: string;
  category?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  location: string;
  city?: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: string;
  broadcastStopped?: boolean;
  registrations?: Array<{ id: string }>;
  skills?: Array<{ skillName: string }>;
};

export type PulseEvent = AdminEvent & {
  apiStatus: string;
  broadcastStopped: boolean;
};

export type BroadcastStartResult = {
  campaignId: string;
  escalationScheduled: boolean;
  tier1: { sent: number; status: string };
};

export type BroadcastStatus = {
  campaignId: string;
  status: string;
  currentTier: string | null;
  targeted: number;
  tiers: Array<{ tierName: string; status: string; audienceCount: number }>;
  escalationScheduled: boolean;
};

type ApiResponse<T> = { data: T; token?: string; error?: string };

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new Error(
      `The notification API returned a non-JSON response (${response.status}). Check VITE_API_URL and backend CORS settings.`,
    );
  }
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

export async function loginPulseUser(email: string, password: string) {
  const result = await request<PulseUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!result.token) throw new Error("The API did not return an access token.");
  if (result.data.role !== "ADMIN" && result.data.role !== "ORGANISER") {
    throw new Error("Sign in with an admin or organiser account to use PULSE.");
  }
  return { token: result.token, user: result.data };
}

export async function getPulseUser(token: string) {
  const result = await request<PulseUser>("/auth/me", {}, token);
  if (result.data.role !== "ADMIN" && result.data.role !== "ORGANISER") {
    throw new Error("This account does not have admin or organiser access.");
  }
  return result.data;
}

export async function getOrganiserOpportunities(token: string) {
  const result = await request<ApiOpportunity[]>("/organiser/opportunities", {}, token);
  return result.data.map(toPulseEvent);
}

export async function createOpportunity(token: string, draft: EventDraft) {
  const result = await request<ApiOpportunity>(
    "/opportunities",
    { method: "POST", body: JSON.stringify(toCreatePayload(draft)) },
    token,
  );
  return result.data;
}

export async function publishOpportunity(token: string, opportunityId: string) {
  await request(
    `/opportunities/${encodeURIComponent(opportunityId)}/publish`,
    { method: "POST" },
    token,
  );
}

export async function startPulseBroadcast(token: string, opportunityId: string) {
  const result = await request<BroadcastStartResult>(
    `/opportunities/${encodeURIComponent(opportunityId)}/broadcast`,
    {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    },
    token,
  );
  return result.data;
}

export async function getPulseBroadcastStatus(token: string, opportunityId: string) {
  const result = await request<BroadcastStatus | null>(
    `/opportunities/${encodeURIComponent(opportunityId)}/broadcast-status`,
    {},
    token,
  );
  return result.data;
}

export function toPulseEvent(opportunity: ApiOpportunity): PulseEvent {
  const startsAt = new Date(opportunity.startsAt);
  const endsAt = new Date(opportunity.endsAt);
  const validStart = Number.isFinite(startsAt.getTime());
  const validEnd = Number.isFinite(endsAt.getTime());
  const status =
    opportunity.status === "OPEN" || opportunity.status === "FULL"
      ? "Live"
      : opportunity.status === "DRAFT"
        ? "Upcoming"
        : "Completed";

  return {
    id: opportunity.id,
    name: opportunity.title,
    category: opportunity.category || "Community Service",
    status,
    date: validStart
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }).format(startsAt)
      : "Date unavailable",
    location: opportunity.city || opportunity.location,
    fullLocation: opportunity.location,
    time:
      validStart && validEnd
        ? `${formatTime(startsAt)} – ${formatTime(endsAt)}`
        : "Time unavailable",
    registered: opportunity.registrations?.length ?? 0,
    needed: opportunity.capacity,
    image: opportunity.imageUrl || palmSeedsImage,
    tags: opportunity.skills?.map((skill) => skill.skillName) ?? [],
    apiStatus: opportunity.status,
    broadcastStopped: Boolean(opportunity.broadcastStopped),
  };
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

function toCreatePayload(draft: EventDraft) {
  const firstSlot = draft.schedule[0]?.time;
  const lastSlot = draft.schedule[draft.schedule.length - 1]?.time;
  const timeRange = firstSlot && lastSlot ? `${firstSlot} – ${lastSlot}` : draft.time;
  const [startTime, endTime] = timeRange.split(/\s+[–—-]\s+/);
  const startsAt = new Date(`${draft.date} ${startTime}`);
  const endsAt = new Date(`${draft.date} ${endTime}`);

  if (
    !startTime ||
    !endTime ||
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime())
  ) {
    throw new Error("Enter a valid event date and start/end time before publishing.");
  }
  if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
  if (startsAt <= new Date()) {
    throw new Error("Choose a future event date and time before publishing.");
  }

  const registrationDeadline = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
  const [city] = draft.location.split(",");

  return {
    title: draft.name.trim(),
    category: draft.type,
    description: draft.description.trim(),
    location: draft.location.trim(),
    city: city?.trim() || undefined,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    registrationDeadline: registrationDeadline.toISOString(),
    capacity: draft.volunteers,
    requirements: draft.tags,
    guidePurpose: draft.purpose,
    guideResponsibilities: draft.responsibilities,
    guidePreparation: draft.preparation,
    schedule: draft.schedule.map((item) => ({
      time: item.time,
      title: item.label,
      description: "",
    })),
    contactName: draft.contactName,
    contactPhone: draft.phone,
    contactEmail: draft.email,
  };
}
