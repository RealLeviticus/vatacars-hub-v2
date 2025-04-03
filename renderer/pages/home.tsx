import React, { useEffect, useState } from 'react';
import { useRouter } from "next/router";
import useUser from "../lib/useUser";
import { randomBytes } from 'crypto';

export default function Home() {
    const { user, isLoading } = useUser();
    const router = useRouter();
    const [Pwd, setPwd] = useState(false)


    useEffect(() => {
        window.ipc.on('storeInteractionReply', (arg: { setting: string; property: any }) => {
            if (arg.setting == 'cookiePwd') {
                if (!arg.property) setPwd(true);
            }
        });

        window.ipc.send('storeInteraction', {
            action: 'get',
            setting: 'cookiePwd',
        });
    }, [])

    useEffect(() => {
        if (!Pwd) return
        window.ipc.send('storeInteraction', {
            action: 'set',
            setting: 'cookiePwd',
            property: "9ed540c309861c9cb9a716d9a9c9d58cefea37095e19e23b53f2e4a37ac1cbba",
        });
    }, [Pwd])

    useEffect(() => {
        console.log("User:", user);
        console.log("IsLoading:", isLoading);

        if (!isLoading && !user) {
            router.push("/login");
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        return <div>Redirecting to login...</div>;
    }

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <h1 className="text-xl">Welcome, {user.username}!</h1>
            <p>You are now logged in.</p>
            <h2 className="text-xl">We are in a pre release state</h2>
        </div>
    );
}
