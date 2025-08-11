"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Eye,
  CreditCard,
  Bitcoin,
  FileText,
  MessageSquare,
  HelpCircle,
  Activity,
  MapPin,
  User,
  Search,
} from "lucide-react"
import { Input } from "@/components/ui/input"

type Balance = Database["public"]["Tables"]["balances"]["Row"]
type CryptoBalance = Database["public"]["Tables"]["crypto_balances"]["Row"]
type Transaction = Database["public"]["Tables"]["transactions"]["Row"]
type Deposit = Database["public"]["Tables"]["deposits"]["Row"]
type KYCApplication = Database["public"]["Tables"]["kyc_applications"]["Row"]
type Tax = Database["public"]["Tables"]["taxes"]["Row"]
type Message = Database["public"]["Tables"]["messages"]["Row"]
type SupportTicket = Database["public"]["Tables"]["support_tickets"]["Row"]
type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"]
type UserSession = Database["public"]["Tables"]["user_sessions"]["Row"]
type UserPresence = Database["public"]["Tables"]["user_presence"]["Row"]

interface UserOverview {
  user: Database["public"]["Tables"]["users"]["Row"]
  balances: Balance[]
  cryptoBalances: CryptoBalance[]
  transactions: Transaction[]
  deposits: Deposit[]
  kycApplication: KYCApplication | null
  taxes: Tax[]
  messages: Message[]
  supportTickets: SupportTicket[]
  activityLogs: ActivityLog[]
  sessions: UserSession[]
  presence: UserPresence | null
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function UserOverviewTab() {
  const [users, setUsers] = useState<Database["public"]["Tables"]["users"]["Row"][]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserOverview | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserDetails = async (userId: string) => {
    setDetailsLoading(true)
    try {
      const [
        userResult,
        balancesResult,
        cryptoBalancesResult,
        transactionsResult,
        depositsResult,
        kycResult,
        taxesResult,
        messagesResult,
        supportResult,
        activityResult,
        sessionsResult,
        presenceResult,
      ] = await Promise.all([
        supabase.from("users").select("*").eq("id", userId).single(),
        supabase.from("balances").select("*").eq("user_id", userId),
        supabase.from("crypto_balances").select("*").eq("user_id", userId),
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("deposits").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("kyc_applications").select("*").eq("user_id", userId).single(),
        supabase.from("taxes").select("*").eq("user_id", userId).order("year", { ascending: false }),
        supabase.from("messages").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("support_tickets").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase
          .from("activity_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("user_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("user_presence").select("*").eq("user_id", userId).single(),
      ])

      const userOverview: UserOverview = {
        user: userResult.data!,
        balances: balancesResult.data || [],
        cryptoBalances: cryptoBalancesResult.data || [],
        transactions: transactionsResult.data || [],
        deposits: depositsResult.data || [],
        kycApplication: kycResult.data || null,
        taxes: taxesResult.data || [],
        messages: messagesResult.data || [],
        supportTickets: supportResult.data || [],
        activityLogs: activityResult.data || [],
        sessions: sessionsResult.data || [],
        presence: presenceResult.data || null,
      }

      setSelectedUser(userOverview)
    } catch (error) {
      console.error("Error fetching user details:", error)
    } finally {
      setDetailsLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Overview</h2>
        <Badge variant="secondary">{users.length} Total Users</Badge>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {searchTerm && (
          <Badge variant="outline">
            {filteredUsers.length} of {users.length} users
          </Badge>
        )}
      </div>

      <div className="grid gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{user.name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                  <Badge
                    variant={
                      user.kyc_status === "approved"
                        ? "default"
                        : user.kyc_status === "pending"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    KYC: {user.kyc_status}
                  </Badge>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => fetchUserDetails(user.id)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                      <DialogHeader>
                        <DialogTitle>User Details: {user.name}</DialogTitle>
                      </DialogHeader>
                      {detailsLoading ? (
                        <div className="flex items-center justify-center h-64">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : selectedUser ? (
                        <ScrollArea className="h-[70vh]">
                          <Tabs defaultValue="overview" className="w-full">
                            <TabsList className="grid w-full grid-cols-6">
                              <TabsTrigger value="overview">Overview</TabsTrigger>
                              <TabsTrigger value="balances">Balances</TabsTrigger>
                              <TabsTrigger value="transactions">Transactions</TabsTrigger>
                              <TabsTrigger value="kyc">KYC</TabsTrigger>
                              <TabsTrigger value="activity">Activity</TabsTrigger>
                              <TabsTrigger value="support">Support</TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center">
                                      <User className="w-4 h-4 mr-2" />
                                      User Information
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div>
                                      <strong>Name:</strong> {selectedUser.user.name}
                                    </div>
                                    <div>
                                      <strong>Email:</strong> {selectedUser.user.email}
                                    </div>
                                    <div>
                                      <strong>Role:</strong> {selectedUser.user.role}
                                    </div>
                                    <div>
                                      <strong>KYC Status:</strong> {selectedUser.user.kyc_status}
                                    </div>
                                    <div>
                                      <strong>Joined:</strong> {formatDate(selectedUser.user.created_at)}
                                    </div>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center">
                                      <Activity className="w-4 h-4 mr-2" />
                                      Status & Activity
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    <div>
                                      <strong>Last Seen:</strong>{" "}
                                      {selectedUser.presence?.last_seen
                                        ? formatDate(selectedUser.presence.last_seen)
                                        : "Never"}
                                    </div>
                                    <div>
                                      <strong>Total Sessions:</strong> {selectedUser.presence?.total_sessions || 0}
                                    </div>
                                    <div>
                                      <strong>Support Tickets:</strong> {selectedUser.supportTickets.length}
                                    </div>
                                    <div>
                                      <strong>Messages:</strong> {selectedUser.messages.length}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Fiat Balances</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {selectedUser.balances.length > 0 ? (
                                      selectedUser.balances.map((balance) => (
                                        <div key={balance.id} className="flex justify-between">
                                          <span>{balance.currency.toUpperCase()}</span>
                                          <span>{formatCurrency(balance.amount, balance.currency)}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-gray-500">No balances</p>
                                    )}
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Crypto Balances</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {selectedUser.cryptoBalances.length > 0 ? (
                                      selectedUser.cryptoBalances.map((balance) => (
                                        <div key={balance.id} className="flex justify-between">
                                          <span>{balance.crypto.toUpperCase()}</span>
                                          <span>{balance.amount.toFixed(8)}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-gray-500">No crypto balances</p>
                                    )}
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Tax Summary</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {selectedUser.taxes.length > 0 ? (
                                      selectedUser.taxes.slice(0, 3).map((tax) => (
                                        <div key={tax.id} className="flex justify-between">
                                          <span>{tax.year}</span>
                                          <span>{formatCurrency(tax.amount, "USD")}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-gray-500">No tax records</p>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>
                            </TabsContent>

                            <TabsContent value="balances" className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="flex items-center">
                                      <CreditCard className="w-4 h-4 mr-2" />
                                      Fiat Balances
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {selectedUser.balances.map((balance) => (
                                      <div
                                        key={balance.id}
                                        className="flex justify-between items-center py-2 border-b last:border-b-0"
                                      >
                                        <div>
                                          <div className="font-medium">{balance.currency.toUpperCase()}</div>
                                          <div className="text-sm text-gray-500">
                                            Updated: {formatDate(balance.updated_at)}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-semibold">
                                            {formatCurrency(balance.amount, balance.currency)}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <CardTitle className="flex items-center">
                                      <Bitcoin className="w-4 h-4 mr-2" />
                                      Crypto Balances
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {selectedUser.cryptoBalances.map((balance) => (
                                      <div
                                        key={balance.id}
                                        className="flex justify-between items-center py-2 border-b last:border-b-0"
                                      >
                                        <div>
                                          <div className="font-medium">{balance.crypto.toUpperCase()}</div>
                                          <div className="text-sm text-gray-500">
                                            Updated: {formatDate(balance.updated_at)}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-semibold">{balance.amount.toFixed(8)}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </CardContent>
                                </Card>
                              </div>
                            </TabsContent>

                            <TabsContent value="transactions" className="space-y-4">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center">
                                    <FileText className="w-4 h-4 mr-2" />
                                    Recent Transactions
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {selectedUser.transactions.map((transaction) => (
                                    <div
                                      key={transaction.id}
                                      className="flex justify-between items-center py-3 border-b last:border-b-0"
                                    >
                                      <div>
                                        <div className="font-medium">{transaction.type}</div>
                                        <div className="text-sm text-gray-500">
                                          {formatDate(transaction.created_at)} • {transaction.currency.toUpperCase()}
                                        </div>
                                        {transaction.transaction_subtype && (
                                          <div className="text-xs text-gray-400">{transaction.transaction_subtype}</div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="font-semibold">
                                          {formatCurrency(transaction.amount, transaction.currency)}
                                        </div>
                                        <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
                                          {transaction.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>

                              <Card>
                                <CardHeader>
                                  <CardTitle>Recent Deposits</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {selectedUser.deposits.map((deposit) => (
                                    <div
                                      key={deposit.id}
                                      className="flex justify-between items-center py-3 border-b last:border-b-0"
                                    >
                                      <div>
                                        <div className="font-medium">Deposit</div>
                                        <div className="text-sm text-gray-500">
                                          {formatDate(deposit.created_at)} • {deposit.currency.toUpperCase()}
                                        </div>
                                        {deposit.notes && <div className="text-xs text-gray-400">{deposit.notes}</div>}
                                      </div>
                                      <div className="text-right">
                                        <div className="font-semibold">
                                          {formatCurrency(deposit.amount, deposit.currency)}
                                        </div>
                                        <Badge
                                          variant={
                                            deposit.status === "approved"
                                              ? "default"
                                              : deposit.status === "pending"
                                                ? "secondary"
                                                : "destructive"
                                          }
                                        >
                                          {deposit.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </CardContent>
                              </Card>
                            </TabsContent>

                            <TabsContent value="kyc" className="space-y-4">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center">
                                    <FileText className="w-4 h-4 mr-2" />
                                    KYC Information
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {selectedUser.kycApplication ? (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="font-semibold mb-2">Personal Information</h4>
                                        <div className="space-y-1 text-sm">
                                          <div>
                                            <strong>Name:</strong> {selectedUser.kycApplication.first_name}{" "}
                                            {selectedUser.kycApplication.last_name}
                                          </div>
                                          <div>
                                            <strong>Date of Birth:</strong> {selectedUser.kycApplication.date_of_birth}
                                          </div>
                                          <div>
                                            <strong>Nationality:</strong> {selectedUser.kycApplication.nationality}
                                          </div>
                                          <div>
                                            <strong>Phone:</strong> {selectedUser.kycApplication.phone_number}
                                          </div>
                                          <div>
                                            <strong>Occupation:</strong> {selectedUser.kycApplication.occupation}
                                          </div>
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="font-semibold mb-2">Address & Status</h4>
                                        <div className="space-y-1 text-sm">
                                          <div>
                                            <strong>Address:</strong> {selectedUser.kycApplication.address}
                                          </div>
                                          <div>
                                            <strong>City:</strong> {selectedUser.kycApplication.city}
                                          </div>
                                          <div>
                                            <strong>Country:</strong> {selectedUser.kycApplication.country}
                                          </div>
                                          <div>
                                            <strong>Postal Code:</strong> {selectedUser.kycApplication.postal_code}
                                          </div>
                                          <div>
                                            <strong>Status:</strong>
                                            <Badge
                                              className="ml-2"
                                              variant={
                                                selectedUser.kycApplication.status === "approved"
                                                  ? "default"
                                                  : selectedUser.kycApplication.status === "pending"
                                                    ? "secondary"
                                                    : "destructive"
                                              }
                                            >
                                              {selectedUser.kycApplication.status}
                                            </Badge>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-gray-500">No KYC application found</p>
                                  )}
                                </CardContent>
                              </Card>
                            </TabsContent>

                            <TabsContent value="activity" className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="flex items-center">
                                      <Activity className="w-4 h-4 mr-2" />
                                      Recent Activity
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <ScrollArea className="h-64">
                                      {selectedUser.activityLogs.map((log) => (
                                        <div key={log.id} className="py-2 border-b last:border-b-0">
                                          <div className="text-sm">{log.activity}</div>
                                          <div className="text-xs text-gray-500">{formatDate(log.created_at)}</div>
                                        </div>
                                      ))}
                                    </ScrollArea>
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <CardTitle className="flex items-center">
                                      <MapPin className="w-4 h-4 mr-2" />
                                      Recent Sessions
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <ScrollArea className="h-64">
                                      {selectedUser.sessions.map((session) => (
                                        <div key={session.id} className="py-2 border-b last:border-b-0">
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <div className="text-sm font-medium">
                                                {session.country && session.city
                                                  ? `${session.city}, ${session.country}`
                                                  : "Unknown Location"}
                                              </div>
                                              <div className="text-xs text-gray-500">{session.ip_address}</div>
                                              <div className="text-xs text-gray-500">
                                                {formatDate(session.created_at)}
                                              </div>
                                            </div>
                                            <Badge variant={session.is_active ? "default" : "secondary"}>
                                              {session.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                          </div>
                                        </div>
                                      ))}
                                    </ScrollArea>
                                  </CardContent>
                                </Card>
                              </div>
                            </TabsContent>

                            <TabsContent value="support" className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="flex items-center">
                                      <HelpCircle className="w-4 h-4 mr-2" />
                                      Support Tickets
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {selectedUser.supportTickets.map((ticket) => (
                                      <div key={ticket.id} className="py-3 border-b last:border-b-0">
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <div className="text-sm font-medium">{ticket.issue}</div>
                                            <div className="text-xs text-gray-500">{formatDate(ticket.created_at)}</div>
                                          </div>
                                          <Badge
                                            variant={
                                              ticket.status === "resolved"
                                                ? "default"
                                                : ticket.status === "pending"
                                                  ? "secondary"
                                                  : "destructive"
                                            }
                                          >
                                            {ticket.status}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </CardContent>
                                </Card>

                                <Card>
                                  <CardHeader>
                                    <CardTitle className="flex items-center">
                                      <MessageSquare className="w-4 h-4 mr-2" />
                                      Recent Messages
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <ScrollArea className="h-64">
                                      {selectedUser.messages.map((message) => (
                                        <div key={message.id} className="py-2 border-b last:border-b-0">
                                          <div className="text-sm">{message.message}</div>
                                          <div className="text-xs text-gray-500 flex justify-between">
                                            <span>{formatDate(message.created_at)}</span>
                                            <Badge variant={message.from_admin ? "default" : "secondary"}>
                                              {message.from_admin ? "Admin" : "User"}
                                            </Badge>
                                          </div>
                                        </div>
                                      ))}
                                    </ScrollArea>
                                  </CardContent>
                                </Card>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </ScrollArea>
                      ) : null}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
