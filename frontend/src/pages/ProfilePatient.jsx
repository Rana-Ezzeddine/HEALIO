import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl, authHeaders, getUser, updateSessionUser } from "../api/http";
import Navbar from "../components/Navbar";
import userMale from "../assets/userMale.png";
import userFemale from "../assets/userFemale.png";
import { getProfileCompletion } from "../utils/patientSetup";

function canonGender(gender) {
  if (!gender) return "";
  const normalized = String(gender).trim().toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  if (normalized === "prefer not to say" || normalized === "prefer-not-to-say" || normalized === "prefer_not_to_say") {
    return "Prefer not to say";
  }
  return "";
}

function FormInput({ label, type = "text", value, onChange, isEditing, options }) {
  const baseField =
    "w-full rounded-xl border px-3 py-2 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500";
  const editableField = "border-slate-300 bg-white text-slate-900";
  const readonlyField = "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500";

  return (
    <div className="flex w-full flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {options ? (
        <select
          value={value}
          onChange={onChange}
          disabled={!isEditing}
          className={`${baseField} ${isEditing ? editableField : readonlyField}`}
        >
          <option value="">Select</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
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
      )}
    </div>
  );
}

export default function ProfilePatient() {
  const navigate = useNavigate();
  const sessionUser = getUser();
  const accountEmail = sessionUser?.email || "";
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ error: "", success: "" });
  const [profileState, setProfileState] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    allergies: "",
    conditions: "",
    bloodType: "",
    email: accountEmail,
    phone: "",
    emName: "",
    relationship: "",
    emPhone: "",
  });

  const hydrateFromSession = useCallback(() => {
    setProfileState((current) => ({
      ...current,
      firstName: sessionUser?.firstName || "",
      lastName: sessionUser?.lastName || "",
      email: accountEmail,
    }));
  }, [accountEmail, sessionUser?.firstName, sessionUser?.lastName]);

  const loadProfile = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/profile`, {
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });

      if (response.status === 404) {
        hydrateFromSession();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load profile.");
      }

      const profile = await response.json();
      setProfileState({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        gender: profile.gender || profile.sex || "",
        dateOfBirth: profile.dateOfBirth || "",
        bloodType: profile.bloodType || "",
        phone: profile.phoneNumber || "",
        email: profile.email || accountEmail,
        allergies: Array.isArray(profile.allergies) ? profile.allergies.join(", ") : profile.allergies || "",
        conditions: Array.isArray(profile.chronicConditions)
          ? profile.chronicConditions.join(", ")
          : profile.chronicConditions || profile.medicalConditions || "",
        emName: profile.emergencyContact?.name || "",
        relationship: profile.emergencyContact?.relationship || "",
        emPhone: profile.emergencyContact?.phoneNumber || "",
      });
    } catch (error) {
      console.error(error);
      hydrateFromSession();
      setSaveStatus({ error: "Could not load the full profile. Showing account basics only.", success: "" });
    }
  }, [accountEmail, hydrateFromSession]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const completion = useMemo(
    () =>
      getProfileCompletion({
        firstName: profileState.firstName,
        lastName: profileState.lastName,
        dateOfBirth: profileState.dateOfBirth,
        gender: profileState.gender,
        phoneNumber: profileState.phone,
        bloodType: profileState.bloodType,
        emergencyContact: {
          name: profileState.emName,
          relationship: profileState.relationship,
          phoneNumber: profileState.emPhone,
        },
      }),
    [profileState]
  );

  async function handleSave() {
    setSaveStatus({ error: "", success: "" });
    try {
      const payload = {
        firstName: profileState.firstName,
        lastName: profileState.lastName,
        gender: profileState.gender,
        dateOfBirth: profileState.dateOfBirth,
        bloodType: profileState.bloodType,
        phoneNumber: profileState.phone,
        email: profileState.email,
        allergies: profileState.allergies
          ? profileState.allergies.split(",").map((item) => item.trim()).filter(Boolean)
          : [],
        chronicConditions: profileState.conditions
          ? profileState.conditions.split(",").map((item) => item.trim()).filter(Boolean)
          : [],
        emergencyContact: {
          name: profileState.emName,
          relationship: profileState.relationship,
          phoneNumber: profileState.emPhone,
        },
      };

      const response = await fetch(`${apiUrl}/api/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveStatus({ error: data.message || "Failed to save profile.", success: "" });
        return;
      }

      localStorage.setItem("firstName", data.firstName || profileState.firstName);
      localStorage.setItem("lastName", data.lastName || profileState.lastName);

      const currentUser = getUser();
      if (currentUser) {
        updateSessionUser({
          ...currentUser,
          firstName: data.firstName || profileState.firstName || currentUser.firstName,
          lastName: data.lastName || profileState.lastName || currentUser.lastName,
        });
      }

      localStorage.setItem("healio:profile-updated", String(Date.now()));

      setIsEditing(false);
      setSaveStatus({ error: "", success: "Profile updated successfully." });
      await loadProfile();
    } catch (error) {
      console.error(error);
      setSaveStatus({ error: "Network error while saving profile.", success: "" });
    }
  }

  function handleCancel() {
    setIsEditing(false);
    setSaveStatus({ error: "", success: "" });
    loadProfile();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">Patient Profile</p>
              <h1 className="mt-3 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-3xl font-black text-transparent">
                My Profile
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Review and update your personal, medical, and contact information. A more complete profile makes onboarding, emergency access, and care-team coordination smoother.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="h-32 w-32 overflow-hidden rounded-full border border-slate-200">
                <img
                  className="h-full w-full object-cover"
                  src={canonGender(profileState.gender) === "Female" ? userFemale : userMale}
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

        <section className="mt-6 rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Profile completion</h2>
              <p className="mt-1 text-sm text-slate-600">
                {completion.percent}% complete. Fill the missing items below to make your profile more useful and more patient-friendly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/care-team")}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Manage care team
            </button>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400" style={{ width: `${completion.percent}%` }} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {completion.checks.map((item) => (
              <span
                key={item.key}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {item.done ? `Done: ${item.label}` : `Missing: ${item.label}`}
              </span>
            ))}
          </div>
        </section>

        {saveStatus.error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {saveStatus.error}
          </div>
        ) : null}
        {saveStatus.success ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {saveStatus.success}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-800">Personal Information</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput label="First Name" value={profileState.firstName} onChange={(event) => setProfileState((current) => ({ ...current, firstName: event.target.value }))} isEditing={isEditing} />
              <FormInput label="Last Name" value={profileState.lastName} onChange={(event) => setProfileState((current) => ({ ...current, lastName: event.target.value }))} isEditing={isEditing} />
              <FormInput label="Gender" value={profileState.gender} onChange={(event) => setProfileState((current) => ({ ...current, gender: event.target.value }))} isEditing={isEditing} options={["Male", "Female", "Prefer not to say"]} />
              <FormInput label="Date of Birth" type="date" value={profileState.dateOfBirth} onChange={(event) => setProfileState((current) => ({ ...current, dateOfBirth: event.target.value }))} isEditing={isEditing} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-800">Medical Information</h2>
            <div className="grid grid-cols-1 gap-4">
              <FormInput label="Allergies" type="textarea" value={profileState.allergies} onChange={(event) => setProfileState((current) => ({ ...current, allergies: event.target.value }))} isEditing={isEditing} />
              <FormInput label="Chronic Conditions" type="textarea" value={profileState.conditions} onChange={(event) => setProfileState((current) => ({ ...current, conditions: event.target.value }))} isEditing={isEditing} />
              <FormInput label="Blood Type" value={profileState.bloodType} onChange={(event) => setProfileState((current) => ({ ...current, bloodType: event.target.value }))} isEditing={isEditing} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-800">Contact Information</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput label="Phone Number" value={profileState.phone} onChange={(event) => setProfileState((current) => ({ ...current, phone: event.target.value }))} isEditing={isEditing} />
              <FormInput label="Email" value={profileState.email} onChange={(event) => setProfileState((current) => ({ ...current, email: event.target.value }))} isEditing={false} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-slate-800">Emergency Contact</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput label="Emergency Contact Name" value={profileState.emName} onChange={(event) => setProfileState((current) => ({ ...current, emName: event.target.value }))} isEditing={isEditing} />
              <FormInput label="Relationship" value={profileState.relationship} onChange={(event) => setProfileState((current) => ({ ...current, relationship: event.target.value }))} isEditing={isEditing} />
              <FormInput label="Phone Number" value={profileState.emPhone} onChange={(event) => setProfileState((current) => ({ ...current, emPhone: event.target.value }))} isEditing={isEditing} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Care Team</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Care-team management now has its own dedicated page so profile editing stays clean and easier to complete.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/care-team")}
                className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-600 transition"
              >
                Open Care Team
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
