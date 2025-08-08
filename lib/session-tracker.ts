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

class SessionTracker {
  private static instance: SessionTracker;

  private constructor() {}

  static getInstance(): SessionTracker {
    if (!SessionTracker.instance) {
      SessionTracker.instance = new SessionTracker();
    }
    return SessionTracker.instance;
  }

  async logUserLogin(userId: string): Promise<void> {
    console.log("Logging user login:", userId);

    try {
      // Get user's location with fallback
      const location = await this.fetchUserLocation();
      console.log("Location fetched:", location);

      // Create session record
      const sessionToken = `session_${userId}_${Date.now()}`;
      const sessionData = {
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
        created_at: new Date().toISOString(),
      };

      const { data: session, error: sessionError } = await supabase
        .from("user_sessions")
        .insert(sessionData)
        .select()
        .single();

      if (sessionError) {
        console.error("Session creation error:", sessionError);
      }

      // Log location data
      const locationData = {
        user_id: userId,
        session_id: session?.id || null,
        ip_address: location.ip,
        country: location.country,
        region: location.region,
        city: location.city,
        timezone: location.timezone,
        isp: location.isp,
        latitude: location.lat,
        longitude: location.lon,
        flag_url: location.flag,
        detected_at: new Date().toISOString(),
      };

      const { error: locationError } = await supabase
        .from("user_locations")
        .insert(locationData);

      if (locationError) {
        console.error("Location logging error:", locationError);
      }

      // DO NOT log any login activity to activity_logs table that clients can see
      // Only log to internal systems or separate admin tables

      console.log("User login logged successfully");
    } catch (error) {
      console.error("Error logging user login:", error);
    }
  }

  async logUserLogout(userId: string): Promise<void> {
    console.log("Logging user logout:", userId);

    try {
      // Deactivate all active sessions for this user
      await supabase
        .from("user_sessions")
        .update({
          is_active: false,
          last_activity: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("is_active", true);

      // DO NOT log any logout activity to activity_logs table that clients can see
      // Only internal tracking

      console.log("User logout logged");
    } catch (error) {
      console.error("Error logging user logout:", error);
    }
  }

  private async fetchUserLocation(): Promise<LocationData> {
    try {
      console.log("Fetching location from API...");

      // Try the API route first
      const response = await fetch("/api/user-location", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Location API success:", data);
        return data;
      } else {
        console.error(
          "Location API failed:",
          response.status,
          response.statusText
        );
        throw new Error(`API failed: ${response.status}`);
      }
    } catch (error) {
      console.error("Location fetch failed:", error);

      // Return fallback data
      const fallback = {
        ip: `Fallback_${Date.now()}`,
        country: "Unknown",
        region: "Unknown",
        city: "Unknown",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        isp: "Unknown ISP",
        lat: 0,
        lon: 0,
        flag: "https://flagcdn.com/24x18/us.png",
      };

      console.log("Using fallback location:", fallback);
      return fallback;
    }
  }

  async getUserHistory(): Promise<any[]> {
    try {
      console.log("Fetching user history...");

      // Get users with their latest location data
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("*")
        .neq("role", "admin")
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error("Users query error:", usersError);
        return [];
      }

      // Get all user locations
      const { data: allLocations, error: locationsError } = await supabase
        .from("user_locations")
        .select("*")
        .order("detected_at", { ascending: false });

      if (locationsError) {
        console.error("Locations query error:", locationsError);
      }

      console.log("Total locations found:", allLocations?.length || 0);

      const processedUsers = (users || []).map((user) => {
        // Get all locations for this user
        const userLocations = (allLocations || []).filter(
          (loc) => loc.user_id === user.id
        );

        // Get the most recent location
        const latestLocation = userLocations[0]; // Already sorted by detected_at DESC

        console.log(
          `User ${user.name}: ${userLocations.length} locations, latest:`,
          latestLocation?.detected_at
        );

        return {
          ...user,
          sessionCount: userLocations.length,
          latestLocation: latestLocation
            ? {
                ip: latestLocation.ip_address,
                country: latestLocation.country,
                region: latestLocation.region,
                city: latestLocation.city,
                timezone: latestLocation.timezone,
                isp: latestLocation.isp,
                lat: latestLocation.latitude,
                lon: latestLocation.longitude,
                flag: latestLocation.flag_url,
                lastLogin: latestLocation.detected_at,
              }
            : null,
        };
      });

      console.log(`Processed ${processedUsers.length} users`);
      return processedUsers;
    } catch (error) {
      console.error("Error getting user history:", error);
      return [];
    }
  }
}

// Export singleton
export const sessionTracker = SessionTracker.getInstance();

// Export functions
export const logUserLogin = async (userId: string): Promise<void> => {
  await sessionTracker.logUserLogin(userId);
};

export const logUserLogout = async (userId: string): Promise<void> => {
  await sessionTracker.logUserLogout(userId);
};

export const getUserHistory = async (): Promise<any[]> => {
  return await sessionTracker.getUserHistory();
};

console.log("Session Tracker initialized - Professional banking format");
