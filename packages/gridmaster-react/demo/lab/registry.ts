/// <reference types="vite/client" />
// Scenario registry. Every file in ./scenarios/ exports `scenario` (built with defineScenario);
// adding a scenario = create that one file, nothing to edit here. Order comes from `scenario.order`.
import type { ScenarioDef } from "./kit";

const modules = import.meta.glob<{ scenario: ScenarioDef }>("./scenarios/*.tsx", { eager: true });

export const scenarios: ScenarioDef[] = Object.values(modules)
  .map((mod) => mod.scenario)
  .sort((a, b) => a.order - b.order);
