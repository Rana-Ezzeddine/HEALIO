import { apiUrl, authHeaders } from "../api/http";
import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

export default function ProfilePatient(){
    const [isEditing, setIsEditing] = useState(false);
    const navigate = useNavigate();

    //personal info
    const[firstName, setFirstName] = useState("");
    const[lastName, setLastName] = useState("");
    const[dateOfBirth, setDateOfBirth] = useState("");
    const[gender, setGender] = useState("");

    //medical info
    const[allergies, setAllergies] = useState("");
    const[conditions, setConditions] = useState("");
    const[bloodType, setBloodType] = useState("");

    //contact info
    const[email, setEmail] = useState("");
    const[phone, setPhone] = useState("");

    //emergency contact
    const[emName, setEmName] = useState("");
    const[relationship, setRelationship] = useState("");
    const[emPhone, setEmPhone] = useState("");
    

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
      setBloodType(p.bloodType || "");
      setPhone(p.phoneNumber || "");
      setEmail(p.email || "");

      setAllergies((p.allergies || []).join(", "));
      setConditions((p.chronicConditions || []).join(", "));

      setEmName(p.emergencyContact?.name || "");
      setRelationship(p.emergencyContact?.relationship || "");
      setEmPhone(p.emergencyContact?.phoneNumber || "");
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
      bloodType,
      phoneNumber: phone,
      email,
      allergies: allergies
        ? allergies.split(",").map((x) => x.trim()).filter(Boolean)
        : [],
      chronicConditions: conditions
        ? conditions.split(",").map((x) => x.trim()).filter(Boolean)
        : [],
      emergencyContact: {
        name: emName,
        relationship,
        phoneNumber: emPhone,
      },
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
    setBloodType(data.bloodType || "");
    setPhone(data.phoneNumber || "");
    setEmail(data.email || "");
    setAllergies((data.allergies || []).join(", "));
    setConditions((data.chronicConditions || []).join(", "));
    setEmName(data.emergencyContact?.name || "");
    setRelationship(data.emergencyContact?.relationship || "");
    setEmPhone(data.emergencyContact?.phoneNumber || "");

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
        setEmail(localStorage.getItem("email") || "");
        setPhone(localStorage.getItem("phone") || "");
        setGender(localStorage.getItem("gender") || "");
        setDateOfBirth(localStorage.getItem("dateOfBirth") || "");
        setAllergies(localStorage.getItem("allergies") || "");
        setConditions(localStorage.getItem("conditions") || "");
        setBloodType(localStorage.getItem("bloodType") || "");
        setEmName(localStorage.getItem("emName") || "");
        setRelationship(localStorage.getItem("relationship") || "");
        setEmPhone(localStorage.getItem("emPhone") || "");
    }

    return(
      <div className="min-h-screen bg-gradient-to-br pt-20 from-sky-50 via-white to-indigo-50">
        <Navbar
          onLogin={() => setAuthView("login")}
          onSignup={() => setAuthView("signup")}
        />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => navigate("/dashboardPatient")}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold"
            >
              <span className="text-xl">←</span> Back to Dashboard
            </button>

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

          <div className="mt-6 rounded-2xl border border-white/60 text-center" >
            <h1 className="text-5xl mb-3 text-3xl font-bold leading-[1.2] pb-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text inline-block">My Profile</h1>
            <p className="mt-2 text-slate-600 mb-10">
              Review and update your personal, medical, and contact information.
            </p>
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
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Medical Information</h2>
              <div className="grid grid-cols-1 gap-4"> 
                <FormInput label="Allergies" type="textarea" value={allergies} onChange={(e)=>setAllergies(e.target.value)} isEditing={isEditing} />
                <FormInput label="Chronic Conditions" type="textarea" value={conditions} onChange={(e)=>setConditions(e.target.value)} isEditing={isEditing} />
                <FormInput label="Blood Type" type="text" value={bloodType} onChange={(e)=>setBloodType(e.target.value)} isEditing={isEditing} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
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
              <h2 className="text-xl font-semibold text-slate-800 mb-4">Emergency Contact</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
                <FormInput label="Emergency Contact Name" type="text" value={emName} onChange={(e)=>setEmName(e.target.value)} isEditing={isEditing} />
                <FormInput label="Relationship" type="text" value={relationship} onChange={(e)=>setRelationship(e.target.value)} isEditing={isEditing} />
                <FormInput label="Phone Number" type="text" value={emPhone} onChange={(e)=>setEmPhone(e.target.value)} isEditing={isEditing} />
              </div>
            </section>
          </div>
        </div>
      </div>
    );
}