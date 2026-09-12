import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";

import { env, isEmailDeliveryConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const emailFrom = env.EMAIL_FROM ?? "Group Trip <no-reply@example.com>";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/check-email",
  },
  providers: [
    Nodemailer({
      from: emailFrom,
      // When SMTP isn't configured, `sendVerificationRequest` below never
      // touches this transport — it's only here to satisfy the provider's
      // constructor, which requires a `server` value to be present.
      server: isEmailDeliveryConfigured
        ? {
            host: env.EMAIL_SERVER_HOST,
            port: env.EMAIL_SERVER_PORT,
            auth: {
              user: env.EMAIL_SERVER_USER,
              pass: env.EMAIL_SERVER_PASSWORD,
            },
          }
        : { jsonTransport: true },
      async sendVerificationRequest({ identifier, url }) {
        if (!isEmailDeliveryConfigured) {
          // Local/dev fallback: no SMTP credentials configured, so print the
          // sign-in link instead of failing. Never do this in production —
          // isEmailDeliveryConfigured is only false there is missing config.
          console.log(
            `\n[dev] Sign-in link for ${identifier}:\n${url}\n`,
          );
          return;
        }

        const { createTransport } = await import("nodemailer");
        const transport = createTransport({
          host: env.EMAIL_SERVER_HOST,
          port: env.EMAIL_SERVER_PORT,
          auth: {
            user: env.EMAIL_SERVER_USER,
            pass: env.EMAIL_SERVER_PASSWORD,
          },
        });

        await transport.sendMail({
          to: identifier,
          from: emailFrom,
          subject: "Sign in to Group Trip",
          text: `Sign in by opening this link:\n${url}`,
          html: `<p>Sign in by clicking the link below.</p><p><a href="${url}">${url}</a></p>`,
        });
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
