import { UserRole } from '@prisma/client';

/**
 * Role hierarchy. Higher number = more privilege.
 *
 * `admin` sits above `tech_admin` for the operational portal because a campus
 * admin manages users, routes and grievances; `tech_admin` is the system
 * operator. Both are handled by the staff guard, but the *system* endpoints
 * (health metrics, raw logs) remain reserved for `tech_admin`.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.passenger]: 0,
  [UserRole.parent]: 0,
  [UserRole.teacher]: 0,
  [UserRole.driver]: 1,
  [UserRole.transport_incharge]: 2,
  [UserRole.tech_admin]: 3,
  [UserRole.admin]: 4,
};

/** Roles allowed to operate the staff/admin dashboards. */
export const STAFF_ROLES: UserRole[] = [
  UserRole.admin,
  UserRole.transport_incharge,
  UserRole.tech_admin,
];

/** Roles that may be assigned to a newly created account by a staff member. */
export const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.passenger,
  UserRole.teacher,
  UserRole.parent,
  UserRole.driver,
  UserRole.transport_incharge,
];

export function isStaff(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

/**
 * Guards against privilege escalation: a transport_incharge must not be able to
 * mint an `admin` or `tech_admin` account, and nobody below admin may create
 * an admin. `tech_admin` may create admins (it is the system operator), and
 * `admin` may create `tech_admin` (system operator accounts are provisioned
 * by the campus admin).
 */
export function canAssignRole(
  actorRole: UserRole,
  targetRole: UserRole,
): boolean {
  if (!ASSIGNABLE_ROLES.includes(targetRole)) {
    // Only an admin/tech_admin may mint another admin or tech_admin.
    if (targetRole === UserRole.admin || targetRole === UserRole.tech_admin) {
      return actorRole === UserRole.admin || actorRole === UserRole.tech_admin;
    }
    return false;
  }
  // You may not create an account more privileged than yourself.
  return ROLE_RANK[targetRole] <= ROLE_RANK[actorRole];
}
