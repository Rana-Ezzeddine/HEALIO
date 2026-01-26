import { useEffect, useState } from "react";

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
      <h1>Healio Frontend</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;
