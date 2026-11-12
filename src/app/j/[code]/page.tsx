import { notFound } from "next/navigation";
import { PhoneApp } from "@/components/phone/PhoneApp";
import { isValidSessionCode } from "@/lib/session-code";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = code.toLowerCase();
  if (!isValidSessionCode(normalized)) notFound();
  return <PhoneApp code={normalized} />;
}
