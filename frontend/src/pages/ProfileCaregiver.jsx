import { apiUrl, authHeaders, getUser } from "../api/http";
import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";
import { getCaregiverLinkRequests, reviewCaregiverLinkRequest } from "../api/links";
import userMale from "../assets/userMale.png"
import userFemale from "../assets/userFemale.png"

function canonGender(g) {
  if (!g) return "";
  const s = String(g).trim().toLowerCase();
  if (s === "male") return "Male";
  if (s === "female") return "Female";
  if (s === "prefer not to say" || s === "prefer-not-to-say" || s === "prefer_not_to_say") {
    return "Prefer not to say";
  }
  return "";
}


function FormInput({ label, type = "text", value, onChange, isEditing, options }) {
  const baseField =
    "w-full px-3 py-2 rounded-lg border transition focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500";
  const editableField = "bg-white border-slate-300 text-slate-900";
  const readonlyField = "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed";
  return (
    <div className="w-full flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {options ? (
        <div className="relative">
            <select
                value={value}
                onChange={onChange}
                disabled={!isEditing}
                className={`appearance-none pr-10 ${baseField} ${
                  isEditing ? editableField : readonlyField
                }`}
            >
                <option value="">Select</option>
                {options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
            </select>
            <span className="pointer-events-none absolute hover:text-red-900 right-3 top-1/2 -translate-y-1/2 text-slate-500">
                ▼
            </span>
        </div>
      ) : 
      (
        type === "textarea" ? (
          <textarea
            rows={3}
            value={value}
            onChange={onChange}
            disabled={!isEditing}
            className={`${baseField} ${isEditing ? editableField : readonlyField}`}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={onChange}
            disabled={!isEditing}
            className={`${baseField} ${isEditing ? editableField : readonlyField}`}
          />
        )
      )}
    </div>
  );
}

export default function ProfileCaregiver(){
    const [isEditing, setIsEditing] = useState(false);

    //personal info
    const[firstName, setFirstName] = useState("");
    const[lastName, setLastName] = useState("");
    const[dateOfBirth, setDateOfBirth] = useState("");
    const[gender, setGender] = useState("");

  //caregiver info
  const[relationshipToPatient, setRelationshipToPatient] = useState("");
  const[supportNotes, setSupportNotes] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activePatients, setActivePatients] = useState([]);
  const [requestError, setRequestError] = useState("");

    //contact info
    const[email, setEmail] = useState("");
    const[phone, setPhone] = useState("");

    function hydrateFromSession() {
      const storedUser = getUser();
      setFirstName(storedUser?.firstName || "");
      setLastName(storedUser?.lastName || "");
      setEmail(storedUser?.email || "");
    }

    async function loadCaregiverLinks() {
      try {
        const [requestsRes, patientsRes] = await Promise.all([
          getCaregiverLinkRequests(),
          fetch(`${apiUrl}/api/caregivers/patients`, {
            headers: { "Content-Type": "application/json", ...authHeaders() },
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to load linked patients.");
            return data;
          }),
        ]);
        setPendingRequests(requestsRes.requests || []);
        setActivePatients(patientsRes.patients || []);
      } catch (err) {
        console.error("Failed to load caregiver links", err);
      }
    }

    useEffect(() => {
  (async () => {
    try {
      await loadCaregiverLinks();
      const res = await fetch(`${apiUrl}/api/profile`, {
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });

      if (res.status === 404) {
        hydrateFromSession();
        return; // no profile yet
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Failed to load profile:", err);
        hydrateFromSession();
        return;
      }

      const p = await res.json();

      setFirstName(p.firstName || "");
      setLastName(p.lastName || "");
      setGender(p.gender || p.sex || "");
      setDateOfBirth(p.dateOfBirth || "");

      setRelationshipToPatient(p.relationshipToPatient || "");
      setSupportNotes(p.supportNotes || "");

      setPhone(p.phoneNumber || "");
      setEmail(p.email || "");

    } catch (err) {
      console.error(err);
      hydrateFromSession();
    }
  })();
}, []);

    async function handleReviewRequest(patientId, status) {
      setRequestError("");
      try {
        await reviewCaregiverLinkRequest(patientId, status);
        await loadCaregiverLinks();
      } catch (err) {
        setRequestError(err.message || "Failed to review request.");
      }
    }


    async function handleSave() {
  try {
    const payload = {
      firstName,
      lastName,
      gender,
      dateOfBirth,

      phoneNumber: phone,
      email,

      relationshipToPatient,
      supportNotes
      
    };

    const res = await fetch(`${apiUrl}/api/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "Failed to save profile");
      return;
    }

    setFirstName(data.firstName || "");
    setLastName(data.lastName || "");
    setGender(canonGender(data.gender || data.sex));
    setDateOfBirth(data.dateOfBirth || "");

    setRelationshipToPatient(data.relationshipToPatient || "");
    setSupportNotes(data.supportNotes || "");
    
    setPhone(data.phoneNumber || "");
    setEmail(data.email || "");

    // Keep dashboard/session name in sync with profile edits
    localStorage.setItem("firstName", data.firstName || firstName);
    localStorage.setItem("lastName", data.lastName || lastName);

    setIsEditing(false);
  } catch (err) {
    console.error(err);
    alert("Network error while saving profile.");
  }
}


    function handleCancel() {
        setIsEditing(false);
        setFirstName(getUser()?.firstName || "");
        setLastName(getUser()?.lastName || "");
        setGender(localStorage.getItem("gender") || "");
        setDateOfBirth(localStorage.getItem("dateOfBirth") || "");

        setEmail(getUser()?.email || "");
        setPhone(localStorage.getItem("phone") || "");

        setRelationshipToPatient(localStorage.getItem("relationshipToPatient") || "");
        setSupportNotes(localStorage.getItem("supportNotes") || "");
    }

    return(
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
          <Navbar/>
          <main className="mx-auto max-w-5xl px-4 pb-10 pt-28 sm:px-6 lg:px-8">

          <section className="rounded-[2rem] bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">Caregiver Profile</p>
                <h1 className="mt-3 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-3xl font-black text-transparent">
                  My Profile
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Review and update your caregiver details, linked patient information, and contact information.
                </p>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="h-32 w-32 overflow-hidden rounded-full border border-slate-200">
                  <img
                    className="h-full w-full object-cover"
                    src={canonGender(gender) === "Female" ? userFemale : userMale}
                    alt="Profile"
                  />
                </div>

                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6">
            <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="First Name" type="text" value={firstName} onChange={(e)=>setFirstName(e.target.value)} isEditing={isEditing} />
                <FormInput label="Last Name" type="text" value={lastName} onChange={(e)=>setLastName(e.target.value)} isEditing={isEditing} />  
                <FormInput label="Gender" type="text" value={gender} onChange={(e)=>setGender(e.target.value)} isEditing={isEditing} options={["Male", "Female", "Prefer not to say"]} />
                <FormInput label="Date of Birth" type="date" value={dateOfBirth} onChange={(e)=>setDateOfBirth(e.target.value)} isEditing={isEditing} />  
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Caregiving Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
                <FormInput label="Relationship to Patient" type="text" value={relationshipToPatient} onChange={(e)=>setRelationshipToPatient(e.target.value)} isEditing={isEditing} />
                <div className="sm:col-span-2">
                  <FormInput label="Support Notes" type="textarea" value={supportNotes} onChange={(e)=>setSupportNotes(e.target.value)} isEditing={isEditing} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
                <FormInput label="Phone Number" type="text" value={phone} onChange={(e)=>setPhone(e.target.value)} isEditing={isEditing} />
                <FormInput label="Email" type="text" value={email} onChange={(e)=>setEmail(e.target.value)} isEditing={isEditing} />
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Patient Link Requests</h2>
                  <p className="mt-1 text-sm text-slate-500">Patients who have invited you to be part of their care team. Review their request and what they've granted you access to.</p>
                </div>
                {pendingRequests.length > 0 ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {pendingRequests.length} pending
                  </span>
                ) : null}
              </div>
              {requestError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{requestError}</div> : null}
              <div className="space-y-4">
                {pendingRequests.length > 0 ? pendingRequests.map((request) => {
                  const name = request.patient?.displayName || request.patient?.email || "Patient";
                  const email = request.patient?.email || "";
                  const initials = [request.patient?.firstName, request.patient?.lastName]
                    .filter(Boolean)
                    .map((n) => n[0].toUpperCase())
                    .join("") || (email ? email[0].toUpperCase() : "?");
                  const requestedAt = request.createdAt
                    ? new Date(request.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : null;

                  const PERMISSION_LABELS = {
                    canViewMedications: "View medications",
                    canViewSymptoms: "View symptoms",
                    canViewAppointments: "View appointments",
                    canMessageDoctor: "Doctor contact info",
                    canReceiveReminders: "Receive reminders",
                  };
                  const grantedPerms = request.permissions
                    ? Object.entries(request.permissions).filter(([, v]) => Boolean(v))
                    : [];
                  const deniedPerms = request.permissions
                    ? Object.entries(request.permissions).filter(([, v]) => !Boolean(v))
                    : [];

                  return (
                    <div key={request.patientId} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">

                      {/* Top row: identity + actions */}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-700">
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{name}</p>
                            {email && name !== email ? (
                              <p className="text-sm text-slate-500">{email}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                                Role: Patient
                              </span>
                              {requestedAt ? (
                                <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                                  Requested {requestedAt}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => handleReviewRequest(request.patientId, "active")}
                            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewRequest(request.patientId, "rejected")}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
                          >
                            Reject
                          </button>
                        </div>
                      </div>

                      {/* Permissions granted by patient */}
                      {request.permissions ? (
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Access granted by patient
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                              const granted = Boolean(request.permissions[key]);
                              return (
                                <div
                                  key={key}
                                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                                    granted
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : "border-slate-200 bg-white text-slate-400"
                                  }`}
                                >
                                  <span className={`text-base leading-none ${granted ? "text-emerald-500" : "text-slate-300"}`}>
                                    {granted ? "✓" : "✗"}
                                  </span>
                                  <span className={granted ? "font-medium" : ""}>{label}</span>
                                </div>
                              );
                            })}
                          </div>
                          {grantedPerms.length === 0 ? (
                            <p className="mt-2 text-xs text-slate-500">No permissions granted.</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                    No pending patient requests.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Patients Under Care</h2>
              <div className="space-y-2">
                {activePatients.length > 0 ? activePatients.map(({ patient, permissions }) => (
                  <div key={patient.id} className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="font-medium text-slate-800">{patient.email}</p>
                    <p className="text-sm text-slate-500">
                      Permissions: {Object.entries(permissions).filter(([, value]) => Boolean(value)).map(([key]) => key).join(", ") || "None"}
                    </p>
                  </div>
                )) : <p className="text-sm text-slate-500">No active patients linked yet.</p>}
              </div>
            </section>
          </div>
          </main>
      </div>
    );
}
