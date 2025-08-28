"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { CheckCircle, XCircle, Clock, Search, Filter, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getCurrentUser } from "@/lib/auth"

type Deposit = {
    id: string
    user_id: string
    amount: number
    currency: string
    status: "pending" | "approved" | "rejected"
    notes?: string | null
    created_at: string
    approved_by?: string | null
    approved_at?: string | null
    updated_at: string
    users?: {
        email: string
        name: string
    }
    approved_by_user?: {
        email: string
        name: string
    }
}

export default function DepositsTab() {
    const [deposits, setDeposits] = useState<Deposit[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [processing, setProcessing] = useState<string | null>(null)
    const [currentAdmin, setCurrentAdmin] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [debugInfo, setDebugInfo] = useState<string>("")

    useEffect(() => {
        initializeAdmin()
    }, [])

    const initializeAdmin = async () => {
        try {
            setError(null)
            setDebugInfo("Loading admin user...")

            // Use your custom getCurrentUser function instead of supabase.auth.getUser()
            const currentUser = await getCurrentUser()

            if (!currentUser) {
                throw new Error("No authenticated user found")
            }

            setDebugInfo(`User found: ${currentUser.email} (role: ${currentUser.role})`)

            // Check if user is admin
            if (currentUser.role !== "admin") {
                throw new Error(`Access denied. User role: ${currentUser.role}. Admin role required.`)
            }

            setCurrentAdmin(currentUser)
            setDebugInfo(`Admin loaded: ${currentUser.email} (role: ${currentUser.role})`)

            // Load deposits
            await loadDeposits()

            // Set up real-time subscription
            const channel = supabase
                .channel("admin-deposits")
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "deposits",
                    },
                    (payload) => {
                        console.log("Deposit changed:", payload)
                        loadDeposits()
                    },
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        } catch (error: any) {
            console.error("Admin initialization error:", error)
            setError(error.message)
            setDebugInfo(`Error: ${error.message}`)
        }
    }

    const loadDeposits = async () => {
        try {
            setDebugInfo((prev) => prev + "\nLoading deposits...")

            // First try simple query
            const { data: simpleData, error: simpleError } = await supabase
                .from("deposits")
                .select("*")
                .order("created_at", { ascending: false })

            if (simpleError) {
                throw new Error(`Simple query failed: ${simpleError.message}`)
            }

            console.log("Simple deposits data:", simpleData)
            setDebugInfo((prev) => prev + `\nFound ${simpleData?.length || 0} deposits`)

            // Try with joins
            const { data, error } = await supabase
                .from("deposits")
                .select(`
          *,
          users!deposits_user_id_fkey (
            email,
            name
          ),
          approved_by_user:users!deposits_approved_by_fkey (
            email,
            name
          )
        `)
                .order("created_at", { ascending: false })

            if (error) {
                console.error("Join query error:", error)
                // Use simple data as fallback
                setDeposits(simpleData || [])
                setDebugInfo((prev) => prev + `\nUsing simple data (join failed: ${error.message})`)
            } else {
                console.log("Deposits with joins:", data)
                setDeposits(data || [])
                setDebugInfo((prev) => prev + `\nLoaded with user data`)
            }
        } catch (error: any) {
            console.error("Error loading deposits:", error)
            setError(`Failed to load deposits: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleApproveDeposit = async (deposit: Deposit) => {
        if (!currentAdmin) {
            toast({
                title: "Error",
                description: "Admin not loaded",
                variant: "destructive",
            })
            return
        }

        setProcessing(deposit.id)
        console.log("Approving deposit:", deposit.id, "by admin:", currentAdmin.id)

        try {
            // Test if we can update the deposit
            const { data: testData, error: testError } = await supabase
                .from("deposits")
                .select("*")
                .eq("id", deposit.id)
                .single()

            if (testError) {
                throw new Error(`Cannot access deposit: ${testError.message}`)
            }

            console.log("Deposit to approve:", testData)

            // Update deposit status
            const { data: updateData, error: updateError } = await supabase
                .from("deposits")
                .update({
                    status: "approved",
                    approved_by: currentAdmin.id,
                    approved_at: new Date().toISOString(),
                })
                .eq("id", deposit.id)
                .select()

            if (updateError) {
                throw new Error(`Update failed: ${updateError.message}`)
            }

            console.log("Deposit updated:", updateData)

            // Update or create balance
            const { data: existingBalance, error: balanceSelectError } = await supabase
                .from("balances")
                .select("*")
                .eq("user_id", deposit.user_id)
                .eq("currency", deposit.currency)
                .single()

            if (balanceSelectError && balanceSelectError.code !== "PGRST116") {
                console.error("Balance select error:", balanceSelectError)
            }

            if (existingBalance) {
                // Update existing balance
                const { error: balanceError } = await supabase
                    .from("balances")
                    .update({
                        amount: Number(existingBalance.amount) + Number(deposit.amount),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", existingBalance.id)

                if (balanceError) {
                    console.error("Balance update error:", balanceError)
                }
            } else {
                // Create new balance
                const { error: balanceError } = await supabase.from("balances").insert({
                    user_id: deposit.user_id,
                    currency: deposit.currency,
                    amount: Number(deposit.amount),
                })

                if (balanceError) {
                    console.error("Balance insert error:", balanceError)
                }
            }

            // Create transaction record
            await supabase.from("transactions").insert({
                user_id: deposit.user_id,
                type: "deposit",
                currency: deposit.currency,
                amount: deposit.amount,
                status: "completed",
                notes: `Deposit approved - ID: ${deposit.id}`,
            })

            // Log activity
            await supabase.from("activity_logs").insert({
                user_id: deposit.user_id,
                activity: `Deposit of ${deposit.amount} ${deposit.currency} approved by ${currentAdmin.name || currentAdmin.email}`,
            })

            toast({
                title: "Success",
                description: "Deposit approved successfully",
            })

            await loadDeposits()
        } catch (error: any) {
            console.error("Error approving deposit:", error)
            toast({
                title: "Error",
                description: `Failed to approve deposit: ${error.message}`,
                variant: "destructive",
            })
        } finally {
            setProcessing(null)
        }
    }

    const handleRejectDeposit = async (deposit: Deposit) => {
        if (!currentAdmin) {
            toast({
                title: "Error",
                description: "Admin not loaded",
                variant: "destructive",
            })
            return
        }

        setProcessing(deposit.id)
        console.log("Rejecting deposit:", deposit.id, "by admin:", currentAdmin.id)

        try {
            // Update deposit status
            const { data: updateData, error: updateError } = await supabase
                .from("deposits")
                .update({
                    status: "rejected",
                    approved_by: currentAdmin.id,
                    approved_at: new Date().toISOString(),
                })
                .eq("id", deposit.id)
                .select()

            if (updateError) {
                throw new Error(`Update failed: ${updateError.message}`)
            }

            console.log("Deposit rejected:", updateData)

            // Log activity
            await supabase.from("activity_logs").insert({
                user_id: deposit.user_id,
                activity: `Deposit of ${deposit.amount} ${deposit.currency} rejected by ${currentAdmin.name || currentAdmin.email}`,
            })

            toast({
                title: "Success",
                description: "Deposit rejected successfully",
            })

            await loadDeposits()
        } catch (error: any) {
            console.error("Error rejecting deposit:", error)
            toast({
                title: "Error",
                description: `Failed to reject deposit: ${error.message}`,
                variant: "destructive",
            })
        } finally {
            setProcessing(null)
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

    const filteredDeposits = deposits.filter((deposit) => {
        const matchesSearch =
            deposit.users?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            deposit.users?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            deposit.currency.toLowerCase().includes(searchTerm.toLowerCase()) ||
            deposit.id.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesStatus = statusFilter === "all" || deposit.status === statusFilter

        return matchesSearch && matchesStatus
    })

    const pendingCount = deposits.filter((d) => d.status === "pending").length
    const approvedCount = deposits.filter((d) => d.status === "approved").length
    const rejectedCount = deposits.filter((d) => d.status === "rejected").length

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Deposit Management</h2>
                    <p className="text-gray-600">Review and approve deposit requests</p>
                </div>

                <Card className="border-red-200">
                    <CardContent className="pt-6">
                        <div className="flex items-center space-x-2 text-red-600 mb-4">
                            <AlertCircle className="h-5 w-5" />
                            <div>
                                <p className="font-medium">Error loading admin panel</p>
                                <p className="text-sm text-red-500">{error}</p>
                            </div>
                        </div>

                        {debugInfo && (
                            <div className="mt-4 p-3 bg-gray-100 rounded text-xs font-mono whitespace-pre-wrap">
                                <strong>Debug Info:</strong>
                                {debugInfo}
                            </div>
                        )}

                        <Button
                            onClick={() => {
                                setError(null)
                                setLoading(true)
                                initializeAdmin()
                            }}
                            className="mt-4"
                            variant="outline"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Deposit Management</h2>
                <p className="text-gray-600">Review and approve deposit requests</p>
                {currentAdmin && (
                    <div className="mt-2 text-sm text-gray-500">
                        Logged in as: <strong>{currentAdmin.name || currentAdmin.email}</strong>
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">{currentAdmin.role}</span>
                    </div>
                )}
                {debugInfo && (
                    <details className="mt-2">
                        <summary className="text-xs text-gray-400 cursor-pointer">Debug Info</summary>
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono whitespace-pre-wrap">{debugInfo}</div>
                    </details>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Pending Deposits</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-yellow-500" />
                            <span className="text-2xl font-bold text-yellow-600">{pendingCount}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Approved Deposits</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-2xl font-bold text-green-600">{approvedCount}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Rejected Deposits</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-2xl font-bold text-red-600">{rejectedCount}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Deposits Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Deposit Requests ({deposits.length} total)</CardTitle>
                    <CardDescription>Manage user deposit requests</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="Search by user, email, currency, or ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-48">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={loadDeposits} variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="animate-pulse">
                                    <div className="h-16 bg-gray-200 rounded"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Currency</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Notes</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDeposits.length > 0 ? (
                                        filteredDeposits.map((deposit) => (
                                            <TableRow key={deposit.id}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{deposit.users?.name || "N/A"}</p>
                                                        <p className="text-sm text-gray-500">{deposit.users?.email || "No email"}</p>
                                                        <p className="text-xs text-gray-400 font-mono">{deposit.user_id.slice(0, 8)}...</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {Number(deposit.amount).toLocaleString("en-US", {
                                                        minimumFractionDigits: 2,
                                                    })}
                                                </TableCell>
                                                <TableCell>{deposit.currency}</TableCell>
                                                <TableCell>{new Date(deposit.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                                                <TableCell>
                                                    {deposit.notes ? (
                                                        <div className="max-w-32 truncate" title={deposit.notes}>
                                                            {deposit.notes}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {deposit.status === "pending" && (
                                                        <div className="flex space-x-2">
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                        disabled={processing === deposit.id}
                                                                    >
                                                                        {processing === deposit.id ? "..." : "Approve"}
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Approve Deposit</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Are you sure you want to approve this deposit of {deposit.amount}{" "}
                                                                            {deposit.currency}? This will add the funds to the user&apos;s balance.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            onClick={() => handleApproveDeposit(deposit)}
                                                                            className="bg-green-600 hover:bg-green-700"
                                                                        >
                                                                            Approve
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>

                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button size="sm" variant="destructive" disabled={processing === deposit.id}>
                                                                        {processing === deposit.id ? "..." : "Reject"}
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Reject Deposit</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Are you sure you want to reject this deposit of {deposit.amount}{" "}
                                                                            {deposit.currency}? This action cannot be undone.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            onClick={() => handleRejectDeposit(deposit)}
                                                                            className="bg-red-600 hover:bg-red-700"
                                                                        >
                                                                            Reject
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    )}
                                                    {deposit.status !== "pending" && deposit.approved_by_user && (
                                                        <div className="text-xs text-gray-500">
                                                            By: {deposit.approved_by_user.name}
                                                            <br />
                                                            {deposit.approved_at && new Date(deposit.approved_at).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8">
                                                <div className="text-gray-500">
                                                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                    <p>No deposit requests found</p>
                                                    {searchTerm && <p className="text-sm">Try adjusting your search terms</p>}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
