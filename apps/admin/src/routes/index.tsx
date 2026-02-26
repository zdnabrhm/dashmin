import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main>
      <h1>Dashmin</h1>
      <p>Admin dashboard - Phase 0 complete.</p>
    </main>
  );
}
