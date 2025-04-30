import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { FaCheckCircle } from "react-icons/fa";

export default function TestPage() {
    const [status, setStatus] = useState<"not_installed" | "installed" | "update_available" | "not_available">("not_installed");
    const [installing, setInstalling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [flash, setFlash] = useState(false);
    const [showCheckmark, setShowCheckmark] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            setStatus("not_installed");
        }, 500);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            console.log("Checking plugin status...");
            setStatus((prev) => {
                if (prev === "installed") {
                    return Math.random() < 0.1 ? "update_available" : "installed";
                }
                return prev;
            });
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const fakeDownloadPlugin = () => {
        setInstalling(true);
        setProgress(0);
        setFlash(false);
        setShowCheckmark(false);

        const fakeInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(fakeInterval);
                    setInstalling(false);
                    setStatus("installed");
                    console.log("Fake download complete!");

                    setFlash(true);
                    setShowCheckmark(true);

                    setTimeout(() => setFlash(false), 500);  // End flash
                    setTimeout(() => setShowCheckmark(false), 3000); // Hide checkmark after 3s
                    return 100;
                }
                return prev + 5;
            });
        }, 150);
    };

    const handleUninstall = () => {
        setInstalling(true);
        setTimeout(() => {
            setStatus("not_installed");
            setInstalling(false);
            setProgress(0);
            setFlash(false);
            setShowCheckmark(false);
        }, 1000);
    };

    const getButtonLabel = () => {
        if (installing) return `Installing... ${progress}%`;
        if (status === "not_installed") return "Install Plugin";
        if (status === "update_available") return "Update Plugin";
        if (status === "installed") return "Uninstall Plugin";
        return "Not Available";
    };

    const isButtonDisabled = () => {
        return status === "not_available" || installing;
    };

    const handleButtonClick = () => {
        if (status === "installed") {
            handleUninstall();
        } else {
            fakeDownloadPlugin();
        }
    };

    const getButtonColor = () => {
        if (status === "installed") return "bg-red-500 hover:bg-red-600 text-white";
        if (status === "not_available") return "bg-gray-500 cursor-not-allowed text-white";
        return "bg-green-500 hover:bg-green-600 text-white";
    };

    return (
        <Layout>
            <div className="relative w-full h-screen flex flex-col items-center justify-center text-center px-4">
                <h1 className="text-4xl font-bold text-blue-400 mb-4">Test Install Page</h1>
                <p className="text-slate-300 mb-8">Download and install a plugin into your vatSys Plugins folder.</p>

                <div
                    className={`flex items-center justify-center transition-all duration-500 ease-out ${showCheckmark ? "gap-4 translate-x-[-10px]" : "gap-0 translate-x-0"
                        }`}
                >
                    <button
                        onClick={handleButtonClick}
                        disabled={isButtonDisabled()}
                        className={`px-6 py-3 rounded-lg font-semibold shadow transition-all duration-300 flex items-center justify-center gap-2
                        ${getButtonColor()} ${flash ? "animate-pulse" : ""}`}
                    >
                        {installing && (
                            <svg
                                className="animate-spin h-5 w-5 text-white"
                                style={{ animationDuration: "0.5s" }}
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                            </svg>
                        )}
                        <span className="transition-opacity duration-300">{getButtonLabel()}</span>
                    </button>

                    {showCheckmark && (
                        <FaCheckCircle className="text-green-400 text-3xl animate-fade-in" />
                    )}
                </div>

                {installing && (
                    <div className="mt-4 w-64 bg-slate-700 rounded-full h-4 overflow-hidden">
                        <div
                            className="bg-green-500 h-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                )}
            </div>

            {/* Fade-in animation for the checkmark */}
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.4s ease-out forwards;
                }
            `}</style>
        </Layout>
    );
}
