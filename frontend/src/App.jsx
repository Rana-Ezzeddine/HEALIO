import { apiUrl, authHeaders } from "./api/http";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPatient from "./pages/DashboardPatient";
import DashboardDoctor from "./pages/DashboardDoctor";
import ProfilePatient from "./pages/ProfilePatient";
import Medication from "./pages/Medication";

function App() {
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
      {/* Debug banner (optional) */}
      <div className="fixed bottom-3 right-3 rounded-xl bg-black/80 px-3 py-2 text-sm text-white">
        {message}
      </div>

      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboardPatient" element={<DashboardPatient />} />
        <Route path="/dashboardDoctor" element={<DashboardDoctor />} />
      <Route path="/medication" element={<Medication />}/>
        <Route path="/profilePatient" element={<ProfilePatient />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
