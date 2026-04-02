import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiUrl, authHeaders } from "../api/http";
import { getMyAppointments } from "../api/appointments";
import { getConversations } from "../api/messaging";
import { getCaregiverLinkRequests, getDoctorLinkRequests } from "../api/links";
import { formatDoseTime, getNextMedicationDose, isActiveMedication } from "../utils/medicationSchedule";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "urgent", label: "Urgent" },
  { key: "requests", label: "Requests" },
  { key: "reminders", label: "Reminders" },
  { key: "messages", label: "Messages" },
];

const DISMISSED_NOTIFICATIONS_STORAGE_KEY = "healio:patient-dismissed-notifications";

function formatRelativeDate(dateLike) {
  const date = new Date(dateLike);
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffHours) < 24) {
    if (diffHours >= 0) return `in ${diffHours || 1}h`;
    return `${Math.abs(diffHours)}h ago`;
  }

  if (diffDays >= 0) return `in ${diffDays}d`;
  return `${Math.abs(diffDays)}d ago`;
}

function NotificationCard({ item, onOpen, onDismiss }) {
  const toneStyles = {
    urgent: "border-rose-200 bg-rose-50",
    warning: "border-amber-200 bg-amber-50",
    info: "border-sky-200 bg-sky-50",
    neutral: "border-slate-200 bg-white",
  };

  const badgeStyles = {
    urgent: "bg-rose-100 text-rose-700",
    warning: "bg-amber-100 text-amber-700",
    info: "bg-sky-100 text-sky-700",
    neutral: "bg-slate-100 text-slate-700",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneStyles[item.tone] || toneStyles.neutral}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.categoryLabel}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{item.title}</h3>
          <p className="mt-1 text-sm text-slate-700">{item.description}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyles[item.tone] || badgeStyles.neutral}`}>
          {item.timeLabel}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.meta}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Remove
          </button>
          {item.href ? (
            <button
              type="button"
              onClick={() => onOpen(item.href)}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              Open
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PatientNotificationCenter() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterKey, setFilterKey] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setDismissedNotificationIds(parsed.filter((value) => typeof value === "string"));
      }
    } catch {
      setDismissedNotificationIds([]);
    }
  }, []);

  function dismissNotification(notificationId) {
    setDismissedNotificationIds((current) => {
      if (current.includes(notificationId)) return current;
      const next = [...current, notificationId];
      localStorage.setItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        getMyAppointments(),
        getConversations(),
        getDoctorLinkRequests({ includeDecisions: true }),
        getCaregiverLinkRequests(),
        fetch(`${apiUrl}/api/medications`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then((res) => (res.ok ? res.json() : [])),
        fetch(`${apiUrl}/api/profile`, {
          headers: { "Content-Type": "application/json", ...authHeaders() },
        }).then(async (res) => {
          if (res.status === 404) return {};
          return res.json().catch(() => ({}));
        }),
      ]);

      if (cancelled) return;

      const [appointmentsResult, conversationsResult, doctorRequestsResult, caregiverRequestsResult, medicationsResult, profileResult] = results;

      const appointments = appointmentsResult.status === "fulfilled" ? appointmentsResult.value.appointments || [] : [];
      const conversations = conversationsResult.status === "fulfilled" ? conversationsResult.value.conversations || [] : [];
      const doctorRequests = doctorRequestsResult.status === "fulfilled" ? doctorRequestsResult.value.requests || [] : [];
      const caregiverRequests = caregiverRequestsResult.status === "fulfilled" ? caregiverRequestsResult.value.requests || [] : [];
      const medications = medicationsResult.status === "fulfilled" && Array.isArray(medicationsResult.value)
        ? medicationsResult.value
        : [];
      const profile = profileResult.status === "fulfilled" ? profileResult.value || {} : {};

      if (
        appointmentsResult.status === "rejected" &&
        conversationsResult.status === "rejected" &&
        doctorRequestsResult.status === "rejected" &&
        caregiverRequestsResult.status === "rejected" &&
        medicationsResult.status === "rejected"
      ) {
        setError("Failed to load notifications.");
        setLoading(false);
        return;
      }

      const built = [];

      if (profile?.emergencyStatus) {
        built.push({
          id: "emergency-status",
          category: "urgent",
          categoryLabel: "Emergency",
          title: "Emergency mode is active",
          description: "Your emergency status is currently active. Confirm whether it still needs urgent attention.",
          timeLabel: "now",
          meta: "High priority",
          tone: "urgent",
          href: "/emergency",
        });
      }

      const pendingDoctorRequests = doctorRequests.filter((request) => request.status === "pending");
      const recentlyApprovedDoctorRequests = doctorRequests.filter((request) => {
        if (request.status !== "active") return false;
        if (!request.updatedAt) return false;
        return Date.now() - new Date(request.updatedAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
      });
      const recentlyRejectedDoctorRequests = doctorRequests.filter((request) => {
        if (request.status !== "rejected") return false;
        if (!request.updatedAt) return false;
        return Date.now() - new Date(request.updatedAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
      });

      if (pendingDoctorRequests.length > 0) {
        built.push({
          id: "doctor-request",
          category: "requests",
          categoryLabel: "Care Team",
          title: `${pendingDoctorRequests.length} doctor request${pendingDoctorRequests.length === 1 ? "" : "s"} pending`,
          description: "A doctor has not responded to your link request yet.",
          timeLabel: "pending",
          meta: "Approval needed",
          tone: "warning",
          href: "/care-team",
        });
      }

      recentlyApprovedDoctorRequests.forEach((request) => {
        const approvedAt = request.updatedAt || request.createdAt;
        built.push({
          id: `doctor-approved-${request.doctorId}-${approvedAt}`,
          category: "requests",
          categoryLabel: "Care Team",
          title: "Doctor link approved",
          description: `${request.doctor?.displayName || request.doctor?.email || "Your doctor"} approved your link request.`,
          timeLabel: approvedAt ? formatRelativeDate(approvedAt) : "new",
          meta: "Approval completed",
          tone: "info",
          href: "/care-team",
        });
      });

      recentlyRejectedDoctorRequests.forEach((request) => {
        const rejectedAt = request.updatedAt || request.createdAt;
        built.push({
          id: `doctor-rejected-${request.doctorId}-${rejectedAt}`,
          category: "requests",
          categoryLabel: "Care Team",
          title: "Doctor link not approved",
          description: `${request.doctor?.displayName || request.doctor?.email || "A doctor"} declined your link request. You can choose another doctor from your care team page.`,
          timeLabel: rejectedAt ? formatRelativeDate(rejectedAt) : "new",
          meta: "Request declined",
          tone: "warning",
          href: "/care-team",
        });
      });

      if (caregiverRequests.length > 0) {
        built.push({
          id: "caregiver-request",
          category: "requests",
          categoryLabel: "Care Team",
          title: `${caregiverRequests.length} caregiver request${caregiverRequests.length === 1 ? "" : "s"} pending`,
          description: "A caregiver has not responded to your invitation yet.",
          timeLabel: "pending",
          meta: "Approval needed",
          tone: "warning",
          href: "/care-team",
        });
      }

      const requestedAppointments = appointments.filter((item) => item.status === "requested");
      if (requestedAppointments.length > 0) {
        built.push({
          id: "appointment-requested",
          category: "requests",
          categoryLabel: "Appointments",
          title: `${requestedAppointments.length} appointment request${requestedAppointments.length === 1 ? "" : "s"} waiting`,
          description: "Your doctor has not reviewed all appointment requests yet.",
          timeLabel: "pending",
          meta: "Scheduling",
          tone: "info",
          href: "/patientAppointments",
        });
      }

      const nextScheduledAppointment = appointments
        .filter((item) => item.status === "scheduled" && new Date(item.startsAt).getTime() >= Date.now())
        .sort((left, right) => new Date(left.startsAt) - new Date(right.startsAt))[0];

      if (nextScheduledAppointment) {
        built.push({
          id: `appointment-next-${nextScheduledAppointment.id}`,
          category: "reminders",
          categoryLabel: "Appointments",
          title: "Upcoming appointment",
          description: `${new Date(nextScheduledAppointment.startsAt).toLocaleString()} with ${nextScheduledAppointment.doctor?.displayName || "your doctor"}`,
          timeLabel: formatRelativeDate(nextScheduledAppointment.startsAt),
          meta: nextScheduledAppointment.location || "Location pending",
          tone: "info",
          href: "/patientAppointments",
        });
      }

      const activeMedications = medications.filter((item) => isActiveMedication(item));
      const nextDose = getNextMedicationDose(activeMedications);
      if (nextDose) {
        built.push({
          id: `medication-next-${nextDose.medication?.id || "dose"}`,
          category: "reminders",
          categoryLabel: "Medications",
          title: `Next dose: ${nextDose.medication?.name || "Medication"}`,
          description: `Scheduled at ${formatDoseTime(nextDose.at)}.`,
          timeLabel: formatRelativeDate(nextDose.at),
          meta: "Medication reminder",
          tone: "info",
          href: "/medication",
        });
      }

      conversations.slice(0, 4).forEach((conversation) => {
        const other = (conversation.participants || []).find((p) => p.role !== "patient");
        const sender = conversation.lastMessage?.sender?.displayName || conversation.lastMessage?.sender?.email || other?.displayName || other?.email || "Care team";
        const sentAt = conversation.lastMessage?.sentAt || conversation.updatedAt;
        built.push({
          id: `conversation-${conversation.id}`,
          category: "messages",
          categoryLabel: "Updates & Communication",
          title: `Message from ${sender}`,
          description: conversation.lastMessage?.body || "Open to view the latest message.",
          timeLabel: sentAt ? formatRelativeDate(sentAt) : "new",
          meta: "Conversation update",
          tone: "neutral",
          href: "/patientMessages",
        });
      });

      setNotifications(
        built.sort((left, right) => {
          const weight = { urgent: 3, warning: 2, info: 1, neutral: 0 };
          return (weight[right.tone] || 0) - (weight[left.tone] || 0);
        })
      );
      setLoading(false);
    }

    loadNotifications();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleNotifications = useMemo(
    () => notifications.filter((item) => !dismissedNotificationIds.includes(item.id)),
    [dismissedNotificationIds, notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (filterKey === "all") return visibleNotifications;
    if (filterKey === "urgent") return visibleNotifications.filter((item) => item.tone === "urgent");
    return visibleNotifications.filter((item) => item.category === filterKey);
  }, [filterKey, visibleNotifications]);

  const unreadLikeCount = visibleNotifications.filter((item) => item.tone !== "neutral").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-sky-800 to-cyan-600 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/75">Patient Notification Center</p>
          <h1 className="mt-3 text-4xl font-black">Stay ahead of every care update.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/90">
            One queue for requests, reminders, appointment updates, and messages across your care journey.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Active alerts: <span className="font-semibold text-slate-900">{unreadLikeCount}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setFilterKey(filter.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filterKey === filter.key
                      ? "bg-sky-100 text-sky-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-3">
          {loading ? <p className="text-sm text-slate-500">Loading notifications...</p> : null}
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          {!loading && !error && filteredNotifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
              No notifications in this category.
            </div>
          ) : null}

          {!loading && !error
            ? filteredNotifications.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  onOpen={(href) => navigate(href)}
                  onDismiss={dismissNotification}
                />
              ))
            : null}
        </section>
      </main>
    </div>
  );
}