import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ProfilePatient(){
    const [isEditing, setIsEditing] = useState(false);
    const navigate = useNavigate();
    const[firstName, setFirstName] = useState("");
    const[lastName, setLastName] = useState("");
    const[email, setEmail] = useState("");
    const[phone, setPhone] = useState("");
    const[address, setAddress] = useState("");

    useEffect(() => {
        try{
            setFirstName(localStorage.getItem("firstName") || "");
            setLastName(localStorage.getItem("lastName") || "");
            setEmail(localStorage.getItem("email") || "");
            setPhone(localStorage.getItem("phone") || "");
            setAddress(localStorage.getItem("address") || "");
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
            localStorage.setItem("address", address);
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
        setAddress(localStorage.getItem("address") || "");
    }

    return(
        <div className="min-h-screen bg-gradient-to-b from-[#e6f7ff] to-[#cce9ff] p-6">
            <header className="max-w-6xl mx-auto mb-6">
                <button 
                    onClick={() => navigate('/dashboardPatient')}
                    className="text-white hover:underline cursor-pointer font-semibold mb-3">
                    ← Back
                </button>
                <h1 className="text-3xl font-bold text-center text-slate-800">My Profile</h1>
            </header>
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-slate-800">Profile Information</h2>
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
                        <div className="w-full flex flex-col gap-1">
                            <label className="text-sm font-medium text-slate-700">First Name</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e)=>setFirstName(e.target.value)}
                                disabled={!isEditing}
                                className="w-full px-3 py-2 border rounded-lg border-slate-500 text-slate-600 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500 focus:text-sky-700"
                            />
                        </div>
                        <div className="w-full flex flex-col gap-1">
                            <label className="text-sm font-medium text-slate-700">Last Name</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e)=>setLastName(e.target.value)}
                                disabled={!isEditing}
                                className="w-full px-3 py-2 border rounded-lg border-slate-500 text-slate-600 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500 focus:text-sky-700"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-full flex flex-col gap-1">
                            <label className="text-sm font-medium text-slate-700">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e)=>setEmail(e.target.value)}
                                    disabled={!isEditing}
                                    className="w-full px-3 py-2 border rounded-lg border-slate-500 text-slate-600 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500 focus:text-sky-700"
                                />
                        </div>
                        <div className="w-full flex flex-col gap-1">
                            <label className="text-sm font-medium text-slate-700">Phone</label>
                            <input
                                type="text"
                                value={phone}
                                onChange={(e)=>setPhone(e.target.value)}
                                disabled={!isEditing}
                                className="w-full px-3 py-2 border rounded-lg border-slate-500 text-slate-600 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500 focus:text-sky-700"
                            />
                        </div>
                    </div>
                    <div className="w-full flex flex-col gap-1">
                        <label className="text-sm font-medium text-slate-700">Address</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e)=>setAddress(e.target.value)}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border rounded-lg border-slate-500 text-slate-600 focus:ring-2 focus:outline-none focus:border-sky-500 focus:ring-sky-500 focus:text-sky-700"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}