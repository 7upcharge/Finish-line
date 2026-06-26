import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub || token.email;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
export default authOptions;
