import { useEffect, useState } from "react";
import ShapeSandbox from "./town/shape-sandbox.tsx";
import SpreadSandbox from "./town/spread-sandbox.tsx";
import TownScene from "./town/town-scene.tsx";

// ?shapes and ?spread open the sandboxes instead of the town.
const params = new URLSearchParams(location.search);
const page = params.has("shapes") ? "shapes" : params.has("spread") ? "spread" : "town";

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
    <>
      {page === "shapes" ? <ShapeSandbox /> : page === "spread" ? <SpreadSandbox /> : <TownScene />}
      <main className="overlay">
        <span className="simulated">SIMULATED</span>
        <p>
          Server:{" "}
          {typeof health === "string" ? health : `${health.status} (brain: ${health.brain})`}
        </p>
        <nav className="pages" aria-label="Pages">
          <a href="/" aria-current={page === "town" ? "page" : undefined}>
            Town
          </a>
          <a href="/?shapes" aria-current={page === "shapes" ? "page" : undefined}>
            Shapes
          </a>
          <a href="/?spread" aria-current={page === "spread" ? "page" : undefined}>
            Spread
          </a>
        </nav>
      </main>
    </>
  );
}
