"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/hooks/use-admin-session";
import AdminSessionWarning from "@/components/admin-session-warning";
import { Button } from "@/components/ui/button";
import {
  Users,
  CreditCard,
  Bitcoin,
  ArrowUpDown,
  MessageSquare,
  FileText,
  HelpCircle,
  Shield,
  Banknote,
  LogOut,
  MapPin,
  Globe,
  Wifi,
  RefreshCw,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  subscribeToLocationUpdates,
  getCurrentLocation,
  forceLocationUpdate,
  LocationInfo,
} from "@/lib/geolocation";
import React from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AdminLayout({
  children,
  activeTab,
  onTabChange,
}: AdminLayoutProps) {
  const router = useRouter();
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // Admin session management
  const { isExpired, timeRemaining, showWarning, forceLogout } =
    useAdminSession();

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/auth/login");
  }, [router]);

  // Handle session expiration
  useEffect(() => {
    if (isExpired) {
      handleSignOut();
    }
  }, [isExpired, handleSignOut]);

  useEffect(() => {
    // Get initial location
    const currentLocation = getCurrentLocation();
    if (currentLocation) {
      setLocationInfo(currentLocation);
      setLocationLoading(false);
    }

    // Subscribe to location updates
    const unsubscribe = subscribeToLocationUpdates((data) => {
      setLocationInfo(data);
      setLocationLoading(false);
    });

    return unsubscribe;
  }, []);

  // Format time remaining for display
  const formatTimeRemaining = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Get session status color and icon
  const getSessionStatus = () => {
    const minutes = Math.floor(timeRemaining / 60000);
    if (minutes <= 2) {
      return {
        color: "text-red-600 bg-red-50 border-red-200",
        icon: AlertTriangle,
        pulse: "animate-pulse",
      };
    } else if (minutes <= 5) {
      return {
        color: "text-amber-600 bg-amber-50 border-amber-200",
        icon: Clock,
        pulse: "",
      };
    } else {
      return {
        color: "text-green-600 bg-green-50 border-green-200",
        icon: Clock,
        pulse: "",
      };
    }
  };

  const handleRefreshLocation = async () => {
    setLocationLoading(true);
    try {
      await forceLocationUpdate();
    } catch (error) {
      console.error("Error refreshing location:", error);
    }
  };

  const tabs = [
    { id: "users", name: "Users", icon: Users },
    { id: "kyc", name: "KYC", icon: Shield },
    { id: "balances", name: "Balances", icon: CreditCard },
    { id: "crypto", name: "Crypto", icon: Bitcoin },
    { id: "transactions", name: "Transactions", icon: ArrowUpDown },
    { id: "messages", name: "Messages", icon: MessageSquare },
    { id: "taxes", name: "Taxes", icon: FileText },
    { id: "support", name: "Support", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Session Warning Dialog */}
      <AdminSessionWarning
        isOpen={showWarning}
        timeRemaining={timeRemaining}
        onExtend={forceLogout}
        onLogout={forceLogout}
      />

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Banknote className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                SecureBank Admin
              </span>
            </div>

            {/* Session Timer & Location Info */}
            <div className="flex items-center space-x-6">
              {/* Session Countdown Timer */}
              <div
                className={`flex items-center space-x-3 px-4 py-2 rounded-lg border ${
                  getSessionStatus().color
                } ${getSessionStatus().pulse}`}
              >
                <div className="flex items-center space-x-2">
                  {React.createElement(getSessionStatus().icon, {
                    className: "h-4 w-4",
                  })}
                  <div className="text-sm font-mono font-bold">
                    {formatTimeRemaining(timeRemaining)}
                  </div>
                </div>
                <div className="text-xs font-medium">Session</div>
              </div>

              <div className="hidden lg:flex items-center space-x-4 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                {locationLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin">
                      <Wifi className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-blue-700 font-medium">
                      Detecting location...
                    </span>
                  </div>
                ) : locationInfo ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <Image
                        src={locationInfo.flag}
                        alt="Country flag"
                        width={24}
                        height={16}
                        className="w-6 h-4 object-cover rounded-sm border border-gray-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <Globe className="h-4 w-4 text-blue-600" />
                      <div className="text-sm">
                        <div className="font-semibold text-blue-900">
                          {locationInfo.city}, {locationInfo.country}
                        </div>
                        <div className="text-blue-600 text-xs">
                          IP: {locationInfo.ip}
                        </div>
                      </div>
                    </div>

                    <div className="h-8 w-px bg-blue-200"></div>

                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <div className="text-xs text-blue-700">
                        <div className="font-medium">
                          {locationInfo.timezone}
                        </div>
                        <div className="text-blue-500">
                          {locationInfo.coordinates}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshLocation}
                      className="h-8 w-8 p-0 hover:bg-blue-100"
                      title="Refresh location"
                    >
                      <RefreshCw
                        className={`h-3 w-3 text-blue-600 ${
                          locationLoading ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600 font-medium">
                      Location unavailable
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshLocation}
                      className="h-6 w-6 p-0 hover:bg-red-100"
                    >
                      <RefreshCw className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Mobile location summary */}
              <div className="lg:hidden flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-lg">
                <Globe className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">
                  {locationLoading
                    ? "Locating..."
                    : locationInfo
                    ? locationInfo.ip
                    : "No location"}
                </span>
              </div>

              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
