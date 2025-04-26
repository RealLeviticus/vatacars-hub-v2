import { useEffect } from "react";
import Router from "next/router";
import useSWR from "swr";
import fetcher from "./fetcher";
import type { VatACARSUserData } from "./types";

interface UseUserOptions {
    redirectTo?: string;
    redirectIfFound?: boolean;
}

export default function useUser({ redirectTo = "", redirectIfFound = false }: UseUserOptions = {}) {
    let fallbackUser: VatACARSUserData | undefined = undefined;

    if (typeof window !== "undefined") {
        const userString = localStorage.getItem("user");
        if (userString) {
            try {
                fallbackUser = JSON.parse(userString);
            } catch (err) {
                console.error("Failed to parse user from localStorage", err);
            }
        }
    }

    const { data: user, mutate: mutateUser, isValidating } = useSWR<VatACARSUserData>("/api/session", fetcher, {
        fallbackData: fallbackUser,
    });

    useEffect(() => {
        if (!redirectTo || isValidating) return;

        if (
            (redirectTo && !redirectIfFound && !user?.username) ||
            (redirectIfFound && user?.username)
        ) {
            Router.push(redirectTo);
        }
    }, [user, redirectIfFound, redirectTo, isValidating]);

    return { user, mutateUser, isLoading: !user && isValidating };
}
