// pages/index.tsx
import { useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { Toaster } from "react-hot-toast";
import useUser from "../lib/useUser"; // Import the useUser hook

export default function HomePage() {
  const { user, isLoading } = useUser(); // Use the hook to check if the user is logged in
  const router = useRouter();

  useEffect(() => {
    // If the user is not logged in, redirect to login page
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]); // Trigger the effect when user or isLoading changes

  // If user data is still loading, you can show a loading spinner or nothing
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Layout>
      <Toaster position="top-center" />
      <div className="relative w-full min-h-screen flex flex-col items-center justify-center">
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/img/home-background.jpg')" }} />
        <div className="relative z-10 flex flex-col items-center">
          <img
            src="/img/vatacars-logo-dark.png"
            alt="vatACARS Logo"
            className="w-full max-w-[400px] h-auto object-contain pointer-events-none mb-4"
          />
          <h1 className="text-4xl font-bold">Welcome to vatACARS</h1>
        </div>
      </div>
    </Layout>
  );
}
