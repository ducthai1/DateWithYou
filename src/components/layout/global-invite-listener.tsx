"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigationInvitesContext } from "@/features/locations/navigation-invites-context";
import { NavigationInviteModal } from "@/features/locations/navigation-invite-modal";
import { acceptedTripStore } from "@/features/locations/accepted-trip-store";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/toast";

export function GlobalInviteListener() {
  const toast = useToast();
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
      acceptedTripStore.set({ inviteId: id, locationId, waypoints, role: "sender" });
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
    // Dismiss the modal the instant they tap instead of holding it on a spinner
    // for the whole round-trip — the response is fire-and-navigate, so the only
    // thing the await gates is the redirect, not the dismissal. We keep the
    // incoming invite in context (don't clear yet) so that if the request fails
    // we can bring the modal back and let them retry.
    setShow(false);
    try {
      const result = await respondInvite.mutateAsync({ inviteId, accept });
      navInvites.clearIncoming();

      if (accept && result.locationId) {
        // Receiver: write the accepted trip into the store so LocationsPage starts
        // with waypoints when it mounts on /map.
        acceptedTripStore.set({
          inviteId,
          locationId: result.locationId,
          waypoints: result.waypoints ?? [],
          role: "receiver",
        });
        router.push(`/map?loc=${result.locationId}&nav=1&t=${Date.now()}`);
      } else if (!accept) {
        toast("Đã từ chối lời mời", "success");
      }
    } catch (err) {
      console.error(err);
      // Request failed — the invite is still pending on the server, so bring the
      // modal back (incoming was never cleared) and let them try again.
      setShow(true);
      toast("Không gửi được phản hồi, thử lại", "error");
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
