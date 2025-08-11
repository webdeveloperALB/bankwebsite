"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Globe, MapPin, RefreshCw, Wifi } from "lucide-react"
import Image from "next/image"

interface LocationInfo {
  ip: string
  location: string
  country: string
  region: string
  city: string
  timezone: string
  isp: string
  coordinates: string
  flag: string
  lastUpdated: string
}

export default function AdminLocationHeader() {
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null)
  const [locationLoading, setLocationLoading] = useState(true)

  const fetchAdminLocation = async () => {
    setLocationLoading(true)
    try {
      console.log("🌍 Fetching admin location client-side (VPN-aware)...")

      // Try primary API - ipapi.co (client-side)
      try {
        const response = await fetch("https://ipapi.co/json/", {
          headers: {
            Accept: "application/json",
            "User-Agent": "Anchor Group Investments-Admin/1.0",
          },
        })

        if (response.ok) {
          const data = await response.json()

          if (!data.error) {
            const locationData = {
              ip: data.ip,
              location: `${data.city}, ${data.region}, ${data.country_name}`,
              country: data.country_name,
              region: data.region,
              city: data.city,
              timezone: data.timezone,
              isp: data.org || "Unknown ISP",
              coordinates: `${Number.parseFloat(data.latitude).toFixed(4)}, ${Number.parseFloat(data.longitude).toFixed(4)}`,
              flag: `https://flagcdn.com/24x18/${data.country_code.toLowerCase()}.png`,
              lastUpdated: new Date().toISOString(),
            }

            console.log("✅ Primary API successful (client-side):", locationData)
            setLocationInfo(locationData)
            return
          }
        }
      } catch (error) {
        console.log("Primary API failed:", error)
      }

      // Try backup API - ipinfo.io (client-side)
      try {
        const backupResponse = await fetch("https://ipinfo.io/json", {
          headers: {
            Accept: "application/json",
            "User-Agent": "Anchor Group Investments-Admin/1.0",
          },
        })

        if (backupResponse.ok) {
          const backupData = await backupResponse.json()
          const [lat, lon] = (backupData.loc || "0,0").split(",").map(Number.parseFloat)

          const backupLocationData = {
            ip: backupData.ip,
            location: `${backupData.city || "Unknown"}, ${backupData.region || "Unknown"}, ${backupData.country || "Unknown"}`,
            country: backupData.country || "Unknown",
            region: backupData.region || "Unknown",
            city: backupData.city || "Unknown",
            timezone: backupData.timezone || "UTC",
            isp: backupData.org || "Unknown ISP",
            coordinates: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
            flag: `https://flagcdn.com/24x18/${(backupData.country || "us").toLowerCase()}.png`,
            lastUpdated: new Date().toISOString(),
          }

          console.log("✅ Backup API successful (client-side):", backupLocationData)
          setLocationInfo(backupLocationData)
          return
        }
      } catch (error) {
        console.log("Backup API failed:", error)
      }

      // Try simple IP detection (client-side)
      try {
        const ipResponse = await fetch("https://api.ipify.org?format=json")
        if (ipResponse.ok) {
          const ipData = await ipResponse.json()

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
          }

          console.log("✅ IP-only detection successful (client-side):", fallbackData)
          setLocationInfo(fallbackData)
          return
        }
      } catch (error) {
        console.log("IP detection failed:", error)
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
      }

      console.log("⚠️ Using final fallback (client-side)")
      setLocationInfo(finalFallback)
    } catch (error) {
      console.error("❌ Client-side location fetch error:", error)

      setLocationInfo({
        ip: "Client error",
        location: "Location service unavailable",
        country: "Unknown",
        region: "Unknown",
        city: "Unknown",
        timezone: "UTC",
        isp: "Unknown ISP",
        coordinates: "0.0000, 0.0000",
        flag: "https://flagcdn.com/24x18/us.png",
        lastUpdated: new Date().toISOString(),
      })
    } finally {
      setLocationLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminLocation()

    // Refresh location every 10 minutes
    const interval = setInterval(fetchAdminLocation, 10 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const handleRefreshLocation = () => {
    fetchAdminLocation()
  }

  return (
    <div className="flex items-center space-x-4 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
      {locationLoading ? (
        <div className="flex items-center space-x-2">
          <div className="animate-spin">
            <Wifi className="h-4 w-4 text-blue-600" />
          </div>
          <span className="text-sm text-blue-700 font-medium">Detecting admin location...</span>
        </div>
      ) : locationInfo ? (
        <>
          <div className="flex items-center space-x-2">
            <Image
              src={locationInfo.flag || "/placeholder.svg"}
              alt="Country flag"
              width={24}
              height={16}
              className="w-6 h-4 object-cover rounded-sm border border-gray-200"
              onError={(e) => {
                ; (e.target as HTMLImageElement).style.display = "none"
              }}
            />
            <Globe className="h-4 w-4 text-blue-600" />
            <div className="text-sm">
              <div className="font-semibold text-blue-900">
                {locationInfo.city}, {locationInfo.country}
              </div>
              <div className="text-blue-600 text-xs font-mono">IP: {locationInfo.ip}</div>
            </div>
          </div>

          <div className="h-8 w-px bg-blue-200"></div>

          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <div className="text-xs text-blue-700">
              <div className="font-medium">{locationInfo.timezone}</div>
              <div className="text-blue-500">{locationInfo.coordinates}</div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshLocation}
            className="h-8 w-8 p-0 hover:bg-blue-100"
            title="Refresh admin location"
          >
            <RefreshCw className={`h-3 w-3 text-blue-600 ${locationLoading ? "animate-spin" : ""}`} />
          </Button>
        </>
      ) : (
        <div className="flex items-center space-x-2">
          <Globe className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-600 font-medium">Admin location unavailable</span>
          <Button variant="ghost" size="sm" onClick={handleRefreshLocation} className="h-6 w-6 p-0 hover:bg-red-100">
            <RefreshCw className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      )}
    </div>
  )
}
