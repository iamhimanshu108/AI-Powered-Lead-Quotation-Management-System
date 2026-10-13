import { useCallback, useEffect, useMemo, useState } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const navigation = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "leads", label: "Leads", icon: "◇" },
  { id: "team", label: "Team", icon: "♙", adminOnly: true },
  { id: "organization", label: "Organization", icon: "▦" },
];

const emptyLead = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  leadSource: "",
  interest: "",
  estimatedBudget: "",
  expectedClosingDate: "",
  assignedSalespersonId: "",
  address: "",
  requirementDescription: "",
  priority: "medium",
  status: "new",
  followUpNotes: "",
  nextFollowUpAt: "",
};

const emptyUser = { name: "", email: "", password: "", role: "sales_executive" };
const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

function errorMessage(error) {
  return error.response?.data?.message || "Something went wrong. Please try again.";
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block text-sm font-medium text-slate-700 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function Modal({ title, description, onClose, error, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="my-auto w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-xl px-3 py-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>
        {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
        {children}
      </div>
    </div>
  );
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    purple: "bg-violet-50 text-violet-700",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tones[tone]}`}>{children}</span>;
}

function statusTone(status) {
  if (status === "won" || status === "qualified") return "green";
  if (status === "proposal") return "purple";
  if (status === "contacted") return "blue";
  if (status === "lost") return "red";
  return "amber";
}

function LeadForm({ initialValue, users, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState(initialValue || emptyLead);
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      ...form,
      estimatedBudget: form.estimatedBudget === "" ? null : Number(form.estimatedBudget),
      expectedClosingDate: form.expectedClosingDate || null,
      assignedSalespersonId: form.assignedSalespersonId || null,
      nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : null,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name *"><input required name="companyName" value={form.companyName || ""} onChange={change} className={inputClass} placeholder="Acme Industries" /></Field>
        <Field label="Contact person"><input name="contactName" value={form.contactName || ""} onChange={change} className={inputClass} placeholder="Jordan Lee" /></Field>
        <Field label="Email"><input type="email" name="email" value={form.email || ""} onChange={change} className={inputClass} placeholder="jordan@company.com" /></Field>
        <Field label="Phone"><input name="phone" value={form.phone || ""} onChange={change} className={inputClass} placeholder="+1 555 0123" /></Field>
        <Field label="Lead source"><input name="leadSource" value={form.leadSource || ""} onChange={change} className={inputClass} placeholder="Website, referral…" /></Field>
        <Field label="Product / interest"><input name="interest" value={form.interest || ""} onChange={change} className={inputClass} placeholder="What are they interested in?" /></Field>
        <Field label="Address"><input name="address" value={form.address || ""} onChange={change} className={inputClass} placeholder="Business address" /></Field>
        <Field label="Requirements" className="sm:col-span-2"><textarea rows="3" name="requirementDescription" value={form.requirementDescription || ""} onChange={change} className={inputClass} placeholder="Describe the customer's requirements…" /></Field>
        <Field label="Follow-up notes" className="sm:col-span-2"><textarea rows="2" name="followUpNotes" value={form.followUpNotes || ""} onChange={change} className={inputClass} placeholder="Notes for the next conversation…" /></Field>
        <Field label="Estimated budget"><input type="number" min="0" step="0.01" name="estimatedBudget" value={form.estimatedBudget ?? ""} onChange={change} className={inputClass} placeholder="0.00" /></Field>
        <Field label="Expected close date"><input type="date" name="expectedClosingDate" value={form.expectedClosingDate?.slice(0, 10) || ""} onChange={change} className={inputClass} /></Field>
        <Field label="Status">
          <select name="status" value={form.status || "new"} onChange={change} className={inputClass}>
            {["new", "contacted", "qualified", "proposal", "won", "lost"].map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" value={form.priority || "medium"} onChange={change} className={inputClass}>
            {["low", "medium", "high"].map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Assign to">
          <select name="assignedSalespersonId" value={form.assignedSalespersonId || ""} onChange={change} className={inputClass}>
            <option value="">Unassigned</option>
            {users.filter((user) => user.is_active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </Field>
        <Field label="Next follow-up"><input type="datetime-local" name="nextFollowUpAt" value={form.nextFollowUpAt?.slice(0, 16) || ""} onChange={change} className={inputClass} /></Field>
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
        <button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">{saving ? "Saving…" : "Save lead"}</button>
      </div>
    </form>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activePage, setActivePage] = useState("overview");
  const [dashboard, setDashboard] = useState({});
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [activities, setActivities] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [activityText, setActivityText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState("");
  const [userForm, setUserForm] = useState(emptyUser);
  const [leadForm, setLeadForm] = useState(emptyLead);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const requests = [
        client.get("/api/dashboard"),
        client.get("/api/leads"),
        client.get("/api/organization"),
      ];
      requests.push(client.get("/api/users"));
      const [dashboardResponse, leadsResponse, organizationResponse, usersResponse] = await Promise.all(requests);
      setDashboard(dashboardResponse.data.stats || {});
      setLeads(leadsResponse.data.leads || []);
      setOrganization(organizationResponse.data.organization || null);
      setUsers(usersResponse?.data.users || []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  const filteredLeads = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return leads;
    return leads.filter((lead) => [lead.company_name, lead.contact_name, lead.email, lead.lead_number]
      .some((value) => value?.toLowerCase().includes(normalized)));
  }, [leads, search]);

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };

  async function saveOrganization(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await client.patch("/api/organization", organization);
      setOrganization(response.data.organization);
      flash("Organization settings saved.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function saveUser(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await client.post("/api/users", userForm);
      setModal("");
      setUserForm(emptyUser);
      await loadWorkspace();
      flash("Team member added.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function toggleUser(userRow) {
    setError("");
    try {
      await client.patch(`/api/users/${userRow.id}`, { isActive: !userRow.is_active });
      await loadWorkspace();
      flash(userRow.is_active ? "Team member deactivated." : "Team member reactivated.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function saveLead(payload) {
    setSaving(true);
    setError("");
    try {
      if (modal === "edit-lead") {
        const response = await client.patch(`/api/leads/${leadForm.id}`, payload);
        setSelectedLead(response.data.lead);
      } else {
        await client.post("/api/leads", payload);
      }
      setModal("");
      await loadWorkspace();
      flash(modal === "edit-lead" ? "Lead updated." : "Lead created.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function openLead(lead) {
    setSelectedLead(lead);
    setError("");
    try {
      const response = await client.get(`/api/leads/${lead.id}/activities`);
      setActivities(response.data.activities || []);
    } catch (requestError) {
      setError(errorMessage(requestError));
      setActivities([]);
    }
  }

  async function addActivity(event) {
    event.preventDefault();
    if (!selectedLead || !activityText.trim()) return;
    setSaving(true);
    setError("");
    try {
      await client.post(`/api/leads/${selectedLead.id}/activities`, {
        activityType: "note",
        details: activityText.trim(),
      });
      setActivityText("");
      await openLead(selectedLead);
      flash("Activity added.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  const visibleNavigation = navigation.filter((item) => !item.adminOnly || isAdmin);
  const metrics = [
    { label: "All leads", value: dashboard.total_leads ?? 0, detail: "Across your organization", icon: "◇", theme: "bg-indigo-50 text-indigo-600" },
    { label: "Qualified", value: dashboard.qualified_leads ?? 0, detail: "Ready for next steps", icon: "✦", theme: "bg-emerald-50 text-emerald-600" },
    { label: "Open pipeline", value: dashboard.open_leads ?? 0, detail: "Active opportunities", icon: "↗", theme: "bg-blue-50 text-blue-600" },
    { label: "Follow-ups today", value: dashboard.follow_ups_today ?? 0, detail: "Keep momentum going", icon: "◷", theme: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-800 lg:flex">
      <aside style={{ flexDirection: "column" }} className="flex shrink-0 flex-col bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen lg:w-64">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-500 text-lg font-bold shadow-lg shadow-indigo-950/50">L</div>
          <div><p className="font-bold tracking-tight">Leadspace</p><p className="text-xs text-slate-400">Sales workspace</p></div>
        </div>
        <div className="mx-4 mb-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
          <p className="mt-1 truncate text-sm font-semibold">{organization?.name || "Loading…"}</p>
        </div>
        <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {visibleNavigation.map((item) => (
            <button key={item.id} type="button" onClick={() => { setActivePage(item.id); setSelectedLead(null); setError(""); }}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition ${activePage === item.id ? "bg-indigo-500 text-white shadow-lg shadow-indigo-950/40" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"}`}>
              <span className="w-5 text-center text-lg">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 p-4 lg:block">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-400/20 text-xs font-bold text-indigo-200">{initials(user?.name)}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs capitalize text-slate-500">{user?.role?.replaceAll("_", " ")}</p></div>
            <button type="button" onClick={logout} aria-label="Log out" title="Log out" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">↪</button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">{organization?.name || "Workspace"}</p><h1 className="mt-0.5 text-xl font-bold text-slate-900">{visibleNavigation.find((item) => item.id === activePage)?.label || "Dashboard"}</h1></div>
            <div className="flex items-center gap-3">
              {activePage === "leads" && <div className="hidden sm:block"><input aria-label="Search leads" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads…" className="w-52 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" /></div>}
              {activePage === "leads" && <button type="button" onClick={() => { setLeadForm(emptyLead); setModal("new-lead"); }} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">＋ <span className="hidden sm:inline">New lead</span><span className="sm:hidden">Lead</span></button>}
              {activePage === "team" && isAdmin && <button type="button" onClick={() => { setUserForm(emptyUser); setError(""); setModal("new-user"); }} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">＋ Add member</button>}
              <button type="button" onClick={logout} aria-label="Log out" title="Log out" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 hover:bg-indigo-200 lg:hidden">{initials(user?.name)}</button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
          {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</div>}
          {error && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error">✕</button></div>}
          {loading ? <div className="grid min-h-64 place-items-center text-sm font-medium text-slate-500">Loading your workspace…</div> : (
            <>
              {activePage === "overview" && (
                <section>
                  <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                    <div><p className="text-sm font-medium text-slate-500">Here’s what’s happening with your pipeline.</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Good to see you, {user?.name?.split(" ")[0] || "there"} 👋</h2></div>
                    <button type="button" onClick={() => setActivePage("leads")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">View all leads <span aria-hidden="true">→</span></button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics.map((metric) => (
                      <div key={metric.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40">
                        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">{metric.label}</p><span className={`grid h-10 w-10 place-items-center rounded-xl text-lg ${metric.theme}`}>{metric.icon}</span></div>
                        <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{metric.value}</p><p className="mt-1 text-xs text-slate-400">{metric.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
                      <div className="mb-5 flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Recent leads</h3><p className="mt-1 text-sm text-slate-500">Latest opportunities in your pipeline</p></div><button type="button" onClick={() => setActivePage("leads")} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">See all</button></div>
                      {leads.length ? <div className="divide-y divide-slate-100">{leads.slice(0, 5).map((lead) => <button key={lead.id} onClick={() => { setActivePage("leads"); openLead(lead); }} className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600">{initials(lead.company_name)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{lead.company_name}</p><p className="text-xs text-slate-400">{lead.lead_number} · {lead.contact_name || "No contact"}</p></div><Badge tone={statusTone(lead.status)}>{lead.status}</Badge></button>)}</div> : <div className="rounded-xl bg-slate-50 px-4 py-8 text-center"><p className="text-sm font-semibold text-slate-700">Your pipeline is ready</p><p className="mt-1 text-sm text-slate-500">Add your first lead to start tracking opportunities.</p><button type="button" onClick={() => { setLeadForm(emptyLead); setModal("new-lead"); }} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Create a lead</button></div>}
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-lg shadow-indigo-200/70">
                      <div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-indigo-100">Workspace snapshot</p><h3 className="mt-2 text-2xl font-bold">{dashboard.active_users ?? 0} active teammates</h3><p className="mt-2 max-w-xs text-sm leading-6 text-indigo-100">Keep your team and organization information up to date as your sales operation grows.</p></div><span className="text-3xl">✦</span></div>
                      <div className="mt-7 flex flex-wrap gap-3">
                        {isAdmin && <button type="button" onClick={() => setActivePage("team")} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Manage team</button>}
                        <button type="button" onClick={() => setActivePage("organization")} className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Organization settings</button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activePage === "leads" && (
                <section>
                  <div className="mb-5 sm:hidden"><input aria-label="Search leads" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads…" className={inputClass} /></div>
                  <div className="mb-5 flex items-center justify-between"><p className="text-sm text-slate-500">{filteredLeads.length} {filteredLeads.length === 1 ? "lead" : "leads"} in your pipeline</p></div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
                    {filteredLeads.length ? <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4 font-semibold">Company</th><th className="px-5 py-4 font-semibold">Contact</th><th className="px-5 py-4 font-semibold">Status</th><th className="px-5 py-4 font-semibold">Priority</th><th className="px-5 py-4 font-semibold">Owner</th><th className="px-5 py-4 font-semibold">Updated</th><th className="px-5 py-4" /></tr></thead><tbody className="divide-y divide-slate-100">{filteredLeads.map((lead) => <tr key={lead.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><button onClick={() => openLead(lead)} className="text-left"><p className="font-semibold text-slate-800 hover:text-indigo-600">{lead.company_name}</p><p className="mt-0.5 text-xs text-slate-400">{lead.lead_number}</p></button></td><td className="px-5 py-4"><p className="text-sm text-slate-700">{lead.contact_name || "—"}</p><p className="text-xs text-slate-400">{lead.email || "No email"}</p></td><td className="px-5 py-4"><Badge tone={statusTone(lead.status)}>{lead.status}</Badge></td><td className="px-5 py-4"><Badge tone={lead.priority === "high" ? "red" : lead.priority === "low" ? "slate" : "blue"}>{lead.priority}</Badge></td><td className="px-5 py-4 text-sm text-slate-600">{lead.assigned_salesperson_name || "Unassigned"}</td><td className="px-5 py-4 text-sm text-slate-500">{formatDate(lead.updated_at)}</td>                                        <td className="px-5 py-4"><button type="button" onClick={() => { setLeadForm({ ...lead, companyName: lead.company_name, contactName: lead.contact_name || "", leadSource: lead.lead_source || "", requirementDescription: lead.requirement_description || "", estimatedBudget: lead.estimated_budget ?? "", expectedClosingDate: lead.expected_closing_date || "", assignedSalespersonId: lead.assigned_salesperson_id || "", followUpNotes: lead.follow_up_notes || "", nextFollowUpAt: lead.next_follow_up_at || "" }); setError(""); setModal("edit-lead"); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">Edit</button></td></tr>)}</tbody></table></div> : <div className="px-6 py-16 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-xl text-indigo-500">◇</div><h3 className="mt-4 font-bold text-slate-900">{search ? "No matching leads" : "No leads yet"}</h3><p className="mt-1 text-sm text-slate-500">{search ? "Try another company, contact, or email." : "Create a lead to begin building your pipeline."}</p>{!search && <button type="button" onClick={() => { setLeadForm(emptyLead); setError(""); setModal("new-lead"); }} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">＋ New lead</button>}</div>}
                  </div>
                </section>
              )}

              {activePage === "team" && isAdmin && (
                <section>
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Your team</h2><p className="mt-1 text-sm text-slate-500">Manage account access for your organization.</p></div><Badge tone="purple">{users.length} members</Badge></div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
                    {users.length ? <div className="divide-y divide-slate-100">{users.map((member) => <div key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">{initials(member.name)}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-800">{member.name}{member.id === user?.id && <span className="ml-2 text-xs font-medium text-slate-400">You</span>}</p><p className="truncate text-sm text-slate-500">{member.email}</p></div><Badge tone={member.role === "admin" ? "purple" : "slate"}>{member.role.replaceAll("_", " ")}</Badge><Badge tone={member.is_active ? "green" : "red"}>{member.is_active ? "Active" : "Inactive"}</Badge>{member.id !== user?.id && <button type="button" onClick={() => toggleUser(member)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">{member.is_active ? "Deactivate" : "Reactivate"}</button>}</div>)}</div> : <div className="px-6 py-16 text-center text-sm text-slate-500">No team members found.</div>}
                  </div>
                  <p className="mt-3 text-xs text-slate-400">New members receive the password you set and can sign in immediately. Share it securely.</p>
                </section>
              )}

              {activePage === "organization" && organization && (
                <section className="max-w-3xl">
                  <div className="mb-6"><h2 className="text-lg font-bold text-slate-900">Organization details</h2><p className="mt-1 text-sm text-slate-500">Your workspace identity and account information.</p></div>
                  <form onSubmit={saveOrganization} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-7">
                    <div className="mb-6 flex items-center gap-4 border-b border-slate-100 pb-6"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-2xl font-bold text-indigo-600">{initials(organization.name)}</div><div><p className="font-bold text-slate-900">{organization.name}</p><p className="mt-1 text-sm text-slate-500">Created {formatDate(organization.created_at)}</p></div></div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Organization name"><input required disabled={!isAdmin} value={organization.name} onChange={(event) => setOrganization({ ...organization, name: event.target.value })} className={`${inputClass} disabled:bg-slate-50`} /></Field>
                      <Field label="Workspace slug"><input required disabled={!isAdmin} value={organization.slug} onChange={(event) => setOrganization({ ...organization, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className={`${inputClass} disabled:bg-slate-50`} /><span className="mt-1.5 block text-xs font-normal text-slate-400">Lowercase letters, numbers, and hyphens only.</span></Field>
                    </div>
                    {isAdmin ? <div className="mt-7 flex justify-end"><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button></div> : <p className="mt-5 text-xs text-slate-400">Only organization admins can edit these details.</p>}
                  </form>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {modal === "new-lead" && <Modal title="Create a lead" description="Add a new opportunity to your sales pipeline." error={error} onClose={() => setModal("")}><LeadForm users={users} onSubmit={saveLead} onCancel={() => setModal("")} saving={saving} /></Modal>}
      {modal === "edit-lead" && <Modal title="Edit lead" description="Update opportunity details and pipeline status." error={error} onClose={() => setModal("")}><LeadForm initialValue={leadForm} users={users} onSubmit={saveLead} onCancel={() => setModal("")} saving={saving} /></Modal>}
      {modal === "new-user" && <Modal title="Add team member" description="Create a sign-in for someone on your organization." error={error} onClose={() => setModal("")}>
        <form onSubmit={saveUser} className="space-y-4">
          <Field label="Full name *"><input required maxLength={255} value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} className={inputClass} placeholder="Jordan Lee" /></Field>
          <Field label="Work email *"><input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} className={inputClass} placeholder="jordan@company.com" /></Field>
          <Field label="Temporary password *"><input required minLength={10} type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} className={inputClass} placeholder="At least 10 characters" /></Field>
          <Field label="Role"><select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })} className={inputClass}><option value="sales_executive">Sales executive</option><option value="sales_manager">Sales manager</option><option value="admin">Admin</option></select></Field>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={() => setModal("")} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Creating…" : "Create member"}</button></div>
        </form>
      </Modal>}
      {selectedLead && activePage === "leads" && !modal && <Modal title={selectedLead.company_name} description={`${selectedLead.lead_number} · ${selectedLead.contact_name || "No contact"} · ${selectedLead.email || "No email"}`} error={error} onClose={() => { setSelectedLead(null); setActivities([]); }}>
        <div className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3"><div><p className="text-xs font-semibold uppercase text-slate-400">Status</p><Badge tone={statusTone(selectedLead.status)}>{selectedLead.status}</Badge></div><div><p className="text-xs font-semibold uppercase text-slate-400">Priority</p><p className="mt-1 text-sm font-semibold capitalize">{selectedLead.priority}</p></div><div><p className="text-xs font-semibold uppercase text-slate-400">Budget</p><p className="mt-1 text-sm font-semibold">{selectedLead.estimated_budget ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(selectedLead.estimated_budget) : "—"}</p></div></div>
        <div className="max-h-64 space-y-3 overflow-y-auto">
          <h3 className="text-sm font-bold text-slate-800">Activity history</h3>
          {activities.length ? activities.map((activity) => <div key={activity.id} className="rounded-xl border border-slate-100 p-3"><div className="flex justify-between gap-3"><p className="text-sm font-semibold capitalize text-slate-700">{activity.activity_type}</p><time className="text-xs text-slate-400">{formatDate(activity.created_at)}</time></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{activity.details}</p><p className="mt-2 text-xs text-slate-400">{activity.user_name || "Team member"}</p></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No activity recorded yet.</p>}
        </div>
        <form onSubmit={addActivity} className="mt-5 border-t border-slate-100 pt-4"><Field label="Add a note"><textarea rows="3" value={activityText} onChange={(event) => setActivityText(event.target.value)} className={inputClass} placeholder="Log a call, meeting, or update…" /></Field><div className="mt-3 flex justify-end"><button disabled={saving || !activityText.trim()} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "Adding…" : "Add activity"}</button></div></form>
      </Modal>}
    </div>
  );
}
