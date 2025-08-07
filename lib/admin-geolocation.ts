import { useState, useEffect } from "react";

// Server-side admin geolocation service
export interface AdminLocationData {
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

export async function getAdminLocation(): Promise<AdminLocationData> {
  try {
    const response = await fetch("/api/admin-location");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching admin location:", error);
    throw error;
  }
}

// Client-side hook for admin location
export function useAdminLocation() {
  const [location, setLocation] = useState<AdminLocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminLocation();
      setLocation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  return {
    location,
    loading,
    error,
    refetch: fetchLocation,
  };
}
