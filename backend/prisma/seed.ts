import { PrismaClient, UserRole, FeeStatus, LogLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  const hashedPassword = await bcrypt.hash('Invertis@123', 10);

  const routeNames = ['Bus 1', 'Bus 2', 'Bus 3', 'Bus 4', 'Bus 5'];
  const destinations = ['Civil Lines', 'Rajendra Nagar', 'DD Puram', 'Subhash Nagar', 'Cantonment'];
  
  for (let i = 0; i < routeNames.length; i++) {
    await prisma.route.upsert({
      where: { routeId: String(i + 1) },
      update: {},
      create: {
        routeId: String(i + 1),
        routeName: routeNames[i],
        busNumber: `UP25 AB 100${i + 1}`,
        stops: `["Invertis University", "Stop A", "Stop B", "${destinations[i]}"]`,
        city: 'Bareilly',
        seatingCapacity: 50,
        speedLimit: 60,
      },
    });
  }

  const admin1 = await prisma.user.upsert({
    where: { loginId: 'AD001' },
    update: {},
    create: { loginId: 'AD001', name: 'System Admin 1', password: hashedPassword, role: UserRole.admin, phone: '9999999991' },
  });
  const admin2 = await prisma.user.upsert({
    where: { loginId: 'AD002' },
    update: {},
    create: { loginId: 'AD002', name: 'System Admin 2', password: hashedPassword, role: UserRole.admin, phone: '9999999992' },
  });
  const admin3 = await prisma.user.upsert({
    where: { loginId: 'AD003' },
    update: {},
    create: { loginId: 'AD003', name: 'System Admin 3', password: hashedPassword, role: UserRole.admin, phone: '9999999993' },
  });

  // Generate 10 Students and their Parents
  for (let i = 1; i <= 10; i++) {
    const sId = `S${String(i).padStart(3, '0')}`;
    const pId = `P${String(i).padStart(3, '0')}`;
    const parentPhone = `77777777${String(i - 1).padStart(2, '0')}`; // e.g. 7777777700, 7777777701...

    const passenger = await prisma.user.upsert({
      where: { loginId: sId },
      update: {
        routeId: String((i % 5) + 1), // Update existing students' routes too
      },
      create: {
        loginId: sId,
        name: `Student ${i}`,
        password: hashedPassword,
        role: UserRole.passenger,
        routeId: String((i % 5) + 1), // Route 1 to 5
        feeStatus: FeeStatus.paid,
        phone: `88888888${String(i - 1).padStart(2, '0')}`,
        gradeClass: 'B.Tech CS 3rd Year',
      },
    });

    const parent = await prisma.user.upsert({
      where: { loginId: pId },
      update: {},
      create: {
        loginId: pId,
        name: `Parent ${i}`,
        password: hashedPassword,
        role: UserRole.parent,
        phone: parentPhone,
      },
    });

    await prisma.parentChildLink.upsert({
      where: {
        parentLoginId_childLoginId: {
          parentLoginId: pId,
          childLoginId: sId,
        }
      },
      update: {},
      create: {
        parentLoginId: pId,
        childLoginId: sId,
        nickname: `Child ${i}`,
      }
    });
  }

  const ti1 = await prisma.user.upsert({
    where: { loginId: 'TI001' },
    update: {},
    create: { loginId: 'TI001', name: 'Transport Incharge 1', password: hashedPassword, role: UserRole.transport_incharge, phone: '6666666661' },
  });
  const ti2 = await prisma.user.upsert({
    where: { loginId: 'TI002' },
    update: {},
    create: { loginId: 'TI002', name: 'Transport Incharge 2', password: hashedPassword, role: UserRole.transport_incharge, phone: '6666666662' },
  });
  const ti3 = await prisma.user.upsert({
    where: { loginId: 'TI003' },
    update: {},
    create: { loginId: 'TI003', name: 'Transport Incharge 3', password: hashedPassword, role: UserRole.transport_incharge, phone: '6666666663' },
  });

  // Generate 5 Drivers for the 5 Routes
  for (let i = 1; i <= 5; i++) {
    const dId = `D${String(i).padStart(3, '0')}`;
    await prisma.user.upsert({
      where: { loginId: dId },
      update: {},
      create: {
        loginId: dId,
        name: `Driver ${i}`,
        password: hashedPassword,
        role: UserRole.driver,
        routeId: String(i),
        phone: `555555555${i}`,
      },
    });

    // Link driver to the route
    await prisma.route.update({
      where: { routeId: String(i) },
      data: { driverId: dId },
    });
  }

  // Generate 20 Distinct Grievances
  const distinctComplaints = [
    // Text (5)
    { type: 'text', media: null, text: 'Bus arrived 25 minutes late today at the Choupla stop. Please ensure timely arrival.' },
    { type: 'text', media: null, text: 'The AC in Bus 3 is not working properly, it gets very suffocating in the afternoon trip.' },
    { type: 'text', media: null, text: 'Some senior students were playing very loud music and disturbing everyone preparing for exams.' },
    { type: 'text', media: null, text: 'The bus driver drove very rashly near the Civil Lines crossing today morning.' },
    { type: 'text', media: null, text: 'Can we have a different pickup point near the market? The current one is too crowded and unsafe.' },
    // Photo (5)
    { type: 'photo', media: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', text: 'Seat covers are completely torn on the last row. Needs immediate replacement.' },
    { type: 'photo', media: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', text: 'Window glass is cracked on the left side, it might break completely if hit.' },
    { type: 'photo', media: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', text: 'Dust and trash scattered all over the floor today morning. Bus was not cleaned.' },
    { type: 'photo', media: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', text: 'The emergency exit handle seems broken. Attached photo for reference.' },
    { type: 'photo', media: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', text: 'Someone left their laptop bag on the bus yesterday. Handed it to the driver.' },
    // Video (5)
    { type: 'video', media: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', text: 'Water is leaking continuously from the AC vent during the rain.' },
    { type: 'video', media: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', text: 'Bus making a very loud rattling noise from the engine side. See video.' },
    { type: 'video', media: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', text: 'Traffic jam due to our bus breaking down in middle of the main road.' },
    { type: 'video', media: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', text: 'Dangerous! Driver was using mobile phone while driving on the highway.' },
    { type: 'video', media: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', text: 'Sparks coming from the overhead light panel. Please fix this immediately.' },
    // Audio (5)
    { type: 'audio', media: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', text: 'Audio recording of the strange engine noise that started today.' },
    { type: 'audio', media: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', text: 'Conductor misbehaving and shouting at junior students, audio attached.' },
    { type: 'audio', media: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', text: 'Loud rattling sound coming from the back wheel area.' },
    { type: 'audio', media: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', text: 'Voice complaint: The route timing needs to be delayed by 10 mins due to college timings.' },
    { type: 'audio', media: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', text: 'Audio proof of seniors using abusive language in the bus.' },
  ];

  await prisma.grievance.deleteMany({}); // clear old ones

  for (let i = 0; i < 20; i++) {
    const comp = distinctComplaints[i];
    const sIdIndex = (i % 10) + 1; // 1 to 10
    const sId = `S${String(sIdIndex).padStart(3, '0')}`;
    const routeId = String((sIdIndex % 5) + 1); // 1 to 5
    
    await prisma.grievance.create({
      data: {
        loginId: sId,
        route: routeId,
        text: comp.text,
        realName: `Student ${sIdIndex}`,
        type: comp.type,
        mediaUrl: comp.media,
        status: i % 4 === 0 ? 'resolved' : 'pending',
        upvotes: Math.floor(Math.random() * 20),
      }
    });
  }

  // Sample System Log
  await prisma.systemLog.create({
    data: {
      level: LogLevel.log,
      message: 'Database seeded successfully',
      context: 'SeedScript',
    }
  });

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
