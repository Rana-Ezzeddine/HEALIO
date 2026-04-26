import { apiUrl, authHeaders, getUser } from "../api/http";
import Navbar from "../components/Navbar";
import TwoFactorSecurityCard from "../components/TwoFactorSecurityCard";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);

    //personal info
    const[firstName, setFirstName] = useState("");
    const[lastName, setLastName] = useState("");
    const[dateOfBirth, setDateOfBirth] = useState("");
    const[gender, setGender] = useState("");

  //caregiver info
  const[relationshipToPatient, setRelationshipToPatient] = useState("");
  const[supportNotes, setSupportNotes] = useState("");

    //contact info
    const[email, setEmail] = useState("");
    const[phone, setPhone] = useState("");

    function hydrateFromSession() {
      const storedUser = getUser();
      setFirstName(storedUser?.firstName || "");
      setLastName(storedUser?.lastName || "");
      setEmail(storedUser?.email || "");
    }

    useEffect(() => {
  (async () => {
    try {
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
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Patient links and permissions</h2>
              <p className="text-sm text-slate-500">
                Manage invitations, active patients, and permission details in one place.
              </p>
              <button
                type="button"
                onClick={() => navigate("/caregiver-patients")}
                className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Open My Patients
              </button>
            </section>
          </div>
          </main>
          <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
            <TwoFactorSecurityCard />
          </div>
      </div>
    );
}
