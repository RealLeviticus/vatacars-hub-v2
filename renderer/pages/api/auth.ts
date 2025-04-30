import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import 'dotenv/config'; // ✅ Load .env variables

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB = process.env.MONGODB_DB || "test";
const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || "AcarsUser";

let cachedClient: MongoClient | null = null;

async function connectToDatabase() {
    if (cachedClient) return cachedClient;

    if (!globalThis.mongoClient) {
        const client = new MongoClient(MONGODB_URI, {
            serverApi: { version: "1" },
        });
        await client.connect();
        globalThis.mongoClient = client;
    }

    cachedClient = globalThis.mongoClient;
    return cachedClient;
}

export default async function handler(req, res) {
    try {
        // Try the upstream vatacars.com API first
        const upstreamResponse = await fetch("https://vatacars.com/api/provider/local", {
            method: req.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });

        if (upstreamResponse.ok) {
            const data = await upstreamResponse.json();
            return res.status(200).json(data);
        }

        console.warn("[Upstream API Error] Falling back to local MongoDB...");

        const client = await connectToDatabase();
        const db = client.db(MONGODB_DB);
        const users = db.collection(MONGODB_COLLECTION);

        const { emailOrUsername, password } = req.body;

        if (!emailOrUsername || !password) {
            return res.status(400).json({
                status: "error",
                message: "Username or email and password are required.",
            });
        }

        const user = await users.findOne({
            $or: [
                { email: emailOrUsername },
                { username: emailOrUsername }
            ],
        });

        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found.",
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: "error",
                message: "Invalid credentials.",
            });
        }

        return res.status(200).json({
            status: "success",
            data: {
                id: user._id,
                email: user.email,
                username: user.username,
                name: user.name,
            },
        });

    } catch (error) {
        console.error("[Proxy or Database Error]", error);
        return res.status(500).json({
            status: "error",
            message: "Internal server error connecting to vatacars.com or MongoDB.",
        });
    }
}
