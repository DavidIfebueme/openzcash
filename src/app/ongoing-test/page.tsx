import { redirect } from "next/navigation";

export default function OngoingTestPage() {
  // Temporary until Ongoing Test has its own project index.
  redirect("/ongoing-test/crosslink");
}
