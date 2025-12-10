import { createFileRoute } from "@tanstack/react-router";
import { Heading } from "./-components/heading";

export const Route = createFileRoute("/(marketing)/")({ component: App });

function App() {
  return (
    <div className="min-h-full flex flex-col">
      <div className="flex flex-col items-center justify-center md:justify-start text-center gap-y-8 flex-1 px-6 pb-10">
        <Heading />
      </div>
    </div>
  );
}
