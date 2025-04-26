import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../lib/session";
import { NextApiRequest, NextApiResponse } from "next";
import { VatACARSUserData } from "../../lib/types";

export default async function loginRoute(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        // Only allow POST method
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    const session = await getIronSession<SessionData>(req, res, sessionOptions);

    const { id, username, firstName, lastName } = req.body as Partial<VatACARSUserData>;

    if (!id || !username || !firstName || !lastName) {
        // Validate that all required fields exist
        return res.status(400).json({ message: "Missing or invalid user data." });
    }

    // Save validated user info to session
    session.user = { id, username, firstName, lastName };
    await session.save();

    res.status(200).json({ message: "Logged in successfully." });
}
