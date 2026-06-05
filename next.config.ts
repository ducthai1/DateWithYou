import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Run these as native Node modules instead of bundling them. Better Auth ships
  // optional sqlite (kysely) dialects we don't use; bundling them pulls in a
  // mismatched kysely export and breaks the build. mongoose/mongodb also prefer
  // to stay external on the server.
  serverExternalPackages: [
    "better-auth",
    "@better-auth/kysely-adapter",
    "kysely",
    "mongodb",
    "mongoose",
  ],
};

export default nextConfig;
