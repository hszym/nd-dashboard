import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/ndas/generate": ["./src/lib/templates/nda-company-template.docx"],
  },
  // NDAs now live inside each project (Track tab); the old pages are gone.
  async redirects() {
    return [
      { source: "/ndas", destination: "/", permanent: false },
      { source: "/ndas/new", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
