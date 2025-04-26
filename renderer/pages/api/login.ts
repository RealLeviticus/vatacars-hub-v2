// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { id, username, firstName, lastName } = req.body;

    if (!id || !username) {
        // Simulate failed login
        return res.status(400).json({ status: 'error', message: 'Missing credentials' });
    }

    // Simulate successful login
    return res.status(200).json({ status: 'success', message: 'Login successful', data: { id, username, firstName, lastName } });
}
