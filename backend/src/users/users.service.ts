import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, FeeStatus } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByLoginId(loginId: string) {
    const user = await this.usersRepository.findOne({ where: { loginId } });
    if (!user) {
      throw new NotFoundException(`User with login ID ${loginId} not found`);
    }
    return user;
  }

  async findAll() {
    return this.usersRepository.find({ select: { id: true, loginId: true, name: true, role: true, routeId: true, feeStatus: true, phone: true, email: true, profilePic: true, designation: true, lastLogin: true, createdAt: true, licenseNumber: true, licenseExpiry: true, experienceYears: true, bloodGroup: true, parentName: true, parentPhone: true, dob: true, address: true, gradeClass: true, awsFaceId: true } });
  }

  async create(body: any) {
    const existing = await this.usersRepository.findOne({ where: { loginId: body.login_id } });
    if (existing) throw new ConflictException(`User ${body.login_id} already exists`);

    const hashedPassword = await bcrypt.hash(body.password || 'Invertis@123', 10);

    const user = this.usersRepository.create({
      loginId: body.login_id,
      name: body.name,
      password: hashedPassword,
      role: body.role as UserRole || UserRole.PASSENGER,
      routeId: body.route_id,
      feeStatus: body.fee_status as FeeStatus || FeeStatus.UNPAID,
      phone: body.phone,
      email: body.email,
      designation: body.designation,
      licenseNumber: body.licenseNumber,
      licenseExpiry: body.licenseExpiry,
      experienceYears: body.experienceYears,
      bloodGroup: body.bloodGroup,
      parentName: body.parentName,
      parentPhone: body.parentPhone,
      dob: body.dob,
      address: body.address,
      gradeClass: body.gradeClass,
    });
    await this.usersRepository.save(user);
    const { password: _, ...result } = user as any;
    return { status: 'success', message: 'User created', user: result };
  }

  async update(loginId: string, body: any) {
    const user = await this.usersRepository.findOne({ where: { loginId } });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

    if (body.name !== undefined) user.name = body.name;
    if (body.role !== undefined) user.role = body.role;
    if (body.route_id !== undefined) user.routeId = body.route_id;
    if (body.fee_status !== undefined) user.feeStatus = body.fee_status;
    if (body.phone !== undefined) user.phone = body.phone;
    if (body.email !== undefined) user.email = body.email;
    if (body.designation !== undefined) user.designation = body.designation;
    if (body.profile_pic !== undefined) user.profilePic = body.profile_pic;
    if (body.wake_alarm !== undefined) user.wakeAlarm = body.wake_alarm;
    if (body.location_lat !== undefined) user.locationLat = body.location_lat;
    if (body.location_lng !== undefined) user.locationLng = body.location_lng;
    
    if (body.licenseNumber !== undefined) user.licenseNumber = body.licenseNumber;
    if (body.licenseExpiry !== undefined) user.licenseExpiry = body.licenseExpiry;
    if (body.experienceYears !== undefined) user.experienceYears = body.experienceYears;
    if (body.bloodGroup !== undefined) user.bloodGroup = body.bloodGroup;
    
    if (body.parentName !== undefined) user.parentName = body.parentName;
    if (body.parentPhone !== undefined) user.parentPhone = body.parentPhone;
    if (body.dob !== undefined) user.dob = body.dob;
    if (body.address !== undefined) user.address = body.address;
    if (body.gradeClass !== undefined) user.gradeClass = body.gradeClass;

    // Hash password if provided
    if (body.password) {
      user.password = await bcrypt.hash(body.password, 10);
    }

    await this.usersRepository.save(user);
    const { password: _, ...result } = user as any;
    return { status: 'success', message: 'User updated', user: result };
  }

  async remove(loginId: string) {
    const user = await this.usersRepository.findOne({ where: { loginId } });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);
    await this.usersRepository.remove(user);
    return { status: 'success', message: 'User deleted' };
  }

  async bulkCreate(users: any[]) {
    const results = { successful: 0, failed: 0, errors: [] as string[] };
    const defaultPassword = await bcrypt.hash('Invertis@123', 10);
    
    for (const data of users) {
      try {
        const existing = await this.usersRepository.findOne({ where: { loginId: data.login_id } });
        if (existing) {
          results.failed++;
          results.errors.push(`User ${data.login_id} already exists`);
          continue;
        }

        const user = this.usersRepository.create({
          loginId: data.login_id,
          name: data.name,
          password: data.password ? await bcrypt.hash(data.password, 10) : defaultPassword,
          role: data.role as UserRole || UserRole.PASSENGER,
          routeId: data.route_id,
          feeStatus: data.fee_status as FeeStatus || FeeStatus.UNPAID,
          phone: data.phone,
          email: data.email,
          parentName: data.parentName,
          parentPhone: data.parentPhone,
          dob: data.dob,
          bloodGroup: data.bloodGroup,
          address: data.address,
          gradeClass: data.gradeClass,
        });
        
        await this.usersRepository.save(user);
        results.successful++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Failed for ${data.login_id}: ${err.message}`);
      }
    }
    
    return { status: 'success', results };
  }

  async changePassword(loginId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersRepository.findOne({
      where: { loginId },
      select: { id: true, loginId: true, password: true },
    });
    if (!user) throw new NotFoundException(`User ${loginId} not found`);

    const isMatch = await bcrypt.compare(currentPassword, user.password!);
    if (!isMatch) throw new UnauthorizedException('Current password is incorrect');

    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);
    return { status: 'success', message: 'Password changed successfully' };
  }
}
