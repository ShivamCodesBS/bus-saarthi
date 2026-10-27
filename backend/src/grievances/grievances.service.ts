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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

/** How long a complainant has to confirm (or reject) a resolution. */
export const RESOLUTION_WINDOW_HOURS = 48;

@Injectable()
export class GrievancesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private cache: CacheService,
    private eventEmitter: EventEmitter2,
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

    // The route comes from the user's assignment, not from the client.
    const effectiveRoute = user?.routeId ?? null;
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

    // Emit real-time event for connected clients on the same route and staff
    this.eventEmitter.emit('grievance.created', grievance);

    // Notify staff without blocking the submitter's request — the fan-out
    // (DB lookup + insert + push per staff member) used to run inline and
    // made filing a complaint feel slow.
    void this.notifyStaffOfNewGrievance(grievance, resolvedName, route?.routeName);

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
    if (options.onlyMine) {
      where.loginId = loginId;
    } else if (!staff) {
      // Non-staff callers (students, parents, teachers):
      // Show complaints for their assigned bus/route OR complaints they filed themselves.
      const caller = await this.prisma.user.findUnique({
        where: { loginId },
        select: { routeId: true, role: true },
      });

      let routeIds: string[] = [];
      if (options.route && options.route !== 'all') {
        routeIds = [String(options.route)];
      } else if (caller?.routeId) {
        routeIds = [String(caller.routeId)];
      } else if (caller?.role === UserRole.parent) {
        // If user is a parent, find routes for all their linked children
        const links = await this.prisma.parentChildLink.findMany({
          where: { parentLoginId: loginId },
          include: { child: { select: { routeId: true } } },
        });
        routeIds = links
          .map((l) => l.child?.routeId)
          .filter(Boolean)
          .map(String);
      }

      if (routeIds.length > 0) {
        where.OR = [
          { route: { in: routeIds } },
          { loginId: loginId },
        ];
      } else {
        where.loginId = loginId;
      }
    } else {
      if (options.route && options.route !== 'all') {
        where.route = options.route;
      }
    }
    if (options.status && options.status !== 'all') {
      where.status = options.status;
    }

    const grievances = await this.prisma.grievance.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { user: { select: { name: true, role: true } } },
      // Bound the query — the table grows forever and the full scan was
      // re-run by every cache miss.
      take: 200,
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

    // For parent accounts, check which grievances belong to their linked children
    let linkedChildIds = new Set<string>();
    if (role === UserRole.parent) {
      const links = await this.prisma.parentChildLink.findMany({
        where: { parentLoginId: loginId },
        select: { childLoginId: true },
      });
      linkedChildIds = new Set(links.map((l) => l.childLoginId));
    }

    // Non-staff must never receive identity data beyond what the reporter
    // consented to: anonymous reporters appear as "Anonymous Passenger",
    // while a reporter who opted to show their name does show it.
    const visible = grievances.map((g) => {
      const { user, ...rest } = g;
      const isMyChild = linkedChildIds.has(g.loginId);
      const mine = g.loginId === loginId || isMyChild;
      const canSeeName = staff || mine || !g.isAnonymous;
      return {
        ...rest,
        realName: canSeeName ? g.realName : null,
        isAnonymous: staff || mine ? g.isAnonymous : false,
        authorDisplay: staff || mine
          ? (isMyChild ? `${g.realName} (Your Child)` : (g.realName || 'Passenger'))
          : (g.isAnonymous ? 'Anonymous Passenger' : (g.realName || 'Passenger')),
        isMine: mine,
        isChild: isMyChild,
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
    const isOwner = grievance.loginId === loginId;
    let isParentOfChild = false;
    if (role === UserRole.parent && !isOwner) {
      const link = await this.prisma.parentChildLink.findUnique({
        where: {
          parentLoginId_childLoginId: {
            parentLoginId: loginId,
            childLoginId: grievance.loginId,
          },
        },
      });
      isParentOfChild = !!link;
    }
    const mine = isOwner || isParentOfChild;

    if (!staff && !mine) {
      // Check if user is on the same route
      const caller = await this.prisma.user.findUnique({
        where: { loginId },
        select: { routeId: true },
      });
      if (!caller?.routeId || String(caller.routeId) !== String(grievance.route)) {
        throw new ForbiddenException('You cannot view this grievance');
      }
    }

    const { user, ...rest } = grievance;
    const canSeeName = staff || mine || !grievance.isAnonymous;
    return {
      ...rest,
      realName: canSeeName ? grievance.realName : null,
      isAnonymous: staff || mine ? grievance.isAnonymous : false,
      authorDisplay: staff || mine
        ? grievance.realName
        : (grievance.isAnonymous ? 'Anonymous Passenger' : (grievance.realName || 'Passenger')),
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

    const updatedGrievance = await this.prisma.grievance.update({
      where: { id },
      data: { upvotes: newUpvotes },
    });

    await this.cache.delByPattern('grievances:*');
    this.eventEmitter.emit('grievance.updated', updatedGrievance);

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
    this.eventEmitter.emit('grievance.updated', updated);
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
    this.eventEmitter.emit('grievance.updated', updated);
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
   * The complainant (or their linked parent) confirms the fix. This is the ONLY way a grievance
   * reaches the terminal `closed` state.
   */
  async confirmResolved(id: string, loginId: string) {
    const grievance = await this.requireGrievance(id);
    const isOwner = grievance.loginId === loginId;
    let isParentOfChild = false;
    if (!isOwner) {
      const link = await this.prisma.parentChildLink.findUnique({
        where: {
          parentLoginId_childLoginId: {
            parentLoginId: loginId,
            childLoginId: grievance.loginId,
          },
        },
      });
      isParentOfChild = !!link;
    }

    if (!isOwner && !isParentOfChild) {
      throw new ForbiddenException(
        'Only the person who raised this complaint or their parent can confirm it',
      );
    }
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
    this.eventEmitter.emit('grievance.updated', updated);
    void this.notifyStaff(
      grievance.loginId,
      updated.id,
      {
        title: '👍 Complaint confirmed by complainant',
        body: 'The complainant confirmed the issue is resolved. The complaint is now closed.',
        type: 'grievance_confirmed',
      },
    );

    return {
      status: 'success',
      message: 'Thank you for confirming',
      data: updated,
    };
  }

  /**
   * The complainant (or their linked parent) rejects the fix. The complaint goes back into the queue
   * with a raised priority so it sorts to the top for staff.
   */
  async reopen(id: string, loginId: string, reason?: string) {
    const grievance = await this.requireGrievance(id);
    const isOwner = grievance.loginId === loginId;
    let isParentOfChild = false;
    if (!isOwner) {
      const link = await this.prisma.parentChildLink.findUnique({
        where: {
          parentLoginId_childLoginId: {
            parentLoginId: loginId,
            childLoginId: grievance.loginId,
          },
        },
      });
      isParentOfChild = !!link;
    }

    if (!isOwner && !isParentOfChild) {
      throw new ForbiddenException(
        'Only the person who raised this complaint or their parent can reopen it',
      );
    }
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
    this.eventEmitter.emit('grievance.updated', updated);
    void this.notifyStaff(
      grievance.loginId,
      updated.id,
      {
        title: '⚠️ Complaint reopened — not satisfied',
        body: reason
          ? `The complainant says the issue is not fixed: ${reason}`
          : 'The complainant has rejected the fix and reopened the complaint.',
        type: 'grievance_reopened',
      },
    );

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
    this.eventEmitter.emit('grievance.updated', updated);
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

  /**
   * Fan out a notification to every staff member. Notifications are
   * delivered concurrently (one insert + push per staff member used to run
   * strictly sequentially, which stalled every mutation).
   */
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
      await Promise.all(
        staff.map((s) =>
          this.notificationsService
            .notifyUser(s.loginId, grievanceId, payload)
            .catch(() => {}),
        ),
      );
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
      await Promise.all(
        staff.map((s) =>
          this.notificationsService
            .notifyUser(s.loginId, grievance.id, {
              title: '📣 New grievance raised',
              body: `A new complaint was filed for ${routeName ?? `Route ${grievance.route}`}.`,
              type: 'grievance_new',
            })
            .catch(() => {}),
        ),
      );
    } catch {
      /* ignore */
    }
  }

  /**
   * Every hour, follow up on resolutions whose confirmation window has
   * lapsed. Complaints only ever close when the complainant confirms, so
   * this nudge reminds them the fix is waiting — and tells staff the window
   * lapsed. `dueAt` is cleared so the nudge fires exactly once.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async escalateLapsedResolutions() {
    try {
      const lapsed = await this.prisma.grievance.findMany({
        where: {
          status: GrievanceStatus.resolved,
          dueAt: { not: null, lt: new Date() },
        },
        take: 50,
      });

      for (const g of lapsed) {
        await this.prisma.grievance.update({
          where: { id: g.id },
          data: { dueAt: null, priority: g.priority + 1 },
        });
        await this.cache.delByPattern('grievances:*');

        void this.notifyComplainant(g, {
          title: '⏰ Still there? Your complaint awaits confirmation',
          body: 'The transport team marked this complaint as fixed. Please confirm it is resolved, or tell us what is still wrong.',
          type: 'grievance_confirmation_reminder',
        });
        void this.notifyStaff(g.loginId, g.id, {
          title: '⌛ Confirmation window lapsed',
          body: `A complaint from ${g.realName || g.loginId} (Route ${g.route}) was marked fixed but has not been confirmed yet.`,
          type: 'grievance_window_lapsed',
        });
        this.eventEmitter.emit('grievance.updated', { ...g, dueAt: null });
      }
    } catch (err) {
      // Cron must never crash the process.
    }
  }
}
