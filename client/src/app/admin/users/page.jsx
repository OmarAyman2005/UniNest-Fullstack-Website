"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { FaUndo } from "react-icons/fa";

const ROLES = [
  "student",
  "staff",
  "ta",
  "professor",
  "vendor",
  "admin",
  "event_office",
];
const ROLE_FILTERS = ["all", ...ROLES];
const APPROVAL_FILTERS = ["all", "pending", "approved", "rejected"];
const ACCOUNT_STATUS_FILTERS = ["all", "active", "blocked"];

const labelize = (s = "") =>
  String(s)
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

const s = (v) => String(v ?? "").toLowerCase();

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(null);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");

  const [create, setCreate] = useState({ fullName: "", email: "", password: "", role: "admin" });
  const [createOpen, setCreateOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ text: "", tone: "info" });

  const [pagePending, setPagePending] = useState(1);
  const [perPending, setPerPending] = useState(10);

  const [pageVerified, setPageVerified] = useState(1);
  const [perVerified, setPerVerified] = useState(10);

  const [pageUnverified, setPageUnverified] = useState(1);
  const [perUnverified, setPerUnverified] = useState(10);

  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const toggleSort = (key) => {
    setPagePending(1);
    setPageVerified(1);
    setPageUnverified(1);

    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const caret = (key) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  // ------- data load -------
  const buildQuery = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (approvalFilter !== "all") params.set("approval", approvalFilter);
    if (accountFilter !== "all") params.set("status", accountFilter);
    params.set("page", "1");
    params.set("limit", "1000");
    return params.toString();
  };

  const load = async () => {
    setLoading(true);
    setBanner({ text: "", tone: "info" });
    try {
      const qs = buildQuery();
      const data = await api(`/admin/users${qs ? `?${qs}` : ""}`);
      setUsers(data.items || []);
    } catch (e) {
      setBanner({ text: e.message || "Failed to load users", tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api("/auth/me");
        let payload = res;
        if (res && typeof res.json === "function") payload = await res.json();
        const me = payload?.data ?? payload?.user ?? payload;
        if (!mounted) return;
        if (me?.role !== "admin") {
          setHasAccess(false);
          router.replace("/404");
          return;
        }
        setHasAccess(true);
      } catch (err) {
        setHasAccess(false);
        router.replace("/404");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (hasAccess) load();
  }, [hasAccess]);

  useEffect(() => {
    setPagePending(1);
    setPageVerified(1);
    setPageUnverified(1);

    const t = setTimeout(() => {
      load();
    }, 350);
    return () => clearTimeout(t);
  }, [q, roleFilter, approvalFilter, accountFilter]);

  const isVerified = (u) =>
    typeof u.isEmailVerified === "boolean" ? u.isEmailVerified : u.isVerified;

  const sortedUsers = useMemo(() => {
    const arr = [...(Array.isArray(users) ? users : [])];
    if (!sortKey) return arr;

    const cmp = (a, b) => {
      let av, bv;
      if (sortKey === "name") {
        av = s(a.fullName);
        bv = s(b.fullName);
      } else if (sortKey === "email") {
        av = s(a.email);
        bv = s(b.email);
      } else if (sortKey === "role") {
        av = s(labelize(a.role));
        bv = s(labelize(b.role));
      } else {
        return 0;
      }
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    };

    arr.sort((a, b) => (sortDir === "asc" ? cmp(a, b) : cmp(b, a)));
    return arr;
  }, [users, sortKey, sortDir]);

  const { pendingList, verifiedList, unverifiedList } = useMemo(() => {
    const list = sortedUsers;
    const pending = list.filter((u) => String(u.approvalStatus ?? "").toLowerCase() === "pending");
    const nonPending = list.filter((u) => String(u.approvalStatus ?? "").toLowerCase() !== "pending");
    const verified = nonPending.filter((u) => isVerified(u));
    const unverified = nonPending.filter((u) => !isVerified(u));
    return { pendingList: pending, verifiedList: verified, unverifiedList: unverified };
  }, [sortedUsers]);

  if (hasAccess === null) return <main className="p-8">Checking permissions...</main>;
  if (hasAccess === false) return null;

  const changeRole = async (userId, role) => {
    try {
      await api(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: { role },
      });
      await load();
      setBanner({ text: "Role updated", tone: "success" });
    } catch (e) {
      setBanner({ text: e.message || "Failed to update role", tone: "error" });
    }
  };

  const changeAccountStatus = async (userId, status) => {
    try {
      await api(`/admin/users/${userId}/status`, {
        method: "PATCH",
        body: { status },
      });
      await load();
      setBanner({ text: "Account status updated", tone: "success" });
    } catch (e) {
      setBanner({
        text: e.message || "Failed to update account status",
        tone: "error",
      });
    }
  };

  const remove = async (userId) => {
    try {
      await api(`/admin/users/${userId}`, { method: "DELETE" });
      await load();
      setBanner({ text: "User deleted", tone: "success" });
    } catch (e) {
      setBanner({ text: e.message || "Failed to delete user", tone: "error" });
    }
  };

  const approve = async (userId) => {
    try {
      await api(`/admin/users/${userId}/approve`, { method: "PATCH" });
      await load();
      setBanner({
        text: "User approved. Verification email sent (if needed).",
        tone: "success",
      });
    } catch (e) {
      setBanner({ text: e.message || "Failed to approve user", tone: "error" });
    }
  };

  const reject = async (userId) => {
    try {
      await api(`/admin/users/${userId}/reject`, { method: "PATCH" });
      await load();
      setBanner({ text: "User rejected", tone: "success" });
    } catch (e) {
      setBanner({ text: e.message || "Failed to reject user", tone: "error" });
    }
  };

  const resendVerification = async (userId) => {
    try {
      await api(`/admin/users/${userId}/resend-verification`, {
        method: "POST",
      });
      setBanner({ text: "Verification email resent", tone: "success" });
    } catch (e) {
      setBanner({ text: e.message || "Failed to resend email", tone: "error" });
    }
  };

  const createPriv = async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/users`, { method: "POST", body: create });
      setCreate({ fullName: "", email: "", password: "", role: "admin" });
      await load();
      setBanner({ text: "Privileged user created", tone: "success" });
    } catch (e) {
      setBanner({ text: e.message || "Failed to create user", tone: "error" });
    }
  };

  const renderRow = (u) => {
    const status = String(u.approvalStatus ?? "").toLowerCase();
    const approved = status === "approved";
    const pending = status === "pending";
    const rejected = status === "rejected";
    const verified = isVerified(u);

    return (
      <tr key={u._id} className="border-t border-root">
        <td className="p-2 text-root-primary">{u.fullName}</td>
        <td className="p-2 text-root-primary">{u.email}</td>
        <td className="p-2 text-center">
          <select
            className="rounded input-surface px-2 py-1"
            value={u.role}
            onChange={(e) => changeRole(u._id, e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {labelize(r)}
              </option>
            ))}
          </select>
        </td>
        <td className="p-2 font-mono text-center">
          {u.role === "student"
            ? u.studentId || "—"
            : ["staff", "ta", "professor"].includes(u.role)
            ? u.staffId || "—"
            : "—"}
        </td>
        <td className="p-2">
          {pending && (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-yellow-600/40">
              Pending
            </span>
          )}
          {approved && (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-600/40">
              Approved
            </span>
          )}
          {rejected && (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-600/40">
              Rejected
            </span>
          )}
          {!u.approvalStatus && (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-black/30">
              n/a
            </span>
          )}
        </td>
        <td className="p-2 text-center">{verified ? "✅" : "⏳"}</td>
        <td className="p-2">
          <select
            className={`rounded px-2 py-1 ${u.status === "blocked" ? "bg-error text-root-primary" : "input-surface"}`}
            value={u.status || "active"}
            onChange={(e) => changeAccountStatus(u._id, e.target.value)}
          >
            {["active", "blocked"].map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
        </td>
        <td className="p-2">
          <div className="flex flex-wrap gap-2">
            {pending && (
              <>
                <button
                  className="px-3 py-1 rounded bg-primary text-root-primary"
                  onClick={() => approve(u._id)}
                >
                  Approve
                </button>
                <button
                  className="px-3 py-1 rounded input-surface"
                  onClick={() => reject(u._id)}
                >
                  Reject
                </button>
              </>
            )}

            {!pending && !verified && (
              <button
                className="px-3 py-1 rounded input-surface"
                onClick={() => resendVerification(u._id)}
              >
                Resend Email
              </button>
            )}

            <button
              className="px-3 py-1 rounded input-surface"
              onClick={() => remove(u._id)}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const Section = ({
    title,
    badge,
    list,
    page,
    setPage,
    per,
    setPer,
  }) => {
    const pages = Math.max(1, Math.ceil(list.length / per));
    const start = (page - 1) * per;
    // local sort state so sorting affects only this section
    const [localSortKey, setLocalSortKey] = useState(null);
    const [localSortDir, setLocalSortDir] = useState("asc");

    const toggleLocalSort = (key) => {
      setPage(1);
      if (localSortKey === key) {
        setLocalSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setLocalSortKey(key);
        setLocalSortDir("asc");
      }
    };

    const caretForLocal = (key) =>
      localSortKey === key ? (localSortDir === "asc" ? " ▲" : " ▼") : "";

    const sorted = useMemo(() => {
      const arr = [...(Array.isArray(list) ? list : [])];
      if (!localSortKey) return arr;
      const cmp = (a, b) => {
        let av = "", bv = "";
        if (localSortKey === "name") {
          av = s(a.fullName);
          bv = s(b.fullName);
        } else if (localSortKey === "email") {
          av = s(a.email);
          bv = s(b.email);
        } else if (localSortKey === "role") {
          av = s(labelize(a.role));
          bv = s(labelize(b.role));
        }
        if (av < bv) return -1;
        if (av > bv) return 1;
        return 0;
      };
      arr.sort((a, b) => (localSortDir === "asc" ? cmp(a, b) : cmp(b, a)));
      return arr;
    }, [list, localSortKey, localSortDir]);

    const slice = sorted.slice(start, start + per);

    useEffect(() => {
      if (page > pages) setPage(1);
    }, [pages]);

    const SortBtn = ({ k, children, align = "left" }) => (
      <button
        type="button"
        onClick={() => toggleLocalSort(k)}
        className={`w-full text-${align} p-2 hover:opacity-80`}
        title={`Sort by ${children}`}
      >
        {children}
        {caretForLocal(k)}
      </button>
    );

    return (
      <section className="p-4 rounded-2xl bg-surface text-root-primary">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold">{title}</h2>
          <span className="text-xs px-2 py-0.5 rounded input-surface text-root-primary">
            {badge}
          </span>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm text-root-primary">
            <thead className="text-root-secondary opacity-80">
              <tr>
                <th className="text-left">
                  <SortBtn k="name">Name</SortBtn>
                </th>
                <th className="text-left">
                  <SortBtn k="email">Email</SortBtn>
                </th>
                <th className="p-2 text-center">
                  <SortBtn k="role" align="left">
                    Role
                  </SortBtn>
                </th>
                <th className="p-2 text-center">ID</th>
                <th className="p-2">Approval</th>
                <th className="p-2">Verified</th>
                <th className="p-2">Account</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>{slice.map(renderRow)}</tbody>
          </table>
        </div>

        {/* pagination footer */}
        <div className="mt-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="opacity-80 text-sm">Records per page:</span>
            <select
              className="px-2 py-1 rounded input-surface"
              value={per}
              onChange={(e) => {
                setPer(Number(e.target.value));
                setPage(1);
              }}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded bg-surface text-root-primary disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              ← Prev
            </button>
            <span className="text-sm">
              Page{" "}
              <input
                type="number"
                min={1}
                max={pages}
                value={page}
                onChange={(e) => {
                  const v = Math.min(
                    Math.max(1, Number(e.target.value || 1)),
                    pages
                  );
                  setPage(v);
                }}
                className="w-14 text-center mx-1 px-2 py-1 rounded input-surface"
              />{" "}
              of {pages}
            </span>
            <button
              className="px-3 py-1 rounded bg-surface text-root-primary disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
            >
              Next →
            </button>
          </div>
        </div>
      </section>
    );
  };

  return (
    <main className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl text-white font-semibold">Users</h1>

        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-root-primary hover:opacity-90 transition"
        >
          <FaUndo className="text-lg" /> Home
        </Link>
      </div>

      {/* CREATE (collapsed, themed) */}
      <section className="rounded-2xl bg-surface text-root-primary">
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3"
        >
          <span className="font-semibold">Create Admin / Events Office</span>
          <span
            className="inline-grid place-items-center w-7 h-7 rounded-full bg-highlight"
            aria-hidden
            title={createOpen ? "Collapse" : "Expand"}
          >
            {createOpen ? "−" : "+"}
          </span>
        </button>

        {createOpen && (
          <form onSubmit={createPriv} className="px-5 pb-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                className="px-3 py-2 rounded input-surface"
                placeholder="Full name"
                value={create.fullName}
                onChange={(e) =>
                  setCreate({ ...create, fullName: e.target.value })
                }
                required
              />
              <input
                className="px-3 py-2 rounded input-surface"
                placeholder="Email"
                type="email"
                value={create.email}
                onChange={(e) =>
                  setCreate({ ...create, email: e.target.value })
                }
                required
              />
              <input
                className="px-3 py-2 rounded input-surface"
                placeholder="Password"
                type="password"
                value={create.password}
                onChange={(e) =>
                  setCreate({ ...create, password: e.target.value })
                }
                required
                minLength={6}
              />
              <select
                className="px-3 py-2 rounded input-surface"
                value={create.role}
                onChange={(e) => setCreate({ ...create, role: e.target.value })}
              >
                <option value="admin">Admin</option>
                <option value="event_office">Event Office</option>
              </select>
            </div>
            <div className="pt-1">
              <button className="px-4 py-2 rounded-2xl bg-primary text-root-primary">
                Create
              </button>
            </div>
          </form>
        )}
      </section>

      {/* FILTERS (auto-apply, themed) */}
      <div className="p-4 rounded-2xl bg-surface text-root-secondary">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Search</label>
            <input
              className="px-3 py-2 rounded input-surface"
              placeholder="name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Role</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              {ROLE_FILTERS.map((r) => (
                <option key={r} value={r}>
                  {labelize(r)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Approval</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
            >
              {APPROVAL_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase opacity-80">Account</label>
            <select
              className="px-3 py-2 rounded input-surface"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              {ACCOUNT_STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Banner text={banner.text} tone={banner.tone} />

      {/* SECTION 1: pending approvals */}
      <Section
        title="Pending approvals"
        badge={pendingList.length}
        list={pendingList}
        page={pagePending}
        setPage={setPagePending}
        per={perPending}
        setPer={setPerPending}
        onSort={toggleSort}
        caretFor={caret}
      />

      {/* SECTION 2: approved/other but NOT verified */}
      <Section
        title="Not verified"
        badge={unverifiedList.length}
        list={unverifiedList}
        page={pageUnverified}
        setPage={setPageUnverified}
        per={perUnverified}
        setPer={setPerUnverified}
        onSort={toggleSort}
        caretFor={caret}
      />

      {/* SECTION 3: approved/other & verified */}
      <Section
        title="Verified users"
        badge={verifiedList.length}
        list={verifiedList}
        page={pageVerified}
        setPage={setPageVerified}
        per={perVerified}
        setPer={setPerVerified}
        onSort={toggleSort}
        caretFor={caret}
      />
    </main>
  );
}

function Banner({ text, tone }) {
  if (!text) return null;
  const toneClass =
    tone === "error"
      ? "bg-red-600/25 text-red-200 border-red-400/40"
      : tone === "success"
      ? "bg-green-600/25 text-green-200 border-green-400/40"
      : "bg-black/30 text-secondary border-white/10";
  return (
    <div className={`mb-3 rounded-xl px-3 py-2 text-sm border ${toneClass}`}>
      {text}
    </div>
  );
}
