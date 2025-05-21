// pages/home.tsx
import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Toaster } from "react-hot-toast";

// --- Update Modal Component ---
function UpdateModal({ updateInfo, onUpdate, onSkip }: {
  updateInfo: { latestVersion: string, releaseNotes: string, downloadUrl: string },
  onUpdate: () => void,
  onSkip: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full p-8 border border-slate-700">
        <h2 className="text-3xl font-bold mb-4 text-blue-400">🚀 Update Available!</h2>
        <p className="mb-4 text-slate-200 text-lg">
          Version <span className="font-semibold text-blue-300">{updateInfo.latestVersion}</span> is now available.
        </p>
        <div className="mb-6 max-h-72 overflow-y-auto border border-slate-700 rounded-lg p-4 bg-slate-800">
          <h3 className="font-semibold mb-2 text-slate-100 text-lg">What's New:</h3>
          <div
            className="prose prose-sm prose-invert text-slate-200"
            dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes || "No changelog provided." }}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onSkip}
            className="px-5 py-2 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 transition font-medium"
          >
            Later
          </button>
          <button
            onClick={onUpdate}
            className="px-5 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
}

const description = "Welcome to vatACARS Hub, the new home for all things to do with vatSys Plugins";

export default function Home() {
  const [typed, setTyped] = useState("");
  const [updateInfo, setUpdateInfo] = useState<{
    latestVersion: string,
    releaseNotes: string,
    downloadUrl: string
  } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    setTyped(""); // Reset on mount
    let i = 0;
    const interval = setInterval(() => {
      if (i < description.length) {
        setTyped(description.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 60);
    return () => clearInterval(interval);
  }, []);

  const checkForUpdate = () => {
    window.ipc.invoke('checkAppUpdate').then((updateInfo: any) => {
      if (updateInfo?.updateAvailable) {
        setUpdateInfo({
          latestVersion: updateInfo.latestVersion,
          releaseNotes: updateInfo.releaseNotes,
          downloadUrl: updateInfo.downloadUrl
        });
        setShowUpdateModal(true);
      } else {
        alert("No update available.");
      }
    }).catch((err) => {
      console.error("Update check failed:", err);
      alert("Failed to check for updates.");
    });
  };

  const handleUpdate = async () => {
    if (!updateInfo) return;
    setShowUpdateModal(false);
    await window.ipc.invoke('downloadAndInstallAppUpdate', updateInfo.downloadUrl);
  };

  const handleSkip = () => {
    setShowUpdateModal(false);
  };

  // Add this function for testing
  const showTestUpdateModal = () => {
    setUpdateInfo({
      latestVersion: "2.0.0-alpha.2",
      releaseNotes: "<ul><li>New feature: Test update modal</li><li>Bug fixes</li></ul>",
      downloadUrl: "https://example.com/fake-download.exe"
    });
    setShowUpdateModal(true);
  };

  return (
    <Layout>
      <Toaster position="top-center" />
      {showUpdateModal && updateInfo && (
        <UpdateModal
          updateInfo={updateInfo}
          onUpdate={handleUpdate}
          onSkip={handleSkip}
        />
      )}
      <div className="relative w-full min-h-screen flex flex-col items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('/img/home-background.jpg')" }}
        />
        <div className="relative z-10 flex flex-col items-center">
          <img
            src="/img/vatacars-logo-dark.png"
            alt="vatACARS Logo"
            className="w-full max-w-[400px] h-auto object-contain pointer-events-none mb-4"
          />
          <h1 className="text-4xl font-bold">
            <span>{typed}</span>
            <span className="animate-pulse text-slate-400">|</span>
          </h1>
          {/* Real update check button */}
          {/* Test modal button (commented out) */}
          {/*
          <button
            onClick={showTestUpdateModal}
            className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
          >
            Show Update Modal (Test)
          </button>
          */}
        </div>
      </div>
    </Layout>
  );
}
