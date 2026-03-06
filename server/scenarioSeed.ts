import type { Scenario } from "@shared/schema";

const BASE_SCORES = {
  operationalControl: 50,
  responseTempo: 50,
  stakeholderTrust: 50,
  teamAlignment: 50,
  executiveComms: 50,
} as const;

export const BUILTIN_SCENARIOS: Scenario[] = [
  {
    id: "ksa-megaevent-01",
    title: "Riyadh Mega-Event Transit and Heat Emergency",
    description:
      "During a flagship Vision 2030 event in Riyadh, a power fault disrupts metro operations and cooling systems at a major transport interchange. High heat, crowd pressure, and international attention create a fast-moving public-safety crisis.",
    startStepId: "step1",
    initialScores: { ...BASE_SCORES },
    steps: {
      step1: {
        id: "step1",
        timeLabel: "T+0m",
        description:
          "Metro services partially fail, platform cooling drops, and crowd density rises sharply as midday temperatures climb.",
        choices: [
          {
            id: "1a",
            text: "Activate the regional crisis cell, deploy civil defense and medical teams, and begin controlled crowd diversion immediately.",
            scoreDeltas: { operationalControl: 15, responseTempo: 10, stakeholderTrust: 5, teamAlignment: 10, executiveComms: 10 },
            nextStepId: "step2",
          },
          {
            id: "1b",
            text: "Ask the transport operator to stabilize the station first before escalating beyond the operator.",
            scoreDeltas: { operationalControl: -15, responseTempo: -10, stakeholderTrust: -5, teamAlignment: -15, executiveComms: -10 },
            nextStepId: "step2",
          },
          {
            id: "1c",
            text: "Keep the disruption internal for now to avoid undermining confidence in the event.",
            scoreDeltas: { operationalControl: -10, responseTempo: -10, stakeholderTrust: -15, teamAlignment: -10, executiveComms: -15 },
            nextStepId: "step2",
          },
        ],
      },
      step2: {
        id: "step2",
        timeLabel: "T+20m",
        description:
          "Traffic congestion spreads around the district. Organizers, municipal teams, and transport authorities need one operating picture while social media shows overcrowded platforms.",
        choices: [
          {
            id: "2a",
            text: "Create a joint operations picture and issue one bilingual public update channel for all agencies.",
            scoreDeltas: { operationalControl: 10, responseTempo: 10, stakeholderTrust: 15, teamAlignment: 15, executiveComms: 10 },
            nextStepId: "step3",
          },
          {
            id: "2b",
            text: "Let each agency publish and route people independently so teams can move in parallel.",
            scoreDeltas: { operationalControl: -5, responseTempo: 5, stakeholderTrust: -15, teamAlignment: -20, executiveComms: -10 },
            nextStepId: "step3",
          },
          {
            id: "2c",
            text: "Focus only on technical restoration and delay public coordination until the system is stable.",
            scoreDeltas: { operationalControl: -10, responseTempo: 5, stakeholderTrust: -10, teamAlignment: -10, executiveComms: -10 },
            nextStepId: "step3",
          },
        ],
      },
      step3: {
        id: "step3",
        timeLabel: "T+45m",
        description:
          "The immediate crowd risk is controlled, but event access, district traffic, and international delegate movement remain unstable. Senior leadership wants a recommendation on whether the event continues.",
        choices: [
          {
            id: "3a",
            text: "Move to a reduced-capacity operating plan with staggered arrivals, controlled reentry, and visible safety messaging.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 10, teamAlignment: 10, executiveComms: 15 },
            nextStepId: "step4",
          },
          {
            id: "3b",
            text: "Restore normal event flow quickly to signal confidence and minimize disruption optics.",
            scoreDeltas: { operationalControl: -15, responseTempo: 15, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -5 },
            nextStepId: "step4",
          },
          {
            id: "3c",
            text: "Suspend the entire event immediately without a phased continuity plan.",
            scoreDeltas: { operationalControl: 0, responseTempo: -10, stakeholderTrust: -5, teamAlignment: 5, executiveComms: -10 },
            nextStepId: "step4",
          },
        ],
      },
      step4: {
        id: "step4",
        timeLabel: "T+48h",
        description:
          "The incident is over, but the public expects a credible review tied to future major-event resilience and Vision 2030 delivery standards.",
        choices: [
          {
            id: "4a",
            text: "Run a cross-agency after-action review, publish corrective actions, and tie upgrades to future event readiness.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 20, teamAlignment: 15, executiveComms: 15 },
            nextStepId: null,
          },
          {
            id: "4b",
            text: "Keep the review internal and release only a brief high-level statement.",
            scoreDeltas: { operationalControl: 5, responseTempo: 5, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -5 },
            nextStepId: null,
          },
          {
            id: "4c",
            text: "Treat the incident as a one-off operational issue and close it without visible reform.",
            scoreDeltas: { operationalControl: -15, responseTempo: 0, stakeholderTrust: -20, teamAlignment: -15, executiveComms: -15 },
            nextStepId: null,
          },
        ],
      },
    },
  },
  {
    id: "hajj-crowd-01",
    title: "Hajj Crowd Flow Disruption and Extreme Heat Response",
    description:
      "During peak Hajj movement between sites, a transport bottleneck and rising temperatures create dangerous crowd density, delayed pilgrim movement, and intense multi-agency pressure for immediate control and public reassurance.",
    startStepId: "step1",
    initialScores: { ...BASE_SCORES },
    steps: {
      step1: {
        id: "step1",
        timeLabel: "T+0m",
        description:
          "Pilgrim movement slows abruptly on a key route, medical teams report increasing heat exhaustion cases, and field commanders warn that density is approaching unsafe thresholds.",
        choices: [
          {
            id: "1a",
            text: "Activate a joint Hajj incident command, reroute movement immediately, and surge water, misting, and medical support.",
            scoreDeltas: { operationalControl: 15, responseTempo: 10, stakeholderTrust: 10, teamAlignment: 15, executiveComms: 10 },
            nextStepId: "step2",
          },
          {
            id: "1b",
            text: "Wait to confirm whether the congestion clears naturally before changing pilgrim routing.",
            scoreDeltas: { operationalControl: -15, responseTempo: -15, stakeholderTrust: -10, teamAlignment: -10, executiveComms: -10 },
            nextStepId: "step2",
          },
          {
            id: "1c",
            text: "Direct only local field teams to manage the crowd while central leadership stays out until needed.",
            scoreDeltas: { operationalControl: -10, responseTempo: -5, stakeholderTrust: -5, teamAlignment: -15, executiveComms: -10 },
            nextStepId: "step2",
          },
        ],
      },
      step2: {
        id: "step2",
        timeLabel: "T+15m",
        description:
          "Video of overcrowding is spreading rapidly. Security, health, transport, and Hajj operations need a synchronized message and a revised movement plan in minutes.",
        choices: [
          {
            id: "2a",
            text: "Issue a unified operational directive and one multilingual advisory explaining route changes and safety actions.",
            scoreDeltas: { operationalControl: 10, responseTempo: 10, stakeholderTrust: 15, teamAlignment: 15, executiveComms: 15 },
            nextStepId: "step3",
          },
          {
            id: "2b",
            text: "Let each agency communicate separately so field decisions are not delayed by approvals.",
            scoreDeltas: { operationalControl: -5, responseTempo: 5, stakeholderTrust: -15, teamAlignment: -20, executiveComms: -10 },
            nextStepId: "step3",
          },
          {
            id: "2c",
            text: "Keep communications minimal to avoid creating panic among pilgrims and media.",
            scoreDeltas: { operationalControl: -5, responseTempo: -10, stakeholderTrust: -20, teamAlignment: -5, executiveComms: -15 },
            nextStepId: "step3",
          },
        ],
      },
      step3: {
        id: "step3",
        timeLabel: "T+40m",
        description:
          "Flow has improved in some sectors, but a second bottleneck is forming. Senior leadership wants to know whether the full sequence can continue on schedule.",
        choices: [
          {
            id: "3a",
            text: "Slow the schedule, meter movement in phases, and prioritize pilgrim safety over throughput targets.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 10, teamAlignment: 10, executiveComms: 10 },
            nextStepId: "step4",
          },
          {
            id: "3b",
            text: "Push the full schedule to avoid visible delays and restore confidence quickly.",
            scoreDeltas: { operationalControl: -20, responseTempo: 15, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -5 },
            nextStepId: "step4",
          },
          {
            id: "3c",
            text: "Pause all movement without a phased alternative while planners reassess.",
            scoreDeltas: { operationalControl: -5, responseTempo: -15, stakeholderTrust: -5, teamAlignment: 0, executiveComms: -10 },
            nextStepId: "step4",
          },
        ],
      },
      step4: {
        id: "step4",
        timeLabel: "T+24h",
        description:
          "The immediate pressure is contained. Authorities now need a credible explanation and concrete readiness improvements before the next major movement window.",
        choices: [
          {
            id: "4a",
            text: "Publish the operational lessons, update field protocols, and rehearse corrective actions before the next peak flow period.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 15, teamAlignment: 15, executiveComms: 15 },
            nextStepId: null,
          },
          {
            id: "4b",
            text: "Acknowledge the disruption briefly and keep the deeper review internal.",
            scoreDeltas: { operationalControl: 5, responseTempo: 5, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -5 },
            nextStepId: null,
          },
          {
            id: "4c",
            text: "Treat the disruption as routine and move forward without visible changes.",
            scoreDeltas: { operationalControl: -10, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -10, executiveComms: -10 },
            nextStepId: null,
          },
        ],
      },
    },
  },
  {
    id: "desalination-01",
    title: "Red Sea Desalination Disruption and Water Distribution Crisis",
    description:
      "A mechanical failure and grid instability reduce output at a major desalination plant serving multiple coastal cities. Reservoir buffers are falling, heat conditions are severe, and authorities must protect continuity of water supply and public confidence.",
    startStepId: "step1",
    initialScores: { ...BASE_SCORES },
    steps: {
      step1: {
        id: "step1",
        timeLabel: "T+0m",
        description:
          "Plant output drops sharply, storage projections show pressure on municipal supply within hours, and utility teams warn that emergency transfer capacity is limited.",
        choices: [
          {
            id: "1a",
            text: "Activate a national utilities coordination cell, protect critical demand first, and begin contingency transfers immediately.",
            scoreDeltas: { operationalControl: 15, responseTempo: 10, stakeholderTrust: 5, teamAlignment: 15, executiveComms: 10 },
            nextStepId: "step2",
          },
          {
            id: "1b",
            text: "Wait for plant engineers to confirm the repair timeline before changing supply plans.",
            scoreDeltas: { operationalControl: -15, responseTempo: -15, stakeholderTrust: -10, teamAlignment: -10, executiveComms: -10 },
            nextStepId: "step2",
          },
          {
            id: "1c",
            text: "Keep the issue within the utility until there is clear evidence customers will feel it.",
            scoreDeltas: { operationalControl: -10, responseTempo: -10, stakeholderTrust: -15, teamAlignment: -10, executiveComms: -15 },
            nextStepId: "step2",
          },
        ],
      },
      step2: {
        id: "step2",
        timeLabel: "T+20m",
        description:
          "Hospitals, airports, and large residential districts need assurance on continuity. Rumors of a citywide shortage are spreading and bottled water demand is rising.",
        choices: [
          {
            id: "2a",
            text: "Publish controlled-demand guidance early, protect critical institutions, and explain what is changing and what is not.",
            scoreDeltas: { operationalControl: 10, responseTempo: 10, stakeholderTrust: 15, teamAlignment: 10, executiveComms: 15 },
            nextStepId: "step3",
          },
          {
            id: "2b",
            text: "Avoid public guidance until service is clearly affected so you do not trigger panic buying.",
            scoreDeltas: { operationalControl: -5, responseTempo: -10, stakeholderTrust: -20, teamAlignment: 0, executiveComms: -10 },
            nextStepId: "step3",
          },
          {
            id: "2c",
            text: "Issue general reassurance without disclosing operational constraints yet.",
            scoreDeltas: { operationalControl: -5, responseTempo: 5, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -5 },
            nextStepId: "step3",
          },
        ],
      },
      step3: {
        id: "step3",
        timeLabel: "T+1h",
        description:
          "Repairs will take longer than first expected. Municipal leaders need a demand-management and distribution plan for the next 24 hours.",
        choices: [
          {
            id: "3a",
            text: "Move to staged restrictions, tanker support, and prioritized service zones with frequent public updates.",
            scoreDeltas: { operationalControl: 15, responseTempo: 5, stakeholderTrust: 10, teamAlignment: 10, executiveComms: 10 },
            nextStepId: "step4",
          },
          {
            id: "3b",
            text: "Keep supply normal as long as possible and hope repairs complete before shortages become visible.",
            scoreDeltas: { operationalControl: -20, responseTempo: 10, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -10 },
            nextStepId: "step4",
          },
          {
            id: "3c",
            text: "Impose broad restrictions everywhere without explaining the operational rationale.",
            scoreDeltas: { operationalControl: 0, responseTempo: 0, stakeholderTrust: -15, teamAlignment: 0, executiveComms: -15 },
            nextStepId: "step4",
          },
        ],
      },
      step4: {
        id: "step4",
        timeLabel: "T+72h",
        description:
          "The supply gap is closed, but ministries want a resilience plan covering redundancy, communication, and continuity of essential services.",
        choices: [
          {
            id: "4a",
            text: "Launch a visible resilience review on redundancy, demand management, and cross-agency emergency water planning.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 15, teamAlignment: 15, executiveComms: 15 },
            nextStepId: null,
          },
          {
            id: "4b",
            text: "Limit the review to internal engineering lessons and keep public messaging brief.",
            scoreDeltas: { operationalControl: 5, responseTempo: 5, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -5 },
            nextStepId: null,
          },
          {
            id: "4c",
            text: "Frame it as an isolated plant issue and close out without a broader resilience program.",
            scoreDeltas: { operationalControl: -10, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -10, executiveComms: -10 },
            nextStepId: null,
          },
        ],
      },
    },
  },
  {
    id: "health-surge-01",
    title: "Major National Event Health-System Surge",
    description:
      "A respiratory illness cluster and heat-related cases drive a sudden surge in emergency visits during a major national event. Hospitals, public health, and event organizers must protect capacity while preserving public trust and continuity.",
    startStepId: "step1",
    initialScores: { ...BASE_SCORES },
    steps: {
      step1: {
        id: "step1",
        timeLabel: "T+0m",
        description:
          "Emergency departments in two major hospitals report overcrowding, ambulance turnaround times are slipping, and event medical posts are escalating more patients than planned.",
        choices: [
          {
            id: "1a",
            text: "Activate health surge coordination, redistribute load, and expand field triage and rapid-treatment capacity immediately.",
            scoreDeltas: { operationalControl: 15, responseTempo: 10, stakeholderTrust: 5, teamAlignment: 15, executiveComms: 10 },
            nextStepId: "step2",
          },
          {
            id: "1b",
            text: "Wait to confirm whether the spike is temporary before changing hospital operations.",
            scoreDeltas: { operationalControl: -15, responseTempo: -15, stakeholderTrust: -10, teamAlignment: -10, executiveComms: -10 },
            nextStepId: "step2",
          },
          {
            id: "1c",
            text: "Ask each hospital to manage internally without a central surge posture for now.",
            scoreDeltas: { operationalControl: -10, responseTempo: -5, stakeholderTrust: -5, teamAlignment: -20, executiveComms: -10 },
            nextStepId: "step2",
          },
        ],
      },
      step2: {
        id: "step2",
        timeLabel: "T+20m",
        description:
          "Social media posts claim hospitals are overwhelmed. Families need guidance, and leaders want to know whether the event can continue safely.",
        choices: [
          {
            id: "2a",
            text: "Issue a clear public health advisory on when to seek care, where to go, and what support capacity has been activated.",
            scoreDeltas: { operationalControl: 10, responseTempo: 10, stakeholderTrust: 15, teamAlignment: 5, executiveComms: 15 },
            nextStepId: "step3",
          },
          {
            id: "2b",
            text: "Keep communications minimal to avoid causing unnecessary alarm.",
            scoreDeltas: { operationalControl: -5, responseTempo: -10, stakeholderTrust: -20, teamAlignment: 0, executiveComms: -15 },
            nextStepId: "step3",
          },
          {
            id: "2c",
            text: "Let hospitals and event organizers answer questions separately in their own channels.",
            scoreDeltas: { operationalControl: -5, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -15, executiveComms: -10 },
            nextStepId: "step3",
          },
        ],
      },
      step3: {
        id: "step3",
        timeLabel: "T+1h",
        description:
          "The surge is manageable if demand is controlled, but elective throughput and event medical access need adjustment fast to preserve critical capacity.",
        choices: [
          {
            id: "3a",
            text: "Scale back noncritical activity, expand field screening, and meter event access based on health and transport conditions.",
            scoreDeltas: { operationalControl: 15, responseTempo: 5, stakeholderTrust: 10, teamAlignment: 10, executiveComms: 10 },
            nextStepId: "step4",
          },
          {
            id: "3b",
            text: "Keep normal event and hospital flows in place to avoid signaling a wider problem.",
            scoreDeltas: { operationalControl: -15, responseTempo: 10, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -10 },
            nextStepId: "step4",
          },
          {
            id: "3c",
            text: "Pause all event operations immediately without a phased health continuity plan.",
            scoreDeltas: { operationalControl: 0, responseTempo: -10, stakeholderTrust: -5, teamAlignment: 5, executiveComms: -10 },
            nextStepId: "step4",
          },
        ],
      },
      step4: {
        id: "step4",
        timeLabel: "T+48h",
        description:
          "The surge has eased. Health leaders now need a credible review of capacity planning, field medicine, and public communication readiness for future national events.",
        choices: [
          {
            id: "4a",
            text: "Run a multiagency readiness review and publish corrective actions for future high-demand events.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 15, teamAlignment: 15, executiveComms: 15 },
            nextStepId: null,
          },
          {
            id: "4b",
            text: "Keep the review limited to internal health operations and release a short summary only.",
            scoreDeltas: { operationalControl: 5, responseTempo: 5, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -5 },
            nextStepId: null,
          },
          {
            id: "4c",
            text: "Treat the surge as normal peak demand and avoid a formal cross-agency lessons process.",
            scoreDeltas: { operationalControl: -10, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -10, executiveComms: -10 },
            nextStepId: null,
          },
        ],
      },
    },
  },
  {
    id: "jeddah-flood-evac-01",
    title: "Jeddah Flash Flood Evacuation and Traffic Collapse",
    description:
      "After sudden heavy rainfall in Jeddah, underpasses and arterial roads flood during evening peak movement. Schools, hospitals, and residential districts face access disruption while public warning demand escalates rapidly.",
    startStepId: "step1",
    initialScores: { ...BASE_SCORES },
    steps: {
      step1: {
        id: "step1",
        timeLabel: "T+0m",
        description:
          "Civil defense receives multiple flood entrapment calls, two key underpasses are impassable, and district traffic begins to lock up.",
        choices: [
          {
            id: "1a",
            text: "Activate a citywide flood incident command, close high-risk corridors immediately, and deploy rescue and traffic diversion teams.",
            scoreDeltas: { operationalControl: 15, responseTempo: 10, stakeholderTrust: 10, teamAlignment: 15, executiveComms: 10 },
            nextStepId: "step2",
          },
          {
            id: "1b",
            text: "Wait for more precise water-level confirmation before restricting road movement.",
            scoreDeltas: { operationalControl: -15, responseTempo: -15, stakeholderTrust: -10, teamAlignment: -10, executiveComms: -10 },
            nextStepId: "step2",
          },
          {
            id: "1c",
            text: "Ask each district to manage road closures independently without central command activation.",
            scoreDeltas: { operationalControl: -10, responseTempo: -5, stakeholderTrust: -5, teamAlignment: -20, executiveComms: -10 },
            nextStepId: "step2",
          },
        ],
      },
      step2: {
        id: "step2",
        timeLabel: "T+20m",
        description:
          "Videos of trapped vehicles spread widely. Parents need school pickup guidance and hospitals request guaranteed emergency access routes.",
        choices: [
          {
            id: "2a",
            text: "Launch one verified multilingual channel with closure maps, shelter points, and emergency route instructions.",
            scoreDeltas: { operationalControl: 10, responseTempo: 10, stakeholderTrust: 15, teamAlignment: 10, executiveComms: 15 },
            nextStepId: "step3",
          },
          {
            id: "2b",
            text: "Keep messaging limited until all agencies confirm their route status.",
            scoreDeltas: { operationalControl: -5, responseTempo: -10, stakeholderTrust: -20, teamAlignment: -5, executiveComms: -15 },
            nextStepId: "step3",
          },
          {
            id: "2c",
            text: "Issue general reassurance without publishing specific corridor restrictions yet.",
            scoreDeltas: { operationalControl: -5, responseTempo: 0, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -10 },
            nextStepId: "step3",
          },
        ],
      },
      step3: {
        id: "step3",
        timeLabel: "T+1h",
        description:
          "Rainfall eases in some districts, but downstream water accumulation now threatens new zones and night mobility remains fragile.",
        choices: [
          {
            id: "3a",
            text: "Shift to phased reopening with dynamic patrol checks, protected emergency lanes, and staged school movement release.",
            scoreDeltas: { operationalControl: 15, responseTempo: 5, stakeholderTrust: 10, teamAlignment: 10, executiveComms: 10 },
            nextStepId: "step4",
          },
          {
            id: "3b",
            text: "Reopen most roads quickly to reduce visible congestion pressure.",
            scoreDeltas: { operationalControl: -20, responseTempo: 15, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -10 },
            nextStepId: "step4",
          },
          {
            id: "3c",
            text: "Keep blanket closures citywide until all districts report full drainage recovery.",
            scoreDeltas: { operationalControl: -5, responseTempo: -15, stakeholderTrust: -5, teamAlignment: 0, executiveComms: -5 },
            nextStepId: "step4",
          },
        ],
      },
      step4: {
        id: "step4",
        timeLabel: "T+48h",
        description:
          "Immediate danger has passed, and leadership requests a resilience package for flood routing, warning automation, and interagency command drills.",
        choices: [
          {
            id: "4a",
            text: "Publish cross-agency lessons, upgrade flood corridor controls, and schedule recurring flood command exercises.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 15, teamAlignment: 15, executiveComms: 15 },
            nextStepId: null,
          },
          {
            id: "4b",
            text: "Close the event with a short statement and keep detailed lessons internal.",
            scoreDeltas: { operationalControl: 5, responseTempo: 5, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -5 },
            nextStepId: null,
          },
          {
            id: "4c",
            text: "Treat the flood as a seasonal outlier and avoid structural policy changes.",
            scoreDeltas: { operationalControl: -10, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -10, executiveComms: -10 },
            nextStepId: null,
          },
        ],
      },
    },
  },
  {
    id: "umrah-heatwave-01",
    title: "Umrah Heatwave Medical Surge and Clinic Saturation",
    description:
      "A severe heatwave during peak Umrah traffic drives dehydration, heat stress, and respiratory complications. Urgent care sites are saturated and referral hospitals face escalating emergency load.",
    startStepId: "step1",
    initialScores: { ...BASE_SCORES },
    steps: {
      step1: {
        id: "step1",
        timeLabel: "T+0m",
        description:
          "Field clinics report a sharp rise in heat-related cases, ambulance turnaround times are increasing, and hospital triage queues are extending.",
        choices: [
          {
            id: "1a",
            text: "Activate surge health command, expand cooling and triage points, and redistribute critical cases across the regional network.",
            scoreDeltas: { operationalControl: 15, responseTempo: 10, stakeholderTrust: 5, teamAlignment: 15, executiveComms: 10 },
            nextStepId: "step2",
          },
          {
            id: "1b",
            text: "Wait one hour to confirm whether case volumes return to seasonal baseline.",
            scoreDeltas: { operationalControl: -15, responseTempo: -15, stakeholderTrust: -10, teamAlignment: -10, executiveComms: -10 },
            nextStepId: "step2",
          },
          {
            id: "1c",
            text: "Allow each health facility to self-manage surge activity without regional coordination.",
            scoreDeltas: { operationalControl: -10, responseTempo: -5, stakeholderTrust: -5, teamAlignment: -20, executiveComms: -10 },
            nextStepId: "step2",
          },
        ],
      },
      step2: {
        id: "step2",
        timeLabel: "T+25m",
        description:
          "Families are unsure where to seek care, misinformation about service collapse is spreading, and leadership asks for a confidence-preserving update.",
        choices: [
          {
            id: "2a",
            text: "Issue a unified public health advisory covering triage pathways, nearest care points, and heat-protection guidance.",
            scoreDeltas: { operationalControl: 10, responseTempo: 10, stakeholderTrust: 15, teamAlignment: 10, executiveComms: 15 },
            nextStepId: "step3",
          },
          {
            id: "2b",
            text: "Delay public communication until hospital load is fully stabilized.",
            scoreDeltas: { operationalControl: -5, responseTempo: -10, stakeholderTrust: -20, teamAlignment: -5, executiveComms: -15 },
            nextStepId: "step3",
          },
          {
            id: "2c",
            text: "Allow each hospital and clinic to publish independent instructions to reduce central bottlenecks.",
            scoreDeltas: { operationalControl: -5, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -15, executiveComms: -10 },
            nextStepId: "step3",
          },
        ],
      },
      step3: {
        id: "step3",
        timeLabel: "T+90m",
        description:
          "The surge remains high but controllable if demand is directed. Event operators request clear thresholds for movement pacing and heat risk controls.",
        choices: [
          {
            id: "3a",
            text: "Coordinate phased movement pacing with expanded cooling support and tightened referral criteria for emergency transfers.",
            scoreDeltas: { operationalControl: 15, responseTempo: 5, stakeholderTrust: 10, teamAlignment: 10, executiveComms: 10 },
            nextStepId: "step4",
          },
          {
            id: "3b",
            text: "Maintain full movement intensity to avoid crowd accumulation and perception of restriction.",
            scoreDeltas: { operationalControl: -15, responseTempo: 10, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -10 },
            nextStepId: "step4",
          },
          {
            id: "3c",
            text: "Pause movement abruptly without a staged medical continuity and transport alternative.",
            scoreDeltas: { operationalControl: 0, responseTempo: -10, stakeholderTrust: -5, teamAlignment: 5, executiveComms: -10 },
            nextStepId: "step4",
          },
        ],
      },
      step4: {
        id: "step4",
        timeLabel: "T+36h",
        description:
          "The medical pressure has declined. Authorities now require a documented heat-health readiness plan before the next high-density Umrah window.",
        choices: [
          {
            id: "4a",
            text: "Publish a heat-health readiness package with triage triggers, staffing surge thresholds, and joint communications protocol updates.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 15, teamAlignment: 15, executiveComms: 15 },
            nextStepId: null,
          },
          {
            id: "4b",
            text: "Deliver the review internally and release only a brief reassurance update to the public.",
            scoreDeltas: { operationalControl: 5, responseTempo: 5, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -5 },
            nextStepId: null,
          },
          {
            id: "4c",
            text: "Treat the surge as expected seasonal load and close without structural adjustments.",
            scoreDeltas: { operationalControl: -10, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -10, executiveComms: -10 },
            nextStepId: null,
          },
        ],
      },
    },
  },
  {
    id: "grid-blackout-01",
    title: "Regional Grid Outage and Transport-Service Disruption",
    description:
      "A high-voltage substation fault triggers cascading outages in a major metropolitan cluster. Traffic control systems, metro segments, and water pumping operations face continuity pressure.",
    startStepId: "step1",
    initialScores: { ...BASE_SCORES },
    steps: {
      step1: {
        id: "step1",
        timeLabel: "T+0m",
        description:
          "Power supply drops across critical districts, signals fail on key corridors, and transport control rooms report unstable service conditions.",
        choices: [
          {
            id: "1a",
            text: "Activate integrated utilities command, protect hospitals and critical nodes first, and deploy preplanned load-shedding safeguards.",
            scoreDeltas: { operationalControl: 15, responseTempo: 10, stakeholderTrust: 5, teamAlignment: 15, executiveComms: 10 },
            nextStepId: "step2",
          },
          {
            id: "1b",
            text: "Delay escalation until the utility confirms a precise restoration timeline.",
            scoreDeltas: { operationalControl: -15, responseTempo: -15, stakeholderTrust: -10, teamAlignment: -10, executiveComms: -10 },
            nextStepId: "step2",
          },
          {
            id: "1c",
            text: "Focus only on technical repair and postpone cross-agency service continuity planning.",
            scoreDeltas: { operationalControl: -10, responseTempo: -5, stakeholderTrust: -10, teamAlignment: -15, executiveComms: -10 },
            nextStepId: "step2",
          },
        ],
      },
      step2: {
        id: "step2",
        timeLabel: "T+15m",
        description:
          "Public anxiety grows as transport disruption expands and rumors of prolonged blackout spread across social channels.",
        choices: [
          {
            id: "2a",
            text: "Issue one verified update stream with restoration zones, service prioritization logic, and immediate public action guidance.",
            scoreDeltas: { operationalControl: 10, responseTempo: 10, stakeholderTrust: 15, teamAlignment: 10, executiveComms: 15 },
            nextStepId: "step3",
          },
          {
            id: "2b",
            text: "Limit communication until full technical certainty is available to avoid corrections later.",
            scoreDeltas: { operationalControl: -5, responseTempo: -10, stakeholderTrust: -20, teamAlignment: -5, executiveComms: -15 },
            nextStepId: "step3",
          },
          {
            id: "2c",
            text: "Allow each utility and transport operator to publish separate status updates.",
            scoreDeltas: { operationalControl: -5, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -15, executiveComms: -10 },
            nextStepId: "step3",
          },
        ],
      },
      step3: {
        id: "step3",
        timeLabel: "T+70m",
        description:
          "Partial restoration succeeds in some districts, but instability remains and leadership requests a near-term continuity posture for the next six hours.",
        choices: [
          {
            id: "3a",
            text: "Move to phased restoration with protected critical loads, transport fallback routing, and fixed update cadence.",
            scoreDeltas: { operationalControl: 15, responseTempo: 5, stakeholderTrust: 10, teamAlignment: 10, executiveComms: 10 },
            nextStepId: "step4",
          },
          {
            id: "3b",
            text: "Push immediate broad restoration to return normal optics quickly.",
            scoreDeltas: { operationalControl: -15, responseTempo: 15, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -10 },
            nextStepId: "step4",
          },
          {
            id: "3c",
            text: "Enforce blanket restrictions without publishing priority rationale.",
            scoreDeltas: { operationalControl: 0, responseTempo: -5, stakeholderTrust: -15, teamAlignment: 0, executiveComms: -15 },
            nextStepId: "step4",
          },
        ],
      },
      step4: {
        id: "step4",
        timeLabel: "T+72h",
        description:
          "Grid stability is restored. Decision-makers request a resilience program covering redundancy, coordination triggers, and public communication standards.",
        choices: [
          {
            id: "4a",
            text: "Publish a cross-agency grid resilience plan with tested failover drills and transparent continuity commitments.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 15, teamAlignment: 15, executiveComms: 15 },
            nextStepId: null,
          },
          {
            id: "4b",
            text: "Keep lessons internal and release a short restoration statement only.",
            scoreDeltas: { operationalControl: 5, responseTempo: 5, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -5 },
            nextStepId: null,
          },
          {
            id: "4c",
            text: "Treat this outage as a rare technical anomaly and avoid a broader resilience overhaul.",
            scoreDeltas: { operationalControl: -10, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -10, executiveComms: -10 },
            nextStepId: null,
          },
        ],
      },
    },
  },
  {
    id: "national-digital-id-01",
    title: "National Digital Identity Platform Outage",
    description:
      "A critical authentication fault disrupts access to government digital services and mobile identity verification. Citizens cannot complete key transactions while trust and security concerns escalate rapidly.",
    startStepId: "step1",
    initialScores: { ...BASE_SCORES },
    steps: {
      step1: {
        id: "step1",
        timeLabel: "T+0m",
        description:
          "Login failure rates spike across the national identity platform, call centers surge, and several ministries report service access interruptions.",
        choices: [
          {
            id: "1a",
            text: "Activate cyber incident command, isolate affected authentication services, and trigger continuity access alternatives.",
            scoreDeltas: { operationalControl: 15, responseTempo: 10, stakeholderTrust: 5, teamAlignment: 15, executiveComms: 10 },
            nextStepId: "step2",
          },
          {
            id: "1b",
            text: "Continue monitoring until root cause is fully confirmed before containment actions.",
            scoreDeltas: { operationalControl: -15, responseTempo: -15, stakeholderTrust: -10, teamAlignment: -10, executiveComms: -10 },
            nextStepId: "step2",
          },
          {
            id: "1c",
            text: "Keep the issue technical-only and avoid notifying affected service owners for now.",
            scoreDeltas: { operationalControl: -10, responseTempo: -10, stakeholderTrust: -15, teamAlignment: -15, executiveComms: -10 },
            nextStepId: "step2",
          },
        ],
      },
      step2: {
        id: "step2",
        timeLabel: "T+18m",
        description:
          "Public complaints trend nationally and rumors of data compromise spread. Agencies need aligned communication and temporary access controls.",
        choices: [
          {
            id: "2a",
            text: "Publish a unified incident notice, explain interim access channels, and communicate verified facts with update cadence.",
            scoreDeltas: { operationalControl: 10, responseTempo: 10, stakeholderTrust: 15, teamAlignment: 10, executiveComms: 15 },
            nextStepId: "step3",
          },
          {
            id: "2b",
            text: "Delay external communication until full forensic confirmation is complete.",
            scoreDeltas: { operationalControl: -5, responseTempo: -10, stakeholderTrust: -20, teamAlignment: -5, executiveComms: -15 },
            nextStepId: "step3",
          },
          {
            id: "2c",
            text: "Allow each affected agency to handle messaging and workaround guidance separately.",
            scoreDeltas: { operationalControl: -5, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -20, executiveComms: -10 },
            nextStepId: "step3",
          },
        ],
      },
      step3: {
        id: "step3",
        timeLabel: "T+80m",
        description:
          "Containment is partially effective, but some service clusters remain unstable and leadership requests a risk-informed recovery recommendation.",
        choices: [
          {
            id: "3a",
            text: "Restore services in controlled phases with hardened authentication controls and continuous monitoring gates.",
            scoreDeltas: { operationalControl: 15, responseTempo: 5, stakeholderTrust: 10, teamAlignment: 10, executiveComms: 10 },
            nextStepId: "step4",
          },
          {
            id: "3b",
            text: "Push full service restoration quickly to reduce visible disruption.",
            scoreDeltas: { operationalControl: -15, responseTempo: 15, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -10 },
            nextStepId: "step4",
          },
          {
            id: "3c",
            text: "Keep most services offline until complete forensic closure, without staged alternatives.",
            scoreDeltas: { operationalControl: 0, responseTempo: -15, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -10 },
            nextStepId: "step4",
          },
        ],
      },
      step4: {
        id: "step4",
        timeLabel: "T+48h",
        description:
          "The platform is stabilized. Authorities now require a strengthened cyber-resilience roadmap and accountable post-incident corrective actions.",
        choices: [
          {
            id: "4a",
            text: "Publish post-incident findings with funded control upgrades, red-team testing, and interagency cyber drill commitments.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 15, teamAlignment: 15, executiveComms: 15 },
            nextStepId: null,
          },
          {
            id: "4b",
            text: "Share only internal technical lessons and release a brief closure notice.",
            scoreDeltas: { operationalControl: 5, responseTempo: 5, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -5 },
            nextStepId: null,
          },
          {
            id: "4c",
            text: "Classify the outage as routine and avoid broader governance changes.",
            scoreDeltas: { operationalControl: -10, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -10, executiveComms: -10 },
            nextStepId: null,
          },
        ],
      },
    },
  },
  {
    id: "port-ransomware-01",
    title: "Port Logistics Ransomware and Supply Chain Disruption",
    description:
      "A ransomware incident impacts cargo management systems at a major Saudi port. Clearance workflows slow sharply, trucking queues grow, and critical supply delivery timelines are at risk.",
    startStepId: "step1",
    initialScores: { ...BASE_SCORES },
    steps: {
      step1: {
        id: "step1",
        timeLabel: "T+0m",
        description:
          "Port operators detect encrypted systems, container release functions degrade, and downstream logistics partners report immediate schedule disruption.",
        choices: [
          {
            id: "1a",
            text: "Trigger cyber and logistics joint command, isolate infected systems, and activate manual continuity workflow for critical cargo.",
            scoreDeltas: { operationalControl: 15, responseTempo: 10, stakeholderTrust: 5, teamAlignment: 15, executiveComms: 10 },
            nextStepId: "step2",
          },
          {
            id: "1b",
            text: "Attempt local IT remediation first before notifying national stakeholders.",
            scoreDeltas: { operationalControl: -15, responseTempo: -15, stakeholderTrust: -10, teamAlignment: -10, executiveComms: -10 },
            nextStepId: "step2",
          },
          {
            id: "1c",
            text: "Suspend all cargo movement immediately without a prioritized continuity protocol.",
            scoreDeltas: { operationalControl: -10, responseTempo: -10, stakeholderTrust: -10, teamAlignment: -10, executiveComms: -10 },
            nextStepId: "step2",
          },
        ],
      },
      step2: {
        id: "step2",
        timeLabel: "T+22m",
        description:
          "Importers and transport operators demand timeline clarity, while misinformation spreads about fuel and food supply shortages.",
        choices: [
          {
            id: "2a",
            text: "Issue a verified logistics continuity bulletin with priority cargo classes and expected clearance intervals.",
            scoreDeltas: { operationalControl: 10, responseTempo: 10, stakeholderTrust: 15, teamAlignment: 10, executiveComms: 15 },
            nextStepId: "step3",
          },
          {
            id: "2b",
            text: "Avoid external updates until full system recovery confidence is achieved.",
            scoreDeltas: { operationalControl: -5, responseTempo: -10, stakeholderTrust: -20, teamAlignment: -5, executiveComms: -15 },
            nextStepId: "step3",
          },
          {
            id: "2c",
            text: "Allow each logistics stakeholder to publish independent updates.",
            scoreDeltas: { operationalControl: -5, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -15, executiveComms: -10 },
            nextStepId: "step3",
          },
        ],
      },
      step3: {
        id: "step3",
        timeLabel: "T+2h",
        description:
          "Manual processes protect some critical flows, but cyber risk persists and port throughput remains below required continuity levels.",
        choices: [
          {
            id: "3a",
            text: "Maintain segmented operations, expand verified manual routing, and restore digital services by risk tier.",
            scoreDeltas: { operationalControl: 15, responseTempo: 5, stakeholderTrust: 10, teamAlignment: 10, executiveComms: 10 },
            nextStepId: "step4",
          },
          {
            id: "3b",
            text: "Reconnect all systems at once to recover throughput quickly.",
            scoreDeltas: { operationalControl: -20, responseTempo: 15, stakeholderTrust: -10, teamAlignment: -5, executiveComms: -10 },
            nextStepId: "step4",
          },
          {
            id: "3c",
            text: "Keep strict shutdown posture without expanding continuity alternatives for essential cargo.",
            scoreDeltas: { operationalControl: 0, responseTempo: -15, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -10 },
            nextStepId: "step4",
          },
        ],
      },
      step4: {
        id: "step4",
        timeLabel: "T+96h",
        description:
          "Operations normalize, but national logistics leadership requires a hardening roadmap covering cyber controls, continuity testing, and supplier coordination.",
        choices: [
          {
            id: "4a",
            text: "Implement a port cyber-resilience program with mandatory drills, backup validation, and cross-supply-chain response protocols.",
            scoreDeltas: { operationalControl: 15, responseTempo: 0, stakeholderTrust: 15, teamAlignment: 15, executiveComms: 15 },
            nextStepId: null,
          },
          {
            id: "4b",
            text: "Limit action to internal IT patching and publish a brief closure message.",
            scoreDeltas: { operationalControl: 5, responseTempo: 5, stakeholderTrust: -10, teamAlignment: 0, executiveComms: -5 },
            nextStepId: null,
          },
          {
            id: "4c",
            text: "Treat the attack as isolated and defer broader coordination reforms.",
            scoreDeltas: { operationalControl: -10, responseTempo: 0, stakeholderTrust: -15, teamAlignment: -10, executiveComms: -10 },
            nextStepId: null,
          },
        ],
      },
    },
  },
];

export const DEFAULT_SCENARIO = BUILTIN_SCENARIOS[0];
