import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  onDoctorPatientTabsUpdated,
  readDoctorPatientTabs,
  removeDoctorPatientTab,
} from "../../utils/doctorPatientTabs";

const DOCK_STICKY_KEY = "healio:doctor-patient-dock-sticky";

export default function DoctorPatientDock() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [tabs, setTabs] = useState(() => readDoctorPatientTabs());
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(DOCK_STICKY_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [stickyOpen, setStickyOpen] = useState(() => {
    try {
      return sessionStorage.getItem(DOCK_STICKY_KEY) === "true";
    } catch {
      return false;
    }
  });
  const dockRef = useRef(null);

  const currentPatientId =
    location.pathname.startsWith("/doctor-patients/") && location.pathname !== "/doctor-patients"
      ? location.pathname.split("/").filter(Boolean).pop()
      : searchParams.get("patientId") || "";

  useEffect(() => {
    setTabs(readDoctorPatientTabs());
    return onDoctorPatientTabsUpdated(() => {
      setTabs(readDoctorPatientTabs());
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    try {
      if (stickyOpen) {
        sessionStorage.setItem(DOCK_STICKY_KEY, "true");
      } else {
        sessionStorage.removeItem(DOCK_STICKY_KEY);
      }
    } catch {
      // ignore storage failures
    }
  }, [stickyOpen]);

  useEffect(() => {
    if (!stickyOpen) return undefined;

    function handleMouseMove(event) {
      const rect = dockRef.current?.getBoundingClientRect();
      if (!rect) return;

      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!inside) {
        setStickyOpen(false);
        setOpen(false);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [stickyOpen, location.pathname, location.search]);

  function openPatient(patientId) {
    setStickyOpen(true);
    setOpen(true);
    navigate(`/doctor-patients/${patientId}`);
  }

  function closePatient(event, patientId) {
    event.stopPropagation();
    const nextTabs = removeDoctorPatientTab(patientId);
    if (currentPatientId === patientId) {
      if (nextTabs.length > 0) {
        navigate(`/doctor-patients/${nextTabs[0].id}`);
      } else {
        navigate("/doctor-patients");
      }
    }
  }

  return (
    <aside
      ref={dockRef}
      className="fixed left-0 top-28 z-30 hidden xl:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!stickyOpen) {
          setOpen(false);
        }
      }}
    >
      <div className={`${open ? "translate-x-0" : "-translate-x-[calc(100%-2.75rem)]"} transition-transform duration-300 ease-out`}>
        <div className="flex items-stretch">
          <div className="flex w-11 items-center justify-center rounded-r-2xl border border-l-0 border-slate-200 bg-white/95 shadow-lg backdrop-blur">
            <div className="flex -rotate-90 items-center gap-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              Open Patients
            </div>
          </div>

          <div className="w-52 rounded-r-3xl border border-slate-200 border-l-0 bg-white/92 p-4 shadow-xl backdrop-blur">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Open patients</p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              setStickyOpen(true);
              setOpen(true);
              navigate("/doctor-patients");
            }}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              location.pathname === "/doctor-patients"
                ? "border-violet-300 bg-violet-50 text-violet-800"
                : "border-violet-200 bg-violet-100/80 text-violet-800 hover:border-violet-300 hover:bg-violet-50"
            }`}
          >
            All Patients
          </button>

          {tabs.map((tab) => {
            const active = tab.id === currentPatientId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => openPatient(tab.id)}
                className={`flex w-full items-start justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  active
                    ? "border-sky-300 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{tab.name}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => closePatient(event, tab.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      closePatient(event, tab.id);
                    }
                  }}
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-xs text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
                  aria-label={`Close ${tab.name}`}
                >
                  x
                </span>
              </button>
            );
          })}
        </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
