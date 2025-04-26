// pages/api/logout.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Simulate clearing the session
    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
}
