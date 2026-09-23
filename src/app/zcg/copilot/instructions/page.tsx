import { ResearchGuide } from "@/components/copilot/research-guide";

export const metadata = {
  title: "ZCG Copilot research guide · OpenZcash",
  description: "Read the complete ZCG Copilot instructions in your browser.",
};

export default function CopilotInstructionsPage() {
  return <ResearchGuide skill="zcg-copilot" />;
}
