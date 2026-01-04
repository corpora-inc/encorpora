import type { NextConfig } from "next";

const normalizeBasePath = (value?: string) => {
  const trimmed = (value || "").trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized.replace(/\/$/, "");
};

const basePath = normalizeBasePath(process.env.ENCORPORA_BASE_PATH);

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || "",
  env: {
    NEXT_PUBLIC_ENCORPORA_BASE_PATH: basePath,
  },
};

export default nextConfig;
