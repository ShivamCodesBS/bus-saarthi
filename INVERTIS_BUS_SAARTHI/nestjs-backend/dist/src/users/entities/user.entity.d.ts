import type { Route } from '../../routes/entities/route.entity';
import type { Attendance } from '../../attendance/entities/attendance.entity';
export declare enum UserRole {
    PASSENGER = "passenger",
    ADMIN = "admin",
    DRIVER = "driver",
    TRANSPORT_INCHARGE = "transport_incharge",
    TECH_ADMIN = "tech_admin"
}
export declare enum FeeStatus {
    PAID = "paid",
    UNPAID = "unpaid",
    PARTIAL = "partial"
}
export declare class User {
    id: string;
    loginId: string;
    name: string;
    password?: string;
    role: UserRole;
    routeId: string;
    route: Route;
    feeStatus: FeeStatus;
    phone: string;
    email: string;
    profilePic: string;
    designation: string;
    lastLogin: Date;
    locationLat: number;
    locationLng: number;
    licenseNumber: string;
    licenseExpiry: Date;
    experienceYears: number;
    bloodGroup: string;
    parentName: string;
    parentPhone: string;
    dob: Date;
    address: string;
    gradeClass: string;
    wakeAlarm: boolean;
    awsFaceId: string | null;
    externalImageId: string | null;
    s3ObjectKey: string | null;
    faceEnrolledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    attendanceRecords: Attendance[];
}
