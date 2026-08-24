import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole, FeeStatus } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByLoginId(loginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) {
      throw new NotFoundException(`User with login ID ${loginId} not found`);
    }
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
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
        gradeClass: true,
        awsFaceId: true,
      },
    });
  }

  async create(body: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { loginId: body.login_id },
    });
    if (existing)
      throw new ConflictException(`User ${body.login_id} already exists`);

    const hashedPassword = await bcrypt.hash(
      body.password || 'Invertis@123',
      10,
    );

    const user = await this.prisma.user.create({
      data: {
        loginId: body.login_id,
        name: body.name,
        password: hashedPassword,
        role: (body.role as UserRole) || UserRole.passenger,
        routeId: body.route_id,
        feeStatus: (body.fee_status as FeeStatus) || FeeStatus.unpaid,
        phone: body.phone,
        email: body.email,
        designation: body.designation,
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

    const { password: _, ...result } = user as any;
    return { status: 'success', message: 'User created', user: result };
  }

  async update(loginId: string, body: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

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

    const { password: _, ...result } = updatedUser as any;
    return { status: 'success', message: 'User updated', user: result };
  }

  async remove(loginId: string) {
    const user = await this.prisma.user.findUnique({ where: { loginId } });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);
    await this.prisma.user.delete({ where: { loginId } });
    return { status: 'success', message: 'User deleted' };
  }

  async bulkCreate(users: any[]) {
    const results = { successful: 0, failed: 0, errors: [] as string[] };
    const defaultPassword = await bcrypt.hash('Invertis@123', 10);

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

        await this.prisma.user.create({
          data: {
            loginId: data.login_id,
            name: data.name,
            password: data.password
              ? await bcrypt.hash(data.password, 10)
              : defaultPassword,
            role: (data.role as UserRole) || UserRole.passenger,
            routeId: data.route_id,
            feeStatus: (data.fee_status as FeeStatus) || FeeStatus.unpaid,
            phone: data.phone,
            email: data.email,
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

    return { status: 'success', results };
  }

  async changePassword(
    loginId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { loginId },
      select: { id: true, loginId: true, password: true },
    });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

    const isMatch = await bcrypt.compare(currentPassword, user.password!);
    if (!isMatch)
      throw new UnauthorizedException('Current password is incorrect');

    await this.prisma.user.update({
      where: { loginId },
      data: { password: await bcrypt.hash(newPassword, 10) },
    });
    return { status: 'success', message: 'Password changed successfully' };
  }

  async setWakeAlarm(
    loginId: string,
    dto: { lat: number; lng: number; thresholdKm: number; subscription: any; firedAt?: string | null },
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

  async getActiveWakeAlarms() {
    // Fetch all users who have any wakeAlarm JSON set (enabled or disabled)
    const allUsers = await this.prisma.user.findMany({
      select: { loginId: true, wakeAlarm: true },
    });

    return allUsers.filter((u) => {
      const alarm = u.wakeAlarm as any;
      return alarm?.enabled === true;
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
  }
}
