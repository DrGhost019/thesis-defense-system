import prisma from "@/lib/prisma";

export class CommitteeService {
  public static async create(name: string, memberProfessorIds: number[], adminUserId: number) {
    const trimmedName = name.trim();

    // Check unique name case-insensitively
    const existing = await prisma.committee.findFirst({
      where: { name: { equals: trimmedName, mode: "insensitive" } },
    });
    if (existing) {
      return { success: false, status: 409, code: "CONFLICT", message: "نام هیئت داوران تکراری است" };
    }

    if (!memberProfessorIds || memberProfessorIds.length === 0) {
      return {
        success: false,
        status: 400,
        code: "VALIDATION_ERROR",
        message: "هیئت داوران باید حداقل یک عضو استاد داشته باشد",
      };
    }

    // Verify all professors exist and are active
    const professors = await prisma.professor.findMany({
      where: {
        professor_id: { in: memberProfessorIds },
        user: { is_active: true },
      },
    });

    if (professors.length !== memberProfessorIds.length) {
      return {
        success: false,
        status: 400,
        code: "VALIDATION_ERROR",
        message: "یک یا چند استاد انتخاب شده نامعتبر یا غیرفعال هستند",
      };
    }

    const committee = await prisma.$transaction(async (tx) => {
      const c = await tx.committee.create({
        data: {
          name: trimmedName,
          created_by_user_id: adminUserId,
          is_active: true,
        },
      });

      await tx.committeeMember.createMany({
        data: memberProfessorIds.map((pId) => ({
          committee_id: c.committee_id,
          professor_id: pId,
        })),
      });

      return c;
    });

    return { success: true, committee };
  }

  public static async listAll(onlyActive: boolean = true) {
    return prisma.committee.findMany({
      where: onlyActive ? { is_active: true } : undefined,
      include: {
        members: {
          include: {
            professor: {
              include: {
                user: {
                  select: { full_name: true, is_active: true, user_id: true },
                },
              },
            },
          },
        },
      },
      orderBy: { committee_id: "asc" },
    });
  }

  public static async listForProfessor(professorId: number) {
    return prisma.committee.findMany({
      where: {
        is_active: true,
        members: {
          some: { professor_id: professorId },
        },
      },
      include: {
        members: {
          include: {
            professor: {
              include: {
                user: { select: { full_name: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  public static async addMember(committeeId: number, professorId: number) {
    const existing = await prisma.committeeMember.findUnique({
      where: {
        committee_id_professor_id: {
          committee_id: committeeId,
          professor_id: professorId,
        },
      },
    });

    if (existing) {
      return { success: false, status: 409, code: "CONFLICT", message: "این استاد قبلاً عضو این هیئت داوران بوده است" };
    }

    const member = await prisma.committeeMember.create({
      data: {
        committee_id: committeeId,
        professor_id: professorId,
      },
    });

    return { success: true, member };
  }

  public static async removeMember(committeeId: number, professorId: number) {
    const committee = await prisma.committee.findUnique({
      where: { committee_id: committeeId },
      include: { members: true },
    });

    if (!committee) {
      return { success: false, status: 404, message: "هیئت داوران یافت نشد" };
    }

    if (committee.members.length <= 1) {
      return {
        success: false,
        status: 400,
        code: "RULE_VIOLATION",
        message: "هیئت داوران باید حداقل یک عضو داشته باشد",
      };
    }

    await prisma.committeeMember.deleteMany({
      where: {
        committee_id: committeeId,
        professor_id: professorId,
      },
    });

    return { success: true };
  }

  public static async update(committeeId: number, data: { name?: string; is_active?: boolean }) {
    if (data.name) {
      const existing = await prisma.committee.findFirst({
        where: {
          name: { equals: data.name.trim(), mode: "insensitive" },
          committee_id: { not: committeeId },
        },
      });
      if (existing) {
        return { success: false, status: 409, code: "CONFLICT", message: "نام هیئت داوران تکراری است" };
      }
    }

    const updated = await prisma.committee.update({
      where: { committee_id: committeeId },
      data: {
        name: data.name?.trim(),
        is_active: data.is_active,
      },
    });

    return { success: true, committee: updated };
  }

  public static async delete(committeeId: number) {
    const committee = await prisma.committee.findUnique({
      where: { committee_id: committeeId },
      include: {
        owned_slots: {
          include: {
            sessions: {
              where: { status: { in: ["requested", "assigned", "confirmed"] } },
            },
          },
        },
      },
    });

    if (!committee) {
      return { success: false, status: 404, message: "هیئت داوران یافت نشد" };
    }

    const hasActiveSessions = committee.owned_slots.some((s) => s.sessions.length > 0);
    if (hasActiveSessions) {
      return {
        success: false,
        status: 409,
        code: "CONFLICT",
        message: "امکان حذف هیئت داوران دارای جلسات دفاع فعال وجود ندارد",
      };
    }

    await prisma.$transaction(async (tx) => {
      // Nullify slot_id on any non-active sessions before deleting slots
      const slotIds = committee.owned_slots.map((s) => s.slot_id);
      if (slotIds.length > 0) {
        await tx.defenseSession.updateMany({
          where: { slot_id: { in: slotIds } },
          data: { slot_id: null },
        });
        await tx.availabilitySlot.deleteMany({
          where: { slot_id: { in: slotIds } },
        });
      }

      await tx.committeeMember.deleteMany({
        where: { committee_id: committeeId },
      });

      await tx.committee.delete({
        where: { committee_id: committeeId },
      });
    });

    return { success: true };
  }
}
