import type { TeamMember, User } from "@/types";
import { api } from "./apiClient";

export async function getUsersList(): Promise<TeamMember[]> {
  const res = await api.get<{ items: TeamMember[] }>("/api/users");
  return res.items;
}

export async function updateUserRole(
  id: string,
  role: User["role"],
): Promise<User> {
  return api.patch<User>(`/api/users/${id}/role`, { role });
}

export async function removeUser(id: string): Promise<void> {
  return api.delete(`/api/users/${id}`);
}

export async function transferOwnership(
  targetUserId: string,
  confirmation: string,
): Promise<{
  previousAdmin: { id: string; email: string; role: string };
  newAdmin: { id: string; email: string; role: string };
}> {
  return api.post("/api/users/transfer-ownership", {
    targetUserId,
    confirmation,
  });
}
