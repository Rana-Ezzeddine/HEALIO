export default function DoctorPatientTabsRail({ tabs, currentPatientId, onOpenPatient }) {
  if (!tabs.length) return null;

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Open patients</p>
      <div className="mt-4 space-y-2">
        {tabs.map((tab) => {
          const active = tab.id === currentPatientId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onOpenPatient(tab.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${active ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"}`}
            >
              <span className="block truncate">{tab.name}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
