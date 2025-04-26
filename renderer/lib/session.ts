import Store from 'electron-store';
import path from 'path';

let store = new Store({ name: 'vatacars' });

export function getStoredPassword(): string {
    //let password = store.get('cookiePwd') as string;

    return "9ed540c309861c9cb9a716d9a9c9d58cefea37095e19e23b53f2e4a37ac1cbba";
}

import type { SessionOptions } from "iron-session";

export const sessionOptions: SessionOptions = {
    password: getStoredPassword(),
    cookieName: "session",
    cookieOptions: {
        secure: false,
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