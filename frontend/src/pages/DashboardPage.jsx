import { useAuth } from "../context/AuthContext";

const statCards = [
  { label: "Total leads", value: "1,248", trend: "+12.4%" },
  { label: "Qualified leads", value: "318", trend: "+8.1%" },
  { label: "Open quotations", value: "87", trend: "+3.2%" },
  { label: "Accepted", value: "41", trend: "+5.9%" },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">
              Sales HQ
            </p>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">
                {user?.name || "Administrator"}
              </p>
              <p className="text-xs text-slate-500">{user?.role || "admin"}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="card">
              <p className="text-sm text-slate-500">{card.label}</p>
              <div className="mt-3 flex items-end justify-between">
                <h2 className="text-3xl font-bold text-slate-900">
                  {card.value}
                </h2>
                <span className="text-sm font-medium text-emerald-600">
                  {card.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                Pipeline overview
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                This month
              </span>
            </div>
            <div className="flex h-56 items-end gap-3 rounded-xl bg-slate-50 p-4">
              {[42, 56, 48, 68, 90, 84, 118].map((value, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-xl bg-brand-100"
                  style={{ height: `${value}%` }}
                />
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900">
              Priority actions
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="rounded-lg bg-amber-50 p-3">
                6 quotations awaiting manager approval
              </li>
              <li className="rounded-lg bg-emerald-50 p-3">
                4 follow-ups due today
              </li>
              <li className="rounded-lg bg-sky-50 p-3">
                2 expired quotations require attention
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
