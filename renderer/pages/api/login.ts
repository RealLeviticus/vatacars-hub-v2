import { NextApiRequest, NextApiResponse } from "next";
import { getIronSession, IronSession } from "iron-session";
import { SessionData, sessionOptions } from "../../lib/session";
import { sendApiResponse } from "../../lib/apiResponse";

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    if (req.method !== "POST") return sendApiResponse(res, "error", "Method not allowed.", {}, 405);
    if (!req.body) return sendApiResponse(res, "error", "No data provided.", {}, 400);
    const { id, username, firstName, lastName } = req.body;
    if (!id || !username || !firstName || !lastName) return sendApiResponse(res, "error", "Invalid data provided.", {}, 400);

    session.user = { id, username, firstName, lastName };
    await session.save();
    return sendApiResponse(res, "success", "Logged in successfully.", { user: session.user });
}