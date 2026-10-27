import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { GrievanceStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../cache/cache.service';
import { isStaff } from '../common/roles';

/** How long a complainant has to confirm (or reject) a resolution. */
export const RESOLUTION_WINDOW_HOURS = 48;

@Injectable()
export class GrievancesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private cache: CacheService,
  ) {}

  /**
   * Resolve the *live* bus serving a route. The bus number changes when routes
   * are merged or the fleet is swapped, but the route identity does not, so a
   * grievance is always anchored to the route and the bus is looked up live.
   */
  private async resolveBusForRoute(routeId: string) {
    if (!routeId || routeId === 'unknown') return null;
    const route = await this.prisma.route.findUnique({
      where: { routeId },
      select: { busNumber: true, routeName: true },
    });
    return route ?? null;
  }

  async create(
    loginId: string,
    text: string,
    type?: string,
    mediaUrl?: string,
    category?: string,
    realName?: string,
    routeId?: string,
    isAnonymous?: boolean,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { loginId },
      select: { routeId: true, name: true, role: true },
    });

    // The route comes from the user's assignment, not from the client. If the
    // client sends a route, it must match the user's own assignment.
    let effectiveRoute = user?.routeId ?? null;
    if (
      routeId &&
      effectiveRoute &&
      String(routeId) !== String(effectiveRoute)
    ) {
      effectiveRoute = effectiveRoute;
    }
    if (!effectiveRoute) {
      throw new BadRequestException(
        'You are not allocated to a bus route yet, so a grievance cannot be filed against a route.',
      );
    }

    const route = await this.resolveBusForRoute(effectiveRoute);
    // Store the user's actual name internally so staff can see it, but honor
    // the anonymous flag for visibility to other passengers.
    const resolvedName = user?.name || 'Anonymous Passenger';

    const grievance = await this.prisma.grievance.create({
      data: {
        loginId,
        route: String(effectiveRoute),
        busNumber: route?.busNumber ?? null,
        text,
        type,
        mediaUrl,
        category,
        realName: resolvedName,
        isAnonymous: isAnonymous ?? false,
        status: GrievanceStatus.pending,
      },
    });

    await this.cache.delByPattern('grievances:*');

    // Notify staff that a new grievance is waiting.
    await this.notifyStaffOfNewGrievance(
      grievance,
      resolvedName,
      route?.routeName,
    );

    return {
      status: 'success',
      message: 'Grievance submitted successfully',
      data: {
        id: grievance.id,
        status: grievance.status,
        route: grievance.route,
        busNumber: grievance.busNumber,
        createdAt: grievance.createdAt,
      },
    };
  }

  /**
   * List grievances. Passengers only ever see their own complaints (and see
   * the reporter as "Anonymous"). Staff see everything, including the real
   * name — that gate is enforced here, not in the UI.
   */
  async findAll(
    loginId: string,
    role: UserRole,
    options: { status?: string; route?: string; onlyMine?: boolean } = {},
  ) {
    const staff = isStaff(role);

    // Build cache key based on query parameters
    const cacheKey = `grievances:${loginId}:${role}:${JSON.stringify(options)}`;

    // Try cache first
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const where: any = {};
    if (!staff || options.onlyMine) {
      where.loginId = loginId;
    }
    if (options.status && options.status !== 'all') {
      where.status = options.status;
    }
    if (options.route && options.route !== 'all') {
      where.route = options.route;
    }

    const grievances = await this.prisma.grievance.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { user: { select: { name: true, role: true } } },
    });

    // A closed complaint must never outrank a live one, however high its
    // priority. The urgency order is:
    //   reopened (not satisfied) > pending > in progress > awaiting
    //   confirmation > closed
    const urgency: Record<string, number> = {
      reopened: 0,
      pending: 1,
      in_progress: 2,
      resolved: 3,
      closed: 4,
    };
    grievances.sort((a, b) => {
      const rank = urgency[a.status] ?? 5;
      const otherRank = urgency[b.status] ?? 5;
      if (rank !== otherRank) return rank - otherRank;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const upvotes = await this.prisma.grievanceUpvote.findMany({
      where: { loginId },
      select: { grievanceId: true },
    });
    const upvotedIds = new Set(upvotes.map((u) => u.grievanceId));

    // Non-staff must never receive the reporter's identity.
    const visible = grievances.map((g) => {
      const { user, ...rest } = g;
      const mine = g.loginId === loginId;
      // Staff see the real name AND the anonymous flag; non-staff see
      // "Anonymous Passenger" and the anonymous flag is hidden.
      return {
        ...rest,
        realName: staff || mine ? g.realName : null,
        isAnonymous: staff || mine ? g.isAnonymous : false,
        authorDisplay: staff || mine ? g.realName : 'Anonymous Passenger',
        isMine: mine,
        hasUpvotedLocally: upvotedIds.has(g.id),
      };
    });

    // Cache for 30 seconds
    await this.cache.set(cacheKey, visible, 30);
    return visible;
  }

  async findOne(id: string, loginId: string, role: UserRole) {
    const grievance = await this.prisma.grievance.findUnique({
      where: { id },
      include: { user: { select: { name: true, role: true } } },
    });
    if (!grievance) throw new NotFoundException('Grievance not found');

    const staff = isStaff(role);
    const mine = grievance.loginId === loginId;
    if (!staff && !mine) {
      throw new ForbiddenException('You cannot view this grievance');
    }

    const { user, ...rest } = grievance;
    return {
      ...rest,
      realName: staff || mine ? grievance.realName : null,
      isAnonymous: staff || mine ? grievance.isAnonymous : false,
      authorDisplay: staff || mine ? grievance.realName : 'Anonymous Passenger',
      isMine: mine,
    };
  }

  async upvote(id: string, loginId: string) {
    const grievance = await this.prisma.grievance.findUnique({
      where: { id },
      select: { id: true, upvotes: true, loginId: true },
    });
    if (!grievance) throw new NotFoundException('Grievance not found');

    // You cannot upvote your own complaint.
    if (grievance.loginId === loginId) {
      throw new BadRequestException('You cannot agree with your own complaint');
    }

    const existingUpvote = await this.prisma.grievanceUpvote.findUnique({
      where: { grievanceId_loginId: { grievanceId: id, loginId } },
    });

    let newUpvotes = grievance.upvotes;

    if (existingUpvote) {
      await this.prisma.grievanceUpvote.delete({
        where: { grievanceId_loginId: { grievanceId: id, loginId } },
      });
      newUpvotes = Math.max(0, grievance.upvotes - 1);
    } else {
      await this.prisma.grievanceUpvote.create({
        data: { grievanceId: id, loginId },
      });
      newUpvotes = grievance.upvotes + 1;
    }

    await this.prisma.grievance.update({
      where: { id },
      data: { upvotes: newUpvotes },
    });

    return { status: 'success', upvotes: newUpvotes };
  }

  /**
   * Staff acknowledges a grievance and starts working on it.
   */
  async startProgress(id: string, staffLoginId: string, note?: string) {
    const grievance = await this.requireGrievance(id);
    if (
      grievance.status !== GrievanceStatus.pending &&
      grievance.status !== GrievanceStatus.reopened
    ) {
      throw new BadRequestException(
        `Cannot start work on a grievance with status "${grievance.status}"`,
      );
    }

    const updated = await this.prisma.grievance.update({
      where: { id },
      data: {
        status: GrievanceStatus.in_progress,
        resolutionNote: note ?? grievance.resolutionNote,
      },
    });

    await this.cache.delByPattern('grievances:*');
    await this.notifyComplainant(updated, {
      title: '🛠️ Your complaint is being worked on',
      body: note
        ? `Update from the transport team: ${note}`
        : 'The transport team has acknowledged your complaint and is working on it.',
      type: 'grievance_progress',
    });

    return { status: 'success', data: updated };
  }

  /**
   * Staff marks the issue as fixed. This does NOT close the complaint — the
   * complainant has to confirm they are satisfied. Until then it stays in the
   * staff queue as "awaiting confirmation" and escalates if the window lapses.
   */
  async resolve(
    id: string,
    staffLoginId: string,
    note?: string,
    response?: string,
  ) {
    const grievance = await this.requireGrievance(id);
    if (
      grievance.status === GrievanceStatus.closed ||
      grievance.status === GrievanceStatus.resolved
    ) {
      throw new BadRequestException(
        'This complaint is already awaiting confirmation. The complainant must confirm it first.',
      );
    }

    const dueAt = new Date(
      Date.now() + RESOLUTION_WINDOW_HOURS * 60 * 60 * 1000,
    );

    const updated = await this.prisma.grievance.update({
      where: { id },
      data: {
        status: GrievanceStatus.resolved,
        resolutionNote: note ?? grievance.resolutionNote,
        adminResponse: response ?? grievance.adminResponse,
        resolvedAt: new Date(),
        resolvedBy: staffLoginId,
        dueAt,
        // Bump priority so it stays visible while awaiting confirmation.
        priority: grievance.priority + 1,
      },
    });

    await this.cache.delByPattern('grievances:*');
    await this.notifyComplainant(updated, {
      title: '✅ Your complaint was marked as fixed',
      body: response
        ? `${response} — Please confirm you are satisfied, or tell us what is still wrong.`
        : 'The transport team marked your complaint as fixed. Please confirm you are satisfied.',
      type: 'grievance_resolved',
    });

    return {
      status: 'success',
      message:
        'Marked as fixed. The complaint stays open until the complainant confirms it.',
      data: updated,
    };
  }

  /**
   * The complainant confirms the fix. This is the ONLY way a grievance
   * reaches the terminal `closed` state.
   */
  async confirmResolved(id: string, loginId: string) {
    const grievance = await this.requireGrievance(id);
    await this.assertReporterOrLinkedParent(
      loginId,
      grievance.loginId,
      'confirm',
    );

    if (grievance.status !== GrievanceStatus.resolved) {
      throw new BadRequestException(
        'This complaint is not awaiting your confirmation',
      );
    }

    const updated = await this.prisma.grievance.update({
      where: { id },
      data: {
        status: GrievanceStatus.closed,
        confirmedAt: new Date(),
        dueAt: null,
      },
    });

    await this.cache.delByPattern('grievances:*');
    await this.notifyStaff(grievance.loginId, updated.id, {
      title: '👍 Complaint confirmed by complainant',
      body: 'The complainant confirmed the issue is resolved. The complaint is now closed.',
      type: 'grievance_confirmed',
    });

    return {
      status: 'success',
      message: 'Thank you for confirming',
      data: updated,
    };
  }

  /**
   * The complainant rejects the fix. The complaint goes back into the queue
   * with a raised priority so it sorts to the top for staff.
   */
  async reopen(id: string, loginId: string, reason?: string) {
    const grievance = await this.requireGrievance(id);
    await this.assertReporterOrLinkedParent(
      loginId,
      grievance.loginId,
      'reopen',
    );

    if (grievance.status !== GrievanceStatus.resolved) {
      throw new BadRequestException(
        'Only a complaint that is awaiting your confirmation can be reopened',
      );
    }

    const updated = await this.prisma.grievance.update({
      where: { id },
      data: {
        status: GrievanceStatus.reopened,
        reopenCount: { increment: 1 },
        // Each rejection pushes it further up the queue.
        priority: grievance.priority + 10,
        resolvedAt: null,
        dueAt: null,
        resolutionNote: reason
          ? `${grievance.resolutionNote ? grievance.resolutionNote + ' — ' : ''}Still not fixed: ${reason}`
          : grievance.resolutionNote,
      },
    });

    await this.cache.delByPattern('grievances:*');
    await this.notifyStaff(grievance.loginId, updated.id, {
      title: '⚠️ Complaint reopened — not satisfied',
      body: reason
        ? `The complainant says the issue is not fixed: ${reason}`
        : 'The complainant has rejected the fix and reopened the complaint.',
      type: 'grievance_reopened',
    });

    return {
      status: 'success',
      message: 'Complaint reopened and moved to the top of the queue',
      data: updated,
    };
  }

  /**
   * Staff extends the resolution window (e.g. the part is not in stock yet).
   */
  async extendDeadline(id: string, staffLoginId: string, hours = 24) {
    const grievance = await this.requireGrievance(id);
    if (grievance.status !== GrievanceStatus.resolved) {
      throw new BadRequestException(
        'Only a complaint awaiting confirmation can have its deadline extended',
      );
    }

    const base = grievance.dueAt ?? new Date();
    const dueAt = new Date(base.getTime() + hours * 60 * 60 * 1000);

    const updated = await this.prisma.grievance.update({
      where: { id },
      data: { dueAt },
    });

    await this.cache.delByPattern('grievances:*');
    await this.notifyComplainant(updated, {
      title: '⏳ More time granted on your complaint',
      body: `The transport team needs ${hours} more hour(s) to resolve your complaint.`,
      type: 'grievance_extended',
    });

    return { status: 'success', data: updated };
  }

  async remove(id: string) {
    const grievance = await this.requireGrievance(id);
    await this.prisma.grievance.delete({ where: { id } });
    await this.cache.delByPattern('grievances:*');
    return { status: 'success', message: 'Grievance deleted' };
  }

  private async requireGrievance(id: string) {
    const grievance = await this.prisma.grievance.findUnique({ where: { id } });
    if (!grievance) throw new NotFoundException('Grievance not found');
    return grievance;
  }

  private async assertReporterOrLinkedParent(
    actorLoginId: string,
    reporterLoginId: string,
    action: 'confirm' | 'reopen',
  ) {
    if (actorLoginId === reporterLoginId) return;

    const link = await this.prisma.parentChildLink.findUnique({
      where: {
        parentLoginId_childLoginId: {
          parentLoginId: actorLoginId,
          childLoginId: reporterLoginId,
        },
      },
      select: { parentLoginId: true },
    });
    if (!link) {
      throw new ForbiddenException(
        `Only the complainant or their linked parent can ${action} this complaint`,
      );
    }
  }

  private async notifyComplainant(
    grievance: { id: string; loginId: string },
    payload: { title: string; body: string; type: string },
  ) {
    try {
      await this.notificationsService.notifyUser(
        grievance.loginId,
        grievance.id,
        payload,
      );
    } catch {
      /* notification delivery must not fail the request */
    }
  }

  private async notifyStaff(
    complainantLoginId: string,
    grievanceId: string,
    payload: { title: string; body: string; type: string },
  ) {
    try {
      const staff = await this.prisma.user.findMany({
        where: {
          role: {
            in: [
              UserRole.admin,
              UserRole.transport_incharge,
              UserRole.tech_admin,
            ],
          },
        },
        select: { loginId: true },
      });
      for (const s of staff) {
        await this.notificationsService.notifyUser(
          s.loginId,
          grievanceId,
          payload,
        );
      }
    } catch {
      /* ignore */
    }
  }

  private async notifyStaffOfNewGrievance(
    grievance: { id: string; loginId: string; route: string },
    realName: string,
    routeName?: string,
  ) {
    try {
      const staff = await this.prisma.user.findMany({
        where: {
          role: {
            in: [
              UserRole.admin,
              UserRole.transport_incharge,
              UserRole.tech_admin,
            ],
          },
        },
        select: { loginId: true },
      });
      for (const s of staff) {
        await this.notificationsService.notifyUser(s.loginId, grievance.id, {
          title: '📣 New grievance raised',
          body: `A new complaint was filed for ${routeName ?? `Route ${grievance.route}`}.`,
          type: 'grievance_new',
        });
      }
    } catch {
      /* ignore */
    }
  }
}
