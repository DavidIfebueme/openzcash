export type Opportunity = {
  id: string;
  title: string;
  description: string;
  community: string;
  type: "Task" | "Contest" | "Hackathon";
  category: string;
  reward: number;
  deadline: string;
  applicants: number;
  art: string;
  level: string;
  campaign?: string;
  brief: string;
  deliverables: string[];
  criteria: string[];
  prizes?: number[];
  resources?: { label: string; url: string }[];
  language?: string;
  country?: string;
};
export const communities = [
  {
    id: "open-builders",
    name: "Open Builders",
    mark: "OB",
    color: "gold",
    description: "Small, useful tools that make Zcash easier to use.",
    focus: "Development",
    members: 24,
  },
  {
    id: "privacy-creators",
    name: "Privacy Creators",
    mark: "PC",
    color: "purple",
    description:
      "Explaining privacy through stories, design, and everyday examples.",
    focus: "Content & design",
    members: 18,
  },
  {
    id: "language-lab",
    name: "Language Lab",
    mark: "LL",
    color: "green",
    description: "Making Zcash resources accessible in more languages.",
    focus: "Translation",
    members: 16,
  },
  {
    id: "wallet-collective",
    name: "Wallet Collective",
    mark: "WC",
    color: "blue",
    description:
      "Helping people feel confident making their first shielded payment.",
    focus: "Research",
    members: 12,
  },
];
export const opportunities: Opportunity[] = [
  {
    id: "0xramp-pay-brasil",
    title: "Teste o PAY da 0xramp com Pix",
    description:
      "Avalie o fluxo de pagamento e ajude a melhorar a experiência no Brasil.",
    community: "open-builders",
    type: "Task",
    category: "Testing",
    reward: 0.5,
    deadline: "2026-11-28",
    applicants: 0,
    art: "0xramp-pay",
    level: "All levels",
    language: "pt",
    country: "BR",
    brief:
      "Teste a experiência do PAY da 0xramp para um pagamento via Pix: entrada dos dados, revisão do valor e destinatário, acompanhamento e recibo. Após a seleção, o organizador fornece o ambiente de demonstração e os dados de teste. Registre o que ficou claro, onde houve dúvida e quais problemas conseguiu reproduzir. Esta oportunidade é um exemplo comunitário; a recompensa é ilustrativa.",
    deliverables: [
      "Um relato em português com os passos percorridos, dispositivo e navegador.",
      "Capturas ou vídeo com dados de demonstração, cobrindo revisão, acompanhamento e recibo.",
      "Uma lista curta de problemas reproduzíveis e sugestões de melhoria.",
    ],
    criteria: [
      "Usar somente o ambiente e os dados de demonstração definidos pelo organizador. Nenhum pagamento real é necessário.",
      "Distinguir valor previsto, estado pendente e confirmação; não apresentar uma tela de revisão como pagamento concluído.",
      "Descrever o resultado esperado e observado de cada problema, sem expor chaves, credenciais ou dados pessoais.",
    ],
    resources: [{ label: "Conheça a 0xramp", url: "https://0xramp.app/" }],
  },
  {
    id: "hashsmash-november",
    title: "HashSmash: finish November in first place",
    description: "Take the lead in the SHA-256, 40-round track on Yukon.",
    community: "open-builders",
    type: "Contest",
    category: "Research",
    reward: 3,
    prizes: [3],
    deadline: "2026-11-30",
    applicants: 0,
    art: "hashsmash",
    level: "Advanced",
    brief:
      "Create a cheaper collision-attack result for reduced-round SHA-256 and finish November at the top of the 40-round HashSmash track. This example is a community-organized monthly contest, independent of Yukon. The displayed reward is illustrative and unfunded.\n\nThe track stays fixed at SHA-256 with 40 rounds for this edition. Results for another algorithm or round count are outside its scope.",
    deliverables: [
      "A public Yukon result link, submitted from November 1, 00:00 UTC through November 30, 2026, 23:59 UTC.",
      "The source repository and exact commit, reproduction steps, and evidence supporting the reported cost.",
      "Author and collaborator attribution, plus a timestamped record of the official track at the deadline.",
    ],
    criteria: [
      "At the deadline, your accepted result must have the lowest reported log₂(T × M′) cost among all scored SHA-256 results with exactly 40 rounds, including results from before November.",
      "The organizer checks the evidence within seven days. Pending, rejected, withdrawn or invalidated results do not qualify; an AI review alone is not a mathematical proof.",
      "Ties at the official reported precision share the first-place reward equally. One result receives one share, regardless of the number of collaborators.",
      "If no eligible November result holds first place at the deadline and passes review, no reward is awarded. The track and cutoff cannot change during this edition.",
    ],
    resources: [
      {
        label: "HashSmash results on Yukon",
        url: "https://www.yukon.org/hashsmash",
      },
    ],
  },
  {
    id: "run-zebra",
    title: "Run a Zebra node",
    description: "Sync a node and publish a reproducible setup guide.",
    community: "open-builders",
    type: "Task",
    category: "Development",
    reward: 1,
    deadline: "2026-11-24",
    applicants: 0,
    art: "zebra",
    level: "Intermediate",
    brief:
      "Set up a Zebra full node on the network agreed with the organizer, verify that it follows the chain tip, and document the setup so another contributor can reproduce it. Apply before starting; the selected contributor agrees on the host and operating costs with the organizer.",
    deliverables: [
      "A setup guide with the Zebra version, network, operating system and hardware requirements.",
      "Timestamped, sanitized sync and health evidence, plus a successful restart check.",
      "A short maintenance guide covering updates, disk use and troubleshooting.",
    ],
    criteria: [
      "The node reaches the agreed network tip and resumes correctly after a restart.",
      "The guide follows the official Zebra documentation and identifies any deviations.",
      "Evidence contains no credentials, private keys or sensitive host information.",
    ],
    resources: [{ label: "The Zebra Book", url: "https://zebra.zfnd.org/" }],
  },
  {
    id: "run-zakura",
    title: "Run a Zakura node",
    description: "Document a working node from setup to steady operation.",
    community: "open-builders",
    type: "Task",
    category: "Development",
    reward: 1,
    deadline: "2026-11-24",
    applicants: 0,
    art: "zakura",
    level: "Intermediate",
    brief:
      "Set up a Zakura full node using the official project instructions. Agree on the network, storage approach and host with the organizer after selection. Deliver a reproducible guide and evidence of synchronization, restart behavior and routine operation.",
    deliverables: [
      "A setup guide with the Zakura version, network, host requirements and storage configuration.",
      "Timestamped, sanitized evidence of synchronization and a successful restart.",
      "Operating notes covering disk use, updates and recovery from common failures.",
    ],
    criteria: [
      "The node follows the agreed network tip and resumes after a restart.",
      "The chosen configuration and any snapshot source are documented and traceable to official instructions.",
      "No credentials, private keys or sensitive host information are included in public evidence.",
    ],
    resources: [
      {
        label: "Zakura setup and downloads",
        url: "https://zakura.com/download/",
      },
    ],
  },
  {
    id: "payment-links",
    title: "Build a shielded payment link",
    description: "Turn a payment request into a link anyone can share.",
    community: "open-builders",
    type: "Task",
    category: "Development",
    reward: 3,
    deadline: "2026-11-20",
    applicants: 8,
    art: "wallet",
    level: "Intermediate",
    campaign: "november",
    brief:
      "Create a small, open-source tool that lets someone prepare a Zcash payment request and share it as a link or QR code. Keep the recipient address and requested amount easy to review before opening a compatible wallet.",
    deliverables: [
      "A working demo with a shareable request and QR code.",
      "A public repository with setup instructions and a clear license.",
      "A short walkthrough of the request, review, and wallet handoff.",
    ],
    criteria: [
      "The recipient and amount remain accurate throughout the flow.",
      "The interface works on a phone and can be used with a keyboard.",
      "The tool never asks for a seed phrase or spending key.",
    ],
  },
  {
    id: "privacy-stories",
    title: "Make privacy easy to understand",
    description: "Tell a short story about why financial privacy matters.",
    community: "privacy-creators",
    type: "Contest",
    category: "Content",
    reward: 2,
    deadline: "2026-11-22",
    applicants: 12,
    art: "story",
    level: "All levels",
    campaign: "november",
    brief:
      "Create a 60–90 second video that explains one practical use of financial privacy. Start with a relatable situation, keep the language simple, and make the connection to Zcash accurate.",
    deliverables: [
      "One original video, 60–90 seconds, with captions.",
      "A transcript and links supporting factual claims.",
      "A note identifying licensed assets and any use of AI.",
    ],
    criteria: [
      "An accurate, understandable explanation of the chosen use case.",
      "A clear story and readable captions on a phone.",
      "Originality and thoughtful use of visual material.",
    ],
  },
  {
    id: "portuguese-guide",
    language: "pt",
    country: "BR",
    title: "Bring Zcash to Portuguese",
    description: "Help a new audience make their first shielded payment.",
    community: "language-lab",
    type: "Task",
    category: "Translation",
    reward: 2,
    deadline: "2026-11-18",
    applicants: 5,
    art: "language",
    level: "Beginner friendly",
    campaign: "november",
    brief:
      "Translate a beginner’s Zcash guide into Brazilian Portuguese. Preserve the technical meaning while making the instructions sound natural. A reviewer will provide the source guide after assignment.",
    deliverables: [
      "The translated guide in Markdown.",
      "A short glossary for terms such as shielded address and recovery phrase.",
      "A list of any source instructions that need clarification.",
    ],
    criteria: [
      "Technical meaning is preserved.",
      "The language is clear and natural for Brazilian readers.",
      "Formatting, links, and terminology are consistent.",
    ],
  },
  {
    id: "first-payment",
    title: "Design a better first payment",
    description: "Make the first-time wallet experience feel effortless.",
    community: "privacy-creators",
    type: "Contest",
    category: "Design",
    reward: 3,
    deadline: "2026-11-25",
    applicants: 7,
    art: "design",
    level: "Intermediate",
    campaign: "november",
    brief:
      "Design a mobile flow that helps someone review and make their first Zcash payment. Focus on address clarity, confirmation, and recovery from errors. This is a design challenge; no real funds are needed.",
    deliverables: [
      "A clickable prototype with the happy path and one error state.",
      "Five to eight key screens with annotations.",
      "A short explanation of the design decisions.",
    ],
    criteria: [
      "The recipient, amount, and next action are always clear.",
      "The flow accounts for loading, failure, and confirmation.",
      "The design is legible and accessible on small screens.",
    ],
  },
  {
    id: "weekend-build",
    title: "A weekend to build with Zcash",
    description: "Bring a small idea. Leave with a working prototype.",
    community: "open-builders",
    type: "Hackathon",
    category: "Development",
    reward: 8,
    deadline: "2026-11-29",
    applicants: 16,
    art: "code",
    level: "All levels",
    brief:
      "An example weekend hackathon for small teams building useful Zcash prototypes. Choose one everyday problem and demonstrate a clear, working solution. The prize pool is shared across three winning projects.",
    deliverables: [
      "A working prototype and source repository.",
      "A two-minute demo video.",
      "A concise description of the problem, users, and next step.",
    ],
    criteria: [
      "A working core interaction.",
      "A useful connection to Zcash and a realistic privacy description.",
      "A demo that makes the project easy to evaluate.",
    ],
  },
  {
    id: "wallet-research",
    title: "Help improve wallet onboarding",
    description: "Find the moments that confuse first-time users.",
    community: "wallet-collective",
    type: "Task",
    category: "Research",
    reward: 0.8,
    deadline: "2026-11-16",
    applicants: 4,
    art: "research",
    level: "Beginner friendly",
    brief:
      "Review a sample wallet onboarding flow and document the points where a beginner might get stuck. Work with a test environment and example accounts only.",
    deliverables: [
      "A concise report of five usability findings.",
      "Annotated screenshots from the test environment.",
      "A practical recommendation for each finding.",
    ],
    criteria: [
      "Findings describe an observable problem and its impact.",
      "Recommendations are specific and achievable.",
      "No personal information or real wallet secrets appear in the report.",
    ],
  },
];
export const communityFor = (id: string) =>
  communities.find((c) => c.id === id) ?? communities[0];
export const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
export const zec = (amount: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(amount);
