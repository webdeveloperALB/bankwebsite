// Simple Online/Offline User Presence System
import { supabase } from "./supabase";

interface LocationData {
  ip: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
  isp: string;
  lat: number;
  lon: number;
  flag: string;
}

interface UserPresenceData {
  id: string;
  name: string;
  email: string;
  role: string;
  kyc_status: string;
  created_at: string;
  isOnline: boolean;
  lastSeen: string;
  location: LocationData | null;
}

class SimplePresenceManager {
  private static instance: SimplePresenceManager;
  private currentUserId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentLocation: LocationData | null = null;

  private constructor() {}

  static getInstance(): SimplePresenceManager {
    if (!SimplePresenceManager.instance) {
      SimplePresenceManager.instance = new SimplePresenceManager();
    }
    return SimplePresenceManager.instance;
  }

  // Set user ONLINE - called on login or any activity
  async setUserOnline(userId: string): Promise<void> {
    console.log("🟢 Setting user ONLINE:", userId);
    this.currentUserId = userId;

    try {
      // Get current location if we don't have it
      if (!this.currentLocation) {
        this.currentLocation = await this.getCurrentLocation();
      }

      // Update user_presence table - set online with current timestamp
      const { error } = await supabase.from("user_presence").upsert(
        {
          user_id: userId,
          is_online: true,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

      if (error) {
        console.error("❌ Error setting user online:", error);
        return;
      }

      // Log location if we have it
      if (this.currentLocation) {
        await supabase.from("user_locations").insert({
          user_id: userId,
          session_id: `simple_${userId}_${Date.now()}`,
          ip_address: this.currentLocation.ip,
          country: this.currentLocation.country,
          region: this.currentLocation.region,
          city: this.currentLocation.city,
          timezone: this.currentLocation.timezone,
          isp: this.currentLocation.isp,
          latitude: this.currentLocation.lat,
          longitude: this.currentLocation.lon,
          flag_url: this.currentLocation.flag,
        });
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: userId,
        activity: `🟢 ONLINE: ${this.currentLocation?.city || "Unknown"}, ${
          this.currentLocation?.country || "Unknown"
        } (${this.currentLocation?.ip || "Unknown IP"})`,
      });

      // Start heartbeat to keep user online
      this.startHeartbeat(userId);

      console.log("✅ User set to ONLINE successfully");
    } catch (error) {
      console.error("❌ Error in setUserOnline:", error);
    }
  }

  // Set user OFFLINE - called on logout
  async setUserOffline(userId: string): Promise<void> {
    console.log("🔴 Setting user OFFLINE:", userId);

    try {
      // Update user_presence table - set offline
      const { error } = await supabase.from("user_presence").upsert(
        {
          user_id: userId,
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

      if (error) {
        console.error("❌ Error setting user offline:", error);
        return;
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: userId,
        activity: "🔴 OFFLINE: User logged out",
      });

      // Stop heartbeat
      this.stopHeartbeat();

      console.log("✅ User set to OFFLINE successfully");
    } catch (error) {
      console.error("❌ Error in setUserOffline:", error);
    }
  }

  // Keep user online with heartbeat
  private startHeartbeat(userId: string): void {
    // Clear any existing heartbeat
    this.stopHeartbeat();

    console.log("💓 Starting heartbeat for user:", userId);

    // Update presence every 30 seconds to keep user online
    this.heartbeatInterval = setInterval(async () => {
      if (this.currentUserId === userId) {
        console.log("💓 Heartbeat - keeping user online");

        // Just update the timestamp to keep user online
        const { error } = await supabase
          .from("user_presence")
          .update({
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("is_online", true);

        if (error) {
          console.error("❌ Heartbeat error:", error);
        }
      }
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log("💓 Heartbeat stopped");
    }
  }

  private async getCurrentLocation(): Promise<LocationData> {
    try {
      console.log("🌍 Fetching REAL IP and geolocation...");

      const response = await fetch("https://ipapi.co/json/", {
        headers: {
          Accept: "application/json",
          "User-Agent": "SecureBank/1.0",
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      if (data.error) throw new Error(data.reason || "API Error");

      const location: LocationData = {
        ip: data.ip,
        country: data.country_name,
        region: data.region,
        city: data.city,
        timezone: data.timezone,
        isp: data.org || "Unknown ISP",
        lat: parseFloat(data.latitude) || 0,
        lon: parseFloat(data.longitude) || 0,
        flag: `https://flagcdn.com/24x18/${data.country_code.toLowerCase()}.png`,
      };

      console.log("✅ REAL location fetched:", location);
      return location;
    } catch (error) {
      console.error("❌ Location API failed:", error);
      // Return fallback
      return {
        ip: "Detection failed",
        country: "Unknown",
        region: "Unknown",
        city: "Unknown",
        timezone: "UTC",
        isp: "Unknown ISP",
        lat: 0,
        lon: 0,
        flag: "https://flagcdn.com/24x18/us.png",
      };
    }
  }

  // Get all users with their online status
  async getAllUsersWithPresence(): Promise<UserPresenceData[]> {
    try {
      console.log("👥 Fetching users with simple presence...");

      // Get all non-admin users
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("*")
        .neq("role", "admin")
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error("❌ Error fetching users:", usersError);
        return [];
      }

      // Get presence data for all users
      const { data: presenceData } = await supabase
        .from("user_presence")
        .select("*");

      // Get latest location for each user
      const { data: locationData } = await supabase
        .from("user_locations")
        .select("*")
        .order("detected_at", { ascending: false });

      const usersWithPresence = (users || []).map((user) => {
        // Find user's presence record
        const presence = presenceData?.find((p) => p.user_id === user.id);

        // Find user's latest location
        const location = locationData?.find((l) => l.user_id === user.id);

        // Determine if user is actually online
        let isOnline = false;
        let lastSeen = user.created_at;

        if (presence) {
          const lastSeenTime = new Date(presence.last_seen).getTime();
          const timeSinceActivity = Date.now() - lastSeenTime;

          // User is online if marked as online AND activity within last 2 minutes
          isOnline = presence.is_online && timeSinceActivity < 2 * 60 * 1000;
          lastSeen = presence.last_seen;

          console.log(
            `👤 ${user.name}: is_online=${
              presence.is_online
            }, time_since=${Math.floor(
              timeSinceActivity / 1000
            )}s, FINAL=${isOnline}`
          );
        }

        return {
          ...user,
          isOnline,
          lastSeen,
          location: location
            ? {
                ip: location.ip_address,
                country: location.country || "Unknown",
                region: location.region || "Unknown",
                city: location.city || "Unknown",
                timezone: location.timezone || "UTC",
                isp: location.isp || "Unknown ISP",
                lat: location.latitude || 0,
                lon: location.longitude || 0,
                flag: location.flag_url || "https://flagcdn.com/24x18/us.png",
              }
            : null,
        };
      });

      const onlineCount = usersWithPresence.filter((u) => u.isOnline).length;
      console.log(
        `👥 Processed ${
          usersWithPresence.length
        } users: ${onlineCount} online, ${
          usersWithPresence.length - onlineCount
        } offline`
      );

      return usersWithPresence;
    } catch (error) {
      console.error("❌ Error in getAllUsersWithPresence:", error);
      return [];
    }
  }

  destroy(): void {
    this.stopHeartbeat();
    this.currentUserId = null;
    this.currentLocation = null;
    console.log("🛑 Simple presence manager destroyed");
  }
}

// Export singleton instance
export const simplePresenceManager = SimplePresenceManager.getInstance();

// Simple utility functions
export const setUserOnline = async (userId: string): Promise<void> => {
  await simplePresenceManager.setUserOnline(userId);
};

export const setUserOffline = async (userId: string): Promise<void> => {
  await simplePresenceManager.setUserOffline(userId);
};

export const getAllUsersWithPresence = async (): Promise<
  UserPresenceData[]
> => {
  return await simplePresenceManager.getAllUsersWithPresence();
};

// Initialize on client side
if (typeof window !== "undefined") {
  console.log("🟢 Simple Presence Manager initialized");
  console.log("📍 Two-state system: Online/Offline only");
}
