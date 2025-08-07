"use client";

import React from "react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getAllUsersWithPresence } from "@/lib/user-presence";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Globe,
  MapPin,
  Wifi,
  WifiOff,
  Eye,
  History,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import { Database } from "@/lib/supabase";

type User = Database["public"]["Tables"]["users"]["Row"];

export default function UsersTab() {
  const [usersWithPresence, setUsersWithPresence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

  useEffect(() => {
    const loadUsersWithPresence = async () => {
      try {
        console.log("👥 Loading users with REAL presence data...");
        const data = await getAllUsersWithPresence();
        console.log("👥 Users with REAL presence loaded:", data.length);
        setUsersWithPresence(data);
      } catch (error) {
        console.error("❌ Error loading users with presence:", error);
        setUsersWithPresence([]);
      } finally {
        setLoading(false);
      }
    };

    loadUsersWithPresence();

    // Set up real-time subscriptions for user changes
    const usersChannel = supabase
      .channel("admin_users_presence")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          console.log("🔄 Users table changed - reloading presence");
          loadUsersWithPresence();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_sessions" },
        () => {
          console.log("🔄 User sessions changed - reloading presence");
          loadUsersWithPresence();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_logs" },
        () => {
          console.log("🔄 Activity logs changed - reloading presence");
          loadUsersWithPresence();
        }
      )
      .subscribe();

    // Auto-refresh every 15 seconds for real-time accuracy
    const refreshInterval = setInterval(() => {
      console.log("🔄 Auto-refreshing presence data...");
      loadUsersWithPresence();
    }, 15000);

    return () => {
      supabase.removeChannel(usersChannel);
      clearInterval(refreshInterval);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getAllUsersWithPresence();
      setUsersWithPresence(data || []);
    } catch (error) {
      console.error("❌ Error refreshing users:", error);
      setUsersWithPresence([]);
    } finally {
      setRefreshing(false);
    }
  };

  const viewLocationHistory = async (user: any) => {
    setSelectedUser(user);
    try {
      const { data: history } = await supabase
        .from("user_locations")
        .select("*")
        .eq("user_id", user.id)
        .order("detected_at", { ascending: false })
        .limit(50);

      setLocationHistory(history || []);
      setLocationDialogOpen(true);
    } catch (error) {
      console.error("❌ Error loading location history:", error);
      setLocationHistory([]);
      setLocationDialogOpen(true);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      console.error("Error updating user role:", error);
    }
  };

  const getOnlineStatus = (user: any) => {
    const lastSeen = new Date(user.lastSeen);
    const diffSeconds = Math.floor((Date.now() - lastSeen.getTime()) / 1000);

    console.log(
      `👤 ${user.name}: isOnline=${user.isOnline}, diffSeconds=${diffSeconds}`
    );

    // Online if marked as online and activity within last 30 seconds
    if (user.isOnline && diffSeconds < 30) {
      return {
        status: "online",
        color: "bg-green-100 text-green-800",
        icon: Wifi,
      };
    }

    // Recently active if within 2 minutes
    if (diffSeconds < 120) {
      return {
        status: "recently",
        color: "bg-yellow-100 text-yellow-800",
        icon: Clock,
      };
    } else {
      return {
        status: "offline",
        color: "bg-red-100 text-red-800",
        icon: WifiOff,
      };
    }
  };

  const getLastSeenText = (user: any) => {
    const lastSeen = new Date(user.lastSeen);
    const diffSeconds = Math.floor((Date.now() - lastSeen.getTime()) / 1000);

    // Show "Online now" if marked as online and activity within 30 seconds
    if (user.isOnline && diffSeconds < 30) {
      return "Online now";
    }

    const diffMinutes = Math.floor(diffSeconds / 60);

    if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "client":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getKycColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "submitted":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const onlineUsers = usersWithPresence.filter((u) => u.isOnline);
  const offlineUsers = usersWithPresence.filter((u) => !u.isOnline);

  const stats = {
    total: usersWithPresence.length,
    online: onlineUsers.length,
    offline: offlineUsers.length,
    approved: usersWithPresence.filter((u) => u.kyc_status === "approved")
      .length,
    pending: usersWithPresence.filter((u) => u.kyc_status === "pending").length,
    rejected: usersWithPresence.filter((u) => u.kyc_status === "rejected")
      .length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            User Management & Presence
          </h1>
          <p className="text-gray-600">
            Real-time user activity, location tracking, and session management
          </p>
        </div>

        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>

      {/* Enhanced Stats with Online/Offline */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Now</CardTitle>
            <Wifi className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.online}
            </div>
            <p className="text-xs text-green-600 mt-1">Active sessions</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <WifiOff className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.offline}
            </div>
            <p className="text-xs text-red-600 mt-1">Not active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.approved}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pending}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.rejected}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Users List with Presence */}
      <Card>
        <CardHeader>
          <CardTitle>Users with Real-Time Presence</CardTitle>
          <CardDescription>
            Live user activity, location tracking, and session management
            {!loading && (
              <span className="ml-2 text-blue-600">
                ({stats.online} online, {stats.offline} offline)
              </span>
            )}
          </CardDescription>
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
                    <div className="space-y-2">
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : usersWithPresence.length > 0 ? (
            <div className="space-y-4">
              {usersWithPresence.map((user) => {
                const onlineStatus = getOnlineStatus(user);
                const location = user.location;

                return (
                  <div
                    key={user.id}
                    className={`p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                      onlineStatus.status === "online"
                        ? "border-l-4 border-l-green-500 bg-green-50/30"
                        : onlineStatus.status === "recently"
                        ? "border-l-4 border-l-yellow-500 bg-yellow-50/30"
                        : "border-l-4 border-l-gray-300"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-lg">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {/* Online indicator */}
                          <div
                            className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                              onlineStatus.status === "online"
                                ? "bg-green-500"
                                : onlineStatus.status === "recently"
                                ? "bg-yellow-500"
                                : "bg-gray-400"
                            }`}
                          ></div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="font-semibold text-gray-900">
                              {user.name}
                            </h3>
                            <Badge
                              className={`${onlineStatus.color} flex items-center space-x-1`}
                            >
                              {React.createElement(onlineStatus.icon, {
                                className: "h-3 w-3",
                              })}
                              <span className="capitalize">
                                {onlineStatus.status}
                              </span>
                            </Badge>
                          </div>

                          <p className="text-sm text-gray-600">{user.email}</p>

                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>
                              Joined{" "}
                              {new Date(user.created_at).toLocaleDateString()}
                            </span>
                            <span>•</span>
                            <span>{getLastSeenText(user)}</span>
                            {user.sessionCount > 0 && (
                              <>
                                <span>•</span>
                                <span>{user.sessionCount} sessions</span>
                              </>
                            )}
                          </div>

                          {/* Current Location (if available) */}
                          {location && (
                            <div className="flex items-center space-x-2 mt-2 p-2 bg-white rounded-lg border">
                              <Image
                                src={location.flag}
                                alt="Country flag"
                                width={20}
                                height={14}
                                className="w-5 h-3.5 object-cover rounded-sm border border-gray-200"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                              <Globe className="h-3 w-3 text-blue-600" />
                              <span className="text-xs font-medium text-gray-700">
                                {location.city}, {location.country}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({location.ip})
                              </span>
                              <MapPin className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {location.lat?.toFixed(4)},{" "}
                                {location.lon?.toFixed(4)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge className={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                        <Badge className={getKycColor(user.kyc_status)}>
                          {user.kyc_status}
                        </Badge>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewLocationHistory(user)}
                        >
                          <History className="h-4 w-4 mr-1" />
                          History
                        </Button>

                        {user.role !== "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateUserRole(
                                user.id,
                                user.role === "client" ? "admin" : "client"
                              )
                            }
                          >
                            {user.role === "client"
                              ? "Make Admin"
                              : "Make Client"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No users found
              </h3>
              <p className="text-gray-500">
                Users will appear here when they register
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location History Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Location History - {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Complete location and session history for security monitoring
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {locationHistory.length > 0 ? (
              <div className="space-y-3">
                {locationHistory.map((location, index) => (
                  <div
                    key={location.id}
                    className="p-4 border rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Image
                            src={location.flag_url}
                            alt="Country flag"
                            width={24}
                            height={16}
                            className="w-6 h-4 object-cover rounded-sm border border-gray-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                          <Globe className="h-4 w-4 text-blue-600" />
                        </div>

                        <div>
                          <p className="font-medium text-gray-900">
                            {location.city}, {location.region},{" "}
                            {location.country}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>IP: {location.ip_address}</span>
                            <span>•</span>
                            <span>ISP: {location.isp}</span>
                            <span>•</span>
                            <span>Timezone: {location.timezone}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Coordinates: {location.latitude?.toFixed(6)},{" "}
                            {location.longitude?.toFixed(6)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(location.detected_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(location.detected_at).toLocaleTimeString()}
                        </p>
                        {index === 0 && (
                          <Badge className="mt-1 bg-green-100 text-green-800">
                            Most Recent
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No location history
                </h3>
                <p className="text-gray-500">
                  Location data will appear when user logs in
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
