import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { HiMenu, HiX } from "react-icons/hi";
import { FaUserCircle, FaArrowLeft } from "react-icons/fa";

import useUser from "../lib/useUser";

const clientsList = [
  { name: 'Home', description: 'Welcome to the vatACARS Hub. Manage your plugins and keep them up to date.' },
  { name: 'vatSys Plugin', description: 'Plugin for vatSys integration.' },
  { name: 'Euroscope Plugin', description: 'Plugin for Euroscope ATC simulation.' },
  { name: 'Pilot Client', description: 'Plugin for pilots connecting to VATSIM.' },
  { name: 'Account', description: 'Manage your account settings and preferences.' },
  { name: 'Settings', description: 'Configure your application settings.' },
];

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading, mutateUser } = useUser({ redirectTo: "/login" });

  const [selectedClient, setSelectedClient] = useState(clientsList[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountView, setAccountView] = useState(false);

  useEffect(() => {
    const video = document.getElementById('background-video') as HTMLVideoElement;
    if (!video) return;

    const startTime = 165;
    const endTime = 330;

    video.currentTime = startTime;

    const checkTime = () => {
      if (video.currentTime >= endTime) {
        video.currentTime = startTime;
        video.play();
      }
    };

    video.addEventListener('timeupdate', checkTime);
    return () => video.removeEventListener('timeupdate', checkTime);
  }, [selectedClient]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      localStorage.removeItem("user");
      await mutateUser();
      toast.success('Logged out successfully');
      setTimeout(() => router.push('/login'), 500);
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Logout failed');
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (!user) return null;

  const firstName = user.firstName || "User";

  return (
    <>
      <Toaster position="top-center" />
      <div className="relative min-h-screen w-full flex overflow-hidden">
        <motion.button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          initial={{ x: 0 }}
          animate={{ x: sidebarOpen ? 256 : 16, y: 72 }}
          transition={{ type: "tween", duration: 0.3 }}
          className="fixed top-[-30px] z-30 p-2 bg-slate-700 rounded-md text-white hover:bg-slate-600"
          style={{ left: sidebarOpen ? "5px" : "-10px" }}
        >
          {sidebarOpen ? <HiX size={24} /> : <HiMenu size={24} />}
        </motion.button>

        <motion.aside
          initial={{ x: -300 }}
          animate={{ x: sidebarOpen ? 0 : -300 }}
          transition={{ type: "tween", duration: 0.3 }}
          className="fixed top-0 left-0 w-64 h-screen bg-gradient-to-br from-slate-900 to-slate-800 border-r-2 border-slate-600 p-4 flex flex-col justify-between z-20"
        >
          <div className="flex flex-col space-y-2">
            <h2 className="text-white text-xl font-bold mb-2 text-center">
              {accountView ? "Account" : "Applications"}
            </h2>

            <AnimatePresence mode="wait">
              {accountView ? (
                <>
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setAccountView(false)}
                    className="flex items-center justify-center space-x-2 p-3 rounded-md cursor-pointer hover:bg-slate-700 text-slate-300"
                  >
                    <FaArrowLeft />
                    <span>Back</span>
                  </motion.button>

                  {clientsList.slice(4).map((client, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => { setSelectedClient(client); setSidebarOpen(false); }}
                      className={`p-3 rounded-md cursor-pointer ${selectedClient.name === client.name
                        ? "bg-blue-500 text-white font-bold"
                        : "hover:bg-slate-700 text-slate-300"
                        }`}
                    >
                      {client.name}
                    </motion.button>
                  ))}
                </>
              ) : (
                clientsList.slice(0, 4).map((client, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => { setSelectedClient(client); setSidebarOpen(false); }}
                    className={`p-3 rounded-md cursor-pointer ${selectedClient.name === client.name
                      ? "bg-blue-500 text-white font-bold"
                      : "hover:bg-slate-700 text-slate-300"
                      }`}
                  >
                    {client.name}
                  </motion.button>
                ))
              )}
            </AnimatePresence>
          </div>

          {accountView ? (
            <button
              onClick={handleLogout}
              className="p-3 rounded-md cursor-pointer bg-red-500 text-white font-bold hover:bg-red-600"
            >
              Logout
            </button>
          ) : (
            <button
              onClick={() => setAccountView(true)}
              className="p-3 rounded-md cursor-pointer flex items-center justify-center space-x-2 text-white hover:bg-white/10 transition-all duration-200"
            >
              <FaUserCircle size={24} />
              <span>{firstName}</span>
            </button>
          )}
        </motion.aside>

        <motion.main className="flex-1 min-h-screen p-6 sm:p-8 flex flex-col items-center justify-center text-slate-300 relative overflow-hidden">
          {selectedClient.name === "vatSys Plugin" ? (
            <div className="absolute inset-0 overflow-hidden">
              <video
                id="background-video"
                className="w-full h-full object-cover pointer-events-none transition-opacity duration-300"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              >
                <source src="/videos/vatsys-background.webm" type="video/webm" />
                <source src="/videos/vatsys-background.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-black opacity-75"></div>
            </div>
          ) : (
            <div
              className={`absolute inset-0 bg-cover bg-center ${selectedClient.name === "Home" ? "opacity-20" : "opacity-10"}`}
              style={{
                backgroundImage:
                  selectedClient.name === "Home"
                    ? "url('/img/home-background.jpg')"
                    : selectedClient.name === "Euroscope Plugin"
                      ? "url('/img/euroscope-background.jpg')"
                      : "url('/img/pilot-background.jpg')",
              }}
            />
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedClient.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 text-center flex flex-col items-center justify-center max-w-4xl w-full"
            >
              {selectedClient.name === "Home" ? (
                <>
                  <img
                    src="/img/vatacars-logo-dark.png"
                    alt="vatACARS Logo"
                    className="w-full max-w-[400px] h-auto object-contain pointer-events-none mb-4"
                  />
                  <p className="text-slate-400 mb-3 mt-2 text-lg text-center px-4">
                    {selectedClient.description}
                  </p>
                </>
              ) : (
                <>
                  <h1 className={`text-3xl sm:text-4xl font-bold mb-4 ${selectedClient.name === "vatSys Plugin"
                    ? "text-blue-400"
                    : selectedClient.name === "Euroscope Plugin"
                      ? "text-emerald-400"
                      : selectedClient.name === "Pilot Client"
                        ? "text-violet-400"
                        : "text-white"
                    }`}>
                    {selectedClient.name}
                  </h1>
                  <p className="text-slate-400 mb-2 mt-2 max-w-xl text-center px-4">
                    {selectedClient.description}
                  </p>

                  {(selectedClient.name === "vatSys Plugin" ||
                    selectedClient.name === "Euroscope Plugin" ||
                    selectedClient.name === "Pilot Client") && (
                      <div className="flex flex-col items-center mt-6">
                        <p className="text-yellow-400 text-lg">Coming Soon!</p>
                      </div>
                    )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.main>
      </div>
    </>
  );
}
