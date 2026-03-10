import { apiUrl } from "./api/http";
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
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch(`${apiUrl}/health`)
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
        <Route path="/loginPage" element={<LoginPage />} />

        <Route
          path="/dashboardPatient"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <DashboardPatient />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboardDoctor"
          element={
            <ProtectedRoute allowedRoles={["doctor"]}>
              <DashboardDoctor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboardCaregiver"
          element={
            <ProtectedRoute allowedRoles={["caregiver"]}>
              <DashboardCaregiver />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profilePatient"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <ProfilePatient />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profileDoctor"
          element={
            <ProtectedRoute allowedRoles={["doctor"]}>
              <ProfileDoctor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profileCaregiver"
          element={
            <ProtectedRoute allowedRoles={["caregiver"]}>
              <ProfileCaregiver />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medication"
          element={
            <ProtectedRoute allowedRoles={["patient", "caregiver"]}>
              <Medication />
            </ProtectedRoute>
          }
        />
        <Route
          path="/symptoms"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <Symptoms />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctorAppointments"
          element={
            <ProtectedRoute allowedRoles={["doctor"]}>
              <DoctorAppointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patientAppointments"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <PatientAppointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctorMessages"
          element={
            <ProtectedRoute allowedRoles={["doctor"]}>
              <DoctorMessages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patientMessages"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <PatientMessages />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
