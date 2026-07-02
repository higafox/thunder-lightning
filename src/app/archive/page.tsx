import { getVideoData } from "@/lib/data";
import { ArchiveGrid } from "@/components/ArchiveGrid";

export default function ArchivePage() {
  const data = getVideoData();
  return <ArchiveGrid data={data} />;
}
