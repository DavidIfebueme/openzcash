import { ResearchGuide } from "@/components/copilot/research-guide";

export const metadata = {
  title: "ZecHub Copilot research guide · OpenZcash",
  description: "Read the complete ZecHub Copilot instructions in your browser.",
};

export default function CopilotInstructionsPage() {
  return <ResearchGuide skill="zechub-copilot" />;
}
