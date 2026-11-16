"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { getTranslations } from "@/lib/translations";
import {
  Users,
  Plus,
  UserPlus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  User,
} from "lucide-react";

export function CommitteesView() {
  const { lang } = useAuth();
  const t = getTranslations(lang);
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCommitteeName, setNewCommitteeName] = useState("");
  const [selectedProfIds, setSelectedProfIds] = useState<number[]>([]);
  const [addMemberCommId, setAddMemberCommId] = useState<number | null>(null);
  const [addMemberProfId, setAddMemberProfId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<"created" | "memberAdded" | "memberRemoved" | null>(null);

  // Fetch committees
  const { data: commData, isLoading: commLoading } = useQuery({
    queryKey: ["admin-committees"],
    queryFn: async () => {
      const res = await fetch("/api/v1/committees");
      if (!res.ok) throw new Error("Failed to load committees");
      return res.json();
    },
  });

  // Fetch all active professors for selection
  const { data: usersData } = useQuery({
    queryKey: ["admin-professors"],
    queryFn: async () => {
      const res = await fetch("/api/v1/admin/users?role=professor&pageSize=100");
      if (!res.ok) throw new Error("Failed to load professors");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, professor_ids }: { name: string; professor_ids: number[] }) => {
      const res = await fetch("/api/v1/committees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, professor_ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create committee");
      return data;
    },
    onSuccess: () => {
      setSuccessKey("created");
      setErrorMessage(null);
      setIsCreateOpen(false);
      setNewCommitteeName("");
      setSelectedProfIds([]);
      queryClient.invalidateQueries({ queryKey: ["admin-committees"] });
      queryClient.invalidateQueries({ queryKey: ["my-committees"] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message);
      setSuccessKey(null);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({
      committeeId,
      professorId,
    }: {
      committeeId: number;
      professorId: number;
    }) => {
      const res = await fetch(`/api/v1/committees/${committeeId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professor_id: professorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add member");
      return data;
    },
    onSuccess: () => {
      setSuccessKey("memberAdded");
      setErrorMessage(null);
      setAddMemberCommId(null);
      setAddMemberProfId("");
      queryClient.invalidateQueries({ queryKey: ["admin-committees"] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message);
      setSuccessKey(null);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({
      committeeId,
      professorId,
    }: {
      committeeId: number;
      professorId: number;
    }) => {
      const res = await fetch(`/api/v1/committees/${committeeId}/members/${professorId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to remove member");
      return data;
    },
    onSuccess: () => {
      setSuccessKey("memberRemoved");
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["admin-committees"] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message);
      setSuccessKey(null);
    },
  });

  const toggleDeactivateMutation = useMutation({
    mutationFn: async ({
      committeeId,
      is_active,
    }: {
      committeeId: number;
      is_active: boolean;
    }) => {
      const res = await fetch(`/api/v1/committees/${committeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update committee");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-committees"] });
    },
  });

  const committees: any[] = commData?.committees || [];
  const availableProfessors: any[] =
    usersData?.users?.filter((u: any) => u.professor && u.isActive) || [];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>{t.committees.title}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.committees.desc}
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(!isCreateOpen);
            setErrorMessage(null);
            setSuccessKey(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreateOpen ? t.slots.closeFormBtn : t.committees.newCommitteeBtn}</span>
        </button>
      </div>

      {successKey && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>
            {successKey === "created"
              ? t.committees.createdSuccess
              : successKey === "memberAdded"
              ? t.committees.memberAddedSuccess
              : successKey === "memberRemoved"
              ? t.committees.memberRemovedSuccess
              : t.common.success}
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Create Committee Modal / Form */}
      {isCreateOpen && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg space-y-4 animate-in fade-in">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            {t.committees.newCommitteeBtn}
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.committees.committeeName}
            </label>
            <input
              type="text"
              value={newCommitteeName}
              onChange={(e) => setNewCommitteeName(e.target.value)}
              placeholder={t.committees.committeeNamePlaceholder}
              className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {t.committees.selectMembers}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              {availableProfessors.map((p: any) => {
                const profId = p.professor.professor_id;
                const isSelected = selectedProfIds.includes(profId);
                return (
                  <label
                    key={profId}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer border transition ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 font-semibold text-blue-900 dark:text-blue-200"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProfIds([...selectedProfIds, profId]);
                        } else {
                          setSelectedProfIds(selectedProfIds.filter((id) => id !== profId));
                        }
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-800 dark:text-slate-200">{p.fullName}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!newCommitteeName.trim()) {
                  setErrorMessage(t.committees.nameRequiredError);
                  return;
                }
                if (selectedProfIds.length === 0) {
                  setErrorMessage(t.committees.memberRequiredError);
                  return;
                }
                createMutation.mutate({
                  name: newCommitteeName,
                  professor_ids: selectedProfIds,
                });
              }}
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm disabled:opacity-60"
            >
              {createMutation.isPending ? t.committees.creating : t.committees.createCommitteeBtn}
            </button>
          </div>
        </div>
      )}

      {/* Committees List */}
      <div className="space-y-4">
        {commLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <span>{t.common.loading}</span>
          </div>
        ) : committees.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-slate-400 text-xs border border-slate-200 dark:border-slate-800">
            {t.committees.noCommittees}
          </div>
        ) : (
          committees.map((comm: any) => (
            <div
              key={comm.committee_id}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-6 border shadow-sm space-y-4 transition ${
                comm.is_active
                  ? "border-slate-200 dark:border-slate-800"
                  : "border-slate-300 dark:border-slate-700 opacity-75 bg-slate-50 dark:bg-slate-800/40"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-xl">
                    <Users className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {comm.name}
                    </h3>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      #{comm.committee_id} - {t.committees.membersCount}{" "}
                      {comm.members?.length || 0}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      comm.is_active
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {comm.is_active ? t.committees.activeStatus : t.committees.inactiveStatus}
                  </span>

                  <button
                    onClick={() =>
                      toggleDeactivateMutation.mutate({
                        committeeId: comm.committee_id,
                        is_active: !comm.is_active,
                      })
                    }
                    className="text-xs px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition"
                  >
                    {comm.is_active
                      ? lang === "fa"
                        ? "غیرفعال‌سازی"
                        : "Deactivate"
                      : lang === "fa"
                      ? "فعال‌سازی"
                      : "Activate"}
                  </button>

                  <button
                    onClick={() => setAddMemberCommId(comm.committee_id)}
                    className="text-xs px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1 transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{t.committees.addMember}</span>
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                  {t.committees.membersList}
                </span>
                <div className="flex flex-wrap gap-2">
                  {comm.members?.map((m: any) => (
                    <div
                      key={m.committee_member_id}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200"
                    >
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>{m.professor.user.full_name}</span>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              lang === "fa"
                                ? `آیا از حذف ${m.professor.user.full_name} از این هیئت مطمئن هستید؟`
                                : `Are you sure you want to remove ${m.professor.user.full_name}?`
                            )
                          ) {
                            removeMemberMutation.mutate({
                              committeeId: comm.committee_id,
                              professorId: m.professor_id,
                            });
                          }
                        }}
                        className="text-slate-400 hover:text-red-600 transition"
                        title={t.committees.removeMember}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add member inline form */}
              {addMemberCommId === comm.committee_id && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-3 text-xs animate-in fade-in">
                  <select
                    value={addMemberProfId}
                    onChange={(e) => setAddMemberProfId(e.target.value)}
                    className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex-1 text-xs"
                  >
                    <option value="">-- {t.committees.selectMembers} --</option>
                    {availableProfessors
                      .filter(
                        (p: any) =>
                          !comm.members.some(
                            (m: any) => m.professor_id === p.professor.professor_id
                          )
                      )
                      .map((p: any) => (
                        <option key={p.professor.professor_id} value={p.professor.professor_id}>
                          {p.fullName} ({p.professor.department})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => {
                      if (!addMemberProfId) return;
                      addMemberMutation.mutate({
                        committeeId: comm.committee_id,
                        professorId: parseInt(addMemberProfId, 10),
                      });
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                  >
                    {t.committees.addMember}
                  </button>
                  <button
                    onClick={() => setAddMemberCommId(null)}
                    className="px-3 py-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
