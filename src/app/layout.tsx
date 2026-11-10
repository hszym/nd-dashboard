import type { Metadata, Viewport } from "next";
import "./globals.css";

// Lets the home backdrop extend under the phone's status bar / notch.
export const viewport: Viewport = { viewportFit: "cover" };

export const metadata: Metadata = {
  title: "ND Group — Case Dashboard",
  description: "Internal dashboard for tracking case documents and fundraising status",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
