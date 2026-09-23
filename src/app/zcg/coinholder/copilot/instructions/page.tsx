import { ResearchGuide } from "@/components/copilot/research-guide";

export const metadata = {
  title: "Coinholder Copilot research guide · OpenZcash",
  description: "Read the complete Coinholder Copilot instructions in your browser.",
};

export default function CopilotInstructionsPage() {
  return <ResearchGuide skill="coinholder-copilot" />;
}
