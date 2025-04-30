import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { InferType } from "yup";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";

const loginSchema = yup.object({
    emailOrUsername: yup.string().required("Email or username is required"),
    password: yup.string().required("Password is required"),
});

type LoginFormInputs = InferType<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormInputs>({
        resolver: yupResolver(loginSchema),
    });

    async function submitLogin(data: LoginFormInputs) {
        try {
            setLoading(true);

            const res = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            let respJson: any = null;
            try {
                respJson = await res.json();
            } catch (err) {
                const raw = await res.text();
                console.error("Raw error:", raw);
                throw new Error("Invalid server response");
            }

            if (respJson.status !== "success") {
                toast.error(respJson.message || "Login failed.");
                setLoading(false);
                return;
            }

            toast.success("Login successful!");
            setTimeout(() => router.replace("/home"), 500);
        } catch (err) {
            console.error("Login error:", err);
            toast.error("Unexpected error occurred.");
            setLoading(false);
        }
    }

    // Optional: if user is already logged in, redirect to home
    useEffect(() => {
        fetch("/api/session")
            .then((res) => res.json())
            .then((user) => {
                if (user && user.email) {
                    router.replace("/home");
                }
            });
    }, []);

    return (
        <div className="flex items-center justify-center w-screen h-screen px-4">
            <Toaster position="top-center" reverseOrder={false} />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-md bg-transparent"
            >
                <div className="flex flex-col items-center text-center mb-6">
                    <img src="/img/vatacars-logo-dark.png" alt="vatACARS Logo" className="h-12" />
                </div>

                <form onSubmit={handleSubmit(submitLogin)} className="w-full px-4 flex flex-col space-y-3">
                    <div className="relative">
                        <input
                            disabled={loading}
                            {...register("emailOrUsername")}
                            type="text"
                            autoComplete="username"
                            className="input input-floating peer w-full bg-zinc-800 focus:border focus:border-white"
                            placeholder="Email or Username"
                        />
                        <label className="input-floating-label peer-focus:text-zinc-300">
                            Email / Username
                        </label>
                        {errors.emailOrUsername && <p className="text-red-500 text-xs mt-1">{errors.emailOrUsername.message}</p>}
                    </div>

                    <div className="relative">
                        <input
                            disabled={loading}
                            {...register("password")}
                            type="password"
                            autoComplete="current-password"
                            className="input input-floating peer w-full bg-zinc-800 focus:border focus:border-white"
                            placeholder="Password"
                        />
                        <label className="input-floating-label peer-focus:text-zinc-300">
                            Password
                        </label>
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                    </div>

                    <div className="form-control pt-3">
                        <button
                            disabled={loading}
                            type="submit"
                            className="btn inline-flex w-full bg-blue-500 text-slate-100 outline-none hover:bg-blue-400 transition-all duration-200"
                        >
                            {loading ? <span className="loading loading-infinity" /> : "Continue"}
                        </button>
                    </div>

                    <div className="text-center text-sm text-slate-400 mt-4">
                        Don’t have an account?
                        <Link href="https://vatacars.com/auth/signup" target="_blank">
                            <span className="ml-2 font-medium text-blue-400 link link-animated">Sign up</span>
                        </Link>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
