import { notFound } from "next/navigation";
import { getVideoData } from "@/lib/data";
import { Player } from "@/components/Player";

export function generateStaticParams() {
  const data = getVideoData();
  return Object.keys(data.videos).map((slug) => ({ slug }));
}

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getVideoData();
  if (!data.videos[slug]) notFound();
  return <Player initialSlug={slug} />;
}
