import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const ADMIN_SESSION_DURATION = 20 * 60 * 1000; // 20 minutes in milliseconds
const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before expiry

export interface AdminSessionState {
  isExpired: boolean;
  timeRemaining: number;
  showWarning: boolean;
  extendSession: () => void;
  forceLogout: () => void;
}

export function useAdminSession(): AdminSessionState {
  const [isExpired, setIsExpired] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(ADMIN_SESSION_DURATION);
  const [showWarning, setShowWarning] = useState(false);
  const [, forceUpdate] = useState({});
  const router = useRouter();

  const getSessionTimestamp = useCallback((): number | null => {
    if (typeof window === "undefined") return null;

    try {
      const adminSession = localStorage.getItem("admin_session");
      if (adminSession) {
        const { timestamp } = JSON.parse(adminSession);
        return timestamp;
      }
    } catch (error) {
      console.error("Error parsing admin session:", error);
    }
    return null;
  }, []);

  const extendSession = useCallback(() => {
    // Session extension disabled - admin must re-login after 20 minutes
    console.log("⚠️ Session extension disabled - please log in again");
  }, []);

  const forceLogout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_session");
    }
    console.log("🔒 Admin session expired after 20 minutes - automatic logout");
    router.push("/auth/login");
  }, [router]);

  const checkSession = useCallback(() => {
    const timestamp = getSessionTimestamp();
    if (!timestamp) {
      setIsExpired(true);
      return;
    }

    const elapsed = Date.now() - timestamp;
    const remaining = ADMIN_SESSION_DURATION - elapsed;

    setTimeRemaining(remaining);

    if (remaining <= 0) {
      console.log(
        "🔒 Admin session expired after exactly 20 minutes - automatic logout"
      );
      setIsExpired(true);
      forceLogout();
    } else if (remaining <= WARNING_TIME) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [getSessionTimestamp, forceLogout]);

  useEffect(() => {
    // Initial session check
    checkSession();

    // Set up interval to check session every second for accurate countdown
    const interval = setInterval(() => {
      checkSession();
      // Force component re-render to update countdown display
      forceUpdate({});
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [checkSession]);

  return {
    isExpired,
    timeRemaining,
    showWarning,
    extendSession,
    forceLogout,
  };
}
