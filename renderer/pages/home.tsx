import useUser from "../lib/useUser";

export default function Home() {
  const { user, isLoading } = useUser({ redirectTo: "/login" });

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Not logged in.</div>;

  return (
    <div>
      <h1>Welcome, {user.username}!</h1>
      <p>You are now logged in.</p>
    </div>
  );
}
