import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PuffLoader from "react-spinners/PuffLoader";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";

interface UserSession {
    id: string;
    firstName: string;
    [key: string]: any;
}

export default function Home() {
    const [user, setUser] = useState<UserSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [redirecting, setRedirecting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const controller = new AbortController();

        async function fetchSession() {
            try {
                const res = await fetch("/api/session", { signal: controller.signal });
                const data = await res.json();

                console.log("Session response:", data);

                if (!data || !data.id) {
                    setRedirecting(true);
                    setTimeout(() => router.replace("/login"), 1500);
                } else {
                    setUser(data);
                }
            } catch (err) {
                console.error("Error fetching session:", err);
                setError("Failed to load session.");
            } finally {
                setLoading(false);
            }
        }

        fetchSession();

        return () => controller.abort();
    }, [router]);

    const handleLogout = async () => {
        try {
            await fetch("/api/logout", { method: "POST" });
            toast.success("Logged out successfully!", {
                style: {
                    background: "#1F2937",
                    color: "#D1D5DB",
                },
                iconTheme: {
                    primary: "#3B82F6",
                    secondary: "#1F2937",
                },
            });
            setTimeout(() => router.replace("/login"), 1500);
        } catch (error) {
            console.error("Logout failed:", error);
            toast.error("Logout failed!", {
                style: {
                    background: "#1F2937",
                    color: "#F87171",
                },
            });
        }
    };

    return (
        <>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: "#1F2937",
                        color: "#E5E7EB",
                        transition: "all 0.3s ease-in-out",
                    },
                    success: {
                        style: {
                            background: "#1F2937",
                            color: "#D1D5DB",
                        },
                    },
                    error: {
                        style: {
                            background: "#1F2937",
                            color: "#F87171",
                        },
                    },
                }}
            />
            <AnimatePresence>
                {loading && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col justify-center items-center h-screen"
                    >
                        <PuffLoader size={48} color="#3B82F6" />
                        <p className="mt-4 text-slate-500">Loading session...</p>
                    </motion.div>
                )}

                {!loading && error && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col justify-center items-center h-screen"
                    >
                        <p className="text-red-400 text-lg font-semibold">{error}</p>
                    </motion.div>
                )}

                {!loading && redirecting && (
                    <motion.div
                        key="redirecting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col justify-center items-center h-screen"
                    >
                        <PuffLoader size={48} color="#3B82F6" />
                        <p className="mt-4 text-slate-500">Redirecting to login...</p>
                    </motion.div>
                )}

                {!loading && !redirecting && user && (
                    <motion.div
                        key="home"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col justify-center items-center h-screen"
                    >
                        <h1 className="text-2xl font-bold mb-4">Welcome, {user.firstName}!</h1>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleLogout}
                            className="btn bg-red-500 text-white hover:bg-red-400 transition-all duration-200"
                        >
                            Logout
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
