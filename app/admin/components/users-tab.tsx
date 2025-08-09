"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { getUserHistory } from "@/lib/session-tracker"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Users, UserCheck, Globe, MapPin, History, RefreshCw, Calendar } from "lucide-react"
import Image from "next/image"

interface UserWithHistory {
  id: string
  name: string
  email: string
  role: string
  kyc_status: string
  created_at: string
  sessionCount: number
  latestLocation: {
    ip: string
    country: string
    region: string
    city: string
    timezone: string
    isp: string
    lat: number
    lon: number
    flag: string
    lastLogin: string
  } | null
}

export default function UsersTab() {
  const [users, setUsers] = useState<UserWithHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithHistory | null>(null)
  const [locationHistory, setLocationHistory] = useState<any[]>([])
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        console.log("👥 Loading users with session history...")
        const data = await getUserHistory()
        console.log("👥 Users loaded:", data.length)

        // Debug: log the first user's data
        if (data.length > 0) {
          console.log("🔍 First user data:", {
            name: data[0].name,
            sessionCount: data[0].sessionCount,
            latestLocation: data[0].latestLocation,
          })
        }

        setUsers(data)
      } catch (error) {
        console.error("❌ Error loading users:", error)
        setUsers([])
      } finally {
        setLoading(false)
      }
    }

    loadUsers()

    // Set up real-time subscriptions for location changes
    const usersChannel = supabase
      .channel("admin_users_history")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_locations" }, loadUsers)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_sessions" }, loadUsers)
      .subscribe()

    // Auto-refresh every 2 minutes instead of 30 seconds
    const refreshInterval = setInterval(loadUsers, 2 * 60 * 1000)

    return () => {
      supabase.removeChannel(usersChannel)
      clearInterval(refreshInterval)
    }
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await getUserHistory()
      setUsers(data || [])
    } catch (error) {
      console.error("❌ Error refreshing users:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const viewLocationHistory = async (user: UserWithHistory) => {
    setSelectedUser(user)
    try {
      const { data: history } = await supabase
        .from("user_locations")
        .select("*")
        .eq("user_id", user.id)
        .order("detected_at", { ascending: false })
        .limit(50)

      setLocationHistory(history || [])
      setLocationDialogOpen(true)
    } catch (error) {
      console.error("❌ Error loading location history:", error)
      setLocationHistory([])
      setLocationDialogOpen(true)
    }
  }

  const getLastLoginText = (user: UserWithHistory) => {
    if (!user.latestLocation?.lastLogin) return "Never logged in"

    const lastLogin = new Date(user.latestLocation.lastLogin)
    const diffSeconds = Math.floor((Date.now() - lastLogin.getTime()) / 1000)

    if (diffSeconds < 60) return `${diffSeconds}s ago`
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const stats = {
    total: users.length,
    approved: users.filter((u) => u.kyc_status === "approved").length,
    withSessions: users.filter((u) => u.sessionCount > 0).length,
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">User Session History</h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1">
            Track user login/logout history with IP addresses and geolocation data
          </p>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="hover:bg-[#F26623] hover:text-white hover:border-[#F26623] bg-transparent w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          <span className="text-sm">{refreshing ? "Refreshing..." : "Refresh Data"}</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <Card className="border-l-4 border-l-[#F26623]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl md:text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#F26623]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">KYC Approved</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-[#F26623]">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#F26623] sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">With Login History</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-[#F26623]">{stats.withSessions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>User Login/Logout History</CardTitle>
          <CardDescription>Complete session tracking with IP addresses and geolocation data</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-48"></div>
                        <div className="h-3 bg-gray-200 rounded w-32"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : users.length > 0 ? (
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="p-3 md:p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
                    <div className="flex items-start space-x-3 sm:space-x-4 flex-1">
                      <div className="h-10 w-10 md:h-12 md:w-12 bg-[#F26623]/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-[#F26623] font-semibold text-sm md:text-lg">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <h3 className="text-sm md:text-base font-semibold text-gray-900 truncate">{user.name}</h3>
                          <Badge
                            variant={user.kyc_status === "approved" ? "default" : "secondary"}
                            className={
                              user.kyc_status === "approved"
                                ? "bg-[#F26623] hover:bg-[#F26623]/90 text-xs w-fit"
                                : "text-xs w-fit"
                            }
                          >
                            {user.kyc_status}
                          </Badge>
                        </div>

                        <p className="text-xs md:text-sm text-gray-600 truncate">{user.email}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs text-gray-500">
                          <span>Last: {getLastLoginText(user)}</span>
                          <span>{user.sessionCount} sessions</span>
                          <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                        </div>

                        {/* Latest Location Display */}
                        {user.latestLocation ? (
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 p-2 md:p-3 bg-white rounded-lg border">
                            <Image
                              src={user.latestLocation.flag || "/placeholder.svg"}
                              alt="Country flag"
                              width={16}
                              height={12}
                              className="w-4 h-3 sm:w-5 sm:h-3.5 object-cover rounded-sm border flex-shrink-0"
                              onError={(e) => {
                                ; (e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                            <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-[#F26623] flex-shrink-0" />
                            <span className="text-xs font-medium text-gray-700 truncate">
                              {user.latestLocation.city}, {user.latestLocation.country}
                            </span>
                            <Badge variant="outline" className="text-xs font-mono">
                              {user.latestLocation.ip}
                            </Badge>
                            <div className="hidden lg:flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {user.latestLocation.lat?.toFixed(2)}, {user.latestLocation.lon?.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 bg-gray-100 rounded text-xs text-gray-500">
                            No login history available
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end sm:justify-start">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewLocationHistory(user)}
                        className="text-xs hover:bg-[#F26623] hover:text-white hover:border-[#F26623] w-full sm:w-auto"
                      >
                        <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span>View History</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-500">Users will appear here when they register</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location History Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Login History - {selectedUser?.name}</DialogTitle>
            <DialogDescription className="text-sm">
              Complete login/logout history with IP addresses and geolocation data
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            {locationHistory.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {locationHistory.map((location, index) => (
                  <div key={location.id} className="p-3 sm:p-4 border rounded-lg bg-gray-50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 flex-1">
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <Image
                            src={location.flag_url || "/placeholder.svg"}
                            alt="Country flag"
                            width={20}
                            height={14}
                            className="w-5 h-3.5 sm:w-6 sm:h-4 object-cover rounded-sm border border-gray-200"
                            onError={(e) => {
                              ; (e.target as HTMLImageElement).style.display = "none"
                            }}
                          />
                          <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-[#F26623]" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-base font-medium text-gray-900 truncate">
                            {location.city}, {location.region}, {location.country}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs sm:text-sm text-gray-600 mt-1">
                            <span className="truncate">IP: {location.ip_address}</span>
                            <span className="truncate">ISP: {location.isp}</span>
                            <span className="truncate">TZ: {location.timezone}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                            Coordinates: {location.latitude?.toFixed(4)}, {location.longitude?.toFixed(4)}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right flex-shrink-0">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(location.detected_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">{new Date(location.detected_at).toLocaleTimeString()}</p>
                        {index === 0 && (
                          <Badge className="mt-1 bg-[#F26623]/10 text-[#F26623] text-xs">Most Recent</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No login history</h3>
                <p className="text-sm text-gray-500">Login data will appear when user logs in</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
