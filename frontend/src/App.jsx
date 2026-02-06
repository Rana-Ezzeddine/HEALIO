import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import DashboardPatient from "./pages/DashboardPatient";
import DashboardDoctor from "./pages/DashboardDoctor";
import ProfilePatient from "./pages/ProfilePatient";

export default function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch("http://localhost:5050/health")
      .then((res) => res.json())
      .then((data) => setMessage(`Status: ${data.status}`))
      .catch(() => setMessage("Backend not reachable"));
  }, []);

  return (
    <BrowserRouter>
      <div className="fixed bottom-3 right-3 z-50 rounded-xl bg-black/80 px-3 py-2 text-sm text-white">
        {message}
      </div>

      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/dashboardPatient" element={<DashboardPatient />} />
        <Route path="/dashboardDoctor" element={<DashboardDoctor />} />
        <Route path="/profilePatient" element={<ProfilePatient />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
