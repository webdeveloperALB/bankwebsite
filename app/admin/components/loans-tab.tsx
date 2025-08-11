"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface Loan {
    id: string
    full_name: string
    email: string
    phone: string
    loan_amount: number
    loan_purpose: string
    employment_status: string
    monthly_income: number
    credit_score: number | null
    collateral_type: string | null
    collateral_value: number | null
    status: "pending" | "approved" | "rejected" | "under_review"
    admin_notes: string | null
    created_at: string
    updated_at: string
}

export default function AdminPanel() {
    const [loans, setLoans] = useState<Loan[]>([])
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
    const [adminNotes, setAdminNotes] = useState("")
    const [newStatus, setNewStatus] = useState<string>("")
    const [isLoading, setIsLoading] = useState(true)
    const [isUpdating, setIsUpdating] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        fetchLoans()
    }, [])

    const fetchLoans = async () => {
        try {
            const { data, error } = await supabase.from("loans").select("*").order("created_at", { ascending: false })

            if (error) throw error
            setLoans(data || [])
        } catch (error) {
            console.error("Error fetching loans:", error)
            toast({
                title: "Error",
                description: "Failed to fetch loan applications.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleLoanSelect = (loan: Loan) => {
        setSelectedLoan(loan)
        setAdminNotes(loan.admin_notes || "")
        setNewStatus(loan.status)
    }

    const handleUpdateLoan = async () => {
        if (!selectedLoan) return
        setIsUpdating(true)

        try {
            const { error } = await supabase
                .from("loans")
                .update({
                    status: newStatus,
                    admin_notes: adminNotes,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", selectedLoan.id)

            if (error) throw error

            toast({
                title: "Loan Updated",
                description: "Loan application has been updated successfully.",
            })

            // Refresh loans list
            await fetchLoans()

            // Update selected loan
            setSelectedLoan({
                ...selectedLoan,
                status: newStatus as any,
                admin_notes: adminNotes,
                updated_at: new Date().toISOString(),
            })
        } catch (error) {
            console.error("Error updating loan:", error)
            toast({
                title: "Update Failed",
                description: "Failed to update loan application.",
                variant: "destructive",
            })
        } finally {
            setIsUpdating(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const variants = {
            pending: "bg-yellow-100 text-yellow-800",
            under_review: "bg-blue-100 text-blue-800",
            approved: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
        }
        return variants[status as keyof typeof variants] || "bg-gray-100 text-gray-800"
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F26623] mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading loan applications...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Loan Management Dashboard</h1>
                    <p className="text-gray-600">Manage and review loan applications</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Loans List */}
                    <Card className="h-fit">
                        <CardHeader className="bg-[#F26623] text-white">
                            <CardTitle>Loan Applications ({loans.length})</CardTitle>
                            <CardDescription className="text-orange-100">Click on any application to review details</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-96 overflow-y-auto">
                                {loans.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500">No loan applications found</div>
                                ) : (
                                    loans.map((loan) => (
                                        <div
                                            key={loan.id}
                                            onClick={() => handleLoanSelect(loan)}
                                            className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedLoan?.id === loan.id ? "bg-orange-50 border-l-4 border-l-[#F26623]" : ""
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-semibold text-gray-900">{loan.full_name}</h3>
                                                <Badge className={getStatusBadge(loan.status)}>{loan.status.replace("_", " ")}</Badge>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-1">{loan.email}</p>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="font-medium text-[#F26623]">{formatCurrency(loan.loan_amount)}</span>
                                                <span className="text-gray-500">{formatDate(loan.created_at)}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Loan Details */}
                    {selectedLoan ? (
                        <Card>
                            <CardHeader className="bg-gray-900 text-white">
                                <CardTitle>Loan Details</CardTitle>
                                <CardDescription className="text-gray-300">Review and update loan application</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* Personal Information */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                                        <p className="text-gray-900">{selectedLoan.full_name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-700">Email</Label>
                                        <p className="text-gray-900">{selectedLoan.email}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-700">Phone</Label>
                                        <p className="text-gray-900">{selectedLoan.phone}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-700">Loan Amount</Label>
                                        <p className="text-gray-900 font-semibold">{formatCurrency(selectedLoan.loan_amount)}</p>
                                    </div>
                                </div>

                                {/* Employment Information */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-sm font-medium text-gray-700">Employment Status</Label>
                                        <p className="text-gray-900">{selectedLoan.employment_status.replace("-", " ")}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-700">Monthly Income</Label>
                                        <p className="text-gray-900">{formatCurrency(selectedLoan.monthly_income)}</p>
                                    </div>
                                    {selectedLoan.credit_score && (
                                        <div>
                                            <Label className="text-sm font-medium text-gray-700">Credit Score</Label>
                                            <p className="text-gray-900">{selectedLoan.credit_score}</p>
                                        </div>
                                    )}
                                    {selectedLoan.collateral_type && (
                                        <div>
                                            <Label className="text-sm font-medium text-gray-700">Collateral</Label>
                                            <p className="text-gray-900">
                                                {selectedLoan.collateral_type.replace("-", " ")}
                                                {selectedLoan.collateral_value && ` - ${formatCurrency(selectedLoan.collateral_value)}`}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Loan Purpose */}
                                <div>
                                    <Label className="text-sm font-medium text-gray-700">Loan Purpose</Label>
                                    <p className="text-gray-900 bg-gray-50 p-3 rounded-md">{selectedLoan.loan_purpose}</p>
                                </div>

                                {/* Status Update */}
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="status" className="text-sm font-medium text-gray-700">
                                            Update Status
                                        </Label>
                                        <Select value={newStatus} onValueChange={setNewStatus}>
                                            <SelectTrigger className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="under_review">Under Review</SelectItem>
                                                <SelectItem value="approved">Approved</SelectItem>
                                                <SelectItem value="rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="adminNotes" className="text-sm font-medium text-gray-700">
                                            Admin Notes
                                        </Label>
                                        <Textarea
                                            id="adminNotes"
                                            value={adminNotes}
                                            onChange={(e) => setAdminNotes(e.target.value)}
                                            className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]"
                                            placeholder="Add notes about this loan application..."
                                            rows={4}
                                        />
                                    </div>

                                    <Button
                                        onClick={handleUpdateLoan}
                                        disabled={isUpdating}
                                        className="w-full bg-[#F26623] hover:bg-[#E55A1F] text-white"
                                    >
                                        {isUpdating ? "Updating..." : "Update Loan Application"}
                                    </Button>
                                </div>

                                {/* Timestamps */}
                                <div className="text-xs text-gray-500 border-t pt-4">
                                    <p>Created: {formatDate(selectedLoan.created_at)}</p>
                                    <p>Updated: {formatDate(selectedLoan.updated_at)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="flex items-center justify-center h-96">
                            <div className="text-center text-gray-500">
                                <p className="text-lg mb-2">Select a loan application</p>
                                <p className="text-sm">Choose an application from the list to view details</p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
