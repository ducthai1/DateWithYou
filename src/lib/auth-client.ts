import { createAuthClient } from "better-auth/react";
import { oneTapClient } from "better-auth/client/plugins";

// Public Google client id — same value as GOOGLE_CLIENT_ID, exposed to the
// browser so the One Tap prompt can initialise. Empty string when unset keeps
// the typed `authClient.oneTap()` method present; <GoogleOneTap /> guards on
// the real value before triggering the prompt.
export const authClient = createAuthClient({
  plugins: [
    oneTapClient({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
      // One quiet attempt; if the user dismisses it we don't nag on every nav.
      promptOptions: { maxAttempts: 1 },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
