"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdminSession } from "@/hooks/use-admin-session"
import AdminSessionWarning from "@/components/admin-session-warning"
import AdminLocationHeader from "@/app/admin/admin-location-header"
import { Button } from "@/components/ui/button"
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
  Menu,
  X,
  PiggyBank,
} from "lucide-react"
import { signOut } from "@/lib/auth"
import { useRouter } from "next/navigation"
import React from "react"

interface AdminLayoutProps {
  children: React.ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function AdminLayout({ children, activeTab, onTabChange }: AdminLayoutProps) {
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Admin session management
  const { isExpired, timeRemaining, showWarning, forceLogout } = useAdminSession()

  const handleSignOut = useCallback(async () => {
    await signOut()
    router.push("/auth/login")
  }, [router])

  // Handle session expiration
  useEffect(() => {
    if (isExpired) {
      handleSignOut()
    }
  }, [isExpired, handleSignOut])

  // Format time remaining for display
  const formatTimeRemaining = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // Get session status color and icon
  const getSessionStatus = () => {
    const minutes = Math.floor(timeRemaining / 60000)
    if (minutes <= 2) {
      return {
        color: "text-red-600 bg-red-50 border-red-200",
        icon: AlertTriangle,
        pulse: "animate-pulse",
      }
    } else if (minutes <= 5) {
      return {
        color: "text-amber-600 bg-amber-50 border-amber-200",
        icon: Clock,
        pulse: "",
      }
    } else {
      return {
        color: "text-green-600 bg-green-50 border-green-200",
        icon: Clock,
        pulse: "",
      }
    }
  }

  const tabs = [
    { id: "users", name: "Users", icon: Users },
    { id: "kyc", name: "KYC", icon: Shield },
    { id: "balances", name: "Balances", icon: CreditCard },
    { id: "crypto", name: "Crypto", icon: Bitcoin },
    { id: "transactions", name: "Transactions", icon: ArrowUpDown },
    { id: "deposits", name: "Deposits", icon: PiggyBank },
    { id: "messages", name: "Messages", icon: MessageSquare },
    { id: "taxes", name: "Taxes", icon: FileText },
    { id: "support", name: "Support", icon: HelpCircle },
  ]

  const handleTabChange = (tabId: string) => {
    onTabChange(tabId)
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Session Warning Dialog */}
      <AdminSessionWarning
        isOpen={showWarning}
        timeRemaining={timeRemaining}
        onExtend={forceLogout}
        onLogout={forceLogout}
      />

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-72 sm:w-80 bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center">
                <Banknote className="h-6 w-6 text-[#F26623]" />
                <span className="ml-2 text-lg font-bold text-gray-900">Anchor Group Investments</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-md hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === tab.id
                          ? "bg-orange-50 text-[#F26623] border border-orange-200"
                          : "text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium text-base">{tab.name}</span>
                    </button>
                  )
                })}
              </nav>

              <div className="mt-8 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full justify-start text-gray-700 bg-transparent"
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Layout */}
      <div className="lg:hidden">
        {/* Mobile Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-3 sm:px-4">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <div className="flex items-center min-w-0 flex-1">
                <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 rounded-md hover:bg-gray-100 mr-2">
                  <Menu className="h-5 w-5" />
                </button>
                <Banknote className="h-5 w-5 sm:h-6 sm:w-6 text-[#F26623]" />
                <span className="ml-2 text-sm sm:text-base font-bold text-gray-900 truncate">Anchor Group Investments Admin</span>
              </div>

              <div className="flex items-center space-x-2">
                <div
                  className={`flex items-center space-x-1 px-2 py-1 rounded border ${getSessionStatus().color
                    } ${getSessionStatus().pulse}`}
                >
                  {React.createElement(getSessionStatus().icon, {
                    className: "h-3 w-3",
                  })}
                  <div className="text-xs font-mono font-bold">{formatTimeRemaining(timeRemaining)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Location Bar */}
        <div className="bg-orange-50 border-b border-orange-200 px-3 sm:px-4 py-2">
          <div className="text-xs sm:text-sm">
            <AdminLocationHeader />
          </div>
        </div>

        {/* Mobile Content */}
        <div className="px-3 sm:px-4 py-4">{children}</div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">
        {/* Desktop Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Banknote className="h-8 w-8 text-[#F26623]" />
                <span className="ml-2 text-xl font-bold text-gray-900">Anchor Group Investments Admin</span>
              </div>

              <div className="flex items-center space-x-6">
                <div
                  className={`flex items-center space-x-3 px-4 py-2 rounded-lg border ${getSessionStatus().color
                    } ${getSessionStatus().pulse}`}
                >
                  <div className="flex items-center space-x-2">
                    {React.createElement(getSessionStatus().icon, {
                      className: "h-4 w-4",
                    })}
                    <div className="text-sm font-mono font-bold">{formatTimeRemaining(timeRemaining)}</div>
                  </div>
                  <div className="text-xs font-medium">Session</div>
                </div>

                <AdminLocationHeader />

                <Button variant="outline" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === tab.id
                        ? "border-[#F26623] text-[#F26623]"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Desktop Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </div>
    </div>
  )
}
