import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/users")({
  staticData: { title: "Users" },
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_authenticated/users"!</div>;
}
