// pages/api/logout.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions } from "../../lib/session";

export default async function logoutRoute(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    // Get the session and destroy it
    const session = await getIronSession(req, res, sessionOptions);
    session.destroy(); // Destroys the session data

    // Respond with success message
    res.status(200).json({ message: "Logged out successfully." });
}
