"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigationInvitesContext } from "@/features/locations/navigation-invites-context";
import { NavigationInviteModal } from "@/features/locations/navigation-invite-modal";
import { acceptedTripStore } from "@/features/locations/accepted-trip-store";
import { trpc } from "@/lib/trpc";

export function GlobalInviteListener() {
  const router = useRouter();
  const navInvites = useNavigationInvitesContext();
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

  // Handle auto-nav for the sender when partner accepts, or dispatch event if rejected.
  // On accept: push the accepted trip into the shared store so the map can pick up
  // waypoints without encoding them in the URL (too large for query params).
  useEffect(() => {
    if (!navInvites.inviteResponse) return;
    const { status, locationId, id } = navInvites.inviteResponse;
    const waypoints = navInvites.inviteResponse.waypoints ?? [];

    if (status === "accepted") {
      navInvites.clearResponse();
      // Write the full trip (destination + waypoints) into the shared store so
      // LocationsPage can start navigation with the correct multi-leg route.
      acceptedTripStore.set({ locationId, waypoints, role: "sender" });
      // Navigate to map; the store is read on mount / on store change.
      router.push(`/map?loc=${locationId}&nav=1&t=${Date.now()}`);
    } else if (status === "rejected") {
      navInvites.clearResponse();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("invite-rejected", { detail: { id } }));
      }
    }
  }, [navInvites, router]);

  const handleRespond = async (accept: boolean) => {
    if (!navInvites.incomingInvite) return;
    const inviteId = navInvites.incomingInvite.id;
    try {
      const result = await respondInvite.mutateAsync({ inviteId, accept });
      setShow(false);
      navInvites.clearIncoming();

      if (accept && result.locationId) {
        // Receiver: write the accepted trip into the store so LocationsPage starts
        // with waypoints when it mounts on /map.
        acceptedTripStore.set({
          locationId: result.locationId,
          waypoints: result.waypoints ?? [],
          role: "receiver",
        });
        router.push(`/map?loc=${result.locationId}&nav=1&t=${Date.now()}`);
      }
    } catch (err) {
      console.error(err);
      setShow(false);
      navInvites.clearIncoming();
    }
  };

  if (!show || !navInvites.incomingInvite) return null;

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
