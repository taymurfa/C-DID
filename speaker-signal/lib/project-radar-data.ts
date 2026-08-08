import { ProjectSchema, type Project, type ProjectEvidence, type ProjectSourceType, type ProjectStage } from "./project-radar";

type EvidenceSeed = [ProjectSourceType, string, string, string, "High" | "Medium" | "Low"];

function evidence(projectId: string, rows: EvidenceSeed[]): ProjectEvidence[] {
  return rows.map(([sourceType, sourceName, title, excerpt, confidence], index) => ({
    id: `${projectId}-evidence-${index + 1}`,
    sourceType,
    sourceName,
    title,
    sourceUrl: `https://example.com/project-radar/${projectId}/${index + 1}`,
    observedAt: new Date(Date.UTC(2026, 7, 8 - index, 15, 0)).toISOString(),
    excerpt,
    confidence,
  }));
}

function project(input: {
  id: string;
  name: string;
  aliases?: string[];
  company: string;
  projectType: string;
  capacityMw: number;
  county: string;
  state?: string;
  coordinates: { x: number; y: number };
  stage: ProjectStage;
  stageConfidence: number;
  score: number;
  latestSignal: string;
  stageChanged?: boolean;
  evidence: EvidenceSeed[];
}): Project {
  return ProjectSchema.parse({
    ...input,
    aliases: input.aliases ?? [],
    state: input.state ?? "Texas",
    updatedAt: new Date(Date.UTC(2026, 7, 8, 15, 0)).toISOString(),
    stageChanged: input.stageChanged ?? false,
    evidence: evidence(input.id, input.evidence),
  });
}

export const demoProjects: Project[] = [
  project({
    id: "lone-star-data-center-energy-park",
    name: "Lone Star Data Center Energy Park",
    aliases: ["Lone Star BTM Campus", "Burnet Compute Power"],
    company: "HelioCore Energy",
    projectType: "Behind-the-meter data-center power",
    capacityMw: 600,
    county: "Burnet County",
    coordinates: { x: 58, y: 57 },
    stage: "FEED",
    stageConfidence: 0.92,
    score: 96,
    latestSignal: "PUCT docket update confirms transmission-study scope",
    stageChanged: true,
    evidence: [
      ["ERCOT", "ERCOT GIS", "Queue position update", "A 600 MW generation request tied to the Burnet campus advanced in the monthly queue.", "High"],
      ["PUCT", "PUCT Interchange", "Application and study filing", "HelioCore filed testimony covering the campus interconnection and delivery schedule.", "High"],
      ["TCEQ", "TCEQ permits", "Air permit application received", "The filing covers gas generation supporting a behind-the-meter compute campus.", "High"],
      ["County agenda", "Burnet County", "Commissioners court agenda", "Tax-abatement discussion references the same parcel, capacity, and HelioCore affiliate.", "Medium"],
      ["Equipment", "Vendor announcement", "Long-lead equipment reservation", "A turbine reservation identifies a Texas data-center power project with matching capacity.", "Medium"],
      ["Finance", "Project finance brief", "Development capital facility", "Financing disclosure names the project holding company and early engineering work.", "Medium"],
      ["News", "Austin Energy Ledger", "Data-center campus planned", "Local reporting connects the parcel, developer, and planned first-power date.", "Low"],
    ],
  }),
  project({
    id: "permian-power-hub",
    name: "Permian Power Hub",
    aliases: ["Mesa Peak Odessa Generation"],
    company: "Mesa Peak Power",
    projectType: "Gas-to-power",
    capacityMw: 480,
    county: "Ector County",
    coordinates: { x: 21, y: 50 },
    stage: "FEL-2 / pre-FEED",
    stageConfidence: 0.9,
    score: 93,
    latestSignal: "County agenda adds water and road study authorization",
    stageChanged: true,
    evidence: [
      ["ERCOT", "ERCOT GIS", "New generation request", "Queue record lists a 480 MW gas resource near Odessa.", "High"],
      ["County agenda", "Ector County", "Study authorization", "Commissioners approved preliminary road and water studies for the site.", "High"],
      ["Equipment", "OEM release", "Turbine slot reserved", "Mesa Peak reserved long-lead equipment for a Permian power development.", "Medium"],
    ],
  }),
  project({
    id: "panhandle-peaker-plant",
    name: "Panhandle Peaker Plant",
    company: "Northwind Generation",
    projectType: "Fast-start gas generation",
    capacityMw: 310,
    county: "Potter County",
    coordinates: { x: 28, y: 16 },
    stage: "Interconnection",
    stageConfidence: 0.88,
    score: 89,
    latestSignal: "ERCOT screening study posted",
    evidence: [
      ["ERCOT", "ERCOT RIOO", "Screening study posted", "The interconnection study includes a 310 MW fast-start resource.", "High"],
      ["TCEQ", "TCEQ permits", "Permit notice", "A combustion permit notice uses the project alias and same county parcel.", "Medium"],
    ],
  }),
  project({
    id: "south-texas-solar-bess",
    name: "South Texas Solar + BESS",
    company: "Clearway Energy",
    projectType: "Solar and battery storage",
    capacityMw: 420,
    county: "Nueces County",
    coordinates: { x: 59, y: 82 },
    stage: "FEED",
    stageConfidence: 0.84,
    score: 87,
    latestSignal: "Civil package issued for bid",
    evidence: [
      ["ERCOT", "ERCOT GIS", "Hybrid queue update", "The hybrid project remains active with revised COD timing.", "High"],
      ["Equipment", "Vendor RFP", "Civil package issued", "A public RFP covers site grading and storage foundations.", "Medium"],
    ],
  }),
  project({
    id: "eagle-ford-gas-plant",
    name: "Eagle Ford Gas Plant",
    company: "CrossPower",
    projectType: "Gas-to-power",
    capacityMw: 720,
    county: "Karnes County",
    coordinates: { x: 49, y: 69 },
    stage: "FEL-2 / pre-FEED",
    stageConfidence: 0.81,
    score: 85,
    latestSignal: "TCEQ pre-application meeting logged",
    evidence: [
      ["TCEQ", "TCEQ permits", "Pre-application meeting", "Agency log describes a proposed 720 MW combined-cycle facility.", "High"],
      ["County agenda", "Karnes County", "Economic development item", "Agenda materials reference a generation project and the CrossPower affiliate.", "Medium"],
    ],
  }),
  project({
    id: "west-texas-wind-repower",
    name: "West Texas Wind Repower",
    company: "Pattern Energy",
    projectType: "Wind repower",
    capacityMw: 260,
    county: "Scurry County",
    coordinates: { x: 31, y: 45 },
    stage: "FEL-1",
    stageConfidence: 0.76,
    score: 82,
    latestSignal: "OEM repower study referenced in earnings call",
    evidence: [
      ["News", "Earnings transcript", "Repower study referenced", "Management described an early repower study for its West Texas fleet.", "Medium"],
    ],
  }),
  project({
    id: "rio-grande-bess",
    name: "Rio Grande BESS",
    company: "Plus Power",
    projectType: "Battery storage",
    capacityMw: 200,
    county: "Hidalgo County",
    coordinates: { x: 52, y: 91 },
    stage: "FEL-2 / pre-FEED",
    stageConfidence: 0.79,
    score: 80,
    latestSignal: "Land option recorded near substation",
    evidence: [
      ["County agenda", "Hidalgo County", "Land-use item", "A land option and access request appear near the target substation.", "Medium"],
      ["ERCOT", "ERCOT GIS", "Storage request", "The queue lists a storage request at the same point of interconnection.", "High"],
    ],
  }),
  project({
    id: "gulf-coast-ccgt",
    name: "Gulf Coast CCGT",
    company: "Calpine",
    projectType: "Combined-cycle generation",
    capacityMw: 900,
    county: "Harris County",
    coordinates: { x: 74, y: 64 },
    stage: "Concept",
    stageConfidence: 0.7,
    score: 78,
    latestSignal: "Capacity option discussed on earnings call",
    evidence: [
      ["Finance", "Earnings transcript", "Capacity option discussed", "Management described evaluating a Gulf Coast generation expansion.", "Medium"],
    ],
  }),
  project({
    id: "austin-data-center-power",
    name: "Austin Data Center Power",
    company: "Lone Star Power",
    projectType: "Behind-the-meter data-center power",
    capacityMw: 340,
    county: "Williamson County",
    coordinates: { x: 60, y: 55 },
    stage: "FEED",
    stageConfidence: 0.82,
    score: 77,
    latestSignal: "Substation design RFP published",
    evidence: [
      ["Equipment", "Public RFP", "Substation design package", "The RFP covers a 345 kV substation serving a compute campus.", "High"],
      ["PUCT", "PUCT Interchange", "Transmission filing", "A utility filing references new large-load service in the same corridor.", "Medium"],
    ],
  }),
  project({
    id: "north-texas-solar",
    name: "North Texas Solar",
    company: "Lightsource bp",
    projectType: "Utility-scale solar",
    capacityMw: 250,
    county: "Fannin County",
    coordinates: { x: 70, y: 35 },
    stage: "FEL-1",
    stageConfidence: 0.73,
    score: 75,
    latestSignal: "County tax-abatement workshop scheduled",
    evidence: [
      ["County agenda", "Fannin County", "Workshop scheduled", "Commissioners scheduled an early tax-abatement workshop for the project.", "Medium"],
    ],
  }),
];

export const projectRadarSourceCount = 24;
