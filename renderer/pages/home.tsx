import useUser from "../lib/useUser";

export default function Home() {
    const { user, isLoading } = useUser({ redirectTo: "/login" });

    // Handling loading state
    if (isLoading) {
        return <div>Loading...</div>;
    }


    // Handling not logged-in state
    if (!user) {
        return <div>Not logged in.</div>;
    }

    // Main content after user is logged in
    return (
        <div>
            <h1>Welcome, {user.username}!</h1>
            <p>You are now logged in.</p>
        </div>
    );
}