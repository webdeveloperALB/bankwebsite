import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log("🌍 Fetching admin location server-side...");

    // Try primary API - ipapi.co
    try {
      const response = await fetch("https://ipapi.co/json/", {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SecureBank-Admin/1.0',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (!data.error) {
          const locationData = {
            ip: data.ip,
            location: `${data.city}, ${data.region}, ${data.country_name}`,
            country: data.country_name,
            region: data.region,
            city: data.city,
            timezone: data.timezone,
            isp: data.org || "Unknown ISP",
            coordinates: `${parseFloat(data.latitude).toFixed(4)}, ${parseFloat(data.longitude).toFixed(4)}`,
            flag: `https://flagcdn.com/24x18/${data.country_code.toLowerCase()}.png`,
            lastUpdated: new Date().toISOString(),
          };

          console.log("✅ Primary API successful:", locationData);
          return NextResponse.json(locationData);
        }
      }
    } catch (error) {
      console.log("Primary API failed:", error);
    }

    // Try backup API - ipinfo.io
    try {
      const backupResponse = await fetch("https://ipinfo.io/json", {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SecureBank-Admin/1.0',
        },
      });

      if (backupResponse.ok) {
        const backupData = await backupResponse.json();
        const [lat, lon] = (backupData.loc || "0,0").split(",").map(parseFloat);

        const backupLocationData = {
          ip: backupData.ip,
          location: `${backupData.city || "Unknown"}, ${backupData.region || "Unknown"}, ${backupData.country || "Unknown"}`,
          country: backupData.country || "Unknown",
          region: backupData.region || "Unknown", 
          city: backupData.city || "Unknown",
          timezone: backupData.timezone || "UTC",
          isp: backupData.org || "Unknown ISP",
          coordinates: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          flag: `https://flagcdn.com/24x18/${(backupData.country || 'us').toLowerCase()}.png`,
          lastUpdated: new Date().toISOString(),
        };

        console.log("✅ Backup API successful:", backupLocationData);
        return NextResponse.json(backupLocationData);
      }
    } catch (error) {
      console.log("Backup API failed:", error);
    }

    // Try simple IP detection
    try {
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      if (ipResponse.ok) {
        const ipData = await ipResponse.json();
        
        const fallbackData = {
          ip: ipData.ip,
          location: "Location detection unavailable",
          country: "Unknown",
          region: "Unknown",
          city: "Unknown", 
          timezone: "UTC",
          isp: "Unknown ISP",
          coordinates: "0.0000, 0.0000",
          flag: "https://flagcdn.com/24x18/us.png",
          lastUpdated: new Date().toISOString(),
        };

        console.log("✅ IP-only detection successful:", fallbackData);
        return NextResponse.json(fallbackData);
      }
    } catch (error) {
      console.log("IP detection failed:", error);
    }

    // Final fallback
    const finalFallback = {
      ip: "Detection failed",
      location: "Unable to detect location",
      country: "Unknown",
      region: "Unknown",
      city: "Unknown",
      timezone: "UTC", 
      isp: "Unknown ISP",
      coordinates: "0.0000, 0.0000",
      flag: "https://flagcdn.com/24x18/us.png",
      lastUpdated: new Date().toISOString(),
    };

    console.log("⚠️ Using final fallback");
    return NextResponse.json(finalFallback);

  } catch (error) {
    console.error("❌ Server-side location fetch error:", error);
    
    return NextResponse.json({
      ip: "Server error",
      location: "Location service unavailable", 
      country: "Unknown",
      region: "Unknown",
      city: "Unknown",
      timezone: "UTC",
      isp: "Unknown ISP", 
      coordinates: "0.0000, 0.0000",
      flag: "https://flagcdn.com/24x18/us.png",
      lastUpdated: new Date().toISOString(),
    });
  }
}
