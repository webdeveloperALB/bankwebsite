"use client";

import { useState } from "react";
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
} from "lucide-react";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";

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

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
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
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
