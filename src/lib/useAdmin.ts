"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

/**
 * Client-side hook to check if the current user is an admin
 * @returns Object with isAdmin boolean and loading state
 */
export function useAdmin() {
  const { user, isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdminStatus() {
      if (!isLoaded || !user) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/admin/check");
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (err) {
        console.error("Error checking admin status:", err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    checkAdminStatus();
  }, [isLoaded, user]);

  return { isAdmin, loading };
}

