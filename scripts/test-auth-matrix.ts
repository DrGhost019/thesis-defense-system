process.env.BALE_TEST_MODE = "true";

import prisma from "../src/lib/prisma";
import { AuthService } from "../src/services/AuthService";
import { SlotService } from "../src/services/SlotService";
import { ScheduleService } from "../src/services/ScheduleService";
import { RequestService } from "../src/services/RequestService";
import { AssignmentService } from "../src/services/AssignmentService";
import { ResponseService } from "../src/services/ResponseService";
import { CancellationService } from "../src/services/CancellationService";
import { MessageService } from "../src/services/MessageService";
import { expandSlotOccurrences, getTehranDate, toTehranDateString } from "../src/lib/date-utils";
import { addDays } from "date-fns";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}: ${detail || "Assertion failed"}`);
    failed++;
  }
}

async function runTests() {
  console.log("=== Running Comprehensive Test Suite (T01 - T31) ===");

  // Reseed before tests to guarantee clean baseline
  const { execSync } = await import("child_process");
  execSync("npx tsx scripts/seed.ts", { stdio: "ignore" });

  // Lookup test users
  const admin = await prisma.user.findUnique({ where: { username: "admin" } });
  const prof1 = await prisma.user.findUnique({ where: { username: "prof.ahmadi" }, include: { professor: true } });
  const prof2 = await prisma.user.findUnique({ where: { username: "prof.hosseini" }, include: { professor: true } });
  const prof3 = await prisma.user.findUnique({ where: { username: "prof.rezaii" }, include: { professor: true } });
  const student1 = await prisma.user.findUnique({ where: { username: "student.alavi" }, include: { student: true } });
  const student2 = await prisma.user.findUnique({ where: { username: "student.mohammadi" }, include: { student: true } });

  // T01: Login with valid, invalid, and deactivated
  const validLogin = await AuthService.authenticate("admin", "admin123456");
  assert(validLogin.success === true, "T01a: Valid login succeeds");

  const invalidPass = await AuthService.authenticate("admin", "wrongpass123");
  assert(invalidPass.success === false && invalidPass.status === 401, "T01b: Wrong password refused with 401");

  // Deactivate student2 temporarily
  await prisma.user.update({ where: { user_id: student2!.user_id }, data: { is_active: false } });
  const deactLogin = await AuthService.authenticate("student.mohammadi", "pass123456");
  assert(deactLogin.success === false && deactLogin.status === 401, "T01c: Deactivated account cannot log in");
  await prisma.user.update({ where: { user_id: student2!.user_id }, data: { is_active: true } });

  // T02: Define slot on Thursday (weekend) -> Refused
  const thursdaySlot = await SlotService.define(
    {
      owner_type: "professor",
      slot_type: "single",
      slot_date: "2026-10-22", // Thursday
      start_time: "09:00",
      end_time: "10:30",
    },
    prof1!.user_id,
    prof1!.professor!.professor_id
  );
  assert(thursdaySlot.success === false, "T02: Single slot on Thursday refused (outside Sat-Wed)");

  // T03: Define slot before 08:00 -> Refused
  const earlySlot = await SlotService.define(
    {
      owner_type: "professor",
      slot_type: "single",
      slot_date: "2026-10-24", // Saturday
      start_time: "07:30",
      end_time: "09:00",
    },
    prof1!.user_id,
    prof1!.professor!.professor_id
  );
  assert(earlySlot.success === false, "T03: Slot starting before 08:00 refused");

  // T04: Define two overlapping slots for same professor -> Refused
  // prof1 already has even_days 09:00 - 11:00 from 2026-10-24 to 2026-12-31
  const overlapSlot = await SlotService.define(
    {
      owner_type: "professor",
      slot_type: "recurring",
      recurrence_pattern: "weekly",
      weekday: "mon",
      valid_from: "2026-10-24",
      valid_until: "2026-11-30",
      start_time: "10:00",
      end_time: "12:00",
    },
    prof1!.user_id,
    prof1!.professor!.professor_id
  );
  assert(overlapSlot.success === false && overlapSlot.status === 409, "T04: Overlapping slot for same professor refused");

  // T08: Professor defines slot for committee they don't belong to -> Refused
  // Create a dummy committee with only prof2
  const commOnly2 = await prisma.committee.create({
    data: { name: "کمیته آزمایشی تک‌عضو", created_by_user_id: admin!.user_id, is_active: true },
  });
  await prisma.committeeMember.create({
    data: { committee_id: commOnly2.committee_id, professor_id: prof2!.professor!.professor_id },
  });

  const unauthorizedCommSlot = await SlotService.define(
    {
      owner_type: "committee",
      committee_id: commOnly2.committee_id,
      slot_type: "single",
      slot_date: "2026-10-24",
      start_time: "09:00",
      end_time: "10:30",
    },
    prof1!.user_id,
    prof1!.professor!.professor_id
  );
  assert(unauthorizedCommSlot.success === false && unauthorizedCommSlot.status === 403, "T08: Non-member defining committee slot refused (403)");

  // T10: Schedule grid builds
  const scheduleData = await ScheduleService.buildWeek("2026-10-24");
  assert(scheduleData.days.length === 5, "T10: Schedule returns 5 working days (Sat to Wed)");

  // T12: Student submits twice -> Second refused
  // student1 already has an active requested session from seed!
  const secondReq = await RequestService.submit(student1!.user_id, "تلاش برای ثبت درخواست دوم");
  assert(secondReq.success === false && secondReq.status === 409, "T12: Second active request by student refused with 409");

  // Find existing session for student1
  const student1Session = await prisma.defenseSession.findFirst({
    where: { student_id: student1!.student!.student_id, status: "requested" },
  });
  assert(!!student1Session, "Found student1 requested session");

  // Find a slot for assignment: Committee 1 slot (Odd days 13:00-15:00)
  const commSlot = await prisma.availabilitySlot.findFirst({
    where: { committee_id: { not: null }, status: "available" },
  });

  // Compute the first valid future occurrence (>= tomorrow in Asia/Tehran) for commSlot
  const tomorrowStr = toTehranDateString(addDays(getTehranDate(), 1));
  const twoWeeksOutStr = toTehranDateString(addDays(getTehranDate(), 14));
  const futureOccurrences = expandSlotOccurrences(
    {
      slot_type: commSlot!.slot_type,
      slot_date: commSlot!.slot_date,
      recurrence_pattern: commSlot!.recurrence_pattern,
      weekday: commSlot!.weekday,
      valid_from: commSlot!.valid_from,
      valid_until: commSlot!.valid_until,
    },
    tomorrowStr,
    twoWeeksOutStr
  );
  const assignDate = futureOccurrences[0];

  // T15: Assign committee slot with members -> creates seats
  const assignResult = await AssignmentService.assign(
    student1Session!.session_id,
    commSlot!.slot_id,
    assignDate,
    admin!.user_id
  );
  assert(assignResult.success === true, "T15a: Assignment of committee slot succeeds");

  const seats = await prisma.defenseParticipant.findMany({
    where: { session_id: student1Session!.session_id },
  });
  assert(seats.length === 2, "T15b: Two pending seats created for committee with 2 members");

  // T13: Attempt to assign same occurrence to another session -> 409 CONFLICT
  // Submit request for student2
  const req2 = await RequestService.submit(student2!.user_id, "درخواست دانشجو ۲");
  assert(req2.success === true, "Student 2 submits request");

  const doubleAssign = await AssignmentService.assign(
    req2.session!.session_id,
    commSlot!.slot_id,
    assignDate, // Same occurrence!
    admin!.user_id
  );
  assert(doubleAssign.success === false && doubleAssign.status === 409, "T13: Double booking same occurrence refused with 409 CONFLICT");

  // T17: Admin declines without reason (< 5 chars) -> 422
  const declineNoReason = await AssignmentService.decline(req2.session!.session_id, "رد", admin!.user_id);
  assert(declineNoReason.success === false && declineNoReason.status === 422, "T17: Admin decline with < 5 chars reason refused");

  // Admin declines with valid reason (>= 5 chars)
  const declineValid = await AssignmentService.decline(
    req2.session!.session_id,
    "مدارک تحصیلی و پژوهشی بارگذاری‌شده ناقص است",
    admin!.user_id
  );
  assert(declineValid.success === true, "Admin decline with valid reason succeeds");

  // T18: First professor approves seat
  const seatProf1 = seats.find((s) => s.professor_id === prof1!.professor!.professor_id);
  const seatProf2 = seats.find((s) => s.professor_id === prof2!.professor!.professor_id);

  const dec1 = await ResponseService.recordDecision(seatProf1!.participant_id, prof1!.professor!.professor_id, true);
  assert(dec1.success === true && dec1.sessionStatus === "assigned", "T18: First professor approves, session remains assigned");

  // T23: Message before confirmation -> Refused
  const msgBeforeConf = await MessageService.post(student1Session!.session_id, student1!.user_id, "سلام");
  assert(msgBeforeConf.success === false && msgBeforeConf.status === 409, "T23: Messaging before confirmation refused");

  // T19: Second professor approves seat -> Session confirmed!
  const dec2 = await ResponseService.recordDecision(seatProf2!.participant_id, prof2!.professor!.professor_id, true);
  assert(dec2.success === true && dec2.sessionStatus === "confirmed", "T19: All professors approve, session confirmed!");

  // T36: Messaging in confirmed session works
  const msgAfterConf = await MessageService.post(student1Session!.session_id, student1!.user_id, "سلام، با تشکر از اساتید محترم");
  assert(msgAfterConf.success === true, "T36: Message posted in confirmed session");

  // T24: Non-member cannot message
  const msgNonMember = await MessageService.post(student1Session!.session_id, prof3!.user_id, "پیام استاد نامرتبط");
  assert(msgNonMember.success === false && msgNonMember.status === 403, "T24: Non-member messaging refused (403)");

  // T25: Bale link code flow
  const linkCodeRes = await AuthService.issueBaleLinkCode(student2!.user_id);
  assert(linkCodeRes.success === true && linkCodeRes.code?.length === 8, "T25a: Bale link code generated (8 characters)");
  const completeLinkRes = await AuthService.completeBaleLink(linkCodeRes.code!, "300301");
  assert(completeLinkRes.success === true, "T25b: Bale link completed successfully");
  const reusedCode = await AuthService.completeBaleLink(linkCodeRes.code!, "300302");
  assert(reusedCode.success === false, "T25c: Reusing same link code refused (one-time use)");

  // T21: Cancellation of confirmed session by student
  const cancelRes = await CancellationService.cancel(student1Session!.session_id, student1!.user_id, "نیاز به بازنگری مقاله");
  assert(cancelRes.success === true && cancelRes.session?.status === "cancelled", "T21: Cancellation by student succeeds");

  console.log(`\n=============================`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`=============================\n`);

  if (failed > 0) process.exit(1);
}

runTests()
  .catch((e) => {
    console.error("Test error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
