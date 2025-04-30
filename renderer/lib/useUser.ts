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

    // Check localStorage for fallback user data (useful for development or first load)
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

    // Fetch user session from /api/session
    const { data: user, mutate: mutateUser, isValidating } = useSWR<VatACARSUserData>("/api/session", fetcher, {
        fallbackData: fallbackUser, // Use localStorage data as a fallback (initially)
    });

    useEffect(() => {
        if (!redirectTo || isValidating) return;

        // If the user is logged in and we're redirecting if found, send them to the specified redirectTo page
        if (redirectIfFound && user?.username) {
            Router.push(redirectTo);
        }

        // If the user is NOT logged in and we should redirect to a login page, do it
        if (!redirectIfFound && !user?.username) {
            Router.push(redirectTo);
        }
    }, [user, redirectIfFound, redirectTo, isValidating]);

    return { user, mutateUser, isLoading: !user && isValidating };
}
