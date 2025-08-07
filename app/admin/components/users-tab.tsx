"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getUserHistory } from "@/lib/session-tracker";
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
} from "@/components/ui/dialog";
import {
  Users,
  UserCheck,
  Globe,
  MapPin,
  History,
  RefreshCw,
  Calendar,
} from "lucide-react";
import Image from "next/image";

interface UserWithHistory {
  id: string;
  name: string;
  email: string;
  role: string;
  kyc_status: string;
  created_at: string;
  sessionCount: number;
  latestLocation: {
    ip: string;
    country: string;
    region: string;
    city: string;
    timezone: string;
    isp: string;
    lat: number;
    lon: number;
    flag: string;
    lastLogin: string;
  } | null;
}

export default function UsersTab() {
  const [users, setUsers] = useState<UserWithHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithHistory | null>(
    null
  );
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        console.log("👥 Loading users with session history...");
        const data = await getUserHistory();
        console.log("👥 Users loaded:", data.length);

        // Debug: log the first user's data
        if (data.length > 0) {
          console.log("🔍 First user data:", {
            name: data[0].name,
            sessionCount: data[0].sessionCount,
            latestLocation: data[0].latestLocation,
          });
        }

        setUsers(data);
      } catch (error) {
        console.error("❌ Error loading users:", error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();

    // Set up real-time subscriptions for location changes
    const usersChannel = supabase
      .channel("admin_users_history")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_locations" },
        loadUsers
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_sessions" },
        loadUsers
      )
      .subscribe();

    // Auto-refresh every 2 minutes instead of 30 seconds
    const refreshInterval = setInterval(loadUsers, 2 * 60 * 1000);

    return () => {
      supabase.removeChannel(usersChannel);
      clearInterval(refreshInterval);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getUserHistory();
      setUsers(data || []);
    } catch (error) {
      console.error("❌ Error refreshing users:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const viewLocationHistory = async (user: UserWithHistory) => {
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

  const getLastLoginText = (user: UserWithHistory) => {
    if (!user.latestLocation?.lastLogin) return "Never logged in";

    const lastLogin = new Date(user.latestLocation.lastLogin);
    const diffSeconds = Math.floor((Date.now() - lastLogin.getTime()) / 1000);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const stats = {
    total: users.length,
    approved: users.filter((u) => u.kyc_status === "approved").length,
    withSessions: users.filter((u) => u.sessionCount > 0).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            User Session History
          </h1>
          <p className="text-gray-600">
            Track user login/logout history with IP addresses and geolocation
            data
          </p>
        </div>

        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KYC Approved</CardTitle>
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
            <CardTitle className="text-sm font-medium">
              With Login History
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.withSessions}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>User Login/Logout History</CardTitle>
          <CardDescription>
            Complete session tracking with IP addresses and geolocation data
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
                  </div>
                </div>
              ))}
            </div>
          ) : users.length > 0 ? (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-lg">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold text-gray-900">
                            {user.name}
                          </h3>
                          <Badge
                            variant={
                              user.kyc_status === "approved"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {user.kyc_status}
                          </Badge>
                        </div>

                        <p className="text-sm text-gray-600">{user.email}</p>

                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Last login: {getLastLoginText(user)}</span>
                          <span>•</span>
                          <span>{user.sessionCount} total sessions</span>
                          <span>•</span>
                          <span>
                            Joined{" "}
                            {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Latest Location Display */}
                        {user.latestLocation ? (
                          <div className="flex items-center space-x-2 mt-2 p-3 bg-white rounded-lg border">
                            <Image
                              src={
                                user.latestLocation.flag || "/placeholder.svg"
                              }
                              alt="Country flag"
                              width={20}
                              height={14}
                              className="w-5 h-3.5 object-cover rounded-sm border"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                            <Globe className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-gray-700">
                              {user.latestLocation.city},{" "}
                              {user.latestLocation.country}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {user.latestLocation.ip}
                            </Badge>
                            <MapPin className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {user.latestLocation.lat?.toFixed(4)},{" "}
                              {user.latestLocation.lon?.toFixed(4)}
                            </span>
                          </div>
                        ) : (
                          <div className="p-2 bg-gray-100 rounded text-xs text-gray-500">
                            No login history available
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewLocationHistory(user)}
                      >
                        <History className="h-4 w-4 mr-1" />
                        View History
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
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
            <DialogTitle>Login History - {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Complete login/logout history with IP addresses and geolocation
              data
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
                            src={location.flag_url || "/placeholder.svg"}
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
                  No login history
                </h3>
                <p className="text-gray-500">
                  Login data will appear when user logs in
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
