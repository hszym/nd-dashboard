import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/ndas/generate": ["./src/lib/templates/nda-company-template.docx"],
  },
};

export default nextConfig;
