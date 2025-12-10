import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
