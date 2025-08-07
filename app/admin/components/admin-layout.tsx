"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminSession } from "@/hooks/use-admin-session";
import AdminSessionWarning from "@/components/admin-session-warning";
import AdminLocationHeader from "@/app/admin/admin-location-header";
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
  Clock,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
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

              {/* Admin Location Display */}
              <div className="hidden lg:block">
                <AdminLocationHeader />
              </div>

              {/* Mobile location summary */}
              <div className="lg:hidden flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-lg">
                <Globe className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">
                  Admin Location
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
