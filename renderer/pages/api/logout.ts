// pages/api/logout.ts
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../lib/session";
import { NextApiRequest, NextApiResponse } from "next";

export default async function logoutRoute(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    session.destroy();
    res.status(200).json({ message: "Logged out successfully." });
}
