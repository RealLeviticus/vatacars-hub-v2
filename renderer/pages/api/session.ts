// pages/api/session.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    // Mocked user session
    const mockUser = {
        id: "123",
        username: "testuser",
        firstName: "Test",
        lastName: "User",
    };

    res.status(200).json(mockUser);
}
