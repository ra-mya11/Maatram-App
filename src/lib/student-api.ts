const API_BASE_URL = (import.meta.env["VITE_API_URL"] || "/api").replace(/\/+$/, "");

export const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");
export const STUDENT_TOKEN_KEY = "maatram-student-notification-token";
export const STUDENT_USER_KEY = "maatram-student-notification-user";

export type StudentAccount = {
  id: string;
  name: string;
  email: string;
  role: "VOLUNTEER";
  profile?: {
    maatramId: string | null;
    college?: string | null;
    department?: string | null;
    degree?: string | null;
    academicYear?: string | null;
    city?: string | null;
    district?: string | null;
    profilePhoto?: string | null;
  };
};

export type StudentNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
};

type ApiResponse<T> = { data: T; token?: string; error?: string };

async function request<T>(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

export async function loginStudent(identifier: string, password: string) {
  const result = await request<StudentAccount>("/student/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  if (!result.token) throw new Error("The API did not return a student session.");
  if (result.data.role !== "VOLUNTEER") {
    throw new Error("Sign in with a student account to view student notifications.");
  }
  return { token: result.token, user: result.data };
}

export async function getStudentNotifications(token: string) {
  const result = await request<StudentNotification[]>("/student/notifications", {}, token);
  return result.data;
}

export async function markStudentNotificationRead(token: string, notificationId: string) {
  await request(
    `/student/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
    token,
  );
}

export async function getAdminNotifications(token: string) {
  const result = await request<StudentNotification[]>("/notifications", {}, token);
  return result.data;
}

export async function markAdminNotificationRead(token: string, notificationId: string) {
  await request(
    `/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PATCH" },
    token,
  );
}
