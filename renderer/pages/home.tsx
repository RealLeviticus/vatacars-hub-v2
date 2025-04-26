import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { HiMenu } from "react-icons/hi";
import BarLoader from "react-spinners/BarLoader";

const clientsList = [
  { name: 'Home', description: 'Welcome to the vatACARS Hub. Manage your plugins and keep them up to date.', available: false },
  { name: 'vatSys Plugin', description: 'Plugin for vatSys integration.', available: false },
  { name: 'Euroscope Plugin', description: 'Plugin for Euroscope ATC simulation.', available: false },
  { name: 'Pilot Client', description: 'Client for pilots connecting to VATSIM.', available: false },
];

export default function Home() {
  const router = useRouter();

  const [serverFailedMessage, setServerFailedMessage] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(clientsList[0]);
  const [installed, setInstalled] = useState(false);
  const [clientStatus, setClientStatus] = useState('waiting');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      toast.success('Logged out successfully!');
      setTimeout(() => router.replace('/login'), 1500);
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Logout failed.');
    }
  };

  const handleInstall = () => {
    if (selectedClient && selectedClient.available) {
      setClientStatus('download');
      toast.success(`Starting installation of ${selectedClient.name}`);
    }
  };

  const handleUninstall = () => {
    if (selectedClient) {
      setClientStatus('uninstalling');
      toast.success(`Starting uninstallation of ${selectedClient.name}`);
    }
  };

  if (serverFailedMessage) {
    return (
      <div className="h-screen w-screen flex flex-col space-y-4 items-center justify-center">
        <p className="font-semibold text-red-500 text-lg">{serverFailedMessage}</p>
        <span className="text-slate-400">
          Please email <a className="font-semibold hover:underline" href="mailto://contact@vatacars.com">contact@vatacars.com</a> for assistance.
        </span>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <div className="relative min-h-screen w-full flex overflow-hidden">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-30 p-2 bg-slate-700 rounded-md text-white hover:bg-slate-600"
        >
          <HiMenu size={24} />
        </motion.button>

        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-10"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <motion.aside
          initial={{ x: -300 }}
          animate={{ x: sidebarOpen ? 0 : -300 }}
          transition={{ type: 'tween', duration: 0.3 }}
          className="fixed top-0 left-0 w-64 h-screen bg-gradient-to-br from-slate-900 to-slate-800 border-r-2 border-slate-600 p-4 flex flex-col space-y-4 z-20"
        >
          {clientsList.map((client, index) => (
            <motion.button
              key={index}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setSelectedClient(client); setSidebarOpen(false); }}
              className={`p-3 rounded-md cursor-pointer ${selectedClient.name === client.name ? 'bg-blue-500 text-white font-bold' : 'hover:bg-slate-700 text-slate-300'}`}
            >
              {client.name}
            </motion.button>
          ))}
        </motion.aside>

        <motion.main
          className="flex-1 min-h-screen p-6 sm:p-8 flex flex-col items-center justify-center text-slate-300 relative"
        >
          <div className="text-center flex flex-col items-center justify-center max-w-4xl w-full">
            {selectedClient.name === 'Home' ? (
              <>
                <motion.img
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: 1, scale: [1, 1.05, 1] }}
                  transition={{ duration: 8, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                  src="/img/vatacars-logo-dark.png"
                  alt="vatACARS Logo"
                  className="w-full max-w-[400px] h-auto object-contain pointer-events-none mb-4"
                />
                <p className="text-slate-400 mb-3 mt-2 text-lg text-center px-4">{selectedClient.description}</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="px-8 py-3 bg-red-500 text-white rounded-lg hover:bg-red-400 text-lg font-semibold transition-all duration-200"
                >
                  Logout
                </motion.button>
              </>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl font-bold mb-4">{selectedClient.name}</h1>
                <p className="text-slate-400 mb-2 mt-2 max-w-xl text-center px-4">{selectedClient.description}</p>
                {selectedClient.available && (
                  <div className="flex flex-col space-y-4 mt-4">
                    {!installed ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleInstall}
                        disabled={clientStatus === 'download'}
                        className="px-6 py-2 bg-blue-500 rounded-lg text-white hover:bg-blue-600 disabled:bg-blue-300"
                      >
                        Install {selectedClient.name}
                      </motion.button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleUninstall}
                        disabled={clientStatus === 'uninstalling'}
                        className="px-6 py-2 bg-red-500 rounded-lg text-white hover:bg-red-600 disabled:bg-red-300"
                      >
                        Uninstall {selectedClient.name}
                      </motion.button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.main>
      </div>
    </>
  );
}