import { notFound } from "next/navigation";
import { ProjectorApp } from "@/components/projector/ProjectorApp";
import { isValidSessionCode } from "@/lib/session-code";

export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const normalized = code.toLowerCase();
  if (!isValidSessionCode(normalized)) notFound();

  return <ProjectorApp code={normalized} demo={"demo" in query} admin={"admin" in query} />;
}
