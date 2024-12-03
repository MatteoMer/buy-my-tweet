import { AuthOptions } from "next-auth";

export const authOptions: AuthOptions = {
    providers: [], // Empty array since we're only using WebAuthn
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
    events: {
        async signIn({ user }) {
            if (!user.id) {
                user.id = crypto.randomUUID();
            }
        },
    },
};
