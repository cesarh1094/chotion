import * as v from "valibot";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import {
  createServerValidate,
  formOptions,
  useForm,
} from "@tanstack/react-form-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { fetchMutation } from "@/lib/auth-server";
import { api } from "../../../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";

const nameValidator = v.pipe(
  v.string("Name must be a string"),
  v.nonEmpty("Name is required"),
);

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

const RegisterFormSchema = v.pipe(
  v.object({
    name: nameValidator,
    email: emailValidator,
    password: passwordValidator,
    confirmPassword: v.pipe(passwordValidator),
  }),
  v.forward(
    v.partialCheck(
      [["password"], ["confirmPassword"]],
      (input) => input.password === input.confirmPassword,
      "Password do not match",
    ),
    ["confirmPassword"],
  ),
);
const formOpts = formOptions({
  defaultValues: {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  },
  validators: {
    onSubmit: RegisterFormSchema,
  },
});
const serverValidate = createServerValidate({
  ...formOpts,
  onServerValidate: ({ value }) => {},
});

const registerUserServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("Invalid form data");
    }
    return data;
  })
  .handler(async (ctx) => {
    try {
      const validated = await serverValidate(ctx.data);

      // TODO: find a way to ensure auth token returned
      const response = await fetchMutation(api.auth.regsiterUser, {
        ...validated,
      });

      setResponseStatus(200);

      return { success: true, data: response.user };
    } catch (e) {
      console.log({ data: ctx.data });

      setResponseStatus(500);
      return { success: false, data: null };
    }
  });

export function RegisterForm() {
  const form = useForm({
    ...formOpts,
    onSubmit: async ({ value, formApi }) => {
      const { data, error } = await authClient.signUp.email(
        {
          name: value.name,
          email: value.email,
          password: value.password,
          image: "",
        },
        {
          onError: async (ctx) => {
            console.log(ctx.request);
            console.log(ctx.response);
            console.log(ctx.error);
          },
        },
      );

      // Reset form input fields
      formApi.reset();
    },
  });

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6"
        action={registerUserServerFn.url}
        method="POST"
        encType="multipart/form-data"
      >
        <form.Field
          name="name"
          validators={{
            onBlur: ({ value }) => {
              try {
                v.parse(nameValidator, value);
                return undefined;
              } catch (error) {
                if (error instanceof v.ValiError) {
                  return error.issues[0]?.message;
                }
                return "Invalid name";
              }
            },
          }}
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
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

        <form.Field
          name="confirmPassword"
          validators={{
            onBlur: ({ value, fieldApi }) => {
              try {
                v.parse(passwordValidator, value);
                const passwordValue = fieldApi.form.getFieldValue("password");
                if (value !== passwordValue) {
                  return "Passwords do not match";
                }
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
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
              className="w-full focus:ring-1"
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? "Signing up..." : "Sign up"}
            </Button>
          )}
        </form.Subscribe>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </>
  );
}
