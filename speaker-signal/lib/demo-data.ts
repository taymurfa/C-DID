import type { Conference, SequenceStep, Speaker } from "./contracts";

/** Demo desk snapshot sourced from agents/agent3/mock/full_schedule.csv (Data Center World Power 2026). */
export const speakers: Speaker[] = [
  {
    id: "adam-scarsella",
    name: "Adam Scarsella",
    title: null,
    company: "Voltus",
    conference: "Data Center World Power 2026",
    session: "Demand Response and Virtual Power Plants: How Data Centers Become Electric Grid Assets",
    email: "faruquitaymur@gmail.com",
    score: 83,
    tier: "A",
    scoreReason: "Speaking on \"Demand Response and Virtual Power Plants: How Data Centers Become Electric Grid Assets\" — topic signals: demand response, grid, power, virtual power.",
    confidence: 0.9,
    scoreBreakdown: {
      roleFit: 15,
      companyFit: 15,
      topicRelevance: 23,
      seniority: 12,
      buyingInfluence: 10,
      eventProximity: 8
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "Demand Response and Virtual Power Plants: How Data Centers Become Electric Grid Assets",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "Voltus",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "T-7"
  },
  {
    id: "nate-soles",
    name: "Nate Soles",
    title: null,
    company: "CPower",
    conference: "Data Center World Power 2026",
    session: "Demand Response and Virtual Power Plants: How Data Centers Become Electric Grid Assets",
    email: "faruquitaymur@gmail.com",
    score: 83,
    tier: "A",
    scoreReason: "Speaking on \"Demand Response and Virtual Power Plants: How Data Centers Become Electric Grid Assets\" — topic signals: demand response, grid, power, virtual power.",
    confidence: 0.9,
    scoreBreakdown: {
      roleFit: 15,
      companyFit: 15,
      topicRelevance: 23,
      seniority: 12,
      buyingInfluence: 10,
      eventProximity: 8
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "Demand Response and Virtual Power Plants: How Data Centers Become Electric Grid Assets",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "CPower",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "T-2"
  },
  {
    id: "amy-roma",
    name: "Amy Roma",
    title: null,
    company: "Orrick",
    conference: "Data Center World Power 2026",
    session: "Nuclear Renaissance: How and When Fission, Fusion, and Hybrid Technologies Can Change the Data Center Power Stack",
    email: "faruquitaymur@gmail.com",
    score: 76,
    tier: "B",
    scoreReason: "Speaking on \"Nuclear Renaissance: How and When Fission, Fusion, and Hybrid Technologies Can Change the Data Center Power Stack\" — topic signals: fusion, nuclear, power.",
    confidence: 0.87,
    scoreBreakdown: {
      roleFit: 14,
      companyFit: 14,
      topicRelevance: 21,
      seniority: 11,
      buyingInfluence: 9,
      eventProximity: 8
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "Nuclear Renaissance: How and When Fission, Fusion, and Hybrid Technologies Can Change the Data Center Power Stack",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "Orrick",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "T-14"
  },
  {
    id: "gary-hilberg",
    name: "Gary Hilberg",
    title: null,
    company: "Continuum Energy",
    conference: "Data Center World Power 2026",
    session: "Engineering Onsite Power for AI Data Centers: Avoiding Problematic Design Assumptions",
    email: "faruquitaymur@gmail.com",
    score: 76,
    tier: "B",
    scoreReason: "Speaking on \"Engineering Onsite Power for AI Data Centers: Avoiding Problematic Design Assumptions\" — topic signals: ai data center, onsite, power.",
    confidence: 0.87,
    scoreBreakdown: {
      roleFit: 14,
      companyFit: 14,
      topicRelevance: 21,
      seniority: 11,
      buyingInfluence: 9,
      eventProximity: 8
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "Engineering Onsite Power for AI Data Centers: Avoiding Problematic Design Assumptions",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "Continuum Energy",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "Identified"
  },
  {
    id: "jim-reilly",
    name: "Jim Reilly",
    title: null,
    company: "Reilly Associates",
    conference: "Data Center World Power 2026",
    session: "Control Systems for Data Center Microgrids: Turning Compliance into Reliability and Revenue",
    email: "faruquitaymur@gmail.com",
    score: 76,
    tier: "B",
    scoreReason: "Speaking on \"Control Systems for Data Center Microgrids: Turning Compliance into Reliability and Revenue\" — topic signals: grid, microgrid, reliability.",
    confidence: 0.87,
    scoreBreakdown: {
      roleFit: 14,
      companyFit: 14,
      topicRelevance: 21,
      seniority: 11,
      buyingInfluence: 9,
      eventProximity: 8
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "Control Systems for Data Center Microgrids: Turning Compliance into Reliability and Revenue",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "Reilly Associates",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "Event"
  },
  {
    id: "mark-wilson",
    name: "Mark Wilson",
    title: null,
    company: "Prometheus Hyperscale",
    conference: "Data Center World Power 2026",
    session: "Hedging Power Cost Risk: Procurement Trends for Hyperscale and Colocation Data Centers",
    email: "faruquitaymur@gmail.com",
    score: 76,
    tier: "B",
    scoreReason: "Speaking on \"Hedging Power Cost Risk: Procurement Trends for Hyperscale and Colocation Data Centers\" — topic signals: hyperscale, power, procurement.",
    confidence: 0.87,
    scoreBreakdown: {
      roleFit: 14,
      companyFit: 14,
      topicRelevance: 21,
      seniority: 11,
      buyingInfluence: 9,
      eventProximity: 8
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "Hedging Power Cost Risk: Procurement Trends for Hyperscale and Colocation Data Centers",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "Prometheus Hyperscale",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "Identified"
  },
  {
    id: "matthias-knolker",
    name: "Matthias Knolker",
    title: null,
    company: "General Atomics Magnetic Fusion Energy",
    conference: "Data Center World Power 2026",
    session: "Nuclear Renaissance: How and When Fission, Fusion, and Hybrid Technologies Can Change the Data Center Power Stack",
    email: "faruquitaymur@gmail.com",
    score: 76,
    tier: "B",
    scoreReason: "Speaking on \"Nuclear Renaissance: How and When Fission, Fusion, and Hybrid Technologies Can Change the Data Center Power Stack\" — topic signals: fusion, nuclear, power.",
    confidence: 0.87,
    scoreBreakdown: {
      roleFit: 14,
      companyFit: 14,
      topicRelevance: 21,
      seniority: 11,
      buyingInfluence: 9,
      eventProximity: 8
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "Nuclear Renaissance: How and When Fission, Fusion, and Hybrid Technologies Can Change the Data Center Power Stack",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "General Atomics Magnetic Fusion Energy",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "T-7"
  },
  {
    id: "robert-henderson",
    name: "Robert Henderson",
    title: null,
    company: "Liberty Energy",
    conference: "Data Center World Power 2026",
    session: "Engineering Onsite Power for AI Data Centers: Avoiding Problematic Design Assumptions",
    email: "faruquitaymur@gmail.com",
    score: 76,
    tier: "B",
    scoreReason: "Speaking on \"Engineering Onsite Power for AI Data Centers: Avoiding Problematic Design Assumptions\" — topic signals: ai data center, onsite, power.",
    confidence: 0.87,
    scoreBreakdown: {
      roleFit: 14,
      companyFit: 14,
      topicRelevance: 21,
      seniority: 11,
      buyingInfluence: 9,
      eventProximity: 8
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "Engineering Onsite Power for AI Data Centers: Avoiding Problematic Design Assumptions",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "Liberty Energy",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "T-14"
  },
  {
    id: "supria-ranade",
    name: "Supria Ranade",
    title: null,
    company: "JP Morgan Chase Bank North America",
    conference: "Data Center World Power 2026",
    session: "Hedging Power Cost Risk: Procurement Trends for Hyperscale and Colocation Data Centers",
    email: "faruquitaymur@gmail.com",
    score: 76,
    tier: "B",
    scoreReason: "Speaking on \"Hedging Power Cost Risk: Procurement Trends for Hyperscale and Colocation Data Centers\" — topic signals: hyperscale, power, procurement.",
    confidence: 0.87,
    scoreBreakdown: {
      roleFit: 14,
      companyFit: 14,
      topicRelevance: 21,
      seniority: 11,
      buyingInfluence: 9,
      eventProximity: 8
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "Hedging Power Cost Risk: Procurement Trends for Hyperscale and Colocation Data Centers",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "JP Morgan Chase Bank North America",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "Identified"
  },
  {
    id: "bill-kleyman",
    name: "Bill Kleyman",
    title: null,
    company: "Apolo.us",
    conference: "Data Center World Power 2026",
    session: "KEYNOTE:  The 200GW Moment: Reinventing the Grid for the AI Economy",
    email: "faruquitaymur@gmail.com",
    score: 62,
    tier: "C",
    scoreReason: "Speaking on \"KEYNOTE:  The 200GW Moment: Reinventing the Grid for the AI Economy\" — topic signals: grid.",
    confidence: 0.81,
    scoreBreakdown: {
      roleFit: 11,
      companyFit: 11,
      topicRelevance: 17,
      seniority: 9,
      buyingInfluence: 7,
      eventProximity: 6
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "KEYNOTE:  The 200GW Moment: Reinventing the Grid for the AI Economy",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "Apolo.us",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "Identified"
  },
  {
    id: "dado-slezak",
    name: "Dado Slezak",
    title: null,
    company: "QTS",
    conference: "Data Center World Power 2026",
    session: "KEYNOTE:  The 200GW Moment: Reinventing the Grid for the AI Economy",
    email: "faruquitaymur@gmail.com",
    score: 62,
    tier: "C",
    scoreReason: "Speaking on \"KEYNOTE:  The 200GW Moment: Reinventing the Grid for the AI Economy\" — topic signals: grid.",
    confidence: 0.81,
    scoreBreakdown: {
      roleFit: 11,
      companyFit: 11,
      topicRelevance: 17,
      seniority: 9,
      buyingInfluence: 7,
      eventProximity: 6
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "KEYNOTE:  The 200GW Moment: Reinventing the Grid for the AI Economy",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "QTS",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "T-2"
  },
  {
    id: "harsha-bojja",
    name: "Harsha Bojja",
    title: null,
    company: "Google",
    conference: "Data Center World Power 2026",
    session: "Forging New Power Standards: Innovation for the Future of Cloud Infrastructure",
    email: "faruquitaymur@gmail.com",
    score: 62,
    tier: "C",
    scoreReason: "Speaking on \"Forging New Power Standards: Innovation for the Future of Cloud Infrastructure\" — topic signals: power.",
    confidence: 0.81,
    scoreBreakdown: {
      roleFit: 11,
      companyFit: 11,
      topicRelevance: 17,
      seniority: 9,
      buyingInfluence: 7,
      eventProximity: 6
    },
    evidence: [
      {
        label: "Agenda",
        excerpt: "Forging New Power Standards: Innovation for the Future of Cloud Infrastructure",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.96
      },
      {
        label: "Company",
        excerpt: "Google",
        sourceUrl: "https://www.datacenterworld.com/",
        confidence: 0.9
      }
    ],
    outreachStage: "Identified"
  }
];

export const conferences: Conference[] = [
  {
    id: "dcw-power-2026",
    name: "Data Center World Power 2026",
    startDate: "2026-09-21T12:30:00.000Z",
    endDate: "2026-09-24T22:00:00.000Z",
    city: "Dallas, TX",
    sourceUrl: "https://www.datacenterworld.com/",
    speakerCount: 74,
    qualifiedCount: 12,
    status: "Analyzed"
  }
];

export const sequenceSteps: SequenceStep[] = [
  {
    id: "initial",
    anchor: "T-14",
    label: "Context-first introduction",
    scheduledFor: "2026-09-08T15:00:00.000Z",
    subject: "Your DCW Power session — quick intro",
    status: "Sent"
  },
  {
    id: "value",
    anchor: "T-7",
    label: "Relevant project insight",
    scheduledFor: "2026-09-15T15:00:00.000Z",
    subject: "A pattern we keep seeing on AI campus power",
    status: "Sent"
  },
  {
    id: "meet",
    anchor: "T-2",
    label: "Meet at the event",
    scheduledFor: "2026-09-20T15:00:00.000Z",
    subject: "15 minutes at Data Center World?",
    status: "Scheduled"
  },
  {
    id: "event",
    anchor: "Event",
    label: "In-person opportunity",
    scheduledFor: "2026-09-22T15:00:00.000Z",
    subject: null,
    status: "Opportunity"
  },
  {
    id: "followup",
    anchor: "T+2",
    label: "Post-event follow-up",
    scheduledFor: "2026-09-24T15:00:00.000Z",
    subject: "Picking up our Dallas conversation",
    status: "Planned"
  }
];

export const funnel = [
  {
    label: "Identified",
    value: 74
  },
  {
    label: "Contacted",
    value: 31
  },
  {
    label: "Replied",
    value: 12
  },
  {
    label: "Meeting scheduled",
    value: 5
  },
  {
    label: "Met",
    value: 3
  },
  {
    label: "Conversation booked",
    value: 2
  }
];
