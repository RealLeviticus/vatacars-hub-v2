import { getIronSession } from "iron-session";
import { sessionOptions } from "../../lib/session";
import type { SessionData } from "../../lib/session"; // ✅ import session type
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB!;
const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || "AcarsUser";

let cachedClient: MongoClient | null = null;

async function connectToDatabase() {
    if (cachedClient) return cachedClient;

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    cachedClient = client;
    return client;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ status: "error", message: "Method not allowed." });
    }

    const session = await getIronSession<SessionData>(req, res, sessionOptions); // ✅ enforce session type

    const { emailOrUsername, password } = req.body || {};
    if (!emailOrUsername || !password) {
        return res.status(400).json({ status: "error", message: "Missing login fields." });
    }

    try {
        // ✅ Try upstream first
        const upstream = await fetch("https://vatacars.com/api/provider/local", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emailOrUsername, password }),
        });

        if (upstream.ok) {
            const data = await upstream.json();
            session.user = data.data as SessionData["user"]; // ✅ assert type explicitly
            await session.save();
            return res.status(200).json({ status: "success", data: session.user });
        }

        // ✅ Fallback to Mongo
        const client = await connectToDatabase();
        const db = client.db(MONGODB_DB);
        const users = db.collection(MONGODB_COLLECTION);

        const user = await users.findOne({
            $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ status: "error", message: "Invalid credentials." });
        }

        const userData: SessionData["user"] = {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
            firstName: user.firstName || "", // adjust based on your schema
            lastName: user.lastName || "",
            name: user.name || "",
        };

        session.user = userData;
        await session.save();

        return res.status(200).json({ status: "success", data: userData });

    } catch (err) {
        console.error("Auth error:", err);
        return res.status(500).json({ status: "error", message: "Server error." });
    }
}
