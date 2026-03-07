import { Navigate } from "react-router-dom";
import { getToken, getUser } from "../api/http";

export default function ProtectedRoute({ allowedRoles, children }) {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
        return <Navigate to="/loginPage" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return children;
}