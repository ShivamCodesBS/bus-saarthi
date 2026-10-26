import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma, UserRole, FeeStatus } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CacheService } from '../cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { canAssignRole } from '../common/roles';

const DEFAULT_PASSWORD = 'Invertis@123';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Strip the password hash and the sensitive JSON blobs from a user record
   * before it leaves the server.
   */
  private sanitize<T extends Record<string, any>>(user: T): Omit<T, 'password'> {
    const { password, wakeAlarm, ...rest } = user as any;
    return rest;
  }

  async findByLoginId(loginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) {
      throw new NotFoundException(`User with login ID ${loginId} not found`);
    }
    // Never leak the bcrypt hash.
    return this.sanitize(user);
  }

  /**
   * The signed-in user's own profile.
   *
   * This is the single source of truth for the profile page. The login
   * response only carries a subset (role, route, fee status …), which is why
   * the profile used to show stale values — the fee status a passenger sees
   * had not been re-read since they signed in.
   *
   * The fields are exactly the ones the User model has, so nothing is
   * invented for a role that does not use it.
   */
  async findOwnProfile(loginId: string) {
    const user = await this.prisma.user.findUnique({
      where: { loginId },
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        routeId: true,
        feeStatus: true,
        phone: true,
        email: true,
        profilePic: true,
        designation: true,
        subject: true,
        gradeClass: true,
        bloodGroup: true,
        parentName: true,
        parentPhone: true,
        dob: true,
        address: true,
        licenseNumber: true,
        licenseExpiry: true,
        experienceYears: true,
        lastLogin: true,
        createdAt: true,
        faceEnrolledAt: true,
        awsFaceId: true,
        wakeAlarm: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with login ID ${loginId} not found`);
    }

    // The live bus serving the user's route. The route is the stable
    // identity; the bus can be swapped out.
    let busNumber: string | null = null;
    let routeName: string | null = null;
    let driverName: string | null = null;
    if (user.routeId) {
      const route = await this.prisma.route.findUnique({
        where: { routeId: user.routeId },
        select: {
          routeName: true,
          busNumber: true,
          bus: { select: { busNumber: true } },
          driverId: true,
        },
      });
      if (route) {
        routeName = route.routeName;
        busNumber = route.bus?.busNumber ?? route.busNumber;
        if (route.driverId) {
          const driver = await this.prisma.user.findUnique({
            where: { loginId: route.driverId },
            select: { name: true },
          });
          driverName = driver?.name ?? null;
        }
      }
    }

    return { ...user, busNumber, routeName, driverName };
  }

  async findAll() {
    // Cache for 60 seconds since user lists don't change frequently
    return this.cache.remember('users:all', 60, async () => {
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          loginId: true,
          name: true,
          role: true,
          routeId: true,
          feeStatus: true,
          phone: true,
          email: true,
          profilePic: true,
          designation: true,
          subject: true,
          gradeClass: true,
          lastLogin: true,
          createdAt: true,
          licenseNumber: true,
          licenseExpiry: true,
          experienceYears: true,
          bloodGroup: true,
          parentName: true,
          parentPhone: true,
          dob: true,
          address: true,
          awsFaceId: true,
          faceEnrolledAt: true,
        },
      });
      return users.map((u) => ({
        ...u,
        login_id: u.loginId,
        route_id: u.routeId,
        fee_status: u.feeStatus,
        face_enrolled_at: u.faceEnrolledAt,
        aws_face_id: u.awsFaceId,
      }));
    });
  }

  async create(body: CreateUserDto, actorRole: UserRole) {
    const role = (body.role as UserRole) || UserRole.passenger;

    if (!canAssignRole(actorRole, role)) {
      throw new ForbiddenException(
        `You are not allowed to create an account with the role "${role}"`,
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { loginId: body.login_id },
    });
    if (existing)
      throw new ConflictException(`User ${body.login_id} already exists`);

    // A phone number must stay unique per account so the phone login fallback
    // can never resolve to the wrong person.
    if (body.phone) {
      const phoneTaken = await this.prisma.user.findFirst({
        where: { phone: body.phone },
        select: { loginId: true },
      });
      if (phoneTaken) {
        throw new ConflictException(
          `Phone number ${body.phone} is already registered to ${phoneTaken.loginId}`,
        );
      }
    }

    const hashedPassword = await bcrypt.hash(
      body.password || DEFAULT_PASSWORD,
      10,
    );

    const user = await this.prisma.user.create({
      data: {
        loginId: body.login_id,
        name: body.name,
        password: hashedPassword,
        role,
        routeId: body.route_id,
        feeStatus: (body.fee_status as FeeStatus) || FeeStatus.unpaid,
        phone: body.phone,
        email: body.email,
        designation: body.designation,
        subject: body.subject,
        licenseNumber: body.licenseNumber,
        licenseExpiry: body.licenseExpiry
          ? new Date(body.licenseExpiry)
          : undefined,
        experienceYears: body.experienceYears
          ? Number(body.experienceYears)
          : undefined,
        bloodGroup: body.bloodGroup,
        parentName: body.parentName,
        parentPhone: body.parentPhone,
        dob: body.dob ? new Date(body.dob) : undefined,
        address: body.address,
        gradeClass: body.gradeClass,
      },
    });

    await this.cache.delByPattern('users:*');
    await this.cache.del(`auth:user:${user.loginId}`);
    return { status: 'success', message: 'User created', user: this.sanitize(user) };
  }

  async update(loginId: string, body: UpdateUserDto, actorRole: UserRole) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

    if (body.role && body.role !== user.role) {
      if (!canAssignRole(actorRole, body.role as UserRole)) {
        throw new ForbiddenException(
          `You are not allowed to change this account to the role "${body.role}"`,
        );
      }
    }

    let password = user.password;
    if (body.password) {
      password = await bcrypt.hash(body.password, 10);
    }

const updatedUser = await this.prisma.user.update({
    where: { loginId },
    data: {
      name: body.name,
      role: body.role as UserRole,
      routeId: body.route_id,
      feeStatus: body.fee_status as FeeStatus,
      phone: body.phone,
      email: body.email,
      designation: body.designation,
      subject: body.subject,
      profilePic: body.profile_pic,
      wakeAlarm: body.wake_alarm,
      locationLat: body.location_lat,
      locationLng: body.location_lng,
      licenseNumber: body.licenseNumber,
      licenseExpiry: body.licenseExpiry
        ? new Date(body.licenseExpiry)
        : undefined,
      experienceYears: body.experienceYears
        ? Number(body.experienceYears)
        : undefined,
      bloodGroup: body.bloodGroup,
      parentName: body.parentName,
      parentPhone: body.parentPhone,
      dob: body.dob ? new Date(body.dob) : undefined,
      address: body.address,
      gradeClass: body.gradeClass,
      password: password,
    },
  });

  // The role may have changed — drop the cached identity.
  await this.cache.delByPattern('users:*');
  await this.cache.del(`auth:user:${loginId}`);

  // Emit event for real-time profile updates
  this.eventEmitter.emit('user.updated', {
    loginId: updatedUser.loginId,
    name: updatedUser.name,
    profilePic: updatedUser.profilePic,
  });

  return {
    status: 'success',
    message: 'User updated',
    user: this.sanitize(updatedUser),
  };
  }

  async remove(loginId: string, actorRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { loginId },
      select: { role: true },
    });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

    // Only a full admin may delete an admin or tech_admin account.
    if (
      (user.role === UserRole.admin || user.role === UserRole.tech_admin) &&
      actorRole !== UserRole.admin &&
      actorRole !== UserRole.tech_admin
    ) {
      throw new ForbiddenException(
        'Only an admin can delete an administrator account',
      );
    }

    await this.prisma.user.delete({ where: { loginId } });
    await this.cache.delByPattern('users:*');
    await this.cache.del(`auth:user:${loginId}`);
    return { status: 'success', message: 'User deleted' };
  }

  async bulkCreate(users: any[], actorRole: UserRole) {
    const results = { successful: 0, failed: 0, errors: [] as string[] };
    const defaultPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    for (const data of users) {
      try {
        const existing = await this.prisma.user.findUnique({
          where: { loginId: data.login_id },
        });
        if (existing) {
          results.failed++;
          results.errors.push(`User ${data.login_id} already exists`);
          continue;
        }

        // The role from the CSV is honoured, but only if the actor is allowed
        // to assign it. Otherwise the row is created as a passenger.
        const requestedRole = (data.role as UserRole) || UserRole.passenger;
        const role = canAssignRole(actorRole, requestedRole)
          ? requestedRole
          : UserRole.passenger;
        if (role !== requestedRole) {
          results.errors.push(
            `User ${data.login_id}: role "${requestedRole}" downgraded to passenger — not permitted for your role`,
          );
        }

        await this.prisma.user.create({
          data: {
            loginId: data.login_id,
            name: data.name,
            password: data.password
              ? await bcrypt.hash(data.password, 10)
              : defaultPassword,
            role,
            routeId: data.route_id,
            feeStatus: (data.fee_status as FeeStatus) || FeeStatus.unpaid,
            phone: data.phone,
            email: data.email,
            designation: data.designation,
            subject: data.subject,
            parentName: data.parentName,
            parentPhone: data.parentPhone,
            dob: data.dob ? new Date(data.dob) : undefined,
            bloodGroup: data.bloodGroup,
            address: data.address,
            gradeClass: data.gradeClass,
          },
        });

        results.successful++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Failed for ${data.login_id}: ${err.message}`);
      }
    }

    // Otherwise CSV-imported users stay invisible in cached lists.
    await this.cache.delByPattern('users:*');
    return { status: 'success', results };
  }

  async changePassword(
    loginId: string,
    currentPassword: string,
    newPassword: string,
    requestingLoginId: string,
    actorRole: UserRole,
  ) {
    // A user may only change their own password. Staff changing someone
    // else's password must go through the admin update endpoint.
    if (requestingLoginId !== loginId && actorRole !== UserRole.admin) {
      throw new ForbiddenException(
        'You can only change your own password',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { loginId },
      select: { id: true, loginId: true, password: true },
    });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

    if (requestingLoginId === loginId) {
      const isMatch = await bcrypt.compare(currentPassword, user.password!);
      if (!isMatch)
        throw new UnauthorizedException('Current password is incorrect');
    }

    await this.prisma.user.update({
      where: { loginId },
      data: { password: await bcrypt.hash(newPassword, 10) },
    });
    return { status: 'success', message: 'Password changed successfully' };
  }

  async setWakeAlarm(
    loginId: string,
    dto: {
      lat: number;
      lng: number;
      thresholdKm: number;
      subscription?: any;
      firedAt?: string | null;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

    const alarmData = {
      enabled: true,
      lat: dto.lat,
      lng: dto.lng,
      thresholdKm: dto.thresholdKm,
      firedAt: dto.firedAt !== undefined ? dto.firedAt : null,
    };

    await this.prisma.user.update({
      where: { loginId },
      data: { wakeAlarm: alarmData },
    });

    // Save push subscription if provided
    if (dto.subscription) {
      const existingSub = await this.prisma.pushSubscription.findFirst({
        where: { loginId, deviceType: 'web' },
      });
      if (existingSub) {
        await this.prisma.pushSubscription.update({
          where: { id: existingSub.id },
          data: { subscription: dto.subscription },
        });
      } else {
        await this.prisma.pushSubscription.create({
          data: { loginId, subscription: dto.subscription, deviceType: 'web' },
        });
      }
    }

    return { status: 'success', message: 'Wake alarm set', alarm: alarmData };
  }

  async cancelWakeAlarm(loginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

    await this.prisma.user.update({
      where: { loginId },
      data: { wakeAlarm: { enabled: false } },
    });

    return { status: 'success', message: 'Wake alarm cancelled' };
  }

  /**
   * Active wake alarms, cached for a short window.
   *
   * This is called on EVERY telemetry update (roughly once per second per
   * bus). Previously it did a full `SELECT` over every user in the database
   * each time — including all their JSON columns — which is one of the main
   * reasons live tracking felt slow and hammered the database.
   */
  async getActiveWakeAlarms() {
    return this.cache.remember('wake:alarms:active', 30, async () => {
      const allUsers = await this.prisma.user.findMany({
        select: { loginId: true, wakeAlarm: true, routeId: true },
        // `{ not: undefined }` used to be passed here — Prisma strips it, so
        // the query matched every user. Only rows that actually carry an
        // alarm JSON can be active alarms.
        where: { NOT: { wakeAlarm: { equals: Prisma.AnyNull } } },
      });

      return allUsers.filter((u) => {
        const alarm = u.wakeAlarm as any;
        return alarm?.enabled === true && alarm?.lat && alarm?.lng;
      });
    });
  }

  /**
   * Marks the alarm as fired for today WITHOUT touching subscription data.
   * This prevents the push subscription from being accidentally deleted.
   */
  async markAlarmFired(loginId: string, today: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) return;

    const existingAlarm = user.wakeAlarm as any;
    await this.prisma.user.update({
      where: { loginId },
      data: {
        wakeAlarm: {
          ...existingAlarm,
          firedAt: today,
        },
      },
    });

    // The cached alarm list now holds a stale "fired" flag.
    await this.cache.del('wake:alarms:active');
  }

  /**
   * User requests a face data reset (re-enrollment).
   * This notifies admins that the user wants to re-enroll their face.
   */
  async requestFaceReset(loginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

    await this.prisma.user.update({
      where: { loginId },
      data: { faceResetRequestedAt: new Date() },
    });

    await this.cache.delByPattern('users:*');
    return { status: 'success', message: 'Face reset request submitted' };
  }

  /**
   * Staff view of pending face-reset requests. The Settings page sets
   * `faceResetRequestedAt`; this is what the admin/transport-incharge panels
   * show so they can approve with the requester's details at hand.
   */
  async findPendingFaceResetRequests() {
    const users = await this.prisma.user.findMany({
      where: { faceResetRequestedAt: { not: null } },
      select: {
        loginId: true,
        name: true,
        role: true,
        phone: true,
        feeStatus: true,
        routeId: true,
        route: { select: { routeName: true, busNumber: true } },
        faceEnrolledAt: true,
        faceResetRequestedAt: true,
      },
      orderBy: { faceResetRequestedAt: 'asc' },
    });
    return users.map((u) => ({
      login_id: u.loginId,
      name: u.name,
      role: u.role,
      phone: u.phone,
      fee_status: u.feeStatus,
      route_id: u.routeId,
      route_name: u.route?.routeName || null,
      bus_number: u.route?.busNumber || null,
      face_enrolled_at: u.faceEnrolledAt,
      requested_at: u.faceResetRequestedAt,
    }));
  }

  /**
   * Admin approves/clears a face reset request.
   * Clears the request flag and the existing face enrollment so the user can re-enroll.
   */
  async approveFaceReset(loginId: string, adminLoginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

    await this.prisma.user.update({
      where: { loginId },
      data: {
        faceResetRequestedAt: null,
        faceResetRequestedBy: adminLoginId,
        faceEnrolledAt: null,
        awsFaceId: null,
      },
    });

    await this.cache.delByPattern('users:*');
    return { status: 'success', message: 'Face reset approved, user can now re-enroll' };
  }
}
