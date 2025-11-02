import "dotenv/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { openAPI, organization } from "better-auth/plugins";
import * as schema from "./schema";
import { logger } from "./logger";
import { eq } from "drizzle-orm";

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
  trustedOrigins: [
    "https://intercall-web.vercel.app",
    "http://localhost:3000",
    "https://intercall.segarloka.cc",
  ],
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
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            logger.info("New user created, setting up default organization", {
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
            });

            // Check if user already has organizations
            const existingOrgs = await db
              .select()
              .from(schema.member)
              .where(eq(schema.member.userId, user.id));

            if (existingOrgs.length === 0) {
              const orgName = `${user.name || user.email}'s Default`;
              let slug = generateSlug(orgName);
              let isSlugAvailable = false;
              let slugAttempt = 0;

              // Keep regenerating slug until we find an available one
              while (!isSlugAvailable) {
                const existingOrg = await db
                  .select()
                  .from(schema.organization)
                  .where(eq(schema.organization.slug, slug));

                if (existingOrg.length === 0) {
                  isSlugAvailable = true;
                } else {
                  // Append a counter to the slug and try again
                  slugAttempt++;
                  slug = `${generateSlug(orgName)}-${slugAttempt}`;
                }
              }

              // Create organization directly in database
              const newOrg = await db
                .insert(schema.organization)
                .values({
                  id: `org_${Date.now()}`,
                  name: orgName,
                  slug: slug,
                  createdAt: new Date(),
                })
                .returning();

              // Add user as admin member of the new organization
              if (newOrg.length > 0) {
                await db.insert(schema.member).values({
                  id: `member_${Date.now()}`,
                  organizationId: newOrg[0].id,
                  userId: user.id,
                  role: "admin",
                  createdAt: new Date(),
                });

                logger.info("Default organization created successfully", {
                  organizationId: newOrg[0].id,
                  organizationName: orgName,
                  organizationSlug: slug,
                  userId: user.id,
                });
              }
            }
          } catch (error) {
            logger.error("Error creating default organization:", error);
            // Don't throw - we don't want to break the user creation flow
          }

          return user;
        },
      },
    },
  },
});
