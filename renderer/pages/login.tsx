import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { InferType } from "yup";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast, Toaster } from "react-hot-toast"; // 🔥 Add toast system

const loginSchema = yup.object({
    email: yup.string().required("Email is required"),
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
            const resp = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emailOrUsername: data.email, password: data.password }),
            });

            const respJson = await resp.json();

            if (respJson.status !== "success") {
                toast.error(respJson.message || "Login failed.");
                setLoading(false);
                return;
            }

            // After successful login, store the session in localStorage
            if (typeof window !== "undefined") {
                localStorage.setItem("user", JSON.stringify(respJson.data));
            }

            toast.success("Login successful!");
            setTimeout(() => router.replace("/home"), 500);
        } catch (error) {
            console.error("Login error:", error);
            toast.error("An unexpected error occurred.");
            setLoading(false);
        }
    }

    return (
        <div className="flex items-center justify-center w-screen h-screen px-4">
            {/* Toast container */}
            <Toaster position="top-center" reverseOrder={false} />

            {/* Animate the entire login block */}
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
                            {...register("email")}
                            type="text"
                            autoComplete="email"
                            required
                            className="input input-floating peer w-full bg-zinc-800 focus:border focus:border-white"
                            placeholder="Email Address or Username"
                        />
                        <label htmlFor="email" className="input-floating-label peer-focus:text-zinc-300">
                            Email / Username
                        </label>
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                    </div>

                    <div className="relative">
                        <input
                            disabled={loading}
                            {...register("password")}
                            type="password"
                            autoComplete="current-password"
                            required
                            className="input input-floating peer w-full bg-zinc-800 focus:border focus:border-white"
                            placeholder="Password"
                        />
                        <label htmlFor="password" className="input-floating-label peer-focus:text-zinc-300">
                            Password
                        </label>
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}

                        <div className="w-full flex justify-end mt-2">
                            <Link href="https://vatacars.com/auth/forgot" target="_blank">
                                <span className="block cursor-pointer text-sm text-blue-400 link link-animated">
                                    Forgot password?
                                </span>
                            </Link>
                        </div>
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
                        Don't have an account yet?
                        <Link href="https://vatacars.com/auth/signup" target="_blank">
                            <span className="ml-2 font-medium text-blue-400 link link-animated">Sign up</span>
                        </Link>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
