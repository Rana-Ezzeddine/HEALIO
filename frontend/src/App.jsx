import { apiUrl, authHeaders } from "./api/http";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPatient from "./pages/DashboardPatient";
import DashboardDoctor from "./pages/DashboardDoctor";
import DashboardCaregiver from "./pages/DashboardCaregiver";
import ProfilePatient from "./pages/ProfilePatient";
import ProfileDoctor from "./pages/ProfileDoctor";
import ProfileCaregiver from "./pages/ProfileCaregiver";
import Medication from "./pages/medication";
import LandingPage from "./pages/LandingPage";
import Symptoms from "./pages/Symptoms";
import DoctorMessages from "./pages/DoctorMessages";
import PatientMessages from "./pages/PatientMessages";
import DoctorAppointments from "./pages/DoctorAppointments";
import PatientAppointments from "./pages/PatientAppointments";

export default function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";


fetch(`${apiUrl}/api/symptoms`, {
  headers: {
    ...authHeaders(),
  },
})
    .then((res) => res.json())
    .then((data) => setMessage(`Symptoms loaded: ${data.length}`))
    .catch(() => setMessage("Backend not reachable"));
}, []);

useEffect(() => {
    fetch("http://localhost:5050/health")
      .then((res) => res.json())
      .then((data) => setMessage(`Status: ${data.status}`))
      .catch(() => setMessage("Backend not reachable"));
  }, []);

  return (
    <BrowserRouter>
      <div className="fixed bottom-3 right-3 rounded-xl bg-black/80 px-3 py-2 text-sm text-white">
        {message}
      </div>
      
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboardPatient" element={<DashboardPatient />} />
        <Route path="/dashboardDoctor" element={<DashboardDoctor />} />
        <Route path="/dashboardCaregiver" element={<DashboardCaregiver />} />
        <Route path="/loginPage" element={<LoginPage />} />
        <Route path="/medication" element={<Medication />}/>
        <Route path="/profilePatient" element={<ProfilePatient />} />
        <Route path="/profileDoctor" element={<ProfileDoctor />} />
        <Route path="/profileCaregiver" element={<ProfileCaregiver />} />
        <Route path="/symptoms" element={<Symptoms />} />
        <Route path="/doctorAppointments" element={<DoctorAppointments />} />
        <Route path="/patientAppointments" element={<PatientAppointments />} />
        <Route path="/doctorMessages" element={<DoctorMessages />} />
        <Route path="/patientMessages" element={<PatientMessages />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
