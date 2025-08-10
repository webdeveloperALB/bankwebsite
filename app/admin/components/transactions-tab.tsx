"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowUpDown,
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  X,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react"
import type { Database } from "@/lib/supabase"

type User = Database["public"]["Tables"]["users"]["Row"]
type Transaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  users?: { name: string; email: string }
  to_users?: { name: string; email: string }
  approved_by_user?: { name: string; email: string }
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF"]

export default function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")

  // Form state
  const [selectedUser, setSelectedUser] = useState("")
  const [transactionType, setTransactionType] = useState("deposit")
  const [currency, setCurrency] = useState("")
  const [amount, setAmount] = useState("")
  const [toUser, setToUser] = useState("")

  useEffect(() => {
    const loadData = async () => {
      // Get current user (admin) - check localStorage first for admin session
      let adminUser = null

      // Check for admin session in localStorage first
      if (typeof window !== "undefined") {
        const adminSession = localStorage.getItem("admin_session")
        if (adminSession) {
          try {
            const { user, timestamp } = JSON.parse(adminSession)
            // Check if session is still valid (20 minutes)
            if (Date.now() - timestamp < 20 * 60 * 1000) {
              // Get fresh admin data from database
              const { data: freshAdminData } = await supabase
                .from("users")
                .select("*")
                .eq("email", "admin@Anchor Group Investments.com")
                .single()

              if (freshAdminData) {
                adminUser = freshAdminData
                console.log("Admin user loaded from localStorage session:", adminUser)
              }
            } else {
              console.log("Admin session expired")
              localStorage.removeItem("admin_session")
            }
          } catch (error) {
            console.log("Error parsing admin session:", error)
            localStorage.removeItem("admin_session")
          }
        }
      }

      // If no admin session, try Supabase auth
      if (!adminUser) {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: userData } = await supabase.from("users").select("*").eq("id", user.id).single()
          if (userData && userData.role === "admin") {
            adminUser = userData
            console.log("Admin user loaded from Supabase auth:", adminUser)
          }
        }
      }

      if (adminUser) {
        setCurrentUser(adminUser)
      } else {
        console.log("No admin user found")
      }

      // Load transactions with user info
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select(`
          *,
          users!transactions_user_id_fkey(name, email),
          to_users:users!transactions_to_user_id_fkey(name, email),
          approved_by_user:users!transactions_approved_by_fkey(name, email)
        `)
        .order("created_at", { ascending: false })

      console.log("Loaded transactions:", transactionsData)

      // Load users
      const { data: usersData } = await supabase.from("users").select("*").neq("role", "admin").order("name")

      setTransactions(transactionsData || [])
      setUsers(usersData || [])
      setLoading(false)
    }

    loadData()

    // Real-time subscription
    const channel = supabase
      .channel("admin_transactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, (payload) => {
        console.log("Real-time update:", payload)
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !transactionType || !currency || !amount) return

    try {
      const transactionData: any = {
        user_id: selectedUser,
        type: transactionType,
        currency: currency,
        amount: Number.parseFloat(amount),
        status: "completed", // Admin-created transactions are automatically completed
        approved_by: currentUser?.id,
        approved_at: new Date().toISOString(),
      }

      if (transactionType === "transfer" && toUser) {
        transactionData.to_user_id = toUser
      }

      const { error } = await supabase.from("transactions").insert(transactionData)

      if (error) throw error

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: selectedUser,
        activity: `Admin created ${transactionType} transaction: ${amount} ${currency}`,
      })

      resetForm()
    } catch (error) {
      console.error("Error creating transaction:", error)
    }
  }

  const approveTransaction = async (transaction: Transaction) => {
    console.log("Current user state:", currentUser)

    if (!currentUser) {
      alert("Admin user not found. Please refresh the page and try logging in again.")
      return
    }

    console.log("Attempting to approve transaction:", transaction.id, "by admin:", currentUser.id)

    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          status: "completed", // Change from "approved" to "completed" for consistency
          approved_by: currentUser.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", transaction.id)

      if (error) {
        console.error("Supabase error:", error)
        alert(`Error approving transaction: ${error.message}`)
        return
      }

      console.log("Transaction approved successfully")

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: transaction.user_id,
        activity: `Transaction approved: ${transaction.type} ${transaction.amount} ${transaction.currency}`,
      })

      // Force reload data to update UI immediately
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select(`
        *,
        users!transactions_user_id_fkey(name, email),
        to_users:users!transactions_to_user_id_fkey(name, email),
        approved_by_user:users!transactions_approved_by_fkey(name, email)
      `)
        .order("created_at", { ascending: false })

      setTransactions(transactionsData || [])

      alert("Transaction approved successfully!")
    } catch (error) {
      console.error("Error approving transaction:", error)
      alert("Failed to approve transaction. Please try again.")
    }
  }

  const rejectTransaction = async (transaction: Transaction) => {
    console.log("Current user state:", currentUser)

    if (!currentUser) {
      alert("Admin user not found. Please refresh the page and try logging in again.")
      return
    }

    if (!confirm("Are you sure you want to reject this transaction?")) return

    console.log("Attempting to reject transaction:", transaction.id, "by admin:", currentUser.id)

    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          status: "rejected",
          approved_by: currentUser.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", transaction.id)

      if (error) {
        console.error("Supabase error:", error)
        alert(`Error rejecting transaction: ${error.message}`)
        return
      }

      console.log("Transaction rejected successfully")

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: transaction.user_id,
        activity: `Transaction rejected: ${transaction.type} ${transaction.amount} ${transaction.currency}`,
      })

      // Force reload data to update UI immediately
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select(`
        *,
        users!transactions_user_id_fkey(name, email),
        to_users:users!transactions_to_user_id_fkey(name, email),
        approved_by_user:users!transactions_approved_by_fkey(name, email)
      `)
        .order("created_at", { ascending: false })

      setTransactions(transactionsData || [])

      alert("Transaction rejected successfully!")
    } catch (error) {
      console.error("Error rejecting transaction:", error)
      alert("Failed to reject transaction. Please try again.")
    }
  }

  const deleteTransaction = async (transaction: Transaction) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return

    const { error } = await supabase.from("transactions").delete().eq("id", transaction.id)

    if (error) {
      console.error("Error deleting transaction:", error)
    } else {
      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: transaction.user_id,
        activity: `Admin deleted ${transaction.type} transaction: ${transaction.amount} ${transaction.currency}`,
      })
    }
  }

  const resetForm = () => {
    setSelectedUser("")
    setTransactionType("deposit")
    setCurrency("")
    setAmount("")
    setToUser("")
    setDialogOpen(false)
  }

  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type === "deposit") {
      return <ArrowDownLeft className="h-4 w-4 text-green-600" />
    } else if (transaction.type === "transfer") {
      return <ArrowUpRight className="h-4 w-4 text-blue-600" />
    } else if (transaction.type === "withdrawal") {
      return <ArrowUpRight className="h-4 w-4 text-red-600" />
    }
    return <ArrowUpDown className="h-4 w-4 text-gray-600" />
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case "approved":
      case "completed":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredTransactions = transactions.filter((transaction) => {
    if (activeTab === "all") return true
    if (activeTab === "pending") return transaction.status === "pending"
    if (activeTab === "approved") return transaction.status === "approved"
    if (activeTab === "rejected") return transaction.status === "rejected"
    return true
  })

  const totalTransactions = transactions.length
  const pendingTransactions = transactions.filter((t) => t.status === "pending").length
  const approvedTransactions = transactions.filter((t) => t.status === "approved" || t.status === "completed").length
  const rejectedTransactions = transactions.filter((t) => t.status === "rejected").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Transaction Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage and approve user transactions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="bg-[#F26623] hover:bg-[#E55A1F] text-white w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Transaction</DialogTitle>
              <DialogDescription>Add a new transaction for a user (automatically approved)</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Transaction Type</Label>
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr} value={curr}>
                        {curr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              {transactionType === "transfer" && (
                <div className="space-y-2">
                  <Label>Transfer To</Label>
                  <Select value={toUser} onValueChange={setToUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => u.id !== selectedUser)
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full bg-[#F26623] hover:bg-[#E55A1F] text-white">
                Create Transaction
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transaction Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card className="border-l-4 border-l-[#F26623]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-gray-700 leading-tight">Total Transactions</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-[#F26623]" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-gray-900">{totalTransactions}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-gray-700 leading-tight">Pending Approval</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-yellow-600">{pendingTransactions}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-gray-700 leading-tight">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-green-600">{approvedTransactions}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-gray-700 leading-tight">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-red-600">{rejectedTransactions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List with Tabs */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-[#F26623]/5 to-transparent border-b">
          <CardTitle className="text-lg md:text-xl text-gray-900">Transaction Management</CardTitle>
          <CardDescription className="text-sm md:text-base">Review and approve pending transactions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({totalTransactions})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingTransactions})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approvedTransactions})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({rejectedTransactions})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="p-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse p-4 border rounded-lg">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : filteredTransactions.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex justify-between items-start p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors gap-3"
                    >
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-[#F26623]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          {getTransactionIcon(transaction)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium capitalize text-gray-900">{transaction.type}</h3>
                            {getStatusBadge(transaction.status || "completed")}
                          </div>
                          <p className="text-xs text-gray-600 truncate">
                            {transaction.users?.name}
                            {transaction.to_users && (
                              <span className="block sm:inline"> → {transaction.to_users.name}</span>
                            )}
                          </p>

                          {/* Transaction Subtype */}
                          {transaction.transaction_subtype && (
                            <div className="mt-2">
                              <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold">
                                {transaction.transaction_subtype === "inside_bank"
                                  ? "Currency Conversion"
                                  : transaction.transaction_subtype === "outside_bank"
                                    ? "External Bank Transfer"
                                    : transaction.transaction_subtype}
                              </span>
                            </div>
                          )}

                          {/* Outside Bank Transfer Details */}
                          {transaction.transaction_subtype === "outside_bank" && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                              <h4 className="text-xs font-semibold text-gray-700 mb-2">External Transfer Details:</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {transaction.beneficiary_name && (
                                  <div>
                                    <span className="font-medium text-gray-600">Beneficiary:</span>
                                    <span className="ml-1 text-gray-900">{transaction.beneficiary_name}</span>
                                  </div>
                                )}
                                {transaction.beneficiary_bank && (
                                  <div>
                                    <span className="font-medium text-gray-600">Bank:</span>
                                    <span className="ml-1 text-gray-900">{transaction.beneficiary_bank}</span>
                                  </div>
                                )}
                                {transaction.beneficiary_iban && (
                                  <div>
                                    <span className="font-medium text-gray-600">IBAN:</span>
                                    <span className="ml-1 text-gray-900 font-mono">{transaction.beneficiary_iban}</span>
                                  </div>
                                )}
                                {transaction.beneficiary_swift && (
                                  <div>
                                    <span className="font-medium text-gray-600">SWIFT:</span>
                                    <span className="ml-1 text-gray-900 font-mono">
                                      {transaction.beneficiary_swift}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {transaction.beneficiary_address && (
                                <div className="mt-2 text-xs">
                                  <span className="font-medium text-gray-600">Address:</span>
                                  <p className="ml-1 text-gray-900 mt-1">{transaction.beneficiary_address}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Withdrawal Details */}
                          {transaction.type === "withdrawal" && (
                            <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                              <h4 className="text-xs font-semibold text-red-700 mb-2">Withdrawal Details:</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {transaction.beneficiary_name && (
                                  <div>
                                    <span className="font-medium text-red-600">Account Holder:</span>
                                    <span className="ml-1 text-gray-900">{transaction.beneficiary_name}</span>
                                  </div>
                                )}
                                {transaction.beneficiary_bank && (
                                  <div>
                                    <span className="font-medium text-red-600">Bank:</span>
                                    <span className="ml-1 text-gray-900">{transaction.beneficiary_bank}</span>
                                  </div>
                                )}
                                {transaction.beneficiary_iban && (
                                  <div>
                                    <span className="font-medium text-red-600">IBAN:</span>
                                    <span className="ml-1 text-gray-900 font-mono">{transaction.beneficiary_iban}</span>
                                  </div>
                                )}
                                {transaction.beneficiary_swift && (
                                  <div>
                                    <span className="font-medium text-red-600">SWIFT:</span>
                                    <span className="ml-1 text-gray-900 font-mono">
                                      {transaction.beneficiary_swift}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {transaction.beneficiary_address && (
                                <div className="mt-2 text-xs">
                                  <span className="font-medium text-red-600">Address:</span>
                                  <p className="ml-1 text-gray-900 mt-1">{transaction.beneficiary_address}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Inside Bank Transfer Details */}
                          {transaction.transaction_subtype === "inside_bank" && (
                            <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                              <h4 className="text-xs font-semibold text-purple-700 mb-2">Currency Conversion:</h4>
                              <div className="flex items-center text-xs">
                                <span className="font-medium text-purple-600">From:</span>
                                <span className="ml-1 px-2 py-1 bg-purple-100 rounded text-purple-800 font-mono">
                                  {transaction.from_currency || transaction.currency}
                                </span>
                                <span className="mx-2 text-purple-600">→</span>
                                <span className="font-medium text-purple-600">To:</span>
                                <span className="ml-1 px-2 py-1 bg-purple-100 rounded text-purple-800 font-mono">
                                  {transaction.to_currency}
                                </span>
                              </div>
                              {transaction.exchange_rate && (
                                <div className="mt-1 text-xs">
                                  <span className="font-medium text-purple-600">Rate:</span>
                                  <span className="ml-1 text-gray-900">{transaction.exchange_rate}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Notes */}
                          {transaction.notes && (
                            <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                              <span className="text-xs font-medium text-yellow-700">Notes:</span>
                              <p className="text-xs text-gray-900 mt-1">{transaction.notes}</p>
                            </div>
                          )}

                          {/* Approval Information */}
                          {transaction.approved_by && (
                            <div className="mt-2 text-xs text-gray-500">
                              <span className="font-medium">Approved by:</span>
                              <span className="ml-1">{transaction.approved_by_user?.name || "Admin"}</span>
                              {transaction.approved_at && (
                                <span className="ml-2">
                                  on {new Date(transaction.approved_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}

                          <p className="text-xs text-gray-500 mt-2">
                            Created: {new Date(transaction.created_at).toLocaleDateString()} at{" "}
                            {new Date(transaction.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {Number(transaction.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-gray-500">{transaction.currency}</p>
                        </div>

                        {transaction.status === "pending" && (
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                console.log("Approving transaction:", transaction.id)
                                approveTransaction(transaction)
                              }}
                              className="hover:bg-green-50 p-2 border border-green-200"
                              title="Approve Transaction"
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                console.log("Rejecting transaction:", transaction.id)
                                rejectTransaction(transaction)
                              }}
                              className="hover:bg-red-50 p-2 border border-red-200"
                              title="Reject Transaction"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTransaction(transaction)}
                          className="hover:bg-red-50 p-1"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8">
                  <ArrowUpDown className="h-10 w-10 sm:h-12 sm:w-12 text-[#F26623]/30 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-sm sm:text-lg font-medium text-gray-900 mb-2">
                    No {activeTab === "all" ? "" : activeTab} transactions
                  </h3>
                  <p className="text-xs sm:text-base text-gray-500">
                    {activeTab === "pending" ? "No transactions awaiting approval" : "Transactions will appear here"}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
