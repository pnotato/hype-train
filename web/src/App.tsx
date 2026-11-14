import { useEffect, useState } from "react";

type Health = { status: string; brain: string };

export default function App() {
  const [health, setHealth] = useState<Health | string>("checking…");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? (res.json() as Promise<Health>) : Promise.reject(res.status)))
      .then(setHealth)
      .catch(() => setHealth("server unreachable"));
  }, []);

  return (
    <main>
      <span className="simulated">SIMULATED</span>
      <h1>Hype Train</h1>
      <p>
        Server: {typeof health === "string" ? health : `${health.status} (brain: ${health.brain})`}
      </p>
    </main>
  );
}
