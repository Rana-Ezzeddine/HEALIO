import { Navigate } from "react-router-dom";
import { getToken, getUser } from "../api/http";
import { needsDoctorApprovalHold } from "../utils/authRouting";

export default function DoctorApprovedRoute({ children }) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    return <Navigate to="/loginPage" replace />;
  }

  if (user.role !== "doctor") {
    return <Navigate to="/" replace />;
  }

  if (needsDoctorApprovalHold(user)) {
    return <Navigate to="/doctor-approval-status" replace />;
  }

  return children;
}
