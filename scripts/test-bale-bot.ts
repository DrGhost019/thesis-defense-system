import { loadEnvFile } from "./load-env";
loadEnvFile();
process.env.BALE_TEST_MODE = "true";

import prisma from "../src/lib/prisma";
import { AuthService } from "../src/services/AuthService";
import { BaleGateway } from "../src/services/BaleGateway";
import { NotificationService, computeNextRetryAt } from "../src/services/NotificationService";
import { CancellationService } from "../src/services/CancellationService";
import { getTehranDate, toTehranDateString } from "../src/lib/date-utils";
import { addDays, subMinutes } from "date-fns";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
    failed++;
  }
}

async function runBaleTests() {
  console.log("=== Running Bale Bot Comprehensive Test Suite (T25 - T30 & Edge Cases) ===");

  const suffix = `bt${String(Date.now()).slice(-7)}`;
  const createdUserIds: number[] = [];
  const createdSlotIds: number[] = [];
  const createdSessionIds: number[] = [];
  const sentMessages: Array<{ chatId: string; text: string }> = [];

  BaleGateway.setTestStub((chatId, text) => {
    sentMessages.push({ chatId, text });
    return { ok: true, messageId: `stub_${sentMessages.length}` };
  });

  try {
    // Setup isolated test accounts: 1 admin, 2 students (FA & EN), 2 professors (1 linked, 1 unlinked), 1 deactivated professor
    const adminAcc = await AuthService.createAccount({
      username: `adm_${suffix}`,
      password: "Password123!",
      full_name: "Test Bale Admin",
      role: "admin",
    });
    const studentFaAcc = await AuthService.createAccount({
      username: `stufa_${suffix}`,
      password: "Password123!",
      full_name: "دانشجوی تست فارسی",
      role: "student",
      student_number: `99${Date.now().toString().slice(-6)}1`,
      degree_level: "master",
      thesis_title: "SECRET_THESIS_TITLE_MUST_NOT_LEAK_FA",
    });
    const studentEnAcc = await AuthService.createAccount({
      username: `stuen_${suffix}`,
      password: "Password123!",
      full_name: "English Test Student",
      role: "student",
      student_number: `99${Date.now().toString().slice(-6)}2`,
      degree_level: "phd",
      thesis_title: "SECRET_THESIS_TITLE_MUST_NOT_LEAK_EN",
    });
    const profLinkedAcc = await AuthService.createAccount({
      username: `profl_${suffix}`,
      password: "Password123!",
      full_name: "دکتر داور متصل",
      role: "professor",
      department: "Computer Engineering",
      academic_title: "Associate Professor",
    });
    const profUnlinkedAcc = await AuthService.createAccount({
      username: `profu_${suffix}`,
      password: "Password123!",
      full_name: "دکتر داور بدون بله",
      role: "professor",
      department: "Computer Engineering",
      academic_title: "Assistant Professor",
    });
    const profInactiveAcc = await AuthService.createAccount({
      username: `profi_${suffix}`,
      password: "Password123!",
      full_name: "دکتر غیرفعال",
      role: "professor",
      department: "Computer Engineering",
      academic_title: "Professor",
    });

    for (const acc of [adminAcc, studentFaAcc, studentEnAcc, profLinkedAcc, profUnlinkedAcc, profInactiveAcc]) {
      if (!acc.success || !acc.userId) {
        throw new Error(`Failed creating test account: ${JSON.stringify(acc)}`);
      }
      createdUserIds.push(acc.userId);
    }

    await AuthService.updatePreferredLang(studentEnAcc.userId!, "en");
    await prisma.user.update({
      where: { user_id: profInactiveAcc.userId! },
      data: { is_active: false, bale_chat_id: `inactive_${suffix}` },
    });

    // =========================================================================
    // T25a: Link code format (8 chars, no 0/O/1/I) & 10-min TTL
    // =========================================================================
    const code1 = await AuthService.issueBaleLinkCode(studentFaAcc.userId!);
    assert(
      code1.success === true &&
        typeof code1.code === "string" &&
        code1.code.length === 8 &&
        !/[0O1I]/.test(code1.code) &&
        code1.ttlMinutes === 10,
      "T25a: Link code is 8 valid chars (excluding 0, O, 1, I) with 10-min TTL"
    );

    // =========================================================================
    // T25b: Rate limit (at most 3 codes/hour) & previous code invalidation (D.8)
    // =========================================================================
    const code2 = await AuthService.issueBaleLinkCode(studentFaAcc.userId!);
    const code3 = await AuthService.issueBaleLinkCode(studentFaAcc.userId!);
    const code4 = await AuthService.issueBaleLinkCode(studentFaAcc.userId!);
    assert(
      code2.success === true && code3.success === true && code4.success === false && code4.status === 429,
      "T25b: Hourly rate limit enforces max 3 link codes per user per hour (4th returns 429)"
    );

    // Verify code1 was invalidated when code2/code3 were issued
    const oldCodeAttempt = await BaleGateway.handleUpdate({
      update_id: 1001,
      message: { chat: { id: `chat_fa_${suffix}` }, text: code1.code! },
    });
    assert(
      oldCodeAttempt.status === "link_failed",
      "T25b-inv: Previous link code is invalidated once a new code is issued"
    );

    // =========================================================================
    // T25c: Valid code via /start <CODE> links account, clears code, sends reply (not logged in Notification)
    // =========================================================================
    sentMessages.length = 0;
    const chatFa = `chat_fa_${suffix}`;
    const linkOk = await BaleGateway.handleUpdate({
      update_id: 1002,
      message: { chat: { id: chatFa }, text: `/start ${code3.code!}` },
    });
    const linkedStudentFa = await prisma.user.findUnique({ where: { user_id: studentFaAcc.userId! } });
    const linkNotifCount = await prisma.notification.count({
      where: { recipient_user_id: studentFaAcc.userId! },
    });
    assert(
      linkOk.status === "linked" &&
        linkedStudentFa?.bale_chat_id === chatFa &&
        linkedStudentFa?.bale_link_code === null &&
        sentMessages.length === 1 &&
        linkNotifCount === 0,
      "T25c: Valid /start <CODE> saves bale_chat_id, clears code, sends Bale reply, and does not log Notification"
    );

    // =========================================================================
    // T25d (Edge Case #18): Duplicate chat_id for a second user is refused
    // =========================================================================
    const codeEn = await AuthService.issueBaleLinkCode(studentEnAcc.userId!);
    sentMessages.length = 0;
    const dupChatRes = await BaleGateway.handleUpdate({
      update_id: 1003,
      message: { chat: { id: chatFa }, text: codeEn.code! },
    });
    assert(
      dupChatRes.status === "link_failed" && sentMessages.length === 1,
      "T25d (Edge Case #18): Second user attempting to link an already-used chat_id is refused with bot error reply"
    );

    // Link English student with their own chat_id (and verify English confirmation reply!)
    sentMessages.length = 0;
    const chatEn = `chat_en_${suffix}`;
    const linkEnOk = await BaleGateway.handleUpdate({
      update_id: 1004,
      message: { chat: { id: chatEn }, text: codeEn.code! },
    });
    assert(
      linkEnOk.status === "linked" &&
        sentMessages.length === 1 &&
        sentMessages[0].text.includes("successfully linked"),
      "T25c-EN: English user receives confirmation reply in English"
    );

    // =========================================================================
    // T25e: One-time use (reusing consumed code fails)
    // =========================================================================
    const reuseRes = await BaleGateway.handleUpdate({
      update_id: 1005,
      message: { chat: { id: `chat_other_${suffix}` }, text: codeEn.code! },
    });
    assert(reuseRes.status === "link_failed", "T25e: Reusing an already-used link code is refused");

    // =========================================================================
    // T26 (Edge Case #17): Wrong code & expired code refused cleanly
    // =========================================================================
    sentMessages.length = 0;
    const wrongCodeRes = await BaleGateway.handleUpdate({
      update_id: 1006,
      message: { chat: { id: `chat_bad_${suffix}` }, text: "ZZZZ9999" },
    });
    assert(
      wrongCodeRes.status === "link_failed" && sentMessages.length === 1,
      "T26a (Edge Case #17): Wrong code replies with short error and changes nothing"
    );

    // Issue code for profLinked, manually expire it, and test T26
    const profCode = await AuthService.issueBaleLinkCode(profLinkedAcc.userId!);
    await prisma.user.update({
      where: { user_id: profLinkedAcc.userId! },
      data: { bale_link_expires_at: subMinutes(new Date(), 5) },
    });
    const expiredRes = await BaleGateway.handleUpdate({
      update_id: 1007,
      message: { chat: { id: `chat_prof_${suffix}` }, text: profCode.code! },
    });
    const profAfterExpired = await prisma.user.findUnique({ where: { user_id: profLinkedAcc.userId! } });
    assert(
      expiredRes.status === "link_failed" &&
        profAfterExpired?.bale_chat_id === null &&
        profAfterExpired?.bale_link_code === null,
      "T26b: Expired link code is refused, cleared, and leaves user unlinked"
    );

    // Now link profLinked cleanly
    const profCode2 = await AuthService.issueBaleLinkCode(profLinkedAcc.userId!);
    const chatProf = `chat_prof_${suffix}`;
    const profLinkedRes = await BaleGateway.handleUpdate({
      update_id: 1008,
      message: { chat: { id: chatProf }, text: profCode2.code! },
    });
    assert(profLinkedRes.status === "linked", "T25-prof: Professor linked cleanly");

    // Test /start, /help, /status bot commands
    sentMessages.length = 0;
    const statusRes = await BaleGateway.handleUpdate({
      update_id: 1009,
      message: { chat: { id: chatEn }, text: "/status" },
    });
    const helpRes = await BaleGateway.handleUpdate({
      update_id: 1010,
      message: { chat: { id: chatEn }, text: "/help" },
    });
    const startRes = await BaleGateway.handleUpdate({
      update_id: 1011,
      message: { chat: { id: `unlinked_${suffix}` }, text: "/start" },
    });
    assert(
      statusRes.status === "status" &&
        helpRes.status === "help" &&
        startRes.status === "welcome" &&
        sentMessages.length === 3 &&
        sentMessages[0].text.includes("English Test Student"),
      "Commands: /start, /help, and /status reply accurately"
    );

    // =========================================================================
    // Prepare tomorrow's date & slot/sessions for T27, T28, T29, T30
    // =========================================================================
    const tomorrowStr = toTehranDateString(addDays(getTehranDate(), 1));
    const tomorrowDate = new Date(tomorrowStr);

    const profLinkedRow = await prisma.professor.findUnique({ where: { user_id: profLinkedAcc.userId! } });
    const profUnlinkedRow = await prisma.professor.findUnique({ where: { user_id: profUnlinkedAcc.userId! } });
    const profInactiveRow = await prisma.professor.findUnique({ where: { user_id: profInactiveAcc.userId! } });
    const studentFaRow = await prisma.student.findUnique({ where: { user_id: studentFaAcc.userId! } });
    const studentEnRow = await prisma.student.findUnique({ where: { user_id: studentEnAcc.userId! } });

    const testSlot = await prisma.availabilitySlot.create({
      data: {
        professor_id: profLinkedRow!.professor_id,
        created_by_user_id: profLinkedAcc.userId!,
        slot_type: "single",
        slot_date: tomorrowDate,
        start_time: "10:00",
        end_time: "12:00",
        status: "available",
      },
    });
    createdSlotIds.push(testSlot.slot_id);

    // Confirmed session dated TOMORROW with: English student (linked), Linked Prof (FA), Unlinked Prof, Deactivated Prof
    const confirmedSession = await prisma.defenseSession.create({
      data: {
        student_id: studentEnRow!.student_id,
        slot_id: testSlot.slot_id,
        scheduled_date: tomorrowDate,
        start_time: "10:00",
        end_time: "12:00",
        status: "confirmed",
        note: "SECRET_STUDENT_NOTE_MUST_NOT_LEAK",
        confirmed_at: new Date(),
        seats: {
          create: [
            { professor_id: profLinkedRow!.professor_id, status: "approved", responded_at: new Date() },
            { professor_id: profUnlinkedRow!.professor_id, status: "approved", responded_at: new Date() },
            { professor_id: profInactiveRow!.professor_id, status: "approved", responded_at: new Date() },
          ],
        },
      },
    });
    createdSessionIds.push(confirmedSession.session_id);

    // =========================================================================
    // T27 & T29: Confirmed Outcome Notification (Bilingual + Privacy + Skipped Unlinked/Inactive)
    // =========================================================================
    sentMessages.length = 0;
    const outcomeRes = await NotificationService.queueOutcome(confirmedSession.session_id);
    const enMsg = sentMessages.find((m) => m.chatId === chatEn);
    const faMsg = sentMessages.find((m) => m.chatId === chatProf);
    const outcomeRows = await prisma.notification.findMany({
      where: { session_id: confirmedSession.session_id, type: "outcome" },
    });
    const skippedRows = outcomeRows.filter((n) => n.status === "skipped");

    assert(
      outcomeRes.sent === 2 && outcomeRes.skipped === 2 && outcomeRes.failed === 0 && skippedRows.length === 2,
      "T27a & T29: Confirmed outcome sends to 2 linked active users and marks unlinked + inactive users as skipped"
    );
    assert(
      !!enMsg &&
        enMsg.text.includes("Your thesis defense is confirmed:") &&
        enMsg.text.includes("10:00 to 12:00") &&
        !enMsg.text.includes("SECRET_THESIS_TITLE") &&
        !enMsg.text.includes("SECRET_STUDENT_NOTE"),
      "T27b: English confirmed template matches Section 11.4 and excludes thesis title & student note"
    );
    assert(
      !!faMsg &&
        faMsg.text.includes("تأیید شد") &&
        !faMsg.text.includes("SECRET_THESIS_TITLE") &&
        !faMsg.text.includes("SECRET_STUDENT_NOTE"),
      "T27c: Persian confirmed template matches Section 11.4 and excludes thesis title & student note"
    );

    // Admin Decline Outcome -> Student ONLY with decline reason
    const declinedSession = await prisma.defenseSession.create({
      data: {
        student_id: studentFaRow!.student_id,
        status: "rejected",
        decision_reason: "مدارک پیش‌دفاع ناقص است",
        assigned_by_user_id: adminAcc.userId!,
        assigned_at: new Date(),
      },
    });
    createdSessionIds.push(declinedSession.session_id);

    sentMessages.length = 0;
    const declineOut = await NotificationService.queueOutcome(declinedSession.session_id);
    assert(
      declineOut.sent === 1 &&
        sentMessages.length === 1 &&
        sentMessages[0].chatId === chatFa &&
        sentMessages[0].text.includes("مدارک پیش‌دفاع ناقص است"),
      "T27d: Admin decline sends Bale outcome to student only with decline reason"
    );

    // =========================================================================
    // T28 (Edge Case #15): Daily Reminder Job + Idempotency (running twice -> zero duplicates)
    // =========================================================================
    sentMessages.length = 0;
    const remRun1 = await NotificationService.runDailyReminders();
    const remMsgsRun1 = sentMessages.filter((m) => m.chatId === chatEn || m.chatId === chatProf);
    const remRun2 = await NotificationService.runDailyReminders();
    const remMsgsRun2 = sentMessages.filter((m) => m.chatId === chatEn || m.chatId === chatProf);

    assert(
      remMsgsRun1.length === 2 &&
        remMsgsRun1.some((m) => m.chatId === chatEn && m.text.startsWith("Reminder: the thesis defense of English Test Student is tomorrow")) &&
        remMsgsRun1.some((m) => m.chatId === chatProf && m.text.startsWith("یادآوری: جلسه دفاع")),
      "T28a: Daily reminder sends bilingual reminders for tomorrow's confirmed session"
    );
    assert(
      remMsgsRun2.length === 2 && remRun2.duplicatesSkipped >= 4,
      "T28b (Edge Case #15): Running daily reminder job twice sends zero duplicate reminders"
    );

    // =========================================================================
    // Appendix D.6 / F.1: Cancellation sends NO Bale notification
    // =========================================================================
    sentMessages.length = 0;
    const cancelRes = await CancellationService.cancel(
      confirmedSession.session_id,
      studentEnAcc.userId!,
      "Testing cancellation no-Bale rule"
    );
    assert(
      cancelRes.success === true && sentMessages.length === 0,
      "Appendix D.6 / F.1: Cancellation does NOT send any Bale message"
    );

    // =========================================================================
    // T30 (Edge Case #16): Bale Gateway outage -> Failed, Non-blocking, Exact Backoff & Recovery Retry
    // =========================================================================
    const backoffCheck = [1, 2, 3, 4, 5].map((attempt) => {
      const now = new Date("2026-10-20T06:00:00Z"); // 09:30 Tehran
      const next = computeNextRetryAt("outcome", attempt, now);
      return next ? Math.round((next.getTime() - now.getTime()) / 60000) : null;
    });
    assert(
      JSON.stringify(backoffCheck) === JSON.stringify([1, 5, 15, 60, null]),
      "T30a (Appendix F.2): Outcome retry backoff delays are exactly [1, 5, 15, 60, null] minutes (5 attempts total)",
      `Got ${JSON.stringify(backoffCheck)}`
    );

    const remBeforeCutoff = computeNextRetryAt("reminder", 1, new Date("2026-10-20T12:30:00Z")); // 16:00 Tehran -> 17:00 Tehran OK
    const remAfterCutoff = computeNextRetryAt("reminder", 1, new Date("2026-10-20T14:30:00Z")); // 18:00 Tehran -> 19:00 Tehran NULL
    assert(
      remBeforeCutoff !== null && remAfterCutoff === null,
      "T30b (Appendix F.2): Reminder retries run hourly until 18:00 Asia/Tehran and stop afterwards"
    );

    // Simulate Bale outage during a professor-rejected outcome
    BaleGateway.setTestStub(() => ({ ok: false, error: "Bale API 503 Service Unavailable" }));

    const rejectedSession = await prisma.defenseSession.create({
      data: {
        student_id: studentFaRow!.student_id,
        slot_id: testSlot.slot_id,
        scheduled_date: tomorrowDate,
        start_time: "10:00",
        end_time: "12:00",
        status: "rejected",
        seats: {
          create: [{ professor_id: profLinkedRow!.professor_id, status: "rejected", responded_at: new Date() }],
        },
      },
    });
    createdSessionIds.push(rejectedSession.session_id);

    const outageOutcome = await NotificationService.queueOutcome(rejectedSession.session_id);
    const failedRows = await prisma.notification.findMany({
      where: { session_id: rejectedSession.session_id, status: "failed" },
    });

    assert(
      outageOutcome.failed === 2 &&
        failedRows.length === 2 &&
        failedRows.every(
          (r) =>
            r.failure_reason === "Bale API 503 Service Unavailable" &&
            r.retry_count === 1 &&
            r.next_retry_at !== null
        ),
      "T30c (NFR-12): Bale outage records failed status, reason, retry_count=1, and next_retry_at without throwing"
    );

    // Restore Bale gateway and verify retry succeeds
    sentMessages.length = 0;
    BaleGateway.setTestStub((chatId, text) => {
      sentMessages.push({ chatId, text });
      return { ok: true, messageId: `recovered_${sentMessages.length}` };
    });

    // Move next_retry_at to past to simulate 1 minute elapsed
    await prisma.notification.updateMany({
      where: { session_id: rejectedSession.session_id },
      data: { next_retry_at: subMinutes(new Date(), 1) },
    });

    const retrySummary = await NotificationService.processPendingAndRetries({ forceImmediate: false });
    const recoveredRows = await prisma.notification.findMany({
      where: { session_id: rejectedSession.session_id },
    });

    assert(
      retrySummary.sent >= 2 &&
        recoveredRows.every((r) => r.status === "sent" && r.sent_at !== null && r.next_retry_at === null),
      "T30d: Scheduled retry delivers failed notifications once Bale recovers and marks status=sent"
    );

    // =========================================================================
    // Unlink test (Appendix D.8)
    // =========================================================================
    await AuthService.unlinkBale(studentFaAcc.userId!);
    const unlinkedUser = await prisma.user.findUnique({ where: { user_id: studentFaAcc.userId! } });
    assert(
      unlinkedUser?.bale_chat_id === null && unlinkedUser?.bale_linked_at === null,
      "Appendix D.8: Unlinking clears bale_chat_id and bale_linked_at"
    );

    console.log(`\n=============================`);
    console.log(`Bale Bot Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`=============================\n`);

    if (failed > 0) process.exit(1);
  } finally {
    BaleGateway.setTestStub(null);
    // Clean up all isolated test entities in safe FK order
    if (createdSessionIds.length > 0) {
      await prisma.notification.deleteMany({ where: { session_id: { in: createdSessionIds } } });
      await prisma.defenseParticipant.deleteMany({ where: { session_id: { in: createdSessionIds } } });
      await prisma.defenseSession.deleteMany({ where: { session_id: { in: createdSessionIds } } });
    }
    if (createdSlotIds.length > 0) {
      await prisma.availabilitySlot.deleteMany({ where: { slot_id: { in: createdSlotIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  }
}

runBaleTests().catch((err) => {
  console.error("Fatal error in Bale test suite:", err);
  process.exit(1);
});
