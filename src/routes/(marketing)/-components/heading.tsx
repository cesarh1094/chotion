import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Heading() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl sm:text-5xl md:text-6xl">
        Your ideas, documents & plans. Unified. Welcome to{" "}
        <span className="underline">Chotion</span>
      </h1>
      <h3 className="text-base sm:text-xl md:text-2xl font-medium">
        Chotion is the connected workspace where <br /> better, faster work
        happens
      </h3>
      <Button asChild>
        <Link to="/docs">
          Enter Chotion <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
