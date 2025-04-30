import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { HiMenu, HiX } from 'react-icons/hi';
import { FaUserCircle, FaArrowLeft } from 'react-icons/fa';

const appClientsList = [
    { name: 'Home', path: '/home' },
    { name: 'vatSys Plugin', path: '/vatsys' },
    { name: 'Euroscope Plugin', path: '/euroscope' },
    { name: 'Pilot Client', path: '/pilot' },
    { name: 'Test Page', path: '/test' },
];

const accountClientsList = [
    { name: 'Account', path: '/account' },
    { name: 'Settings', path: '/settings' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [accountView, setAccountView] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [fadeOutContent, setFadeOutContent] = useState(false);
    const [fadeOutSidebar, setFadeOutSidebar] = useState(false);
    const [navigatingPath, setNavigatingPath] = useState<string | null>(null);
    const [waitingToFadeSidebar, setWaitingToFadeSidebar] = useState(false); // NEW

    const confirmLogout = async () => {
        try {
            // Call the logout API to clear the session server-side
            const response = await fetch('/api/logout', { method: 'POST' });

            if (response.ok) {
                // Clear the session data in localStorage on the frontend
                if (typeof window !== "undefined") {
                    localStorage.removeItem('user'); // Clear localStorage on successful logout
                }

                // Redirect the user to the login page after successful logout
                router.push('/login');
            } else {
                console.error('Logout failed');
            }
        } catch (error) {
            console.error('Logout request failed:', error);
        }
    };

    const handleNavigation = (path: string) => {
        if (path === router.pathname) return;
        setNavigatingPath(path);
        setFadeOutContent(true); // Fade out content
        setTimeout(() => {
            router.push(path);
        }, 300);
    };

    // after user lands on a NEW PAGE
    useEffect(() => {
        if (!navigatingPath) return; // Not navigating

        setFadeOutContent(false); // fade content back in
        setWaitingToFadeSidebar(true); // tell it we are waiting

        const fadeTimer = setTimeout(() => {
            setFadeOutSidebar(true); // actually fade sidebar now
        }, 500); // wait 0.5s after new page loads

        const collapseTimer = setTimeout(() => {
            setSidebarOpen(false); // collapse sidebar after fade
            setFadeOutSidebar(false);
            setWaitingToFadeSidebar(false);
            setNavigatingPath(null);
        }, 1000); // 0.5s after sidebar fade starts

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(collapseTimer);
        };
    }, [router.pathname]);

    return (
        <div className="relative h-screen w-screen flex overflow-hidden">
            {/* Confirm Logout Modal */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        key="confirm-modal"
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="bg-slate-800 p-6 rounded-lg text-center space-y-4"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300 }}
                        >
                            <h2 className="text-white text-xl font-bold">Confirm Logout</h2>
                            <p className="text-slate-300">Are you sure you want to logout?</p>
                            <div className="flex space-x-4 justify-center">
                                <button
                                    onClick={confirmLogout}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
                                >
                                    Logout
                                </button>
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Sidebar Toggle Button */}
            <motion.button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                initial={{ x: 0 }}
                animate={{ x: sidebarOpen ? 256 : 16, y: 72 }}
                transition={{ type: 'tween', duration: 0.3 }}
                className="fixed top-[-30px] z-30 p-2 bg-slate-700 rounded-md text-white hover:bg-slate-600"
                style={{ left: sidebarOpen ? '5px' : '-10px' }}
            >
                {sidebarOpen ? <HiX size={24} /> : <HiMenu size={24} />}
            </motion.button>

            {/* Sidebar */}
            <motion.aside
                initial={{ x: -300 }}
                animate={{
                    x: sidebarOpen ? 0 : -300,
                    opacity: fadeOutSidebar ? 0 : 1,
                }}
                transition={{
                    x: { type: 'tween', duration: 0.3 },
                    opacity: { type: 'tween', duration: 0.5 },
                }}
                className="fixed top-0 left-0 w-64 h-screen bg-gradient-to-br from-slate-900 to-slate-800 border-r-2 border-slate-600 p-4 flex flex-col z-20"
            >
                {/* Sidebar content */}
                <div className="flex flex-col space-y-2">
                    <h2 className="text-white text-xl font-bold mb-2 text-center">
                        {accountView ? 'User Area' : 'Applications'}
                    </h2>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={accountView ? 'account-view' : 'app-view'}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col space-y-2"
                        >
                            {(accountView ? accountClientsList : appClientsList).map((client) => (
                                <button
                                    key={client.name}
                                    onClick={() => handleNavigation(client.path)}
                                    className={`p-3 rounded-md cursor-pointer hover:bg-slate-700 text-slate-300 ${router.pathname === client.path ? 'bg-blue-500 text-white font-bold' : ''
                                        }`}
                                    disabled={!!navigatingPath}
                                >
                                    {client.name}
                                </button>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Spacer */}
                <div className="flex-grow"></div>

                {/* Bottom buttons */}
                <div className="flex flex-col space-y-2">
                    {accountView && (
                        <button
                            onClick={() => setShowConfirm(true)}
                            className="p-3 rounded-md bg-red-600 text-white hover:bg-red-700 flex items-center justify-center space-x-2"
                        >
                            Logout
                        </button>
                    )}
                    {accountView ? (
                        <button
                            onClick={() => setAccountView(false)}
                            className="p-3 rounded-md bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center space-x-2"
                        >
                            <FaArrowLeft />
                            <span>Back</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => setAccountView(true)}
                            className="p-3 rounded-md bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center space-x-2"
                        >
                            <FaUserCircle size={24} />
                            <span>User Area</span>
                        </button>
                    )}
                </div>
            </motion.aside>

            {/* Main Content */}
            <motion.main
                className="relative overflow-hidden"
                animate={{
                    marginLeft: sidebarOpen ? 256 : 0,
                    opacity: fadeOutContent ? 0 : 1,
                }}
                transition={{
                    marginLeft: { type: 'tween', duration: 0.3 },
                    opacity: { type: 'tween', duration: 0.3 },
                }}
                style={{
                    width: '100%',
                    height: '100vh',
                }}
            >
                {children}
            </motion.main>
        </div>
    );
}
