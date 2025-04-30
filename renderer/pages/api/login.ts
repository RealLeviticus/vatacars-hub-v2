import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "../../lib/session"; // Import your sessionOptions and SessionData
import { NextApiRequest, NextApiResponse } from "next";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const MONGODB_URI = "mongodb+srv://therealleviticus:Lismore369@vatacars.nqowdou.mongodb.net/?retryWrites=true&w=majority&appName=vatACARS";
const MONGODB_DB = "test"; // Your MongoDB database name
const MONGODB_COLLECTION = "users"; // Your MongoDB collection name

let cachedClient: MongoClient | null = null;

async function connectToDatabase() {
    if (cachedClient) {
        return cachedClient;
    }

    const client = new MongoClient(MONGODB_URI, {
        serverApi: { version: "1" },
    });

    await client.connect();
    cachedClient = client;
    return client;
}

export default async function loginRoute(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        // Connect to the database
        const client = await connectToDatabase();
        const db = client.db(MONGODB_DB);
        const users = db.collection(MONGODB_COLLECTION);

        // Find user by email
        const user = await users.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Compare password with stored hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        // Save user data to session
        const session = await getIronSession<SessionData>(req, res, sessionOptions); // Type the session
        session.user = {
            id: user._id.toString(), // Convert ObjectId to string
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        };
        await session.save();

        res.status(200).json({ message: "Logged in successfully." });

    } catch (error) {
        console.error("[MongoDB or Session Error]", error);
        res.status(500).json({ message: "Internal server error." });
    }
}
