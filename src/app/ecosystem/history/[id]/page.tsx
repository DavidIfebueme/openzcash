import Link from "next/link";
import { CommunityCredit } from "@/components/community-credit";
import { notFound } from "next/navigation";
import { readProjectHistory, projectHistoryDirectory } from "@/lib/project-history/data";
import { ProjectHistoryView } from "@/components/project-history/history";
import { BrandMark } from "@/components/ecosystem/identity";
import { historyBrand } from "@/components/project-history/branding";
import styles from "@/components/project-history/history.module.css";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = projectHistoryDirectory().find(item => item.id === id);
  return { title: `${identity?.name ?? "Project"} history · OpenZcash` };
}
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const history = await readProjectHistory(id);
  if (!history) notFound();
  const identity = projectHistoryDirectory().find(item => item.id === id)!;
  return <div className={styles.page}>
    <header className={styles.hero}>
      <div><div className={styles.eyebrow}>Project history / {identity.category}</div><div className={styles.identity}>
        <BrandMark brand={historyBrand(identity)} category={identity.category} /><h1>{history.project.name}</h1>
      </div><p>{history.project.description}</p><CommunityCredit screen="project-history" compact /></div>
      <div className={styles.actions}><Link className={styles.primary} href={`/zarvis?q=${encodeURIComponent(`Show project history for ${identity.id}.`)}`}>Ask about it →</Link><a className={styles.action} href="#history-sources">Verify sources ↓</a></div>
    </header><ProjectHistoryView history={history} /><CommunityCredit screen="project-history" />
  </div>;
}
