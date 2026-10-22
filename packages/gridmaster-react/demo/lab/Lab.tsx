// Feature Lab shell: sidebar of scenarios (hash routed), header, reset button.
// Language: TypeScript 6 (strict), React 19.
import { useSyncExternalStore } from "react";
import { LIB_VERSION, resetAllChecks, scenarioProgress, useChecksVersion } from "./kit";
import { scenarios } from "./registry";

function currentId(): string {
  const match = /^#\/([\w-]+)/.exec(window.location.hash);
  return match?.[1] ?? scenarios[0].id;
}

function subscribeHash(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export default function Lab() {
  const id = useSyncExternalStore(subscribeHash, currentId);
  useChecksVersion();
  const active = scenarios.find((s) => s.id === id) ?? scenarios[0];
  const areas = scenarios.map((s) => s.area).filter((area, i, all) => all.indexOf(area) === i);
  const Active = active.Component;

  return (
    <div className="lab-shell">
      <header className="lab-header">
        <h1>GridMaster Feature Lab</h1>
        <span className="lab-badge" data-testid="lib-version">
          gridmaster-react v{LIB_VERSION}
        </span>
        <span className="lab-muted lab-note">
          Everything here is a manual test bed; events appear in the log
        </span>
        <button type="button" onClick={resetAllChecks}>
          Reset all checks
        </button>
      </header>
      <div className="lab-main">
        <nav className="lab-sidebar" aria-label="Scenarios">
          {areas.map((area) => (
            <div key={area} className="lab-area">
              <h2>{area}</h2>
              <ul>
                {scenarios
                  .filter((s) => s.area === area)
                  .map((s) => {
                    const { done, total } = scenarioProgress(s);
                    return (
                      <li key={s.id}>
                        <a
                          href={`#/${s.id}`}
                          aria-current={s.id === active.id ? "page" : undefined}
                          className={s.id === active.id ? "active" : undefined}
                        >
                          <span>{s.title}</span>
                          <span
                            className={done === total && total > 0 ? "lab-badge ok" : "lab-badge"}
                          >
                            {done}/{total}
                          </span>
                        </a>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>
        <main className="lab-content" key={active.id}>
          <Active />
        </main>
      </div>
    </div>
  );
}
