import prisma from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.message.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.defenseParticipant.deleteMany();
  await prisma.defenseSession.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.committeeMember.deleteMany();
  await prisma.committee.deleteMany();
  await prisma.student.deleteMany();
  await prisma.professor.deleteMany();
  await prisma.failedLoginAttempt.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await hashPassword("pass123456");

  // 1. Create Administrator
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      password_hash: await hashPassword("admin123456"),
      full_name: "مدیر اداره آموزش تحصیلات تکمیلی",
      email: "admin@university.ac.ir",
      role: "admin",
      is_active: true,
    },
  });

  // 2. Create Professors
  const prof1User = await prisma.user.create({
    data: {
      username: "prof.ahmadi",
      password_hash: defaultPasswordHash,
      full_name: "دکتر علی احمدی",
      email: "ahmadi@university.ac.ir",
      role: "professor",
      is_active: true,
      bale_chat_id: "100101",
      bale_linked_at: new Date(),
    },
  });
  const prof1 = await prisma.professor.create({
    data: {
      user_id: prof1User.user_id,
      department: "مهندسی کامپیوتر",
      academic_title: "دانشیار",
      office_location: "ساختمان ابوریحان، اتاق ۳۰۲",
    },
  });

  const prof2User = await prisma.user.create({
    data: {
      username: "prof.hosseini",
      password_hash: defaultPasswordHash,
      full_name: "دکتر زهرا حسینی",
      email: "hosseini@university.ac.ir",
      role: "professor",
      is_active: true,
      bale_chat_id: "100102",
      bale_linked_at: new Date(),
    },
  });
  const prof2 = await prisma.professor.create({
    data: {
      user_id: prof2User.user_id,
      department: "مهندسی نرم‌افزار",
      academic_title: "استاد تمام",
      office_location: "ساختمان ابوریحان، اتاق ۴۰۵",
    },
  });

  const prof3User = await prisma.user.create({
    data: {
      username: "prof.rezaii",
      password_hash: defaultPasswordHash,
      full_name: "دکتر مسعود رضایی",
      email: "rezaii@university.ac.ir",
      role: "higher_education_staff", // Tests higher_education_staff role equivalence
      is_active: true,
    },
  });
  const prof3 = await prisma.professor.create({
    data: {
      user_id: prof3User.user_id,
      department: "هوش مصنوعی و رباتیک",
      academic_title: "استادیار",
      office_location: "ساختمان فناوری، اتاق ۱۱۰",
    },
  });

  // 3. Create Committees
  const committee1 = await prisma.committee.create({
    data: {
      name: "کمیته ارزیابی نرم‌افزار و سامانه‌های توزیع‌شده",
      created_by_user_id: admin.user_id,
      is_active: true,
    },
  });
  await prisma.committeeMember.createMany({
    data: [
      { committee_id: committee1.committee_id, professor_id: prof1.professor_id },
      { committee_id: committee1.committee_id, professor_id: prof2.professor_id },
    ],
  });

  const committee2 = await prisma.committee.create({
    data: {
      name: "کمیته ارزیابی هوش مصنوعی و داده‌کاوی",
      created_by_user_id: admin.user_id,
      is_active: true,
    },
  });
  await prisma.committeeMember.createMany({
    data: [
      { committee_id: committee2.committee_id, professor_id: prof1.professor_id },
      { committee_id: committee2.committee_id, professor_id: prof3.professor_id },
    ],
  });

  // 4. Create Availability Slots
  // Slot 1: Prof Ahmadi - Even days 09:00 - 11:00 (Sat, Mon, Wed)
  await prisma.availabilitySlot.create({
    data: {
      professor_id: prof1.professor_id,
      created_by_user_id: prof1User.user_id,
      slot_type: "recurring",
      recurrence_pattern: "even_days",
      start_time: "09:00",
      end_time: "11:00",
      valid_from: new Date("2026-10-24"),
      valid_until: new Date("2026-12-31"),
      status: "available",
    },
  });

  // Slot 2: Prof Hosseini - Odd days 14:00 - 16:00 (Sun, Tue)
  await prisma.availabilitySlot.create({
    data: {
      professor_id: prof2.professor_id,
      created_by_user_id: prof2User.user_id,
      slot_type: "recurring",
      recurrence_pattern: "odd_days",
      start_time: "14:00",
      end_time: "16:00",
      valid_from: new Date("2026-10-24"),
      valid_until: new Date("2026-12-31"),
      status: "available",
    },
  });

  // Slot 3: Committee 1 - Even days 13:00 - 15:00 (Sat, Mon, Wed)
  await prisma.availabilitySlot.create({
    data: {
      committee_id: committee1.committee_id,
      created_by_user_id: prof1User.user_id,
      slot_type: "recurring",
      recurrence_pattern: "even_days",
      start_time: "13:00",
      end_time: "15:00",
      valid_from: new Date("2026-10-24"),
      valid_until: new Date("2026-12-31"),
      status: "available",
    },
  });

  // Slot 4: Prof Rezaii - Weekly on Monday 10:00 - 12:00
  await prisma.availabilitySlot.create({
    data: {
      professor_id: prof3.professor_id,
      created_by_user_id: prof3User.user_id,
      slot_type: "recurring",
      recurrence_pattern: "weekly",
      weekday: "mon",
      start_time: "10:00",
      end_time: "12:00",
      valid_from: new Date("2026-10-19"),
      valid_until: new Date("2026-12-31"),
      status: "available",
    },
  });

  // 5. Create Students
  const student1User = await prisma.user.create({
    data: {
      username: "student.alavi",
      password_hash: defaultPasswordHash,
      full_name: "علی علوی",
      email: "alavi@student.university.ac.ir",
      role: "student",
      is_active: true,
      bale_chat_id: "200101",
      bale_linked_at: new Date(),
    },
  });
  const student1 = await prisma.student.create({
    data: {
      user_id: student1User.user_id,
      student_number: "40112345",
      degree_level: "master",
      thesis_title: "بهینه‌سازی الگوریتم‌های یادگیری ماشین در سامانه‌های توزیع‌شده با مقیاس بالا",
    },
  });

  const student2User = await prisma.user.create({
    data: {
      username: "student.mohammadi",
      password_hash: defaultPasswordHash,
      full_name: "مریم محمدی",
      email: "mohammadi@student.university.ac.ir",
      role: "student",
      is_active: true,
    },
  });
  const student2 = await prisma.student.create({
    data: {
      user_id: student2User.user_id,
      student_number: "40098765",
      degree_level: "phd",
      thesis_title: "معماری‌های نوین پردازش زبان طبیعی فارسی در مدل‌های زبانی بزرگ",
    },
  });

  // 6. Create a sample requested session for student1
  await prisma.defenseSession.create({
    data: {
      student_id: student1.student_id,
      status: "requested",
      note: "پایان‌نامه به تایید استاد راهنما رسیده و آماده دفاع در نیمه اول آبان ماه هستم.",
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
