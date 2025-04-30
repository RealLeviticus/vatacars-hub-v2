// pages/api/session.ts
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../lib/session"; // Import session options and types
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Get the session using the session options
    const session = await getIronSession<SessionData>(req, res, sessionOptions);

    if (session.user) {
        // If the user is logged in, return their session data
        return res.status(200).json(session.user);
    }

    // If no user is logged in, return an empty object
    return res.status(200).json({});
}
