export const USER_ROLES = ["admin", "dm", "player"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MEMBERSHIP_ROLES = ["dm", "player"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export interface CharacterForgeUser {
  id: number;
  username: string;
  passwordHash: string;
  role: UserRole;
  displayName: string | null;
  createdAt: string;
}

export interface CharacterForgeCampaign {
  id: number;
  name: string;
  description: string | null;
  dmId: number;
  isActive: boolean;
  createdAt: string;
}

export interface CharacterForgeMembership {
  id: number;
  campaignId: number;
  userId: number;
  role: MembershipRole;
  approved: boolean;
  joinedAt: string;
}

export interface CharacterForgeCharacterIdentity {
  id: number;
  ownerId: number | null;
  campaignId: number | null;
  isNpc: boolean;
  name: string;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}
