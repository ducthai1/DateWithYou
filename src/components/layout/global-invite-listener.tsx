"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigationInvites } from "@/features/locations/use-navigation-invites";
import { NavigationInviteModal } from "@/features/locations/navigation-invite-modal";
import { trpc } from "@/lib/trpc";

export function GlobalInviteListener() {
  const router = useRouter();
  const navInvites = useNavigationInvites();
  const [show, setShow] = useState(false);
  const respondInvite = trpc.location.respondNavInvite.useMutation();

  // Show incoming invite modal
  useEffect(() => {
    if (navInvites.incomingInvite && navInvites.incomingInvite.status === "pending") {
      setShow(true);
    } else {
      setShow(false);
    }
  }, [navInvites.incomingInvite]);

  // Handle auto-nav for the sender when partner accepts
  useEffect(() => {
    if (navInvites.inviteResponse && navInvites.inviteResponse.status === "accepted") {
      const locId = navInvites.inviteResponse.locationId;
      navInvites.clearResponse();
      // Force a redirect to /map with nav flags so it auto-starts
      router.push(`/map?loc=${locId}&nav=1&t=${Date.now()}`);
    }
  }, [navInvites, router]);

  const handleRespond = async (accept: boolean) => {
    if (!navInvites.incomingInvite) return;
    try {
      const result = await respondInvite.mutateAsync({
        inviteId: navInvites.incomingInvite.id,
        accept,
      });
      setShow(false);
      navInvites.clearIncoming();

      if (accept && result.locationId) {
        router.push(`/map?loc=${result.locationId}&nav=1&t=${Date.now()}`);
      }
    } catch (err) {
      console.error(err);
      setShow(false);
      navInvites.clearIncoming();
    }
  };

  if (!show || !navInvites.incomingInvite) return null;

  // We are in a global scope, but NavigationInviteModal expects to be rendered.
  // It renders a full-screen overlay, so it's fine.
  return (
    <div className="relative z-[9999]">
      <NavigationInviteModal
        locationName={navInvites.incomingInvite.locationName}
        onAccept={() => handleRespond(true)}
        onDecline={() => handleRespond(false)}
        isPending={respondInvite.isPending}
      />
    </div>
  );
}
