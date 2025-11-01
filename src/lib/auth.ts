import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { openAPI, organization } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import * as schema from "./schema";
import { logger } from "./logger";

/**
 * Generates a URL-friendly slug from a string
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces/underscores/hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  plugins: [
    organization({
      creatorRole: "admin", // Set default organization creator role to admin
      organizationHooks: {
        afterCreateOrganization: async ({
          organization: org,
          user,
          member,
        }) => {
          logger.info("Organization created via auth.api", {
            organizationId: org.id,
            userId: user.id,
            memberRole: member.role,
            organizationName: org.name,
          });
        },
      },
    }),
    openAPI(),
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      accessType: "offline",
      prompt: "select_account consent",
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx: any) => {
      try {
        // Create default organization after successful social sign-up
        // The callback endpoint is used for OAuth redirects
        if (
          ctx.path.startsWith("/callback/") ||
          ctx.path === "/sign-in/social"
        ) {
          const newSession = ctx.context.newSession;

          if (newSession?.user) {
            logger.info("Creating organization for new user", {
              userId: newSession.user.id,
              userName: newSession.user.name,
              userEmail: newSession.user.email,
              userCreatedAt: newSession.user.createdAt,
            });

            const organizations = await auth.api.listOrganizations({
              // This endpoint requires session cookies.
              headers: ctx.headers,
            });

            if (organizations.length == 0) {
              const orgName = `${newSession.user.name || newSession.user.email}'s Default`;
              let slug = generateSlug(orgName);
              let isSlugAvailable = false;
              let slugAttempt = 0;

              // Keep regenerating slug until we find an available one
              while (!isSlugAvailable) {
                const check = await auth.api.checkOrganizationSlug({
                  body: { slug },
                });

                if (check.status) {
                  isSlugAvailable = true;
                } else {
                  // Append a counter to the slug and try again
                  slugAttempt++;
                  slug = `${generateSlug(orgName)}-${slugAttempt}`;
                }
              }

              const data = await auth.api.createOrganization({
                body: {
                  name: orgName, // required
                  slug: slug, // required
                  userId: newSession.user.id, // server-only
                  keepCurrentActiveOrganization: false,
                },
                // This endpoint requires session cookies.
                headers: ctx.headers,
              });
            }
          }
        }
      } catch (error) {
        logger.error("Error in signup hook:", error);
        // Don't throw - we don't want to break the signup flow
      }
    }),
  },
});
