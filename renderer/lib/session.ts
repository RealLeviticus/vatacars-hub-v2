// lib/session.ts
import { SessionOptions } from "iron-session";

// Define the type for session data
export interface SessionData {
    user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    };
}

// Configure the session options (must have the password)
export const sessionOptions: SessionOptions = {
    password: process.env.SESSION_SECRET as string, // Use the secret from .env file
    cookieName: "vatacars_session", // Name of the session cookie
    cookieOptions: {
        secure: process.env.NODE_ENV === "production", // Secure cookies only in production
    },
};
