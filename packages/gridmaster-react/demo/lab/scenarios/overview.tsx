// Scenario: landing page. Language: TypeScript 6 (strict), React 19.
// Imports the registry only to read it at render time (the registry also imports this file).
import { useState } from "react";
import {
  type Check,
  LIB_VERSION,
  copyText,
  defineScenario,
  scenarioProgress,
  useChecksVersion,
} from "../kit";
import { scenarios } from "../registry";

const checks: Check[] = [
  {
    do: "Click a scenario name in the table below.",
    expect: "The page switches to that scenario and the address bar shows #/<id>; reloading keeps you there.",
  },
  {
    do: "Tick one checkbox in any scenario, then return here.",
    expect: "Its row in the table shows the new progress, and the sidebar badge matches.",
  },
  {
    do: 'Press "Reset all checks" in the header.',
    expect: "Every checkbox is cleared and all progress counters go back to 0.",
  },
];

function Body() {
  useChecksVersion();
  const [status, setStatus] = useState("");
  const copyEnv = async () => {
    const info = `gridmaster-react v${LIB_VERSION}\n${navigator.userAgent}\nlab: ${window.location.href}`;
    const error = await copyText(info);
    setStatus(error ? `Copy failed: ${error}` : "Copied environment info");
  };

  return (
    <div className="lab-demo">
      <div className="lab-panel">
        <h3>What this is</h3>
        <p>
          The Feature Lab is a manual test bed for <b>gridmaster-react v{LIB_VERSION}</b>. Each scenario mounts
          the grid with the relevant props and gives you a checklist of &ldquo;Try this &rarr; Expect that&rdquo;
          steps. Ticks are remembered in this browser. It is a dev tool and is not part of the published package.
        </p>
      </div>
      <table className="lab-table">
        <thead>
          <tr>
            <th>Area</th>
            <th>Scenario</th>
            <th>Checks passed</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => {
            const { done, total } = scenarioProgress(s);
            return (
              <tr key={s.id}>
                <td>{s.area}</td>
                <td>
                  <a href={`#/${s.id}`}>{s.title}</a>
                </td>
                <td>
                  {done} / {total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="lab-panel">
        <h3>How to report a bug</h3>
        <ol>
          <li>Note the scenario, the check you were on, and what you saw instead of the expectation.</li>
          <li>
            Use <b>Copy log</b> under the grid to copy the event log, and the button below for browser/version info.
          </li>
          <li>Paste both into the issue, with a screenshot if it is visual.</li>
        </ol>
        <button type="button" onClick={copyEnv}>
          Copy environment info
        </button>{" "}
        <span className="lab-muted">{status}</span>
      </div>
    </div>
  );
}

export const scenario = defineScenario({
  id: "overview",
  area: "Start",
  order: 0,
  title: "Overview",
  summary: "What the lab is, progress across all scenarios, and how to report a bug.",
  checks,
  Body,
});
