import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log("🌍 Fetching user location server-side...");

    // Try primary API - ipapi.co
    try {
      const response = await fetch("https://ipapi.co/json/", {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SecureBank-Client/1.0',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (!data.error) {
          const locationData = {
            ip: data.ip,
            country: data.country_name || "Unknown",
            region: data.region || "Unknown",
            city: data.city || "Unknown",
            timezone: data.timezone || "UTC",
            isp: data.org || "Unknown ISP",
            lat: parseFloat(data.latitude) || 0,
            lon: parseFloat(data.longitude) || 0,
            flag: `https://flagcdn.com/24x18/${(data.country_code || 'us').toLowerCase()}.png`,
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
          'User-Agent': 'SecureBank-Client/1.0',
        },
      });

      if (backupResponse.ok) {
        const backupData = await backupResponse.json();
        const [lat, lon] = (backupData.loc || "0,0").split(",").map(parseFloat);

        const backupLocationData = {
          ip: backupData.ip,
          country: backupData.country || "Unknown",
          region: backupData.region || "Unknown", 
          city: backupData.city || "Unknown",
          timezone: backupData.timezone || "UTC",
          isp: backupData.org || "Unknown ISP",
          lat: lat || 0,
          lon: lon || 0,
          flag: `https://flagcdn.com/24x18/${(backupData.country || 'us').toLowerCase()}.png`,
        };

        console.log("✅ Backup API successful:", backupLocationData);
        return NextResponse.json(backupLocationData);
      }
    } catch (error) {
      console.log("Backup API failed:", error);
    }

    // Final fallback
    const fallbackData = {
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

    console.log("⚠️ Using fallback data");
    return NextResponse.json(fallbackData);

  } catch (error) {
    console.error("❌ Server-side location fetch error:", error);
    
    return NextResponse.json({
      ip: "Server error",
      country: "Unknown",
      region: "Unknown",
      city: "Unknown",
      timezone: "UTC",
      isp: "Unknown ISP", 
      lat: 0,
      lon: 0,
      flag: "https://flagcdn.com/24x18/us.png",
    });
  }
}
