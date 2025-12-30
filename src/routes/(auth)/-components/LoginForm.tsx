import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import * as v from "valibot";
import { Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const emailValidator = v.pipe(
  v.string("Email must be a string"),
  v.nonEmpty("Email is required"),
  v.email("Invalid email format"),
);

const passwordValidator = v.pipe(
  v.string("Password must be a string"),
  v.nonEmpty("Password is required"),
  v.minLength(8, "Password must be at least 8 characters"),
);

export function LoginForm() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        const response = await authClient.signIn.email({
          email: value.email,
          password: value.password,
        });

        if (response.error) {
          switch (response.error.status) {
            case 404: {
              setSubmitError("No account found with this email");
              return;
            }
          }
        }

        if (response instanceof Error) {
          setSubmitError(response.message || "Login failed");
          return;
        }
        console.log(response);

        // Successful login - redirect to docs
        navigate({ to: "/docs" });
      } catch (error) {
        if (error instanceof Error) {
          setSubmitError(error.message);
        } else {
          setSubmitError("An error occurred");
        }
      }
    },
  });

  return (
    <>
      {submitError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        <form.Field
          name="email"
          validators={{
            onBlur: ({ value }) => {
              try {
                v.parse(emailValidator, value);
                return undefined;
              } catch (error) {
                if (error instanceof v.ValiError) {
                  return error.issues[0]?.message;
                }
                return "Invalid email";
              }
            },
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.isTouched && field.state.meta.errors && (
                <p className="text-sm text-red-500">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name="password"
          validators={{
            onBlur: ({ value }) => {
              try {
                v.parse(passwordValidator, value);
                return undefined;
              } catch (error) {
                if (error instanceof v.ValiError) {
                  return error.issues[0]?.message;
                }
                return "Invalid password";
              }
            },
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.isTouched && field.state.meta.errors && (
                <p className="text-sm text-red-500">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.isSubmitting, state.canSubmit]}
        >
          {([isSubmitting, canSubmit]) => (
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          )}
        </form.Subscribe>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-primary hover:underline"
          >
            Sign up
          </Link>
        </p>
      </form>
    </>
  );
}
