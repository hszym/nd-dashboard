import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ND Group — Your details",
  robots: { index: false, follow: false },
};

export default function LpRequestLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#eef0f3] text-slate-900">{children}</div>;
}
