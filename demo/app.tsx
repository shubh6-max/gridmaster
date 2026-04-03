import React, { useState } from "react";
import { GridMaster, createColumn } from "../src";
import "./demo.css";

const REGION_OPTIONS = ["US", "LATAM", "EU", "APAC", "Middle-east", "ROW"] as const;

const BUSINESS_UNIT_OPTIONS = [
  "After sales",
  "Business Strategy",
  "Central Analytics",
  "Clinical",
  "Commercial",
  "Consumer",
  "Digital/ eComm",
  "Finance",
  "GenAI & Automation",
  "HR",
  "IT-Data",
  "Manufacturing",
  "Market access",
  "Marketing",
  "Medical affairs",
  "Merchandising/ Store",
  "Operations",
  "Others",
  "Patient Support",
  "Procurement",
  "Product Platform",
  "Program Management",
  "R&D & Product Development",
  "Retail Media",
  "Revenue",
  "Supply Chain",
] as const;

const SERVICE_LINE_OPTIONS = ["DAC", "Engg"] as const;

const CSL_OWNER_OPTIONS = [
  "Shashank Kagwad",
  "Ayush Jha",
  "Pradeep Varavoor",
  "Prashanth Sukumar",
  "Andy Shankar",
  "Srilekha Kundu",
  "Chandler Johnson",
  "Indu Somayajula",
  "Pawan Valudas",
  "Pradipt Das",
  "Vedant Prasad",
  "William D'Sousa",
  "Abhinav Saxena",
  "Jayeeta Sharma",
] as const;

const SALES_APPROACH_OPTIONS = ["Mining", "Farming"] as const;
const PURSUED_IN_PAST_OPTIONS = ["Yes", "No"] as const;
const STAKEHOLDER_STATUS_OPTIONS = [
  "DND",
  "Stakeholder",
  "M1 generated",
  "Grey Response",
  "Persued in Past",
  "Unsubscribe",
] as const;
const REACHOUT_LEVER_OPTIONS = ["Exec-Exec", "Volume"] as const;
const REACHOUT_CHANNEL_OPTIONS = ["Email", "Linkedin", "Email, Linkedin", "In-person"] as const;

type DemoRow = {
  id: number;
  account: string;
  clientName: string;
  clientDesignation: string;
  region: (typeof REGION_OPTIONS)[number];
  businessUnit: (typeof BUSINESS_UNIT_OPTIONS)[number];
  serviceLine: (typeof SERVICE_LINE_OPTIONS)[number];
  cslOwner: (typeof CSL_OWNER_OPTIONS)[number];
  salesApproach: (typeof SALES_APPROACH_OPTIONS)[number];
  linkedInUrl: string;
  location: string;
  contractorCount: number | null;
  pursuedInPast: (typeof PURSUED_IN_PAST_OPTIONS)[number];
  stakeholderStatus: (typeof STAKEHOLDER_STATUS_OPTIONS)[number];
  reachoutLever: (typeof REACHOUT_LEVER_OPTIONS)[number];
  reachoutChannel: (typeof REACHOUT_CHANNEL_OPTIONS)[number];
  reachoutDate: string;
  followUpScore: number | string | null;
  comments: string;
};

const columns = [
  createColumn.text<DemoRow>("account", {
    title: "Account",
    width: 210,
  }),
  createColumn.text<DemoRow>("clientName", {
    title: "Client Name",
    width: 170,
  }),
  createColumn.text<DemoRow>("clientDesignation", {
    title: "Client Designation",
    width: 180,
  }),
  createColumn.select<DemoRow>("region", {
    title: "Region",
    width: 120,
    options: [...REGION_OPTIONS],
  }),
  createColumn.select<DemoRow>("businessUnit", {
    title: "Business Unit (Function)",
    width: 220,
    options: [...BUSINESS_UNIT_OPTIONS],
  }),
  createColumn.select<DemoRow>("serviceLine", {
    title: "Service Line",
    width: 120,
    options: [...SERVICE_LINE_OPTIONS],
  }),
  createColumn.select<DemoRow>("cslOwner", {
    title: "CSL Owner",
    width: 170,
    options: [...CSL_OWNER_OPTIONS],
  }),
  createColumn.select<DemoRow>("salesApproach", {
    title: "Sales Approach",
    width: 140,
    options: [...SALES_APPROACH_OPTIONS],
  }),
  createColumn.link<DemoRow>("linkedInUrl", {
    title: "LinkedIn URL",
    width: 220,
  }),
  createColumn.text<DemoRow>("location", {
    title: "Location",
    width: 190,
  }),
  createColumn.number<DemoRow>("contractorCount", {
    title: "Contractor Count",
    width: 145,
  }),
  createColumn.select<DemoRow>("pursuedInPast", {
    title: "Pursued In Past",
    width: 140,
    options: [...PURSUED_IN_PAST_OPTIONS],
  }),
  createColumn.select<DemoRow>("stakeholderStatus", {
    title: "Stakeholder Status",
    width: 170,
    options: [...STAKEHOLDER_STATUS_OPTIONS],
  }),
  createColumn.select<DemoRow>("reachoutLever", {
    title: "Reachout Lever",
    width: 145,
    options: [...REACHOUT_LEVER_OPTIONS],
  }),
  createColumn.select<DemoRow>("reachoutChannel", {
    title: "Reachout Channel",
    width: 160,
    options: [...REACHOUT_CHANNEL_OPTIONS],
  }),
  createColumn.date<DemoRow>("reachoutDate", {
    title: "Reachout Date",
    width: 145,
  }),
  createColumn.number<DemoRow>("followUpScore", {
    title: "Follow-up Score",
    width: 145,
  }),
  createColumn.text<DemoRow>("comments", {
    title: "Comments",
    width: 280,
    wrap: true,
    hidden: true,
  }),
];

const initialRows = [
  {
    id: 1,
    account: "Northwind Retail",
    clientName: "Mara Lane",
    clientDesignation: "VP Merchandising Analytics",
    region: "US",
    businessUnit: "Merchandising/ Store",
    serviceLine: "DAC",
    cslOwner: "Shashank Kagwad",
    salesApproach: "Mining",
    linkedInUrl: "linkedin.com/in/mara-lane",
    location: "Bentonville, AR, US",
    contractorCount: 1,
    pursuedInPast: "Yes",
    stakeholderStatus: "Stakeholder",
    reachoutLever: "Exec-Exec",
    reachoutChannel: "Email",
    reachoutDate: "2026-04-08",
    followUpScore: '=IF(L1="Yes",K1*2,K1)',
    comments: "Workbook-inspired retail lead mirroring the LDB Template dropdown structure.",
  },
  {
    id: 2,
    account: "BluePeak Health",
    clientName: "Rhea Patel",
    clientDesignation: "Director, Patient Support",
    region: "LATAM",
    businessUnit: "Patient Support",
    serviceLine: "Engg",
    cslOwner: "Ayush Jha",
    salesApproach: "Farming",
    linkedInUrl: "linkedin.com/in/rhea-patel",
    location: "Sao Paulo, BR",
    contractorCount: 2,
    pursuedInPast: "No",
    stakeholderStatus: "M1 generated",
    reachoutLever: "Volume",
    reachoutChannel: "Linkedin",
    reachoutDate: "2026-04-11",
    followUpScore: '=IF(L2="Yes",K2*2,K2)',
    comments: "Second numeric row starts at 2 so fill-handle testing can continue 1, 2, 3, 4.",
  },
  {
    id: 3,
    account: "Atlas Mobility",
    clientName: "Jonas Weber",
    clientDesignation: "Senior Director, Supply Chain",
    region: "EU",
    businessUnit: "Supply Chain",
    serviceLine: "DAC",
    cslOwner: "Pradeep Varavoor",
    salesApproach: "Mining",
    linkedInUrl: "linkedin.com/in/jonas-weber",
    location: "Munich, DE",
    contractorCount: 4,
    pursuedInPast: "Yes",
    stakeholderStatus: "Grey Response",
    reachoutLever: "Exec-Exec",
    reachoutChannel: "Email, Linkedin",
    reachoutDate: "2026-04-14",
    followUpScore: '=IF(L3="Yes",K3*2,K3)',
    comments: "Use the formula bar on Follow-up Score to see the raw formula while the grid shows the result.",
  },
  {
    id: 4,
    account: "Harbor Energy",
    clientName: "Neel Rao",
    clientDesignation: "Head of Commercial Strategy",
    region: "APAC",
    businessUnit: "Commercial",
    serviceLine: "DAC",
    cslOwner: "Prashanth Sukumar",
    salesApproach: "Farming",
    linkedInUrl: "linkedin.com/in/neel-rao",
    location: "Singapore, SG",
    contractorCount: 6,
    pursuedInPast: "No",
    stakeholderStatus: "DND",
    reachoutLever: "Volume",
    reachoutChannel: "In-person",
    reachoutDate: "2026-04-18",
    followUpScore: null,
    comments: "Keep this Follow-up Score cell empty to test formula creation by typing = and clicking cells.",
  },
  {
    id: 5,
    account: "Summit Foods",
    clientName: "Priyanka Shah",
    clientDesignation: "Director, Consumer Analytics",
    region: "Middle-east",
    businessUnit: "Consumer",
    serviceLine: "Engg",
    cslOwner: "Andy Shankar",
    salesApproach: "Mining",
    linkedInUrl: "linkedin.com/in/priyanka-shah",
    location: "Dubai, AE",
    contractorCount: 3,
    pursuedInPast: "No",
    stakeholderStatus: "Unsubscribe",
    reachoutLever: "Volume",
    reachoutChannel: "Email",
    reachoutDate: "2026-04-21",
    followUpScore: null,
    comments: "Good row for dropdown edits on Stakeholder Status and Reachout Channel.",
  },
  {
    id: 6,
    account: "Lumen Logistics",
    clientName: "Arav Menon",
    clientDesignation: "VP Logistics Planning",
    region: "ROW",
    businessUnit: "After sales",
    serviceLine: "DAC",
    cslOwner: "Srilekha Kundu",
    salesApproach: "Mining",
    linkedInUrl: "linkedin.com/in/arav-menon",
    location: "Johannesburg, ZA",
    contractorCount: 5,
    pursuedInPast: "Yes",
    stakeholderStatus: "Persued in Past",
    reachoutLever: "Exec-Exec",
    reachoutChannel: "Linkedin",
    reachoutDate: "2026-04-25",
    followUpScore: null,
    comments: "Helpful for keyboard movement into off-screen template-style dropdown columns.",
  },
  {
    id: 7,
    account: "Verde Finance",
    clientName: "Sonia Kulkarni",
    clientDesignation: "Head of Finance Transformation",
    region: "US",
    businessUnit: "Finance",
    serviceLine: "Engg",
    cslOwner: "Chandler Johnson",
    salesApproach: "Farming",
    linkedInUrl: "linkedin.com/in/sonia-kulkarni",
    location: "New York, NY, US",
    contractorCount: 8,
    pursuedInPast: "No",
    stakeholderStatus: "Stakeholder",
    reachoutLever: "Exec-Exec",
    reachoutChannel: "Email, Linkedin",
    reachoutDate: "2026-04-28",
    followUpScore: null,
    comments: "Use this row when testing selection expansion followed by dropdown edits.",
  },
  {
    id: 8,
    account: "Orbit Telecom",
    clientName: "Karan Dsouza",
    clientDesignation: "Director, Revenue Operations",
    region: "LATAM",
    businessUnit: "Revenue",
    serviceLine: "DAC",
    cslOwner: "Indu Somayajula",
    salesApproach: "Mining",
    linkedInUrl: "linkedin.com/in/karan-dsouza",
    location: "Mexico City, MX",
    contractorCount: 7,
    pursuedInPast: "No",
    stakeholderStatus: "Grey Response",
    reachoutLever: "Volume",
    reachoutChannel: "Email",
    reachoutDate: "2026-05-02",
    followUpScore: null,
    comments: "Strong candidate for formula entry and link navigation in the same row.",
  },
  {
    id: 9,
    account: "Crescent Pharma",
    clientName: "Lena Hoffman",
    clientDesignation: "SVP Medical Affairs",
    region: "EU",
    businessUnit: "Medical affairs",
    serviceLine: "Engg",
    cslOwner: "Pawan Valudas",
    salesApproach: "Farming",
    linkedInUrl: "linkedin.com/in/lena-hoffman",
    location: "Basel, CH",
    contractorCount: 9,
    pursuedInPast: "Yes",
    stakeholderStatus: "M1 generated",
    reachoutLever: "Exec-Exec",
    reachoutChannel: "In-person",
    reachoutDate: "2026-05-05",
    followUpScore: null,
    comments: "Medical affairs option is included from the workbook-derived BU list.",
  },
  {
    id: 10,
    account: "Aurora Travel",
    clientName: "Tara Nair",
    clientDesignation: "Director, Marketing Automation",
    region: "APAC",
    businessUnit: "Marketing",
    serviceLine: "DAC",
    cslOwner: "Pradipt Das",
    salesApproach: "Mining",
    linkedInUrl: "linkedin.com/in/tara-nair",
    location: "Sydney, AU",
    contractorCount: 10,
    pursuedInPast: "No",
    stakeholderStatus: "Unsubscribe",
    reachoutLever: "Volume",
    reachoutChannel: "Linkedin",
    reachoutDate: "2026-05-09",
    followUpScore: null,
    comments: "A stable row for dropdown testing after horizontal viewport scrolling.",
  },
  {
    id: 11,
    account: "Cobalt Security",
    clientName: "Mayank Bedi",
    clientDesignation: "VP Product Platform",
    region: "Middle-east",
    businessUnit: "Product Platform",
    serviceLine: "Engg",
    cslOwner: "Vedant Prasad",
    salesApproach: "Farming",
    linkedInUrl: "linkedin.com/in/mayank-bedi",
    location: "Riyadh, SA",
    contractorCount: 11,
    pursuedInPast: "Yes",
    stakeholderStatus: "DND",
    reachoutLever: "Exec-Exec",
    reachoutChannel: "Email",
    reachoutDate: "2026-05-13",
    followUpScore: null,
    comments: "Great row for testing hidden column restore and continued arrow navigation.",
  },
  {
    id: 12,
    account: "Maple Insurance",
    clientName: "Ira Sen",
    clientDesignation: "Director, Business Strategy",
    region: "ROW",
    businessUnit: "Business Strategy",
    serviceLine: "DAC",
    cslOwner: "William D'Sousa",
    salesApproach: "Mining",
    linkedInUrl: "linkedin.com/in/ira-sen",
    location: "Nairobi, KE",
    contractorCount: 12,
    pursuedInPast: "No",
    stakeholderStatus: "Stakeholder",
    reachoutLever: "Volume",
    reachoutChannel: "Email, Linkedin",
    reachoutDate: "2026-05-17",
    followUpScore: null,
    comments: "Useful for row selection followed by workbook dropdown edits across the same row.",
  },
  {
    id: 13,
    account: "Nova Manufacturing",
    clientName: "Amit Vora",
    clientDesignation: "Head of Manufacturing Analytics",
    region: "US",
    businessUnit: "Manufacturing",
    serviceLine: "DAC",
    cslOwner: "Abhinav Saxena",
    salesApproach: "Farming",
    linkedInUrl: "linkedin.com/in/amit-vora",
    location: "Chicago, IL, US",
    contractorCount: 13,
    pursuedInPast: "No",
    stakeholderStatus: "Grey Response",
    reachoutLever: "Exec-Exec",
    reachoutChannel: "In-person",
    reachoutDate: "2026-05-21",
    followUpScore: null,
    comments: "Lets the viewport demonstrate deeper downward movement after the first screenful of rows.",
  },
  {
    id: 14,
    account: "Riverbank Media",
    clientName: "Elena Costa",
    clientDesignation: "Director, Retail Media Partnerships",
    region: "LATAM",
    businessUnit: "Retail Media",
    serviceLine: "Engg",
    cslOwner: "Jayeeta Sharma",
    salesApproach: "Mining",
    linkedInUrl: "linkedin.com/in/elena-costa",
    location: "Buenos Aires, AR",
    contractorCount: 14,
    pursuedInPast: "Yes",
    stakeholderStatus: "M1 generated",
    reachoutLever: "Volume",
    reachoutChannel: "Linkedin",
    reachoutDate: "2026-05-25",
    followUpScore: null,
    comments: "Retail Media is also carried over from the workbook option set.",
  },
  {
    id: 15,
    account: "Vertex Mining",
    clientName: "Rahil Sethi",
    clientDesignation: "Senior Director, Procurement",
    region: "EU",
    businessUnit: "Procurement",
    serviceLine: "DAC",
    cslOwner: "Shashank Kagwad",
    salesApproach: "Farming",
    linkedInUrl: "linkedin.com/in/rahil-sethi",
    location: "Dublin, IE",
    contractorCount: 15,
    pursuedInPast: "No",
    stakeholderStatus: "Persued in Past",
    reachoutLever: "Exec-Exec",
    reachoutChannel: "Email",
    reachoutDate: "2026-05-29",
    followUpScore: null,
    comments: "Another lower row so horizontal plus vertical keyboard scrolling stays obvious.",
  },
  {
    id: 16,
    account: "Pioneer Aerospace",
    clientName: "Jia Park",
    clientDesignation: "VP Program Management",
    region: "APAC",
    businessUnit: "Program Management",
    serviceLine: "Engg",
    cslOwner: "Ayush Jha",
    salesApproach: "Mining",
    linkedInUrl: "linkedin.com/in/jia-park",
    location: "Seoul, KR",
    contractorCount: 16,
    pursuedInPast: "Yes",
    stakeholderStatus: "DND",
    reachoutLever: "Volume",
    reachoutChannel: "Email, Linkedin",
    reachoutDate: "2026-06-02",
    followUpScore: null,
    comments: "Program Management appears in the workbook list and helps widen the visible dropdown mix.",
  },
  {
    id: 17,
    account: "Beacon Hospitality",
    clientName: "Nadia Farooqi",
    clientDesignation: "Director, Operations Excellence",
    region: "Middle-east",
    businessUnit: "Operations",
    serviceLine: "DAC",
    cslOwner: "Pradeep Varavoor",
    salesApproach: "Farming",
    linkedInUrl: "linkedin.com/in/nadia-farooqi",
    location: "Doha, QA",
    contractorCount: 17,
    pursuedInPast: "No",
    stakeholderStatus: "Stakeholder",
    reachoutLever: "Exec-Exec",
    reachoutChannel: "In-person",
    reachoutDate: "2026-06-06",
    followUpScore: null,
    comments: "Operations row is useful when testing select edits close to the bottom of the first viewport.",
  },
  {
    id: 18,
    account: "Granite Supply",
    clientName: "Peter Oloo",
    clientDesignation: "Head of R&D and Product Development",
    region: "ROW",
    businessUnit: "R&D & Product Development",
    serviceLine: "Engg",
    cslOwner: "Prashanth Sukumar",
    salesApproach: "Mining",
    linkedInUrl: "linkedin.com/in/peter-oloo",
    location: "Lagos, NG",
    contractorCount: 18,
    pursuedInPast: "Yes",
    stakeholderStatus: "Grey Response",
    reachoutLever: "Volume",
    reachoutChannel: "Linkedin",
    reachoutDate: "2026-06-10",
    followUpScore: null,
    comments: "Bottom-row account intended for scroll-follow, dropdown edits, and range selection demos.",
  },
] satisfies DemoRow[];

const availableFeatures = [
  "Workbook-inspired test app based on the LDB Template sheet from the provided Master LDB template.",
  "Template dropdowns are mocked for Region, Business Unit, Service Line, CSL Owner, Sales Approach, Pursued In Past, Stakeholder Status, Reachout Lever, and Reachout Channel.",
  "Use Ctrl/Cmd + Shift + Arrow to grow selection by row, column, or both axes.",
  "Move with arrow keys and let the viewport follow when the active cell goes off-screen.",
  "Select columns and edit the workbook-style dropdowns directly in-grid.",
  "Use Contractor Count for drag fill or double-click fill-down to continue a numeric series.",
  "Follow-up Score still supports formulas, formula-bar editing, and cell-reference picking.",
  "Hide and show columns, including the Comments column that starts hidden.",
];

const demoTypes = ["text", "number", "select", "date", "link", "formula"];

const keyboardShortcuts = [
  {
    windows: ["Ctrl", "Shift", "Right"],
    mac: ["Cmd", "Shift", "Right"],
    description: "Select the active row across all visible columns.",
  },
  {
    windows: ["Ctrl", "Shift", "Down"],
    mac: ["Cmd", "Shift", "Down"],
    description: "Expand that selection downward, similar to Excel-style axis growth.",
  },
  {
    windows: ["Alt"],
    mac: ["Option"],
    description: "Can be held as an extra modifier with the same row and column shortcuts.",
  },
];

export default function App() {
  const [rows, setRows] = useState<DemoRow[]>(initialRows);

  return (
    <div className="demo-shell">
      <section className="demo-hero">
        <div>
          <p className="demo-eyebrow">LDB Template sandbox</p>
          <h1 className="demo-title">Workbook-inspired lead desk demo with real dropdown mocks</h1>
          <p className="demo-copy">
            This test app now uses the <strong>LDB Template</strong> sheet from the provided workbook as
            its reference. The dropdown-heavy columns mirror the template’s lead-capture flow, while the
            grid still keeps spreadsheet behaviors like keyboard selection, viewport follow, fill handle,
            and formulas. The <strong>Contractor Count</strong> column starts with <strong>1</strong> and
            <strong> 2</strong> so fill-down is easy to test, and <strong>Follow-up Score</strong> includes
            formulas so the formula bar still has real data to work with.
          </p>
        </div>

        <div className="demo-stat-grid">
          <article className="demo-stat-card">
            <span className="demo-stat-label">Rows</span>
            <strong>{rows.length}</strong>
          </article>
          <article className="demo-stat-card">
            <span className="demo-stat-label">Dropdown fields</span>
            <strong>9</strong>
          </article>
          <article className="demo-stat-card">
            <span className="demo-stat-label">Hidden at start</span>
            <strong>1</strong>
          </article>
          <article className="demo-stat-card">
            <span className="demo-stat-label">Frozen by default</span>
            <strong>2</strong>
          </article>
        </div>
      </section>

      <div className="demo-layout">
        <aside className="demo-sidebar">
          <section className="demo-card">
            <h2>Available features</h2>
            <ul className="demo-checklist">
              {availableFeatures.map((item) => (
                <li key={item}>
                  <input type="checkbox" checked readOnly />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="demo-card">
            <h2>Column types in this demo</h2>
            <div className="demo-pill-list">
              {demoTypes.map((type) => (
                <span key={type} className="demo-pill">
                  {type}
                </span>
              ))}
            </div>
          </section>

          <section className="demo-card">
            <h2>Keyboard shortcuts to try</h2>
            <div className="demo-shortcut-list">
              {keyboardShortcuts.map((shortcut) => (
                <div key={`${shortcut.windows.join("+")}-${shortcut.mac.join("+")}`} className="demo-shortcut-row">
                  <div className="demo-shortcut-combos">
                    <div className="demo-shortcut-combo">
                      {shortcut.windows.map((key) => (
                        <kbd key={`win-${shortcut.description}-${key}`} className="demo-kbd">
                          {key}
                        </kbd>
                      ))}
                    </div>
                    <div className="demo-shortcut-combo demo-shortcut-combo-secondary">
                      {shortcut.mac.map((key) => (
                        <kbd key={`mac-${shortcut.description}-${key}`} className="demo-kbd">
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                  <p>{shortcut.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="demo-card">
            <h2>Quick things to try</h2>
            <ol className="demo-steps">
              <li>Edit Region, Stakeholder Status, or Reachout Channel and confirm the options match the workbook-style mock dropdowns.</li>
              <li>Click Account in the first row, press <strong>Ctrl/Cmd + Shift + Right</strong>, then press <strong>Ctrl/Cmd + Shift + Down</strong>.</li>
              <li>Keep pressing the right arrow until the active cell reaches Stakeholder Status or Reachout Channel and watch the grid scroll with it.</li>
              <li>Select the first two cells in <strong>Contractor Count</strong>, then drag the fill handle or double-click it to continue <strong>1, 2, 3, 4...</strong>.</li>
              <li>Start editing the empty <strong>Follow-up Score</strong> cell on Harbor Energy with <strong>=</strong>, click Contractor Count, type <strong>*2</strong>, and commit.</li>
              <li>Select a formula-filled cell in <strong>Follow-up Score</strong> and confirm the formula bar shows raw entries like <strong>=IF(L1=&quot;Yes&quot;,K1*2,K1)</strong>.</li>
            </ol>
          </section>
        </aside>

        <main className="demo-card demo-grid-card">
          <div className="demo-grid-header">
            <div>
              <h2>Master LDB template sandbox</h2>
              <p>
                The mock rows and dropdown values in this grid are based on the provided workbook’s
                <strong> LDB Template </strong>
                sheet and its dropdown source list.
              </p>
            </div>
          </div>

          <GridMaster<DemoRow>
            rows={rows}
            columns={columns}
            getRowId={(row) => String(row.id)}
            onRowsChange={setRows}
            frozenColumns={2}
            width="100%"
            height={460}
          />
        </main>
      </div>
    </div>
  );
}
