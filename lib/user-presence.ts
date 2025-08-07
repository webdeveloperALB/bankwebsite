import { supabase } from "./supabase";

interface UserLocationData {
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

interface UserWithPresence {
  id: string;
  name: string;
  email: string;
  role: string;
  kyc_status: string;
  created_at: string;
  isOnline: boolean;
  lastSeen: string;
  sessionCount: number;
  location: UserLocationData | null;
}

class FixedUserPresenceManager {
  private static instance: FixedUserPresenceManager;
  private activeUsers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  static getInstance(): FixedUserPresenceManager {
    if (!FixedUserPresenceManager.instance) {
      FixedUserPresenceManager.instance = new FixedUserPresenceManager();
    }
    return FixedUserPresenceManager.instance;
  }

  async setUserOnline(userId: string): Promise<void> {
    console.log("🟢 Setting user ONLINE:", userId);

    try {
      // Get user's location
      const location = await this.getUserLocation();

      // Create session with location
      const sessionToken = `session_${userId}_${Date.now()}`;
      const { data: session, error: sessionError } = await supabase
        .from("user_sessions")
        .insert({
          user_id: userId,
          session_token: sessionToken,
          ip_address: location.ip,
          country: location.country,
          region: location.region,
          city: location.city,
          timezone: location.timezone,
          isp: location.isp,
          latitude: location.lat,
          longitude: location.lon,
          flag_url: location.flag,
          is_active: true,
          last_activity: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) {
        console.error("❌ Session creation error:", sessionError);
        return;
      }

      // Update user presence
      const { error: presenceError } = await supabase
        .from("user_presence")
        .upsert(
          {
            user_id: userId,
            is_online: true,
            last_seen: new Date().toISOString(),
            current_session_id: session.id,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (presenceError) {
        console.error("❌ Presence update error:", presenceError);
        return;
      }

      // Log location
      await supabase.from("user_locations").insert({
        user_id: userId,
        session_id: session.id,
        ip_address: location.ip,
        country: location.country,
        region: location.region,
        city: location.city,
        timezone: location.timezone,
        isp: location.isp,
        latitude: location.lat,
        longitude: location.lon,
        flag_url: location.flag,
      });

      // Start heartbeat
      this.startHeartbeat(userId, session.id);

      console.log("✅ User set online with location:", location.city);
    } catch (error) {
      console.error("❌ Error setting user online:", error);
    }
  }

  async setUserOffline(userId: string): Promise<void> {
    console.log("🔴 Setting user OFFLINE:", userId);

    try {
      // Stop heartbeat
      this.stopHeartbeat(userId);

      // Deactivate sessions
      await supabase
        .from("user_sessions")
        .update({
          is_active: false,
          last_activity: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("is_active", true);

      // Update presence
      await supabase
        .from("user_presence")
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
          current_session_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      console.log("✅ User set offline");
    } catch (error) {
      console.error("❌ Error setting user offline:", error);
    }
  }

  private startHeartbeat(userId: string, sessionId: string): void {
    this.stopHeartbeat(userId);

    const interval = setInterval(async () => {
      try {
        // Update session
        await supabase
          .from("user_sessions")
          .update({ last_activity: new Date().toISOString() })
          .eq("id", sessionId)
          .eq("is_active", true);

        // Update presence
        await supabase
          .from("user_presence")
          .update({
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        console.log("💓 Heartbeat for user:", userId);
      } catch (error) {
        console.error("❌ Heartbeat error:", error);
        this.stopHeartbeat(userId);
      }
    }, 30000);

    this.activeUsers.set(userId, interval);
  }

  private stopHeartbeat(userId: string): void {
    const interval = this.activeUsers.get(userId);
    if (interval) {
      clearInterval(interval);
      this.activeUsers.delete(userId);
    }
  }

  private async getUserLocation(): Promise<UserLocationData> {
    try {
      const response = await fetch("https://ipapi.co/json/");
      if (!response.ok) throw new Error("API failed");

      const data = await response.json();
      if (data.error) throw new Error(data.reason);

      return {
        ip: data.ip,
        country: data.country_name || "Unknown",
        region: data.region || "Unknown",
        city: data.city || "Unknown",
        timezone: data.timezone || "UTC",
        isp: data.org || "Unknown ISP",
        lat: parseFloat(data.latitude) || 0,
        lon: parseFloat(data.longitude) || 0,
        flag: `https://flagcdn.com/24x18/${(
          data.country_code || "us"
        ).toLowerCase()}.png`,
      };
    } catch (error) {
      console.error("❌ Location fetch failed:", error);
      return {
        ip: "Unknown",
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

  async getAllUsersWithPresence(): Promise<UserWithPresence[]> {
    try {
      console.log("👥 Fetching all users with presence...");

      // Get users with their presence data
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select(
          `
          *,
          user_presence (
            is_online,
            last_seen,
            current_session_id
          )
        `
        )
        .neq("role", "admin")
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error("❌ Users query error:", usersError);
        return [];
      }

      // Get all active sessions
      const { data: sessions } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("is_active", true)
        .order("last_activity", { ascending: false });

      // Get latest locations
      const { data: locations } = await supabase
        .from("user_locations")
        .select("*")
        .order("detected_at", { ascending: false });

      const processedUsers = (users || []).map((user) => {
        const presence = user.user_presence?.[0];
        const userSessions =
          sessions?.filter((s) => s.user_id === user.id) || [];
        const latestLocation = locations?.find((l) => l.user_id === user.id);

        // Determine online status
        let isOnline = false;
        let lastSeen = user.created_at;

        if (presence) {
          const lastSeenTime = new Date(presence.last_seen).getTime();
          const timeSinceActivity = Date.now() - lastSeenTime;

          // Online if marked online AND recent activity (within 2 minutes)
          isOnline = presence.is_online && timeSinceActivity < 120000;
          lastSeen = presence.last_seen;
        }

        // Get location from latest session or location record
        let location: UserLocationData | null = null;
        const activeSession = userSessions[0];

        if (activeSession) {
          location = {
            ip: activeSession.ip_address || "Unknown",
            country: activeSession.country || "Unknown",
            region: activeSession.region || "Unknown",
            city: activeSession.city || "Unknown",
            timezone: activeSession.timezone || "UTC",
            isp: activeSession.isp || "Unknown ISP",
            lat: activeSession.latitude || 0,
            lon: activeSession.longitude || 0,
            flag: activeSession.flag_url || "https://flagcdn.com/24x18/us.png",
          };
        } else if (latestLocation) {
          location = {
            ip: latestLocation.ip_address || "Unknown",
            country: latestLocation.country || "Unknown",
            region: latestLocation.region || "Unknown",
            city: latestLocation.city || "Unknown",
            timezone: latestLocation.timezone || "UTC",
            isp: latestLocation.isp || "Unknown ISP",
            lat: latestLocation.latitude || 0,
            lon: latestLocation.longitude || 0,
            flag: latestLocation.flag_url || "https://flagcdn.com/24x18/us.png",
          };
        }

        return {
          ...user,
          isOnline,
          lastSeen,
          sessionCount: userSessions.length,
          location,
        };
      });

      const onlineCount = processedUsers.filter((u) => u.isOnline).length;
      console.log(
        `👥 Loaded ${processedUsers.length} users (${onlineCount} online)`
      );

      return processedUsers;
    } catch (error) {
      console.error("❌ Error getting users with presence:", error);
      return [];
    }
  }
}

// Export singleton
export const fixedPresenceManager = FixedUserPresenceManager.getInstance();

// Export functions
export const setUserOnline = async (userId: string): Promise<void> => {
  await fixedPresenceManager.setUserOnline(userId);
};

export const setUserOffline = async (userId: string): Promise<void> => {
  await fixedPresenceManager.setUserOffline(userId);
};

export const getAllUsersWithPresence = async (): Promise<
  UserWithPresence[]
> => {
  return await fixedPresenceManager.getAllUsersWithPresence();
};

console.log("🟢 Fixed User Presence Manager initialized");
