import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  serverExternalPackages: ["nodemailer"],
  env: {
    SESSION_SECRET: process.env.SESSION_SECRET || "ci_test_environment_session_secret_at_least_32_characters_long",
  },
};

export default nextConfig;
