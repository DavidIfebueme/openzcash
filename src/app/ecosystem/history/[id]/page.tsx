import { CommunityCredit } from "@/components/community-credit";
import { notFound } from "next/navigation";
import { readProjectHistory, projectHistoryDirectory } from "@/lib/project-history/data";
import { ProjectHistoryView } from "@/components/project-history/history";
import { CommunityMark } from "@/components/communities/community-mark";
import { BrandMark } from "@/components/ecosystem/identity";
import { historyBrand, historyCommunityMark } from "@/components/project-history/branding";
import { safeExternalUrl } from "@/lib/ecosystem/catalog";
import styles from "@/components/project-history/history.module.css";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = (await projectHistoryDirectory()).find(item => item.id === id);
  return { title: `${identity?.name ?? "Project"} history · OpenZcash` };
}
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const history = await readProjectHistory(id);
  if (!history) notFound();
  const identity = (await projectHistoryDirectory()).find(item => item.id === id)!;
  const community = historyCommunityMark(identity);
  return <div className={styles.page}>
    <header className={styles.hero}>
      <div><div className={styles.eyebrow}>{identity.category} / Project record</div><div className={styles.identity}>
        {community ? <CommunityMark community={community} size={48} /> : <BrandMark brand={historyBrand(identity)} category={identity.category} />}<h1>{history.project.name}</h1>
      </div><p>{history.project.description}</p></div>
      <div className={styles.actions}>{safeExternalUrl(history.project.website) && <a className={styles.action} href={safeExternalUrl(history.project.website)!} target="_blank" rel="noopener noreferrer">Project website ↗</a>}<a className={styles.action} href="#history-sources">Sources ↓</a></div>
    </header><ProjectHistoryView history={history} /><CommunityCredit screen="project-history" />
  </div>;
}
