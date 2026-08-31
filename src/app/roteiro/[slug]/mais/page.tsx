import { MaisView } from "@/components/roteiro/MaisView";

export default async function MaisPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MaisView slug={slug} />;
}
