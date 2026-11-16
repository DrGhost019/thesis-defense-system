"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { getTranslations } from "@/lib/translations";
import {
  UserCog,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

export function AccountsView() {
  const { lang } = useAuth();
  const t = getTranslations(lang);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New account form state
  const [formRole, setFormRole] = useState<"student" | "professor" | "higher_education_staff" | "admin">("student");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formStudentNumber, setFormStudentNumber] = useState("");
  const [formDegreeLevel, setFormDegreeLevel] = useState<"master" | "phd">("master");
  const [formThesisTitle, setFormThesisTitle] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [formAcademicTitle, setFormAcademicTitle] = useState("");
  const [formOfficeLocation, setFormOfficeLocation] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter, page],
    queryFn: async () => {
      let url = `/api/v1/admin/users?page=${page}&pageSize=20`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (roleFilter) url += `&role=${roleFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to create user");
      return resData;
    },
    onSuccess: () => {
      setSuccessMessage(t.accounts.userCreatedSuccess);
      setErrorMessage(null);
      setIsCreateOpen(false);
      setFormUsername("");
      setFormPassword("");
      setFormFullName("");
      setFormEmail("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message);
      setSuccessMessage(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, is_active }: { userId: number; is_active: boolean }) => {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to update status");
      return { resData, is_active };
    },
    onSuccess: ({ is_active }) => {
      setSuccessMessage(
        is_active ? t.accounts.statusActiveSuccess : t.accounts.statusInactiveSuccess
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const payload: any = {
      username: formUsername,
      password: formPassword,
      full_name: formFullName,
      email: formEmail,
      role: formRole,
    };

    if (formRole === "student") {
      payload.student_number = formStudentNumber;
      payload.degree_level = formDegreeLevel;
      payload.thesis_title = formThesisTitle;
    } else if (formRole === "professor" || formRole === "higher_education_staff") {
      payload.department = formDepartment;
      payload.academic_title = formAcademicTitle;
      payload.office_location = formOfficeLocation;
    }

    createUserMutation.mutate(payload);
  };

  const users: any[] = data?.users || [];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCog className="w-5 h-5 text-blue-600" />
            <span>{t.accounts.title}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.accounts.desc}
          </p>
        </div>

        <button
          onClick={() => {
            setIsCreateOpen(!isCreateOpen);
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreateOpen ? t.slots.closeFormBtn : lang === "fa" ? "تعریف کاربر جدید" : "New User"}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Create User Form / Modal */}
      {isCreateOpen && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg space-y-4 animate-in fade-in"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            {lang === "fa" ? "ثبت مشخصات کاربر جدید" : "Create New User Account"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.accounts.roleCol}
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as any)}
                className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="student">{t.accounts.roleFilterStudent}</option>
                <option value="professor">{t.accounts.roleFilterProf}</option>
                <option value="higher_education_staff">
                  {lang === "fa" ? "کارشناس آموزش (Staff)" : "Academic Staff"}
                </option>
                <option value="admin">{t.accounts.roleFilterAdmin}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.accounts.fullName}
              </label>
              <input
                type="text"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                required
                placeholder="Dr. John Doe"
                className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.accounts.username}
              </label>
              <input
                type="text"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                required
                placeholder="j.doe"
                className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.auth.password}
              </label>
              <input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.profile.emailLabel}
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="user@uni.ac.ir"
                className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                dir="ltr"
              />
            </div>

            {formRole === "student" ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.student.studentNumber}
                  </label>
                  <input
                    type="text"
                    value={formStudentNumber}
                    onChange={(e) => setFormStudentNumber(e.target.value)}
                    required
                    placeholder="40123456"
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.student.degreeLevel}
                  </label>
                  <select
                    value={formDegreeLevel}
                    onChange={(e) => setFormDegreeLevel(e.target.value as any)}
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="master">{t.student.master}</option>
                    <option value="phd">{t.student.phd}</option>
                  </select>
                </div>
                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.student.thesisTitle}
                  </label>
                  <input
                    type="text"
                    value={formThesisTitle}
                    onChange={(e) => setFormThesisTitle(e.target.value)}
                    required
                    placeholder="Thesis title..."
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </>
            ) : formRole === "professor" || formRole === "higher_education_staff" ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "fa" ? "دانشکده / گروه" : "Department"}
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    required
                    placeholder="Computer Engineering"
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "fa" ? "مرتبه علمی" : "Academic Title"}
                  </label>
                  <input
                    type="text"
                    value={formAcademicTitle}
                    onChange={(e) => setFormAcademicTitle(e.target.value)}
                    required
                    placeholder="Associate Professor"
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === "fa" ? "دفتر / محل کار" : "Office"}
                  </label>
                  <input
                    type="text"
                    value={formOfficeLocation}
                    onChange={(e) => setFormOfficeLocation(e.target.value)}
                    placeholder="Room 302"
                    className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </>
            ) : null}
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
              type="submit"
              disabled={createUserMutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm"
            >
              {createUserMutation.isPending ? t.common.loading : t.common.save}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 rtl:right-3 ltr:right-auto ltr:left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t.accounts.searchUserPlaceholder}
            className="w-full rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="p-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <option value="">{t.accounts.roleFilterAll}</option>
          <option value="student">{t.accounts.roleFilterStudent}</option>
          <option value="professor">{t.accounts.roleFilterProf}</option>
          <option value="admin">{t.accounts.roleFilterAdmin}</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                <th className="p-3">{t.accounts.fullName}</th>
                <th className="p-3">{t.accounts.username}</th>
                <th className="p-3">{t.accounts.roleCol}</th>
                <th className="p-3">{t.accounts.baleCol}</th>
                <th className="p-3">{t.accounts.statusCol}</th>
                <th className="p-3 text-center">{t.accounts.actionsCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <span>{t.common.loading}</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    {lang === "fa" ? "هیچ کاربری یافت نشد." : "No users found."}
                  </td>
                </tr>
              ) : (
                users.map((u: any) => (
                  <tr key={u.userId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                    <td className="p-3 font-medium text-slate-900 dark:text-white">
                      <div>{u.fullName}</div>
                      {u.student && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                          {t.student.studentNumber} {u.student.student_number} ({u.student.degree_level})
                        </div>
                      )}
                      {u.professor && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {u.professor.academic_title} - {u.professor.department}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400" dir="ltr">
                      {u.username}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === "admin"
                            ? "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300"
                            : u.role === "student"
                            ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300"
                            : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                        }`}
                      >
                        {u.role === "admin"
                          ? t.navbar.admin
                          : u.role === "student"
                          ? t.navbar.student
                          : t.navbar.professor}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.baleLinked ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{t.accounts.baleLinked}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">
                          {t.accounts.baleNotLinked}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isActive
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                        }`}
                      >
                        {u.isActive ? t.accounts.activeBadge : t.accounts.deactivatedBadge}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            userId: u.userId,
                            is_active: !u.isActive,
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                          u.isActive
                            ? "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                            : "border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        }`}
                      >
                        {u.isActive
                          ? lang === "fa"
                            ? "غیرفعال‌سازی"
                            : "Deactivate"
                          : lang === "fa"
                          ? "فعال‌سازی"
                          : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
