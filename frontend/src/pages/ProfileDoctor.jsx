import { apiUrl, authHeaders, getUser } from "../api/http";
import Navbar from "../components/Navbar";
import { useState, useEffect, useCallback } from "react";
import { getDoctorLinkRequests, reviewDoctorLinkRequest } from "../api/links";
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

export default function ProfileDoctor(){
    const [isEditing, setIsEditing] = useState(false);

    //personal info
    const[firstName, setFirstName] = useState("");
    const[lastName, setLastName] = useState("");
    const[dateOfBirth, setDateOfBirth] = useState("");
    const[gender, setGender] = useState("");

    //medical info
    const[specialization, setSpecialization] = useState("");
    const[yearsOfExperience, setYearsOfExperience] = useState("");
    const[licenseNb, setLicenseNb] = useState("");
    const[clinicName, setClinicName] = useState("");
    const[clinicAddress, setClinicAddress] = useState("");

    //contact info
    const[email, setEmail] = useState("");
    const[phone, setPhone] = useState("");
    const [pendingRequests, setPendingRequests] = useState([]);
    const [assignedPatients, setAssignedPatients] = useState([]);
    const [requestError, setRequestError] = useState("");
    const sessionUser = getUser();
    const accountEmail = sessionUser?.email || "";

    const hydrateFromSession = useCallback(() => {
      setFirstName(sessionUser?.firstName || "");
      setLastName(sessionUser?.lastName || "");
      setEmail(accountEmail);
      setLicenseNb(localStorage.getItem("licenseNb") || "");
    }, [accountEmail, sessionUser?.firstName, sessionUser?.lastName]);

    async function loadDoctorLinks() {
      try {
        const [requestsRes, patientsRes] = await Promise.all([
          getDoctorLinkRequests(),
          fetch(`${apiUrl}/api/doctors/assigned-patients`, {
            headers: { "Content-Type": "application/json", ...authHeaders() },
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to load assigned patients.");
            return data;
          }),
        ]);
        setPendingRequests(requestsRes.requests || []);
        setAssignedPatients(patientsRes.patients || []);
      } catch (err) {
        console.error("Failed to load doctor link data", err);
      }
    }

    useEffect(() => {
  (async () => {
    try {
      await loadDoctorLinks();
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

      setSpecialization(p.specialization || "");
      setYearsOfExperience(p.yearsOfExperience || "");
      setLicenseNb(p.licenseNb || localStorage.getItem("licenseNb") || "");
      setClinicName(p.clinicName || "");
      setClinicAddress(p.clinicAddress || "");

      setPhone(p.phoneNumber || "");
      setEmail(p.email || accountEmail);

    } catch (err) {
      console.error(err);
      hydrateFromSession();
    }
  })();
}, [accountEmail, hydrateFromSession]);

    async function handleReviewRequest(patientId, status) {
      setRequestError("");
      try {
        await reviewDoctorLinkRequest(patientId, status);
        await loadDoctorLinks();
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
      email: accountEmail,

      specialization,
      yearsOfExperience,
      licenseNb,
      clinicName,
      clinicAddress
      
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

    setSpecialization(data.specialization || "");
    setYearsOfExperience(data.yearsOfExperience || "");
    setLicenseNb(data.licenseNb || licenseNb);
    setClinicName(data.clinicName || "");
    setClinicAddress(data.clinicAddress || clinicAddress);
    
    setPhone(data.phoneNumber || phone);
    setEmail(accountEmail);

    // Keep dashboard/session name in sync with profile edits
    localStorage.setItem("firstName", data.firstName || firstName);
    localStorage.setItem("lastName", data.lastName || lastName);
    localStorage.setItem("licenseNb", data.licenseNb || licenseNb);

    setIsEditing(false);
  } catch (err) {
    console.error(err);
    alert("Network error while saving profile.");
  }
}


    function handleCancel() {
        setIsEditing(false);
        setFirstName(sessionUser?.firstName || "");
        setLastName(sessionUser?.lastName || "");
        setGender(localStorage.getItem("gender") || "");
        setDateOfBirth(localStorage.getItem("dateOfBirth") || "");

        setEmail(accountEmail);
        setPhone(localStorage.getItem("phone") || "");

        setSpecialization(localStorage.getItem("specialization") || "");
        setYearsOfExperience(localStorage.getItem("yearsOfExperience") || "");
        setLicenseNb(localStorage.getItem("licenseNb") || "");
        setClinicName(localStorage.getItem("clinicName") || "");
        setClinicAddress(localStorage.getItem("clinicAddress") || "");
    }

    return(
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50">
          <Navbar/>
          <main className="mx-auto max-w-5xl px-4 pb-10 pt-28 sm:px-6 lg:px-8">

          <section className="rounded-[2rem] bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">Doctor Profile</p>
                <h1 className="mt-3 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-3xl font-black text-transparent">
                  My Profile
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Review and update your personal, professional, and contact information.
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
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Professional Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
                <div className="sm:col-span-2">
                    <FormInput label="Specialization" type="text" value={specialization} onChange={(e)=>setSpecialization(e.target.value)} isEditing={isEditing} />
                </div>
                <FormInput label="Years of experience" type="number" value={yearsOfExperience} onChange={(e)=>setYearsOfExperience(e.target.value)} isEditing={isEditing} />
                <FormInput label="License Number" type="text" value={licenseNb} onChange={(e)=>setLicenseNb(e.target.value)} isEditing={false} />
                <FormInput label="Clinic/Hospital Name" type="text" value={clinicName} onChange={(e)=>setClinicName(e.target.value)} isEditing={isEditing} />
                <FormInput label="Clinic/Hospital Address" type="text" value={clinicAddress} onChange={(e)=>setClinicAddress(e.target.value)} isEditing={isEditing} />
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
                <FormInput label="Phone Number" type="text" value={phone} onChange={(e)=>setPhone(e.target.value)} isEditing={isEditing} />
                <FormInput label="Email" type="text" value={email} onChange={(e)=>setEmail(e.target.value)} isEditing={false} />
              </div>
            </section>
          </div>
          </main>
      </div>
    );
}
