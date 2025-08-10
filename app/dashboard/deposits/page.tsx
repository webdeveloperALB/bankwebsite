"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { PiggyBank, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import type { Database } from "@/lib/supabase"

type User = Database["public"]["Tables"]["users"]["Row"]
type Balance = Database["public"]["Tables"]["balances"]["Row"]
type Deposit = Database["public"]["Tables"]["deposits"]["Row"] & {
  approved_by_user?: {
    email: string
    name: string
  }
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF"]

export default function DepositsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [balances, setBalances] = useState<Balance[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [loading, setLoading] = useState(true)
  const [depositing, setDepositing] = useState(false)
  const [depositAmount, setDepositAmount] = useState("")
  const [depositCurrency, setDepositCurrency] = useState("")
  const [depositNotes, setDepositNotes] = useState("")

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) return

        setUser(currentUser)

        // Load balances
        const { data: balancesData } = await supabase.from("balances").select("*").eq("user_id", currentUser.id)

        setBalances(balancesData || [])

        // Load deposit history
        const { data: depositsData } = await supabase
          .from("deposits")
          .select(`
            *,
            approved_by_user:users!deposits_approved_by_fkey (
              email,
              name
            )
          `)
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })

        setDeposits(depositsData || [])

        // Set up real-time subscriptions
        const balancesChannel = supabase
          .channel("user-balances")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "balances",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => {
              supabase
                .from("balances")
                .select("*")
                .eq("user_id", currentUser.id)
                .then(({ data }) => setBalances(data || []))
            },
          )
          .subscribe()

        const depositsChannel = supabase
          .channel("user-deposits")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "deposits",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => {
              supabase
                .from("deposits")
                .select(`
                  *,
                  approved_by_user:users!deposits_approved_by_fkey (
                    email,
                    name
                  )
                `)
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false })
                .then(({ data }) => setDeposits(data || []))
            },
          )
          .subscribe()

        return () => {
          supabase.removeChannel(balancesChannel)
          supabase.removeChannel(depositsChannel)
        }
      } catch (error) {
        console.error("Error loading deposits data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    if (!user) return

    const interval = setInterval(async () => {
      try {
        // Refresh balances
        const { data: balancesData } = await supabase.from("balances").select("*").eq("user_id", user.id)
        setBalances(balancesData || [])

        // Refresh deposits
        const { data: depositsData } = await supabase
          .from("deposits")
          .select(`
          *,
          approved_by_user:users!deposits_approved_by_fkey (
            email,
            name
          )
        `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        setDeposits(depositsData || [])
      } catch (error) {
        console.error("Error refreshing data:", error)
      }
    }, 1000) // Refresh every second

    return () => clearInterval(interval)
  }, [user])

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !depositAmount || !depositCurrency) return

    setDepositing(true)

    try {
      const amount = Number(depositAmount)

      // Create deposit record
      const { error: depositError } = await supabase.from("deposits").insert({
        user_id: user.id,
        amount: amount,
        currency: depositCurrency,
        status: "pending",
        notes: depositNotes || null,
      })

      if (depositError) throw depositError

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: `Submitted deposit request for ${amount} ${depositCurrency}`,
      })

      setDepositAmount("")
      setDepositCurrency("")
      setDepositNotes("")

      alert("Deposit request submitted successfully! It will be reviewed by our team.")
    } catch (error) {
      console.error("Error processing deposit:", error)
      alert("Deposit request failed. Please try again.")
    } finally {
      setDepositing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
    }
  }

  const approvedDeposits = deposits.filter((d) => d.status === "approved")
  const pendingDeposits = deposits.filter((d) => d.status === "pending")
  const rejectedDeposits = deposits.filter((d) => d.status === "rejected")

  return (
    <DashboardLayout currentSection="deposits">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Deposits</h1>
          <p className="text-sm sm:text-base text-gray-600">Add funds to your account (subject to approval)</p>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Pending Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-yellow-600">{pendingDeposits.length}</span>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Approved Deposits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-600">{approvedDeposits.length}</span>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Rejected Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-600">{rejectedDeposits.length}</span>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Balances by Currency */}
          {balances.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Current Balances</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Your available funds by currency (approved deposits only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {balances.map((balance) => (
                    <div
                      key={balance.id}
                      className="flex justify-between items-center p-3 border border-orange-100 rounded-lg bg-gradient-to-r from-orange-50 to-white"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-[#F26623] bg-opacity-10 rounded-full flex items-center justify-center">
                          <span className="text-[#F26623] font-semibold text-xs sm:text-sm">
                            {balance.currency.substring(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm sm:text-base">{balance.currency}</p>
                          <p className="text-xs sm:text-sm text-gray-500">Available</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm sm:text-base">
                          {Number(balance.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deposit Form */}
          <Card className="border-orange-100">
            <CardHeader className="bg-gradient-to-r from-[#F26623] to-orange-600 text-white rounded-t-lg">
              <CardTitle className="text-lg sm:text-xl">Request Deposit</CardTitle>
              <CardDescription className="text-orange-100 text-sm sm:text-base">
                Submit a deposit request for admin approval
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleDeposit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-sm sm:text-base font-medium">
                    Currency
                  </Label>
                  <Select value={depositCurrency} onValueChange={setDepositCurrency}>
                    <SelectTrigger className="border-orange-200 focus:border-[#F26623] focus:ring-[#F26623]">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm sm:text-base font-medium">
                    Amount
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="border-orange-200 focus:border-[#F26623] focus:ring-[#F26623]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm sm:text-base font-medium">
                    Notes (Optional)
                  </Label>
                  <Textarea
                    id="notes"
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    placeholder="Add any additional information about your deposit..."
                    className="border-orange-200 focus:border-[#F26623] focus:ring-[#F26623]"
                    rows={3}
                  />
                </div>

                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-[#F26623]" />
                    <span className="text-xs sm:text-sm font-medium text-orange-900">Approval Required</span>
                  </div>
                  <p className="text-xs text-orange-700">
                    All deposits require admin approval before being added to your balance. You will be notified once
                    your request is processed.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#F26623] hover:bg-orange-700 text-white font-medium"
                  disabled={depositing}
                >
                  {depositing ? "Submitting..." : "Submit Deposit Request"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Deposit History */}
          <Card className="border-orange-100 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Deposit History</CardTitle>
              <CardDescription className="text-sm sm:text-base">Your deposit requests and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex justify-between items-center p-3 border rounded-lg">
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                        <div className="h-3 bg-gray-200 rounded w-32"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : deposits.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {deposits.map((deposit) => (
                    <div
                      key={deposit.id}
                      className="flex justify-between items-center p-4 border border-orange-100 rounded-lg hover:bg-orange-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(deposit.status)}
                        <div>
                          <p className="font-medium text-sm sm:text-base">
                            {Number(deposit.amount).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            {deposit.currency}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {new Date(deposit.created_at).toLocaleString()}
                          </p>
                          {deposit.notes && <p className="text-xs text-gray-600 mt-1 italic">"{deposit.notes}"</p>}
                          {deposit.approved_by_user && (
                            <p className="text-xs text-gray-500 mt-1">
                              Processed by: {deposit.approved_by_user.name || deposit.approved_by_user.email}
                              {deposit.approved_at && ` on ${new Date(deposit.approved_at).toLocaleDateString()}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">{getStatusBadge(deposit.status)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PiggyBank className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No deposit requests yet</h3>
                  <p className="text-sm sm:text-base text-gray-500">Submit your first deposit request to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
