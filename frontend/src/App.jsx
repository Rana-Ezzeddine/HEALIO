import { useEffect, useState } from "react";
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom"
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPatient from "./pages/DashboardPatient";
import DashboardDoctor from "./pages/DashboardDoctor";
import ProfilePatient from "./pages/ProfilePatient";
function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch("http://localhost:5050/health")
      .then((res) => res.json())
      .then((data) => setMessage(`Status: ${data.status}`))
      .catch(() => setMessage("Backend not reachable"));
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
       <BrowserRouter>
    <Routes>
      <Route path="/" element={<LoginPage />}/>
      <Route path="/signup" element={<SignupPage />}/>
      <Route path="/dashboardPatient" element={<DashboardPatient />}/>
      <Route path="/dashboardDoctor" element={<DashboardDoctor />}/>
      <Route path="/profilePatient" element={<ProfilePatient />}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
    </BrowserRouter>
      <h1>Healio Frontend</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;