import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function FormInput({ label, type="text", value, onChange, isEditing, options }) {
  return (
    <div className="w-full flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {options ? (
        <div className="relative">
            <select
                value={value}
                onChange={onChange}
                disabled={!isEditing}
                className="w-full px-3 py-2 pr-10 border border-slate-100 rounded-lg bg-slate-100 hover:bg-slate-200 transition text-slate-600
            focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500 focus:text-sky-700
            appearance-none"
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
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={!isEditing}
        className="w-full px-3 py-2 border border-slate-100 rounded-lg bg-slate-100 text-slate-600 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500 focus:text-sky-700"
      />
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
        try{
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
        } catch(err){
            console.error(err)
        }
    }, []);

    function handleSave() {
        try {
            localStorage.setItem("firstName", firstName);
            localStorage.setItem("lastName", lastName);
            localStorage.setItem("email", email);
            localStorage.setItem("phone", phone);
            localStorage.setItem("gender", gender);
            localStorage.setItem("dateOfBirth", dateOfBirth);
            localStorage.setItem("allergies", allergies);
            localStorage.setItem("conditions", conditions);
            localStorage.setItem("bloodType", bloodType);
            localStorage.setItem("emName", emName);
            localStorage.setItem("relationship", relationship);
            localStorage.setItem("emPhone", emPhone);

            setIsEditing(false);
        } catch(err) {
            console.error(err);
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
        <div className="min-h-screen bg-[#e6f7ff] p-4">
            <header className="max-w-6xl mx-auto mb-6">
                <button 
                    onClick={() => navigate('/dashboardPatient')}
                    className="text-slate-700 hover:underline cursor-pointer font-semibold mb-3">
                    ← Back
                </button>
                <h1 className="text-3xl font-bold text-center text-slate-600">My Profile</h1>
            </header>
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-semibold text-slate-800">Personal Information</h2>
                    {!isEditing ? (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-500">
                            Edit
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleSave}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500">
                                Save
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-4 py-2 bg-slate-400 text-white rounded-lg hover:bg-slate-300">
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                        <FormInput label="First Name" type="text" value={firstName} onChange={(e)=>setFirstName(e.target.value)} isEditing={isEditing} />
                        <FormInput label="Last Name" type="text" value={lastName} onChange={(e)=>setLastName(e.target.value)} isEditing={isEditing} />  
                    </div>
                    <div className="flex gap-3">
                        <FormInput label="Gender" type="text" value={gender} onChange={(e)=>setGender(e.target.value)} isEditing={isEditing} options={["Male", "Female", "Prefer not to say"]} />
                        <FormInput label="Date of Birth" type="text" value={dateOfBirth} onChange={(e)=>setDateOfBirth(e.target.value)} isEditing={isEditing} />  
                    </div>
                </div>
            </div>
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="max-w-6xl mx-auto mb-6 text-xl font-semibold text-slate-800">Medical Information</h2>
                <div className="flex flex-col gap-3"> 
                    <FormInput label="Allergies" type="textarea" value={allergies} onChange={(e)=>setAllergies(e.target.value)} isEditing={isEditing} />
                    <FormInput label="Chronic Conditions" type="textarea" value={conditions} onChange={(e)=>setConditions(e.target.value)} isEditing={isEditing} />
                    <FormInput label="Blood Type" type="text" value={bloodType} onChange={(e)=>setBloodType(e.target.value)} isEditing={isEditing} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} />
                </div>
            </div>
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="max-w-6xl mx-auto mb-6 text-xl font-semibold text-slate-800">Contact Information</h2>
                <div className="flex flex-col gap-3"> 
                    <FormInput label="Phone Number" type="text" value={phone} onChange={(e)=>setPhone(e.target.value)} isEditing={isEditing} />
                    <FormInput label="Email" type="text" value={email} onChange={(e)=>setEmail(e.target.value)} isEditing={isEditing} />
                    
                </div>
            </div>
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6 mt-6">
                <h2 className="max-w-6xl mx-auto mb-6 text-xl font-semibold text-slate-800">Emergency Contact</h2>
                <div className="flex flex-col gap-3"> 
                    <FormInput label="Emergency Contact Name" type="textarea" value={emName} onChange={(e)=>setEmName(e.target.value)} isEditing={isEditing} />
                    <FormInput label="Relationship" type="textarea" value={relationship} onChange={(e)=>setRelationship(e.target.value)} isEditing={isEditing} />
                    <FormInput label="Phone Number" type="text" value={emPhone} onChange={(e)=>setEmPhone(e.target.value)} isEditing={isEditing} />
                </div>
            </div>
        </div>
    );
}