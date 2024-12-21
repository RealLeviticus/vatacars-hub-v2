import { randomBytes } from 'crypto';
import Store from 'electron-store';

const isProd = process.env.NODE_ENV === 'production';
let store;

if (isProd) store = new Store({ name: 'vatacars' });
else store = new Store({ name: 'vatacars-dev' });

export function getStoredPassword(): string {
    let password = store.get('auth_cookie_pwd') as string;

    if (!password) {
        password = randomBytes(32).toString('hex');
        store.set('auth_cookie_pwd', password);
    }

    return password;
}

import type { SessionOptions } from "iron-session";

export const sessionOptions: SessionOptions = {
    password: getStoredPassword(),
    cookieName: "session",
    cookieOptions: {
        secure: true
    }
}

export interface SessionData {
    user: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
    }
}