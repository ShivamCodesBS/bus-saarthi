import { PrismaClient, UserRole, FeeStatus, LogLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Bus Saarthi database on Supabase PostgreSQL...');

  const adminPass = await bcrypt.hash('Admin@123', 10);
  const techAdminPass = await bcrypt.hash('TechAdmin@123', 10);
  const studentPass = await bcrypt.hash('Student@123', 10);
  const parentPass = await bcrypt.hash('Parent@123', 10);
  const transportPass = await bcrypt.hash('Transport@123', 10);
  const driverPass = await bcrypt.hash('Driver@123', 10);
  const teacherPass = await bcrypt.hash('Teacher@123', 10);

  // 1. Routes and Buses
  const routesData = [
    {
      id: '1',
      name: 'Route 1 - Civil Lines & Chowki',
      bus: 'UP25 AB 1001',
      dest: 'Civil Lines',
      stops: ['Invertis University', 'Choupla', 'Patel Chowk', 'Civil Lines', 'Ayub Khan Crossing'],
      capacity: 52,
    },
    {
      id: '2',
      name: 'Route 2 - Rajendra Nagar & DD Puram',
      bus: 'UP25 AB 1002',
      dest: 'Rajendra Nagar',
      stops: ['Invertis University', 'Satellite Bus Stand', 'Selection Point', 'DD Puram', 'Rajendra Nagar'],
      capacity: 50,
    },
    {
      id: '3',
      name: 'Route 3 - Subhash Nagar & Junction',
      bus: 'UP25 AB 1003',
      dest: 'Subhash Nagar',
      stops: ['Invertis University', 'Bareilly Junction', 'Subhash Nagar Chungi', 'Badaun Road'],
      capacity: 48,
    },
    {
      id: '4',
      name: 'Route 4 - Cantonment & Sadar',
      bus: 'UP25 AB 1004',
      dest: 'Cantonment',
      stops: ['Invertis University', 'Cantt General Hospital', 'Sadar Bazar', 'Gandhi Udyan'],
      capacity: 50,
    },
    {
      id: '5',
      name: 'Route 5 - Pilibhit Bypass & University Road',
      bus: 'UP25 AB 1005',
      dest: 'Pilibhit Bypass',
      stops: ['Invertis University', 'Bisalpur Road', 'Pilibhit Bypass', 'Phoenix Mall'],
      capacity: 54,
    },
  ];

  for (const r of routesData) {
    await prisma.route.upsert({
      where: { routeId: r.id },
      update: {
        routeName: r.name,
        busNumber: r.bus,
        stops: JSON.stringify(r.stops),
        city: 'Bareilly',
        seatingCapacity: r.capacity,
        speedLimit: 60,
      },
      create: {
        routeId: r.id,
        routeName: r.name,
        busNumber: r.bus,
        stops: JSON.stringify(r.stops),
        city: 'Bareilly',
        seatingCapacity: r.capacity,
        speedLimit: 60,
      },
    });

    // A Bus entity per bus number, linked to the route that serves it.
    // The route is the stable identity; the bus can be swapped out.
    const bus = await prisma.bus.upsert({
      where: { busNumber: r.bus },
      update: { seatingCapacity: r.capacity },
      create: {
        busNumber: r.bus,
        seatingCapacity: r.capacity,
        status: 'active',
      },
    });
    await prisma.route.update({
      where: { routeId: r.id },
      data: { busId: bus.id },
    });
  }
  console.log('✔ 5 Routes and Buses seeded.');

  // 2. Drivers (D001 to D005)
  const driversData = [
    { id: 'D001', name: 'Ram Bahadur', phone: '9415011001', route: '1' },
    { id: 'D002', name: 'Jagdish Prasad', phone: '9415011002', route: '2' },
    { id: 'D003', name: 'Mohan Lal', phone: '9415011003', route: '3' },
    { id: 'D004', name: 'Satish Kumar', phone: '9415011004', route: '4' },
    { id: 'D005', name: 'Brijesh Yadav', phone: '9415011005', route: '5' },
  ];

  for (const d of driversData) {
    await prisma.user.upsert({
      where: { loginId: d.id },
      update: { password: driverPass, role: UserRole.driver, name: d.name, phone: d.phone, routeId: d.route },
      create: {
        loginId: d.id,
        name: d.name,
        password: driverPass,
        role: UserRole.driver,
        phone: d.phone,
        routeId: d.route,
      },
    });

    await prisma.route.update({
      where: { routeId: d.route },
      data: { driverId: d.id },
    });
  }
  console.log('✔ 5 Drivers seeded & linked to routes.');

  // 3. System Admins (3) - For Main Portal
  const adminsData = [
    { id: 'AD001', name: 'Dr. R.K. Shukla', email: 'rk.shukla@invertis.org', phone: '9876543210', desig: 'Dean Student Welfare' },
    { id: 'AD002', name: 'Prof. Neha Agarwal', email: 'neha.agarwal@invertis.org', phone: '9876543211', desig: 'Transport Administrator' },
    { id: 'AD003', name: 'Er. Amit Saxena', email: 'amit.saxena@invertis.org', phone: '9876543212', desig: 'Campus Facility Head' },
  ];

  for (const a of adminsData) {
    await prisma.user.upsert({
      where: { loginId: a.id },
      update: { password: adminPass, role: UserRole.admin, name: a.name, email: a.email, phone: a.phone, designation: a.desig },
      create: {
        loginId: a.id,
        name: a.name,
        password: adminPass,
        role: UserRole.admin,
        email: a.email,
        phone: a.phone,
        designation: a.desig,
      },
    });
  }
  console.log('✔ 3 System Admins seeded.');

  // 4. Tech Admins (for Tech Admin Portal)
  const techAdminsData = [
    { id: 'techadmin', name: 'Head Tech Admin', email: 'techadmin@bussaarthi.com', phone: '9999999990' },
    { id: 'admin', name: 'System Administrator', email: 'admin@bussaarthi.com', phone: '9999999999' },
    { id: 'TECH001', name: 'Tech Operations Engineer', email: 'tech001@bussaarthi.com', phone: '9999999998' },
  ];

  for (const ta of techAdminsData) {
    await prisma.user.upsert({
      where: { loginId: ta.id },
      update: { password: techAdminPass, role: UserRole.tech_admin, name: ta.name, email: ta.email, phone: ta.phone },
      create: {
        loginId: ta.id,
        name: ta.name,
        password: techAdminPass,
        role: UserRole.tech_admin,
        email: ta.email,
        phone: ta.phone,
      },
    });
  }
  console.log('✔ 3 Tech Admins seeded.');

  // 5. Transport Incharges (2-3 TI)
  const tiData = [
    { id: 'TI001', name: 'Rakesh Yadav', phone: '9450011221', desig: 'Senior Transport Incharge' },
    { id: 'TI002', name: 'Suresh Chandra', phone: '9450011222', desig: 'Fleet & Dispatch Incharge' },
    { id: 'TI003', name: 'Dharmendra Singh', phone: '9450011223', desig: 'Depot Supervisor' },
  ];

  for (const ti of tiData) {
    await prisma.user.upsert({
      where: { loginId: ti.id },
      update: { password: transportPass, role: UserRole.transport_incharge, name: ti.name, phone: ti.phone, designation: ti.desig },
      create: {
        loginId: ti.id,
        name: ti.name,
        password: transportPass,
        role: UserRole.transport_incharge,
        phone: ti.phone,
        designation: ti.desig,
      },
    });
  }
  console.log('✔ 3 Transport Incharges seeded.');

  // 5b. Teachers (staff accounts that can file and track grievances)
  const teachersData = [
    { id: 'T001', name: 'Dr. S. K. Verma', phone: '9450011331', subject: 'Computer Science' },
    { id: 'T002', name: 'Prof. Anita Rao', phone: '9450011332', subject: 'Electronics' },
    { id: 'T003', name: 'Dr. Mohit Jain', phone: '9450011333', subject: 'Mechanical' },
  ];

  for (const t of teachersData) {
    await prisma.user.upsert({
      where: { loginId: t.id },
      update: { password: teacherPass, role: UserRole.teacher, name: t.name, phone: t.phone, subject: t.subject },
      create: {
        loginId: t.id,
        name: t.name,
        password: teacherPass,
        role: UserRole.teacher,
        phone: t.phone,
        subject: t.subject,
        designation: 'Faculty',
      },
    });
  }
  console.log('✔ 3 Teachers seeded.');

  // 6. 10 Students (Passengers) and 10 Parents
  const students = [
    { id: 'S001', name: 'Aarav Sharma', class: 'B.Tech CSE 3rd Year', fee: FeeStatus.paid, route: '1', phone: '9839000001', parent: 'Rajesh Sharma', parentPhone: '9839011221' },
    { id: 'S002', name: 'Ananya Verma', class: 'BCA 2nd Year', fee: FeeStatus.paid, route: '2', phone: '9839000002', parent: 'Sunita Verma', parentPhone: '9839011222' },
    { id: 'S003', name: 'Rohan Patel', class: 'B.Tech ME 4th Year', fee: FeeStatus.partial, route: '3', phone: '9839000003', parent: 'Vikram Patel', parentPhone: '9839011223' },
    { id: 'S004', name: 'Priya Singh', class: 'MBA 1st Year', fee: FeeStatus.paid, route: '4', phone: '9839000004', parent: 'Meena Singh', parentPhone: '9839011224' },
    { id: 'S005', name: 'Ishaan Gupta', class: 'B.Tech EE 2nd Year', fee: FeeStatus.unpaid, route: '5', phone: '9839000005', parent: 'Sanjay Gupta', parentPhone: '9839011225' },
    { id: 'S006', name: 'Riya Saxena', class: 'B.Sc Biotech 3rd Year', fee: FeeStatus.paid, route: '1', phone: '9839000006', parent: 'Geeta Saxena', parentPhone: '9839011226' },
    { id: 'S007', name: 'Aditya Kumar', class: 'BBA 2nd Year', fee: FeeStatus.paid, route: '2', phone: '9839000007', parent: 'Ashok Kumar', parentPhone: '9839011227' },
    { id: 'S008', name: 'Sneha Mishra', class: 'B.Tech CSE 2nd Year', fee: FeeStatus.paid, route: '3', phone: '9839000008', parent: 'Rekha Mishra', parentPhone: '9839011228' },
    { id: 'S009', name: 'Harsh Vardhan', class: 'MCA 1st Year', fee: FeeStatus.partial, route: '4', phone: '9839000009', parent: 'Manoj Vardhan', parentPhone: '9839011229' },
    { id: 'S010', name: 'Tanvi Joshi', class: 'B.Tech IT 3rd Year', fee: FeeStatus.paid, route: '5', phone: '9839000010', parent: 'Anita Joshi', parentPhone: '9839011230' },
  ];

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const pId = `P${String(i + 1).padStart(3, '0')}`;

    // Student
    await prisma.user.upsert({
      where: { loginId: s.id },
      update: {
        name: s.name,
        password: studentPass,
        role: UserRole.passenger,
        routeId: s.route,
        feeStatus: s.fee,
        phone: s.phone,
        gradeClass: s.class,
        parentName: s.parent,
        parentPhone: s.parentPhone,
        faceEnrolledAt: i < 8 ? new Date(Date.now() - (10 - i) * 86400 * 1000) : null,
        awsFaceId: i < 8 ? `aws-face-${s.id}` : null,
      },
      create: {
        loginId: s.id,
        name: s.name,
        password: studentPass,
        role: UserRole.passenger,
        routeId: s.route,
        feeStatus: s.fee,
        phone: s.phone,
        gradeClass: s.class,
        parentName: s.parent,
        parentPhone: s.parentPhone,
        faceEnrolledAt: i < 8 ? new Date(Date.now() - (10 - i) * 86400 * 1000) : null,
        awsFaceId: i < 8 ? `aws-face-${s.id}` : null,
      },
    });

    // Parent
    await prisma.user.upsert({
      where: { loginId: pId },
      update: {
        name: s.parent,
        password: parentPass,
        role: UserRole.parent,
        phone: s.parentPhone,
      },
      create: {
        loginId: pId,
        name: s.parent,
        password: parentPass,
        role: UserRole.parent,
        phone: s.parentPhone,
      },
    });

    // Parent Child Link
    await prisma.parentChildLink.upsert({
      where: {
        parentLoginId_childLoginId: {
          parentLoginId: pId,
          childLoginId: s.id,
        },
      },
      update: { nickname: s.name },
      create: {
        parentLoginId: pId,
        childLoginId: s.id,
        nickname: s.name,
      },
    });
  }
  console.log('✔ 10 Students and 10 Parents seeded & linked.');

  // 7. Grievances (Text, Audio, Video, Photo with Cloudinary)
  const cloudinaryUrls = [
    'https://res.cloudinary.com/dddm66gd7/image/upload/v1792574567/bus-saarthi/complaints/complaint_sample_1.png',
    'https://res.cloudinary.com/dddm66gd7/image/upload/v1792574570/bus-saarthi/complaints/complaint_sample_2.png',
    'https://res.cloudinary.com/dddm66gd7/image/upload/v1792574571/bus-saarthi/complaints/complaint_sample_3.png',
    'https://res.cloudinary.com/dddm66gd7/image/upload/v1792574572/bus-saarthi/complaints/complaint_sample_4.png',
    'https://res.cloudinary.com/dddm66gd7/image/upload/v1792574573/bus-saarthi/complaints/complaint_sample_5.png',
  ];

  const audioUrls = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'https://actions.google.com/sounds/v1/emergency/ambulance_siren.ogg',
    'https://actions.google.com/sounds/v1/transportation/bus_horn.ogg',
  ];

  const videoUrls = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  ];

  const complaints = [
    // 5 Text
    { type: 'text', media: null, category: 'Timings', text: 'Bus arrived 25 minutes late today at the Choupla stop. Please ensure timely arrival.' },
    { type: 'text', media: null, category: 'AC & Cleanliness', text: 'The AC in Bus 3 is not cooling properly, it gets very suffocating in the afternoon trip.' },
    { type: 'text', media: null, category: 'Discipline', text: 'Some senior students were playing loud music and disturbing students preparing for exams.' },
    { type: 'text', media: null, category: 'Driver Behavior', text: 'The bus driver drove very rashly near the Civil Lines crossing today morning.' },
    { type: 'text', media: null, category: 'Route & Stops', text: 'Can we have a different pickup point near the market? The current one is too crowded.' },

    // 5 Photo (Cloudinary)
    { type: 'photo', media: cloudinaryUrls[0], category: 'Maintenance', text: 'Seat covers are torn on the 4th row left side. Needs urgent repair.' },
    { type: 'photo', media: cloudinaryUrls[1], category: 'Maintenance', text: 'Window latch is broken and vibrates heavily on the highway. Attached photo.' },
    { type: 'photo', media: cloudinaryUrls[2], category: 'Cleanliness', text: 'Dust and trash scattered all over the aisle floor today morning. Bus was not cleaned.' },
    { type: 'photo', media: cloudinaryUrls[3], category: 'Safety', text: 'The emergency hammer holder is damaged. Attached snapshot for reference.' },
    { type: 'photo', media: cloudinaryUrls[4], category: 'Lost & Found', text: 'Found a water bottle and notebook left on the last seat. Handed over to driver.' },

    // 5 Video
    { type: 'video', media: videoUrls[0], category: 'Maintenance', text: 'Water is leaking continuously from the AC vent during the rain. Recorded video proof.' },
    { type: 'video', media: videoUrls[1], category: 'Engine / Noise', text: 'Bus is making a very loud rattling noise from the gearbox side. Please check video.' },
    { type: 'video', media: videoUrls[2], category: 'Traffic / Delay', text: 'Bus delayed due to heavy bottleneck near Satellite stand. Video attached.' },
    { type: 'video', media: videoUrls[3], category: 'Safety', text: 'Driver was repeatedly attending phone calls while negotiating heavy traffic.' },
    { type: 'video', media: videoUrls[4], category: 'Electrical', text: 'Flickering interior lighting near seats 12-14 causing inconvenience.' },

    // 5 Audio
    { type: 'audio', media: audioUrls[0], category: 'Engine / Noise', text: 'Audio recording of the abnormal screeching brake sound when stopping.' },
    { type: 'audio', media: audioUrls[1], category: 'Staff Conduct', text: 'Conductor was rude to junior passengers asking about stop timings. Audio note attached.' },
    { type: 'audio', media: audioUrls[2], category: 'Vibration', text: 'Audio clip of loud mechanical vibration near rear axle.' },
    { type: 'audio', media: audioUrls[3], category: 'Route Suggestion', text: 'Voice suggestion: Please delay Route 4 departure by 10 mins to match lab dispersal.' },
    { type: 'audio', media: audioUrls[4], category: 'Safety Alert', text: 'Audio warning regarding waterlogged patch near Railway crossing road.' },
  ];

  await prisma.grievanceUpvote.deleteMany({});
  await prisma.grievance.deleteMany({});

  // Route id -> the bus number serving it (for the grievance snapshot).
  const routeBusById: Record<string, string> = {};
  for (const r of routesData) routeBusById[r.id] = r.bus;

  const createdGrievanceIds: string[] = [];

  for (let i = 0; i < complaints.length; i++) {
    const c = complaints[i];
    const s = students[i % students.length];
    const g = await prisma.grievance.create({
      data: {
        loginId: s.id,
        route: s.route,
        text: c.text,
        realName: s.name,
        type: c.type,
        mediaUrl: c.media,
        category: c.category,
        busNumber: routeBusById[s.route] ?? null,
        status:
          i % 5 === 0
            ? 'closed'
            : i % 4 === 0
              ? 'resolved'
              : i % 4 === 1
                ? 'reopened'
                : 'pending',
        upvotes: Math.floor(Math.random() * 15) + 3,
        createdAt: new Date(Date.now() - (20 - i) * 3600 * 1000),
        ...(i % 4 === 0
          ? {
              resolvedAt: new Date(),
              resolvedBy: 'AD001',
              dueAt: new Date(Date.now() + 48 * 3600 * 1000),
            }
          : {}),
        ...(i % 4 === 1 ? { reopenCount: 1, priority: 10 } : {}),
      },
    });
    createdGrievanceIds.push(g.id);
  }

  // Seed some Upvotes
  for (const gId of createdGrievanceIds) {
    const voter = students[Math.floor(Math.random() * students.length)];
    try {
      await prisma.grievanceUpvote.create({
        data: {
          grievanceId: gId,
          loginId: voter.id,
        },
      });
    } catch (e) {
      // ignore duplicate
    }
  }
  console.log('✔ 20 Student Complaints (Text, Photo, Video, Audio) and Upvotes seeded.');

  // 8. Attendance Records (15-20 records for today)
  await prisma.attendance.deleteMany({});
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    await prisma.attendance.create({
      data: {
        passengerId: s.id,
        routeId: s.route,
        name: s.name,
        feeStatus: s.fee,
        confidence: 0.95 + Math.random() * 0.04,
        timestamp: new Date(Date.now() - (i + 1) * 15 * 60 * 1000),
      },
    });
  }
  console.log('✔ Recent attendance records seeded.');

  // 9. Broadcasts & Announcements
  await prisma.broadcast.deleteMany({});
  await prisma.broadcast.createMany({
    data: [
      {
        title: 'Morning Shift Bus Schedule',
        message: 'All morning buses will depart promptly from university gate at 07:45 AM. Please arrive 5 minutes early.',
        timestamp: new Date(Date.now() - 4 * 3600 * 1000),
      },
      {
        title: 'Route 3 Road Diversion Notice',
        message: 'Due to road maintenance on Badaun Road, Bus 3 will temporarily detour via Subhash Nagar overbridge.',
        timestamp: new Date(Date.now() - 12 * 3600 * 1000),
      },
      {
        title: 'Biometric Face Enrollment Camp',
        message: 'Face Recognition verification desk is open at Admin Block room 104 between 2 PM to 5 PM today.',
        timestamp: new Date(Date.now() - 24 * 3600 * 1000),
      },
    ],
  });
  console.log('✔ Campus transit announcements seeded.');

  // 10. Leaves
  await prisma.leave.deleteMany({});
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  await prisma.leave.createMany({
    data: [
      { loginId: 'S001', date: tomorrow },
      { loginId: 'S003', date: tomorrow },
      { loginId: 'S005', date: tomorrow },
    ],
  });
  console.log('✔ Student leaves seeded.');

  // 11. System Log
  await prisma.systemLog.create({
    data: {
      level: LogLevel.log,
      message: 'Comprehensive database re-seed completed with Cloudinary & Supabase credentials.',
      context: 'SeedScript',
      meta: {
        totalStudents: 10,
        totalAdmins: 3,
        totalTechAdmins: 3,
        totalParents: 10,
        totalTI: 3,
        totalDrivers: 5,
        totalRoutes: 5,
        totalComplaints: 20,
      },
    },
  });

  console.log('\n==============================================');
  console.log('🎉 ALL MODULES SUCCESSFULLY SEEDED!');
  console.log('==============================================');
  console.log('Roles & Credentials Summary:');
  console.log('- Admins:      AD001, AD002, AD003 (Password: Admin@123)');
  console.log('- Tech Admins: techadmin, admin, TECH001 (Password: TechAdmin@123)');
  console.log('- TI:          TI001, TI002, TI003 (Password: Transport@123)');
  console.log('- Students:    S001 to S010 (Password: Student@123)');
  console.log('- Parents:     P001 to P010 (Password: Parent@123) or Phone');
  console.log('- Drivers:     D001 to D005 (Password: Driver@123)');
  console.log('==============================================\n');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
