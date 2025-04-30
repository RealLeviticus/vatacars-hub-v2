// pages/api/session.ts
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../lib/session";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getIronSession<SessionData>(req, res, sessionOptions);

    if (session.user?.id && session.user?.email) {
        return res.status(200).json(session.user);
    }

    // ✅ Return `null` instead of an empty object
    return res.status(200).json(null);
}
