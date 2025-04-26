import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { InferType } from "yup";
import { useRouter } from "next/router";
import Link from "next/link";

import useUser from "../lib/useUser"; // Make sure this import path matches your structure

const loginSchema = yup.object({
    email: yup.string().required("Email is required"),
    password: yup.string().required("Password is required"),
});

type LoginFormInputs = InferType<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const { mutateUser } = useUser();

    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormInputs>({
        resolver: yupResolver(loginSchema),
    });

    async function submitLogin(data: LoginFormInputs) {
        try {
            setLoading(true);
            const resp = await fetch("https://vatacars.com/api/provider/local", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: data.email, password: data.password }),
            });

            const respJson = await resp.json();

            if (respJson.status !== "success") {
                setLoading(false);
                setStatus(respJson.message);
                return;
            }

            await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(respJson.data),
            });

            await mutateUser(); // Refresh session
            setStatus(respJson.message);
            setTimeout(() => router.replace("/home"), 500);
        } catch (error) {
            console.error("Login error:", error);
            setStatus("An unexpected error occurred.");
            setLoading(false);
        }
    }

    async function loginAnonymous() {
        try {
            setLoading(true);

            const anonymousUser = {
                id: "0",
                username: "Anonymous",
                firstName: "User",
                lastName: "Guest",
            };

            localStorage.setItem("user", JSON.stringify(anonymousUser)); // 🔥 Save to localStorage

            await mutateUser(anonymousUser); // 🔥 Update SWR cache immediately

            setStatus("Logged in anonymously.");
            setTimeout(() => router.replace("/home"), 500);
        } catch (error) {
            console.error("Anonymous login error:", error);
            setStatus("An unexpected error occurred.");
            setLoading(false);
        }
    }

    return (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 w-full max-w-md h-full md:h-auto">
            <div className="relative p-5">
                <div className="flex flex-col items-center text-center">
                    <img src="/img/vatacars-logo-dark.png" alt="vatACARS Logo" className="h-12 my-3" />
                </div>

                {status && (
                    <div className="flex justify-center pt-3 px-6 font-medium">
                        {status}
                    </div>
                )}

                <form onSubmit={handleSubmit(submitLogin)} className="w-full px-4 pt-6 flex-col space-y-3">
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

                        <div className="w-full flex justify-end">
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

                    <div className="text-center text-sm text-slate-400">
                        Don't have an account yet?
                        <Link href="https://vatacars.com/auth/signup" target="_blank">
                            <span className="ml-2 font-medium text-blue-400 link link-animated">Sign up</span>
                        </Link>
                    </div>
                </form>

                <div className="flex w-full items-center gap-2 py-6 text-sm text-slate-600">
                    <div className="h-px w-full bg-slate-400" />
                    OR
                    <div className="h-px w-full bg-slate-400" />
                </div>

                <div className="flex flex-col gap-2 px-4 mb-3">
                    <button
                        disabled={loading}
                        onClick={loginAnonymous}
                        className="btn inline-flex items-center justify-center gap-4 bg-slate-700 hover:bg-slate-600 border border-transparent hover:border-slate-500 transition-all duration-200"
                    >
                        <span className="text-sm">{loading ? "Logging in..." : "Skip Login"}</span>
                    </button>
                    <span className="text-center text-sm text-zinc-500">Features may be limited</span>
                </div>
            </div>
        </div>
    );
}
