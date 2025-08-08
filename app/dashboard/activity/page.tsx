"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Search,
  Calendar,
  User,
  TrendingUp,
  LogIn,
  LogOut,
  CreditCard,
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { Database } from "@/lib/supabase";

type User = Database["public"]["Tables"]["users"]["Row"];
type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];

export default function ActivityPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityLog[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("all");

  const filterClientVisibleActivities = (activities: ActivityLog[]) => {
    return activities.filter((activity) => {
      const activityLower = activity.activity.toLowerCase();
      // Hide ALL tracking and admin activities from client view
      return (
        !activityLower.includes("login") &&
        !activityLower.includes("logout") &&
        !activityLower.includes("signed in") &&
        !activityLower.includes("signed out") &&
        !activityLower.includes("session") &&
        !activityLower.includes("location") &&
        !activityLower.includes("ip address") &&
        !activityLower.includes("admin") &&
        !activityLower.includes("system") &&
        !activityLower.includes("internal") &&
        !activityLower.includes("tracking") &&
        !activityLower.includes("detected") &&
        !activityLower.includes("logged in") &&
        !activityLower.includes("logged out") &&
        !activityLower.includes("authentication")
      );
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        setUser(currentUser);

        // Load activity logs
        const { data: activitiesData } = await supabase
          .from("activity_logs")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false });

        const clientVisibleActivities = filterClientVisibleActivities(
          activitiesData || []
        );
        setActivities(clientVisibleActivities);
        setFilteredActivities(clientVisibleActivities);

        // Set up real-time subscription
        const channel = supabase
          .channel("activity_logs")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "activity_logs",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => {
              // Reload activities
              supabase
                .from("activity_logs")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false })
                .then(({ data }) => {
                  const clientVisible = filterClientVisibleActivities(
                    data || []
                  );
                  setActivities(clientVisible);
                  setFilteredActivities(clientVisible);
                });
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error("Error loading activity logs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    let filtered = activities;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((activity) =>
        activity.activity.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply time period filter
    if (filterPeriod !== "all") {
      const now = new Date();
      let cutoffDate = new Date();

      switch (filterPeriod) {
        case "today":
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "month":
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case "year":
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(
        (activity) => new Date(activity.created_at) >= cutoffDate
      );
    }

    setFilteredActivities(filtered);
  }, [activities, searchTerm, filterPeriod]);

  const getActivityDetails = (activity: string) => {
    const activityLower = activity.toLowerCase();

    if (
      activityLower.includes("login") ||
      activityLower.includes("signed in")
    ) {
      return {
        icon: <LogIn className="h-4 w-4" />,
        color: "text-[#F26623]",
        bgColor: "bg-orange-50",
        borderColor: "border-l-[#F26623]",
        badge: "Authentication",
        badgeVariant: "default" as const,
      };
    } else if (
      activityLower.includes("logout") ||
      activityLower.includes("signed out")
    ) {
      return {
        icon: <LogOut className="h-4 w-4" />,
        color: "text-gray-600",
        bgColor: "bg-gray-50",
        borderColor: "border-l-gray-500",
        badge: "Authentication",
        badgeVariant: "secondary" as const,
      };
    } else if (
      activityLower.includes("deposit") ||
      activityLower.includes("added funds")
    ) {
      return {
        icon: <ArrowDownLeft className="h-4 w-4" />,
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-l-green-500",
        badge: "Transaction",
        badgeVariant: "default" as const,
      };
    } else if (
      activityLower.includes("transfer") ||
      activityLower.includes("sent") ||
      activityLower.includes("withdrawal")
    ) {
      return {
        icon: <ArrowUpRight className="h-4 w-4" />,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-l-orange-500",
        badge: "Transaction",
        badgeVariant: "default" as const,
      };
    } else if (
      activityLower.includes("message") ||
      activityLower.includes("ticket") ||
      activityLower.includes("support")
    ) {
      return {
        icon: <MessageSquare className="h-4 w-4" />,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        borderColor: "border-l-purple-500",
        badge: "Support",
        badgeVariant: "default" as const,
      };
    } else if (
      activityLower.includes("card") ||
      activityLower.includes("payment")
    ) {
      return {
        icon: <CreditCard className="h-4 w-4" />,
        color: "text-indigo-600",
        bgColor: "bg-indigo-50",
        borderColor: "border-l-indigo-500",
        badge: "Payment",
        badgeVariant: "default" as const,
      };
    }

    return {
      icon: <Activity className="h-4 w-4" />,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      borderColor: "border-l-gray-500",
      badge: "General",
      badgeVariant: "secondary" as const,
    };
  };

  const formatActivityText = (activity: string) => {
    return activity
      .replace(/[🟢🔴🟡🔵⚪⚫🟠🟣🟤📝💾📍✅❌⚠️🌍]/g, "") // Remove all emojis
      .replace(/admin increased balance/gi, "Deposit received")
      .replace(/admin decreased balance/gi, "Withdrawal processed")
      .replace(/admin added funds/gi, "Deposit received")
      .replace(/admin removed funds/gi, "Withdrawal processed")
      .replace(/system updated/gi, "Account updated")
      .replace(/LOGIN:/gi, "")
      .replace(/LOGOUT:/gi, "")
      .replace(/DEPOSIT:/gi, "")
      .replace(/TRANSFER:/gi, "")
      .replace(/MESSAGE:/gi, "")
      .trim();
  };

  const todayActivities = activities.filter((a) => {
    const today = new Date();
    const activityDate = new Date(a.created_at);
    return activityDate.toDateString() === today.toDateString();
  }).length;

  const thisWeekActivities = activities.filter((a) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(a.created_at) >= weekAgo;
  }).length;

  return (
    <DashboardLayout currentSection="activity">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Account Activity
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Monitor all account activities and transaction history
          </p>
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Total Activities
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {activities.length}
              </div>
              <p className="text-xs text-muted-foreground">All time records</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Today
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {todayActivities}
              </div>
              <p className="text-xs text-muted-foreground">Activities today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                This Week
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {thisWeekActivities}
              </div>
              <p className="text-xs text-muted-foreground">Past 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Daily Average
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {activities.length > 0 ? Math.round(activities.length / 30) : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Activities per day
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Activity Filters
            </CardTitle>
            <CardDescription className="text-sm">
              Search and filter your account activity records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Past Week</SelectItem>
                    <SelectItem value="month">Past Month</SelectItem>
                    <SelectItem value="year">Past Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Activity Timeline
            </CardTitle>
            <CardDescription>
              Comprehensive record of your account activities
              {filteredActivities.length !== activities.length && (
                <span className="ml-2 text-blue-600 font-medium">
                  ({filteredActivities.length} of {activities.length} activities
                  shown)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse flex items-center space-x-4 p-4 border-l-4 border-gray-200 bg-gray-50 rounded-r-lg"
                  >
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredActivities.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredActivities.map((activity) => {
                  const details = getActivityDetails(activity.activity);
                  return (
                    <div
                      key={activity.id}
                      className={`flex items-start space-x-4 p-4 border-l-4 ${details.borderColor} ${details.bgColor} rounded-r-lg hover:shadow-sm transition-all duration-200`}
                    >
                      <div
                        className={`w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border ${details.color}`}
                      >
                        {details.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                            {formatActivityText(activity.activity)}
                          </p>
                          <Badge
                            variant={details.badgeVariant}
                            className="ml-2 text-xs"
                          >
                            {details.badge}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.created_at).toLocaleString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || filterPeriod !== "all"
                    ? "No matching activities found"
                    : "No activities recorded"}
                </h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  Your transaction history and account activities will be
                  displayed here as you use our banking services.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
