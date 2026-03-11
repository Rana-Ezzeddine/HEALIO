import { apiUrl, clearSession, getToken, getUser, updateSessionUser } from "./api/http";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

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
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ProtectedRoute from "./components/ProtectedRoute";

function AuthSync() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function syncAuthFromStorage(event) {
      if (
        event.key &&
        !["accessToken", "user", "userRole", "firstName", "lastName", "healio:auth-sync"].includes(event.key)
      ) {
        return;
      }

      const token = getToken();
      const user = getUser();
      if (!token || !user) return;

      const dashboardPathByRole = {
        doctor: "/dashboardDoctor",
        patient: "/dashboardPatient",
        caregiver: "/dashboardCaregiver",
      };
      const target = dashboardPathByRole[user?.role] || "/dashboardPatient";
      const currentPath = location.pathname.toLowerCase();
      const isAuthPage =
        currentPath === "/" ||
        currentPath.startsWith("/signup") ||
        currentPath.startsWith("/loginpage") ||
        currentPath.startsWith("/verify-email");

      if (isAuthPage) {
        navigate(target, { replace: true });
      }
    }

    function syncWithoutEvent() {
      syncAuthFromStorage({});
    }

    syncWithoutEvent();
    window.addEventListener("storage", syncAuthFromStorage);
    window.addEventListener("focus", syncWithoutEvent);
    document.addEventListener("visibilitychange", syncWithoutEvent);

    return () => {
      window.removeEventListener("storage", syncAuthFromStorage);
      window.removeEventListener("focus", syncWithoutEvent);
      document.removeEventListener("visibilitychange", syncWithoutEvent);
    };
  }, [location.pathname, navigate]);

  return null;
}

export default function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    // Drop legacy persisted auth so a fresh browser session starts at landing/login.
    if (!window.sessionStorage.getItem("accessToken")) {
      clearSession();
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;

    fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Failed to refresh session.");
        }
        return data;
      })
      .then((data) => {
        if (cancelled || !data?.user) return;
        updateSessionUser(data.user);
      })
      .catch((err) => {
        console.error("Session refresh failed:", err);
        clearSession();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => setMessage(`Status: ${data.status}`))
      .catch(() => setMessage("Backend not reachable"));
  }, []);

  return (
    <BrowserRouter>
      <AuthSync />
      <div className="fixed bottom-3 right-3 rounded-xl bg-black/80 px-3 py-2 text-sm text-white">
        {message}
      </div>

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/loginPage" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

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
