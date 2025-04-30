// lib/session.ts
import { SessionOptions } from "iron-session";

// This defines what `req.session.user` will look like
export interface SessionData {
    user?: {
        id: string;
        email: string;
        username: string;
        firstName?: string;
        lastName?: string;
        name?: string;
    };
}

// Session config
export const sessionOptions: SessionOptions = {
    password: process.env.SESSION_SECRET as string,
    cookieName: "vatacars_session",
    cookieOptions: {
        secure: process.env.NODE_ENV === "production",
    },
};

// 🔥 Required for TypeScript to understand `session.user`
declare module "iron-session" {
    interface IronSessionData extends SessionData { }
}
