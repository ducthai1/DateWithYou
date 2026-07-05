import { createAuthClient } from "better-auth/react";
const client = createAuthClient();
client.requestPasswordReset({ email: "a@a.com" });
