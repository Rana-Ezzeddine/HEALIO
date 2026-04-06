import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import {
  getCaregiverLinkRequests,
  getMyCaregivers,
  getDoctorLinkRequests,
  getMyDoctors,
  linkCaregiverByEmail,
  linkDoctorByEmail,
  removeCaregiverAssignment,
  updateCaregiverPermissions,
} from "../api/links";
import { readSafePrefill, writeSafePrefill } from "../utils/safePrefill";

const PERMISSION_LABELS = {
  canViewMedications: "View medications",
  canViewSymptoms: "View symptoms",
  canViewAppointments: "View appointments",
  canMessageDoctor: "Message doctor",
  canReceiveReminders: "Receive reminders",
};

export default function CareTeamPatient() {
  const careTeamPrefill = readSafePrefill("care-team", {
    doctorEmailToLink: "",
    caregiverEmailToLink: "",
  });
  const [linkedDoctors, setLinkedDoctors] = useState([]);
  const [linkedCaregivers, setLinkedCaregivers] = useState([]);
  const [doctorRequests, setDoctorRequests] = useState([]);
  const [caregiverRequests, setCaregiverRequests] = useState([]);
  const [doctorEmailToLink, setDoctorEmailToLink] = useState(careTeamPrefill.doctorEmailToLink || "");
  const [caregiverEmailToLink, setCaregiverEmailToLink] = useState(careTeamPrefill.caregiverEmailToLink || "");
  const [status, setStatus] = useState({ error: "", success: "" });
  const [loading, setLoading] = useState(true);

  async function loadAssignments() {
    setLoading(true);
    try {
      const [doctorsRes, caregiversRes, doctorRequestsRes, caregiverRequestsRes] = await Promise.all([
        getMyDoctors(),
        getMyCaregivers(),
        getDoctorLinkRequests(),
        getCaregiverLinkRequests(),
      ]);
      setLinkedDoctors(doctorsRes.doctors || []);
      setLinkedCaregivers(caregiversRes.caregivers || []);
      setDoctorRequests(doctorRequestsRes.requests || []);
      setCaregiverRequests(caregiverRequestsRes.requests || []);
      setStatus({ error: "", success: "" });
    } catch (error) {
      setStatus({ error: error.message || "Failed to load care team.", success: "" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssignments();
  }, []);

  useEffect(() => {
    writeSafePrefill("care-team", {
      doctorEmailToLink: doctorEmailToLink.trim().toLowerCase(),
      caregiverEmailToLink: caregiverEmailToLink.trim().toLowerCase(),
    });
  }, [caregiverEmailToLink, doctorEmailToLink]);

  async function handleLinkDoctor() {
    try {
      await linkDoctorByEmail(doctorEmailToLink.trim());
      setDoctorEmailToLink("");
      setStatus({ error: "", success: "Doctor request sent successfully." });
      await loadAssignments();
    } catch (error) {
      if (error?.code === "DOCTOR_NOT_AVAILABLE") {
        setStatus({ error: "This doctor is not available for linking.", success: "" });
        return;
      }
      setStatus({ error: error.message || "Failed to link doctor.", success: "" });
    }
  }

  async function handleLinkCaregiver() {
    try {
      await linkCaregiverByEmail(caregiverEmailToLink.trim(), {
        canViewMedications: true,
        canViewSymptoms: true,
        canViewAppointments: true,
        canMessageDoctor: true,
        canReceiveReminders: true,
      });
      setCaregiverEmailToLink("");
      setStatus({ error: "", success: "Caregiver request sent successfully." });
      await loadAssignments();
    } catch (error) {
      setStatus({ error: error.message || "Failed to link caregiver.", success: "" });
    }
  }

  async function handleToggleCaregiverPermission(caregiverId, permissions, key) {
    try {
      await updateCaregiverPermissions(caregiverId, {
        [key]: !permissions[key],
      });
      setStatus({ error: "", success: "Caregiver permissions updated." });
      await loadAssignments();
    } catch (error) {
      setStatus({ error: error.message || "Failed to update caregiver permissions.", success: "" });
    }
  }

  async function handleRemoveCaregiver(caregiverId) {
    try {
      await removeCaregiverAssignment(caregiverId);
      setStatus({ error: "", success: "Caregiver removed." });
      await loadAssignments();
    } catch (error) {
      setStatus({ error: error.message || "Failed to remove caregiver.", success: "" });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 pb-10 pt-28">
        <section className="rounded-[2rem] bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-500 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/80">Patient Care Team</p>
          <h1 className="mt-3 text-4xl font-black">Keep your support network in one place.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/90">
            Link your doctor and caregiver here so reminders, appointments, and health updates flow to the right people.
          </p>
        </section>

        {status.error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {status.error}
          </div>
        ) : null}
        {status.success ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {status.success}
          </div>
        ) : null}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">What caregiver access means</h2>
          <p className="mt-1 text-sm text-slate-600">
            Caregivers support your routine care. They do not replace your doctor and only see what you allow.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Caregiver can</p>
              <ul className="mt-2 space-y-2 text-sm text-emerald-900">
                <li>• View selected medications, symptoms, and appointments.</li>
                <li>• Help monitor reminders and care follow-through.</li>
                <li>• Collaborate in care communication where enabled.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Caregiver cannot</p>
              <ul className="mt-2 space-y-2 text-sm text-amber-900">
                <li>• Diagnose conditions or prescribe treatment.</li>
                <li>• Access permissions you did not grant.</li>
                <li>• Replace doctor review for medical decisions.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Doctors</h2>
                <p className="mt-1 text-sm text-slate-500">Request a doctor link to unlock appointments and treatment coordination.</p>
              </div>
              <div className="rounded-2xl bg-sky-50 px-4 py-2 text-right">
                <p className="text-xs text-slate-500">Linked</p>
                <p className="text-xl font-bold text-slate-900">{linkedDoctors.length}</p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <input
                type="email"
                value={doctorEmailToLink}
                onChange={(event) => setDoctorEmailToLink(event.target.value)}
                placeholder="doctor@email.com"
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleLinkDoctor}
                className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600 transition"
              >
                Link doctor
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? <p className="text-sm text-slate-500">Loading doctors...</p> : null}
              {linkedDoctors.map((record) => (
                <div key={record.doctor.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{record.doctor.displayName}</p>
                  <p className="mt-1 text-sm text-slate-500">{record.doctor.email}</p>
                </div>
              ))}
              {doctorRequests.map((record) => (
                <div key={`doctor-request-${record.doctorId}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-slate-900">{record.doctor?.displayName || record.doctor?.email || "Doctor"}</p>
                  <p className="mt-1 text-sm text-amber-700">Pending doctor approval</p>
                </div>
              ))}
              {!loading && linkedDoctors.length === 0 && doctorRequests.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No approved doctors available yet.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Caregivers</h2>
                <p className="mt-1 text-sm text-slate-500">Control exactly what your caregiver can see and receive.</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-right">
                <p className="text-xs text-slate-500">Linked</p>
                <p className="text-xl font-bold text-slate-900">{linkedCaregivers.length}</p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <input
                type="email"
                value={caregiverEmailToLink}
                onChange={(event) => setCaregiverEmailToLink(event.target.value)}
                placeholder="caregiver@email.com"
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleLinkCaregiver}
                className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition"
              >
                Link caregiver
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? <p className="text-sm text-slate-500">Loading caregivers...</p> : null}
              {linkedCaregivers.map(({ caregiver, permissions }) => (
                <div key={caregiver.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{caregiver.email}</p>
                      <p className="mt-1 text-sm text-slate-500">Permissions</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCaregiver(caregiver.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {Object.entries(permissions).map(([key, value]) => (
                      <label key={key} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={() => handleToggleCaregiverPermission(caregiver.id, permissions, key)}
                        />
                        <span>{PERMISSION_LABELS[key] || key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {caregiverRequests.map((record) => (
                <div key={`caregiver-request-${record.caregiverId}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-slate-900">{record.caregiver?.email || "Caregiver"}</p>
                  <p className="mt-1 text-sm text-amber-700">Pending caregiver approval</p>
                </div>
              ))}
              {!loading && linkedCaregivers.length === 0 && caregiverRequests.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No caregiver linked yet.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
