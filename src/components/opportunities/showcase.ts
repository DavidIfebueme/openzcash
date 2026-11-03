import type { Opportunity } from "./data";

const walletExamples = [
  {
    id: "zodl",
    name: "Zodl",
    title: "Review the first Zodl payment",
    description:
      "Make the amount, recipient and confirmation easier to understand.",
    focus:
      "Walk through a fresh demo wallet and review the receive and payment screens. Identify three moments that could confuse a new user.",
    url: "https://zodl.com/",
  },
  {
    id: "zingo",
    name: "Zingo!",
    title: "Explore a Zingo! indexer connection",
    description:
      "Document a small compatibility test for wallet infrastructure.",
    focus:
      "Prepare a test plan for connecting a supported Zingo! build to an agreed test indexer. Record the network, connection options, sync behavior and any unsupported configuration. This is a proposed compatibility check, not an announced partnership.",
    url: "https://zingolabs.org/zingo/",
  },
  {
    id: "ywallet",
    name: "YWallet",
    title: "Make YWallet recovery easier to follow",
    description: "Explain a restore flow using a disposable demo wallet.",
    focus:
      "Review the recovery instructions and reproduce them with a disposable wallet. Explain what a beginner needs to check before and after restoring.",
    url: "https://ywallet.app/",
  },
  {
    id: "zkool",
    name: "Zkool",
    title: "Review Zkool onboarding",
    description: "Find friction between setup and the first useful screen.",
    focus:
      "Review an available Zkool test build from setup to its main wallet screen. Document loading, empty and error states that a newcomer might see.",
    url: "https://github.com/hhanh00/zkool2",
  },
  {
    id: "cake",
    name: "Cake Wallet",
    title: "Test the Cake Wallet receive flow",
    description: "Review address clarity and the steps for sharing a request.",
    focus:
      "Walk through the supported Zcash receive flow in an agreed demo build. Review labels, copy actions and the information shown before sharing an address.",
    url: "https://cakewallet.com/",
  },
  {
    id: "edge",
    name: "Edge",
    title: "Review Zcash in Edge",
    description:
      "Check how clearly the wallet explains supported Zcash features.",
    focus:
      "Review the Zcash asset screens in the selected Edge build. Record which features and address types are actually available and suggest clearer guidance.",
    url: "https://edge.app/",
  },
  {
    id: "unstoppable",
    name: "Unstoppable",
    title: "Explore Zcash in Unstoppable",
    description:
      "Help users find the asset and understand its available actions.",
    focus:
      "Trace the path from finding Zcash to reviewing the supported asset actions. Document the exact build and distinguish available features from proposed improvements.",
    url: "https://unstoppable.money/",
  },
  {
    id: "brave",
    name: "Brave Wallet",
    title: "Prototype a Brave Wallet handoff",
    description: "Design a clear browser-to-wallet request experience.",
    focus:
      "Map a Zcash request handoff for a Brave Wallet demo. Confirm the selected build’s supported actions first; use a labelled mockup for anything unavailable. No live integration is assumed.",
    url: "https://brave.com/wallet/",
  },
  {
    id: "vizor",
    name: "Vizor",
    title: "Review Vizor connection states",
    description: "Make sync, pending and reconnecting states understandable.",
    focus:
      "Review a supported Vizor demo or test build. Map how it communicates connection, synchronization and pending work, and propose one improvement.",
    url: "https://vizor.cash/",
  },
];

export const showcaseOpportunities: Opportunity[] = [
  {
    id: "test-crosslink",
    title: "Test Crosslink on a feature net",
    description: "Run a focused test and document what happens.",
    community: "open-builders",
    type: "Task",
    category: "Testing",
    reward: 0,
    deadline: "2026-11-28",
    applicants: 0,
    art: "crosslink",
    level: "Intermediate",
    campaign: "shielded-labs-lab",
    brief:
      "Try one documented Crosslink feature-net flow with the official test build. Agree on a small scenario, record the result and make it reproducible. Crosslink is a proposed Zcash upgrade; this example does not imply mainnet activation or a Shielded Labs reward program.",
    deliverables: [
      "A short test report with the build commit, feature net and setup.",
      "Sanitized evidence of the chosen scenario and any reproducible issue.",
      "A suggested documentation fix or clear pass/fail conclusion.",
    ],
    criteria: [
      "Use the current official feature-net instructions and test currency only.",
      "Keep the result tied to the exact build and network tested.",
      "Separate observed behavior from assumptions; include no wallet secrets.",
    ],
    resources: [
      {
        label: "Crosslink overview",
        url: "https://shieldedlabs.net/crosslink/",
      },
      {
        label: "Zebra-Crosslink Book",
        url: "https://shieldedlabs.github.io/zebra-crosslink/",
      },
    ],
  },
  {
    id: "integrate-zero-indexer",
    title: "Connect a demo to zero-indexer",
    description: "Test a wallet or app connection with clear pending states.",
    community: "open-builders",
    type: "Task",
    category: "Development",
    reward: 0,
    deadline: "2026-11-28",
    applicants: 0,
    art: "zero-indexer",
    level: "Intermediate",
    campaign: "shielded-labs-lab",
    brief:
      "Build a small proof of compatibility between an existing wallet or app and an agreed zero-indexer test deployment. Pin the version and endpoint, exercise one supported flow, and document what still needs integration work. This is a proposed community exercise, not a claim of an existing partnership.",
    deliverables: [
      "A minimal demo or integration patch with reproduction steps.",
      "A test matrix covering connection, pending, confirmation and failure.",
      "Notes on supported requests and the privacy assumptions of the tested setup.",
    ],
    criteria: [
      "Use test funds and a deployment explicitly designated for testing.",
      "Never present an accepted request as an on-chain confirmation.",
      "Document metadata exposure and attestation checks without claiming complete anonymity.",
    ],
    resources: [
      { label: "Zero by Shielded Labs", url: "https://shieldedlabs.net/zero/" },
      {
        label: "zero-indexer documentation",
        url: "https://github.com/ShieldedLabs/zero/tree/main/zeronym",
      },
    ],
  },
  ...walletExamples.map(
    (w): Opportunity => ({
      id: w.id + "-wallet-test",
      title: w.title,
      description: w.description,
      community: "wallet-collective",
      type: "Task",
      category: "Wallets",
      reward: 0,
      deadline: "2026-11-26",
      applicants: 0,
      art: w.id,
      level: "All levels",
      brief:
        w.focus +
        " Use an organizer-provided demo, test wallet or clearly labelled prototype. These examples are independent community briefs.",
      deliverables: [
        "A concise walkthrough naming the build and platform.",
        "Three annotated findings, with expected and observed behavior.",
        "One practical improvement with a sketch or reproduction steps.",
      ],
      criteria: [
        "Only demonstrate features verified in the chosen version.",
        "Use disposable test data and keep wallet secrets out of evidence.",
        "Make the findings reproducible and readable on mobile.",
      ],
      resources: [{ label: w.name + " project", url: w.url }],
    }),
  ),
  {
    id: "zcash-explainer",
    title: "Create a one-page Zcash explainer",
    description: "Help a beginner understand their first private payment.",
    community: "language-lab",
    type: "Task",
    category: "Education",
    reward: 0,
    deadline: "2026-11-21",
    applicants: 0,
    art: "education",
    level: "Beginner friendly",
    brief:
      "Write a one-page illustrated guide for a reader who has never used Zcash. Explain one supported payment flow, the terms they will see and where to find official help.",
    deliverables: [
      "An accessible one-page guide and editable source.",
      "A short glossary and links supporting the instructions.",
    ],
    criteria: [
      "Use plain language and version-specific instructions.",
      "Separate payment privacy from device and network privacy.",
    ],
  },
  {
    id: "zero-stack-workshop",
    title: "Explore the Zero infrastructure stack",
    description: "Connect a small demo to a documented test setup.",
    community: "open-builders",
    type: "Task",
    category: "Development",
    reward: 0,
    deadline: "2026-11-27",
    applicants: 0,
    art: "workshop",
    level: "Intermediate",
    campaign: "shielded-labs-lab",
    brief:
      "Prepare a short developer walkthrough using supported components from the Zero stack. Choose one read-only integration, such as showing node or indexer health in a demo dashboard, and pin the versions used.",
    deliverables: [
      "A minimal read-only demo and setup notes.",
      "A diagram naming each component and the interface it uses.",
      "One documented success case and one unavailable-service state.",
    ],
    criteria: [
      "Follow the selected components’ official documentation.",
      "Run against an agreed test setup and avoid exposing credentials.",
      "Mark any proposed or unimplemented connection clearly.",
    ],
    resources: [
      {
        label: "Zero software stack",
        url: "https://github.com/ShieldedLabs/zero",
      },
      { label: "Zero overview", url: "https://shieldedlabs.net/zero/" },
    ],
  },
  {
    id: "community-meetup-kit",
    title: "Plan a local Zcash meetup",
    description: "Build a small, reusable kit for a community gathering.",
    community: "privacy-creators",
    type: "Task",
    category: "Events",
    reward: 0,
    deadline: "2026-11-23",
    applicants: 0,
    art: "meetup",
    level: "All levels",
    language: "pt",
    country: "BR",
    brief:
      "Prepare a meetup plan in Portuguese for a Brazilian community. Keep the format simple enough for a small volunteer group to run.",
    deliverables: [
      "A one-hour agenda and short facilitator notes.",
      "An editable invitation and a practical venue checklist.",
    ],
    criteria: [
      "Separate the proposed event from a confirmed booking.",
      "Keep the invitation readable and include no invented sponsors.",
    ],
  },
  {
    id: "zcash-short-film",
    title: "Make a 30-second Zcash demo",
    description: "Show one useful interaction in a clear short film.",
    community: "privacy-creators",
    type: "Contest",
    category: "Content",
    reward: 0,
    deadline: "2026-11-25",
    applicants: 0,
    art: "video",
    level: "All levels",
    brief:
      "Make a short screen-led film explaining a single Zcash interaction. Use a labelled demo or prototype, readable captions and a simple story.",
    deliverables: [
      "A 30-second film with captions and transcript.",
      "Editable source and attribution for any reused media.",
    ],
    criteria: [
      "The interaction is easy to follow on a phone.",
      "Demo activity is clearly identified and factual claims have sources.",
    ],
  },
  {
    id: "zero-privacy-check",
    title: "Review a zero-indexer privacy flow",
    description: "Map what each service can observe in one test scenario.",
    community: "wallet-collective",
    type: "Task",
    category: "Research",
    reward: 0,
    deadline: "2026-11-27",
    applicants: 0,
    art: "security",
    level: "Intermediate",
    campaign: "shielded-labs-lab",
    brief:
      "Review one documented zero-indexer test flow and draw its data path. Explain what the wallet, indexer and other services can observe. Keep the review small and specific to the chosen build.",
    deliverables: [
      "A labelled diagram and short evidence-based assessment.",
      "A list of assumptions and checks that remain unverified.",
    ],
    criteria: [
      "Distinguish transaction content, timing, IP metadata and hardware trust.",
      "Avoid treating a single successful test as a security audit.",
    ],
    resources: [
      {
        label: "zero-indexer security model",
        url: "https://github.com/ShieldedLabs/zero/tree/main/zeronym#security",
      },
    ],
  },
  {
    id: "community-welcome-kit",
    title: "Create a Zcash community welcome kit",
    description: "Give new contributors a friendly place to start.",
    community: "privacy-creators",
    type: "Task",
    category: "Community",
    reward: 0,
    deadline: "2026-11-22",
    applicants: 0,
    art: "community",
    level: "Beginner friendly",
    language: "es",
    country: "GLOBAL",
    brief:
      "Create a compact Spanish-language welcome kit for a Zcash community. Help a newcomer find reliable resources and choose a first contribution.",
    deliverables: [
      "A welcome message, resource list and three suggested first steps.",
      "Editable source and a note on how to keep links current.",
    ],
    criteria: [
      "Use clear Spanish and verify the linked resources.",
      "Do not imply official sponsorship or require personal financial information.",
    ],
  },
];
