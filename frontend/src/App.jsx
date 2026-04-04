import { apiUrl, clearSession, getToken, getUser, updateSessionUser } from "./api/http";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPatient from "./pages/DashboardPatient";
import DashboardDoctor from "./pages/DashboardDoctor";
import DashboardCaregiver from "./pages/DashboardCaregiver";
import HealthSummaryPatient from "./pages/HealthSummaryPatient";
import ProfilePatient from "./pages/ProfilePatient";
import ProfileDoctor from "./pages/ProfileDoctor";
import ProfileCaregiver from "./pages/ProfileCaregiver";
import Medication from "./pages/medication";
import LandingPage from "./pages/LandingPage";
import Symptoms from "./pages/Symptoms";
import PatientMessages from "./pages/PatientMessages";
import PatientNotificationCenter from "./pages/PatientNotificationCenter";
import CaregiverMessages from "./pages/CaregiverMessages";
import DoctorAppointments from "./pages/DoctorAppointments";
import PatientAppointments from "./pages/PatientAppointments";
import CaregiverAppointments from "./pages/CaregiverAppointments";
import CaregiverCareNotes from "./pages/CaregiverCareNotes";
import CareTeamPatient from "./pages/CareTeamPatient";
import PatientEmergency from "./pages/PatientEmergency";
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
import DoctorPatients from "./pages/DoctorPatients";
import DoctorLinkRequests from "./pages/DoctorLinkRequests";
import DoctorPatientDetail from "./pages/DoctorPatientDetail";
import DoctorClinicalNotes from "./pages/DoctorClinicalNotes";
import DoctorTreatmentPlans from "./pages/DoctorTreatmentPlans";
import CaregiverPatients from "./pages/CaregiverPatients";
import { getPostAuthRoute } from "./utils/authRouting";
import CaregiverOnboarding from "./pages/CaregiverOnboarding";
import CareTeam from "./pages/CareTeam";
import CaregiverMyPatients from "./pages/CaregiverMyPatients";
import CareNotes from "./pages/CareNotes";
import CaregiverAcceptInvite from "./pages/CaregiverAcceptInvite";
import CaregiverMedications from "./pages/CaregiverMedications";
import CaregiverSymptoms from "./pages/CaregiverSymptoms";
import CaregiverCareConcern from "./pages/CaregiverCareConcern";



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
            <ProtectedRoute allowedRoles={["reviewer", "admin"]}>
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
          path="/healthSummary"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <HealthSummaryPatient />
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
          path="/doctor-patients"
          element={
            <DoctorApprovedRoute>
              <DoctorPatients />
            </DoctorApprovedRoute>
          }
        />
        <Route
          path="/doctor-patients/requests"
          element={
            <DoctorApprovedRoute>
              <DoctorLinkRequests />
            </DoctorApprovedRoute>
          }
        />
        <Route
          path="/doctor-patients/:patientId"
          element={
            <DoctorApprovedRoute>
              <DoctorPatientDetail />
            </DoctorApprovedRoute>
          }
        />
        <Route
          path="/doctor-clinical-notes"
          element={
            <DoctorApprovedRoute>
              <DoctorClinicalNotes />
            </DoctorApprovedRoute>
          }
        />
        <Route
          path="/doctor-treatment-plans"
          element={
            <DoctorApprovedRoute>
              <DoctorTreatmentPlans />
            </DoctorApprovedRoute>
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
          path="/caregiverAppointments"
          element={
            <ProtectedRoute allowedRoles={["caregiver"]}>
              <CaregiverAppointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/caregiverNotes"
          element={
            <ProtectedRoute allowedRoles={["caregiver"]}>
              <CaregiverCareNotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/care-team"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <CareTeamPatient />
            </ProtectedRoute>
          }
        />
        <Route
          path="/emergency"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <PatientEmergency />
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


        <Route path="/caregiverOnboarding" element={<ProtectedRoute allowedRoles={["caregiver"]}><CaregiverOnboarding /></ProtectedRoute>} />
        
        <Route path="/careTeam" element={<ProtectedRoute allowedRoles={["patient"]}><CareTeam /></ProtectedRoute>} />
        <Route path="/caregiverMyPatients" element={<ProtectedRoute allowedRoles={["caregiver"]}><CaregiverMyPatients /></ProtectedRoute>} />
        <Route path="/careNotes" element={<ProtectedRoute allowedRoles={["caregiver"]}><CareNotes /></ProtectedRoute>} />

        <Route
          path="/patient-notifications"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <PatientNotificationCenter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/caregiverMessages"
          element={
            <ProtectedRoute allowedRoles={["caregiver"]}>
              <CaregiverMessages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/caregiver-patients"
          element={
            <ProtectedRoute allowedRoles={["caregiver"]}>
              <CaregiverPatients />
            </ProtectedRoute>
          }
        />
        <Route path="/caregiverAcceptInvite" element={<CaregiverAcceptInvite />} />
        <Route path="/caregiverMedications" element={<ProtectedRoute allowedRoles={["caregiver"]}><CaregiverMedications /></ProtectedRoute>} />
        <Route path="/caregiverSymptoms" element={<ProtectedRoute allowedRoles={["caregiver"]}><CaregiverSymptoms /></ProtectedRoute>} />
        <Route path="/caregiverCareConcern" element={<ProtectedRoute allowedRoles={["caregiver"]}><CaregiverCareConcern /></ProtectedRoute>} />
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
