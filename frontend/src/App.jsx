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
import SocialAuthCompletePage from "./pages/SocialAuthCompletePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SupportPage from "./pages/SupportPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import DoctorApprovedRoute from "./components/DoctorApprovedRoute";
import DoctorApprovalStatusPage from "./pages/DoctorApprovalStatusPage";
import DoctorReviewPage from "./pages/DoctorReviewPage";
import { getPostAuthRoute } from "./utils/authRouting";

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

      const target = getPostAuthRoute(user);
      const currentPath = location.pathname.toLowerCase();
      const isAuthPage =
        currentPath === "/" ||
        currentPath.startsWith("/signup") ||
        currentPath.startsWith("/loginpage") ||
        currentPath.startsWith("/forgot-password") ||
        currentPath.startsWith("/reset-password") ||
        currentPath.startsWith("/verify-email") ||
        currentPath.startsWith("/social-auth-complete");

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

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    const hasHash = Boolean(location.hash);
    if (hasHash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.hash]);

  return null;
}

function RoutedApp() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="route-enter">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/loginPage" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/social-auth-complete" element={<SocialAuthCompletePage />} />
        <Route
          path="/doctor-approval-status"
          element={
            <ProtectedRoute allowedRoles={["doctor"]}>
              <DoctorApprovalStatusPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor-review"
          element={
            <ProtectedRoute>
              <DoctorReviewPage />
            </ProtectedRoute>
          }
        />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

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
            <DoctorApprovedRoute>
              <DashboardDoctor />
            </DoctorApprovedRoute>
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
            <DoctorApprovedRoute>
              <DoctorAppointments />
            </DoctorApprovedRoute>
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
            <DoctorApprovedRoute>
              <DoctorMessages />
            </DoctorApprovedRoute>
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
    </div>
  );
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
      <ScrollToTop />
      <div className="fixed bottom-3 right-3 rounded-xl bg-black/80 px-3 py-2 text-sm text-white">
        {message}
      </div>
      <RoutedApp />
    </BrowserRouter>
  );
}
