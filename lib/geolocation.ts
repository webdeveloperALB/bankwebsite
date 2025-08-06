// IP Address and Geolocation Detection Service
import { supabase } from "./supabase";

interface GeolocationData {
  ip: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
  isp: string;
  lat: number;
  lon: number;
  flag: string;
  countryCode: string;
}

export interface LocationInfo {
  ip: string;
  location: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
  isp: string;
  coordinates: string;
  flag: string;
  lastUpdated: string;
}

class GeolocationService {
  private static instance: GeolocationService;
  private locationData: LocationInfo | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private subscribers: Array<(data: LocationInfo) => void> = [];

  private constructor() {
    this.initializeLocationTracking();
  }

  static getInstance(): GeolocationService {
    if (!GeolocationService.instance) {
      GeolocationService.instance = new GeolocationService();
    }
    return GeolocationService.instance;
  }

  private async initializeLocationTracking() {
    console.log("🌍 Initializing IP geolocation tracking...");

    // Get initial location
    await this.updateLocation();

    // Update every 5 minutes
    this.updateInterval = setInterval(() => {
      this.updateLocation();
    }, 5 * 60 * 1000);
  }

  private async updateLocation() {
    try {
      console.log("📍 Fetching current IP and geolocation...");

      // Try primary geolocation API
      const locationData = await this.fetchFromPrimaryAPI();

      if (locationData) {
        this.locationData = {
          ip: locationData.ip,
          location: `${locationData.city}, ${locationData.region}, ${locationData.country}`,
          country: locationData.country,
          region: locationData.region,
          city: locationData.city,
          timezone: locationData.timezone,
          isp: locationData.isp,
          coordinates: `${locationData.lat.toFixed(
            4
          )}, ${locationData.lon.toFixed(4)}`,
          flag: locationData.flag,
          lastUpdated: new Date().toISOString(),
        };

        console.log("✅ Location updated:", this.locationData);
        this.notifySubscribers();

        // Log admin location activity
        await this.logLocationActivity();
      }
    } catch (error) {
      console.error("❌ Error updating location:", error);
      await this.tryBackupAPIs();
    }
  }

  private async fetchFromPrimaryAPI(): Promise<GeolocationData | null> {
    try {
      // Using ipapi.co for accurate geolocation
      const response = await fetch("https://ipapi.co/json/", {
        headers: {
          Accept: "application/json",
          "User-Agent": "SecureBank-Admin/1.0",
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      if (data.error) throw new Error(data.reason || "API Error");

      return {
        ip: data.ip,
        country: data.country_name,
        region: data.region,
        city: data.city,
        timezone: data.timezone,
        isp: data.org || "Unknown ISP",
        lat: parseFloat(data.latitude) || 0,
        lon: parseFloat(data.longitude) || 0,
        flag: `https://flagcdn.com/24x18/${data.country_code.toLowerCase()}.png`,
        countryCode: data.country_code,
      };
    } catch (error) {
      console.error("Primary API failed:", error);
      throw error;
    }
  }

  private async tryBackupAPIs() {
    try {
      console.log("🔄 Trying backup geolocation APIs...");

      // Backup API 1: ipinfo.io
      try {
        const response = await fetch("https://ipinfo.io/json");
        if (response.ok) {
          const data = await response.json();
          const [lat, lon] = (data.loc || "0,0").split(",").map(parseFloat);

          this.locationData = {
            ip: data.ip,
            location: `${data.city || "Unknown"}, ${
              data.region || "Unknown"
            }, ${data.country || "Unknown"}`,
            country: data.country || "Unknown",
            region: data.region || "Unknown",
            city: data.city || "Unknown",
            timezone: data.timezone || "Unknown",
            isp: data.org || "Unknown ISP",
            coordinates: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
            flag: `https://flagcdn.com/24x18/${(
              data.country || "us"
            ).toLowerCase()}.png`,
            lastUpdated: new Date().toISOString(),
          };

          console.log("✅ Backup API successful");
          this.notifySubscribers();
          return;
        }
      } catch (error) {
        console.log("Backup API 1 failed:", error);
      }

      // Backup API 2: Simple IP detection
      try {
        const response = await fetch("https://api.ipify.org?format=json");
        if (response.ok) {
          const data = await response.json();

          this.locationData = {
            ip: data.ip,
            location: "Location detection unavailable",
            country: "Unknown",
            region: "Unknown",
            city: "Unknown",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            isp: "Unknown ISP",
            coordinates: "0.0000, 0.0000",
            flag: "https://flagcdn.com/24x18/us.png",
            lastUpdated: new Date().toISOString(),
          };

          console.log("✅ Basic IP detection successful");
          this.notifySubscribers();
          return;
        }
      } catch (error) {
        console.log("Backup API 2 failed:", error);
      }

      // Final fallback
      this.locationData = {
        ip: "Detection failed",
        location: "Unable to detect location",
        country: "Unknown",
        region: "Unknown",
        city: "Unknown",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isp: "Unknown ISP",
        coordinates: "0.0000, 0.0000",
        flag: "https://flagcdn.com/24x18/us.png",
        lastUpdated: new Date().toISOString(),
      };

      console.log("⚠️ Using fallback location data");
      this.notifySubscribers();
    } catch (error) {
      console.error("All backup APIs failed:", error);
    }
  }

  private async logLocationActivity() {
    try {
      if (!this.locationData) return;

      // Get current admin user
      const adminSession = localStorage.getItem("admin_session");
      if (!adminSession) return;

      const { user } = JSON.parse(adminSession);

      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: `Admin location: ${this.locationData.location} (IP: ${this.locationData.ip})`,
      });
    } catch (error) {
      console.error("Error logging location activity:", error);
    }
  }

  private notifySubscribers() {
    if (this.locationData) {
      this.subscribers.forEach((callback) => {
        try {
          callback(this.locationData!);
        } catch (error) {
          console.error("Error in location subscriber:", error);
        }
      });
    }
  }

  // Public methods
  getCurrentLocation(): LocationInfo | null {
    return this.locationData;
  }

  subscribe(callback: (data: LocationInfo) => void): () => void {
    this.subscribers.push(callback);

    // Immediately call with current data if available
    if (this.locationData) {
      callback(this.locationData);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== callback);
    };
  }

  async forceUpdate(): Promise<void> {
    await this.updateLocation();
  }

  getLocationSummary(): string {
    if (!this.locationData) return "Location detecting...";

    return `${this.locationData.city}, ${this.locationData.country} (${this.locationData.ip})`;
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.subscribers = [];
    console.log("🛑 Geolocation service destroyed");
  }
}

// Create singleton instance
export const geolocationService = GeolocationService.getInstance();

// Utility functions
export const getCurrentLocation = (): LocationInfo | null => {
  return geolocationService.getCurrentLocation();
};

export const subscribeToLocationUpdates = (
  callback: (data: LocationInfo) => void
): (() => void) => {
  return geolocationService.subscribe(callback);
};

export const forceLocationUpdate = async (): Promise<void> => {
  await geolocationService.forceUpdate();
};

export const getLocationSummary = (): string => {
  return geolocationService.getLocationSummary();
};

// Initialize on import
if (typeof window !== "undefined") {
  console.log("🌍 Geolocation Service initialized for admin panel");
  console.log("📍 Real-time IP and location tracking active");
}
