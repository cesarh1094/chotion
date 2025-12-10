import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)")({
  component: RouteLayoutComponent,
});

function RouteLayoutComponent() {
  return (
    <div>
      <h1>Auth layout</h1>
      <Outlet />
    </div>
  );
}
