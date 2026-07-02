import { getVideoData } from "@/lib/data";
import { Player } from "@/components/Player";

export default function HomePage() {
  const data = getVideoData();
  return <Player data={data} initialSlug={null} />;
}
