import { apiUrl, authHeaders } from "../api/http";
import Navbar from "../components/Navbar";
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

export default function ProfileDoctor(){
    const [isEditing, setIsEditing] = useState(false);
    const navigate = useNavigate();

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

    useEffect(() => {
  (async () => {
    try {
      const res = await fetch(`${apiUrl}/api/profile`, {
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });

      if (res.status === 404) return; // no profile yet
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Failed to load profile:", err);
        return;
      }

      const p = await res.json();

      setFirstName(p.firstName || "");
      setLastName(p.lastName || "");
      setGender(p.gender || "");
      setDateOfBirth(p.dateOfBirth || "");

      setSpecialization(p.specialization || "");
      setYearsOfExperience(p.yearsOfExperience || "");
      setLicenseNb(p.licenseNb || "");
      setClinicName(p.clinicName || "");
      setClinicAddress(p.ClinicAddress || "");

      setPhone(p.phoneNumber || "");
      setEmail(p.email || "");

    } catch (err) {
      console.error(err);
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
    setGender(canonGender(data.gender));
    setDateOfBirth(data.dateOfBirth || "");

    setSpecialization(data.specialization || "");
    setYearsOfExperience(data.yearsOfExperience || "");
    setLicenseNb(data.licenseNb || "");
    setClinicName(data.clinicName || "");
    setClinicAddress(data.clinicAddress || "");
    
    setPhone(data.phoneNumber || "");
    setEmail(data.email || "");

    setIsEditing(false);
  } catch (err) {
    console.error(err);
    alert("Network error while saving profile.");
  }
}


    function handleCancel() {
        setIsEditing(false);
        setFirstName(localStorage.getItem("firstName") || "");
        setLastName(localStorage.getItem("lastName") || "");
        setGender(localStorage.getItem("gender") || "");
        setDateOfBirth(localStorage.getItem("dateOfBirth") || "");

        setEmail(localStorage.getItem("email") || "");
        setPhone(localStorage.getItem("phone") || "");

        setSpecialization(localStorage.getItem("specialization") || "");
        setYearsOfExperience(localStorage.getItem("yearsOfExperience") || "");
        setLicenseNb(localStorage.getItem("licenseNb") || "");
        setClinicName(localStorage.getItem("clinicName") || "");
        setClinicAddress(localStorage.getItem("clinicAddress") || "");
    }

    return(
      <div className="min-h-screen bg-gradient-to-br pt-18 from-sky-50 via-white to-indigo-50">
          <Navbar/>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
          <div className="flex justify-between items-center">
            <div className="mt-6 rounded-2xl border border-white/60" >
              <h1 className="text-5xl mb-3 text-3xl font-black leading-[1.2] pb-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text inline-block">My Profile</h1>
              <p className=" text-slate-600 mb-5">
                Review and update your personal, medical, and contact information.
              </p>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-gradient-to-b from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 transition text-white rounded-lg hover:bg-sky-500 shadow"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 shadow"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 bg-slate-400 text-white rounded-lg hover:bg-slate-300 shadow"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center border border-slate-200 rounded-full w-40 h-40 overflow-hidden">
                <img
                className="w-full h-full object-cover object-center"
                src={canonGender(gender) === "Female" ? userFemale : userMale}
                alt="Profile"
                />
            </div>
          </div>

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
                <FormInput label="License Number" type="number" value={licenseNb} onChange={(e)=>setLicenseNb(e.target.value)} isEditing={isEditing} />
                <FormInput label="Clinic/Hospital Name" type="text" value={clinicName} onChange={(e)=>setClinicName(e.target.value)} isEditing={isEditing} />
                <FormInput label="Clinic/Hospital Address" type="text" value={clinicAddress} onChange={(e)=>setClinicAddress(e.target.value)} isEditing={isEditing} />
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
                <FormInput label="Phone Number" type="text" value={phone} onChange={(e)=>setPhone(e.target.value)} isEditing={isEditing} />
                <FormInput label="Email" type="text" value={email} onChange={(e)=>setEmail(e.target.value)} isEditing={isEditing} />
              </div>
            </section>
          </div>
        </div>
      </div>
    );
}