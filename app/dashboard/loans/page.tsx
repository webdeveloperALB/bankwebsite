"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import { useToast } from "@/hooks/use-toast"
import DashboardLayout from "@/components/dashboard-layout"
import { Plus, FileText, Clock, CheckCircle, XCircle } from "lucide-react"

type Loan = {
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
    status: "pending" | "approved" | "rejected"
    created_at: string
    updated_at: string
}

export default function LoanDashboard() {
    const [loans, setLoans] = useState<Loan[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)

    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        loanAmount: "",
        loanPurpose: "",
        employmentStatus: "",
        monthlyIncome: "",
        creditScore: "",
        collateralType: "",
        collateralValue: "",
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { toast } = useToast()

    const fetchLoans = async () => {
        try {
            const user = await getCurrentUser()
            if (!user) return

            const { data, error } = await supabase
                .from("loans")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })

            if (error) throw error
            setLoans(data || [])
        } catch (error) {
            console.error("Error fetching loans:", error)
            toast({
                title: "Error",
                description: "Failed to load your loan applications.",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLoans()
    }, [])

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const user = await getCurrentUser()
            if (!user) {
                toast({
                    title: "Authentication Required",
                    description: "Please log in to submit a loan application.",
                    variant: "destructive",
                })
                return
            }

            const { error } = await supabase.from("loans").insert({
                user_id: user.id,
                full_name: formData.fullName,
                email: formData.email,
                phone: formData.phone,
                loan_amount: Number.parseFloat(formData.loanAmount),
                loan_purpose: formData.loanPurpose,
                employment_status: formData.employmentStatus,
                monthly_income: Number.parseFloat(formData.monthlyIncome),
                credit_score: formData.creditScore ? Number.parseInt(formData.creditScore) : null,
                collateral_type: formData.collateralType || null,
                collateral_value: formData.collateralValue ? Number.parseFloat(formData.collateralValue) : null,
                status: "pending",
            })

            if (error) throw error

            toast({
                title: "Application Submitted",
                description: "Your loan application has been submitted successfully. We'll review it and get back to you soon.",
            })

            // Reset form
            setFormData({
                fullName: "",
                email: "",
                phone: "",
                loanAmount: "",
                loanPurpose: "",
                employmentStatus: "",
                monthlyIncome: "",
                creditScore: "",
                collateralType: "",
                collateralValue: "",
            })

            setShowForm(false)
            fetchLoans()
        } catch (error) {
            console.error("Error submitting loan application:", error)
            toast({
                title: "Submission Failed",
                description: "There was an error submitting your application. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "approved":
                return "bg-green-100 text-green-800 border-green-200"
            case "rejected":
                return "bg-red-100 text-red-800 border-red-200"
            default:
                return "bg-yellow-100 text-yellow-800 border-yellow-200"
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "approved":
                return <CheckCircle className="h-4 w-4" />
            case "rejected":
                return <XCircle className="h-4 w-4" />
            default:
                return <Clock className="h-4 w-4" />
        }
    }

    return (
        <DashboardLayout currentSection="loans">
            <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">Loan Management</h1>
                            <p className="text-gray-600">View your loan applications and apply for new loans</p>
                        </div>
                        <Button onClick={() => setShowForm(!showForm)} className="bg-[#F26623] hover:bg-[#E55A1F] text-white">
                            <Plus className="h-4 w-4 mr-2" />
                            {showForm ? "View Applications" : "New Application"}
                        </Button>
                    </div>

                    {showForm ? (
                        // Application Form
                        <Card className="shadow-xl border-0">
                            <CardHeader className="bg-[#F26623] text-white rounded-t-lg">
                                <CardTitle className="text-2xl">Personal Loan Application</CardTitle>
                                <CardDescription className="text-orange-100">
                                    Fill out all required fields to submit your loan application
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-8">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Personal Information */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                                                Full Name *
                                            </Label>
                                            <Input
                                                id="fullName"
                                                type="text"
                                                value={formData.fullName}
                                                onChange={(e) => handleInputChange("fullName", e.target.value)}
                                                className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                                                Email Address *
                                            </Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => handleInputChange("email", e.target.value)}
                                                className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                                                Phone Number *
                                            </Label>
                                            <Input
                                                id="phone"
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => handleInputChange("phone", e.target.value)}
                                                className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="loanAmount" className="text-sm font-medium text-gray-700">
                                                Loan Amount ($) *
                                            </Label>
                                            <Input
                                                id="loanAmount"
                                                type="number"
                                                min="1000"
                                                step="100"
                                                value={formData.loanAmount}
                                                onChange={(e) => handleInputChange("loanAmount", e.target.value)}
                                                className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Loan Details */}
                                    <div className="space-y-2">
                                        <Label htmlFor="loanPurpose" className="text-sm font-medium text-gray-700">
                                            Loan Purpose *
                                        </Label>
                                        <Textarea
                                            id="loanPurpose"
                                            value={formData.loanPurpose}
                                            onChange={(e) => handleInputChange("loanPurpose", e.target.value)}
                                            className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]"
                                            placeholder="Describe what you'll use the loan for..."
                                            required
                                        />
                                    </div>

                                    {/* Employment Information */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="employmentStatus" className="text-sm font-medium text-gray-700">
                                                Employment Status *
                                            </Label>
                                            <Select
                                                value={formData.employmentStatus}
                                                onValueChange={(value) => handleInputChange("employmentStatus", value)}
                                            >
                                                <SelectTrigger className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]">
                                                    <SelectValue placeholder="Select employment status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="full-time">Full-time Employee</SelectItem>
                                                    <SelectItem value="part-time">Part-time Employee</SelectItem>
                                                    <SelectItem value="self-employed">Self-employed</SelectItem>
                                                    <SelectItem value="unemployed">Unemployed</SelectItem>
                                                    <SelectItem value="retired">Retired</SelectItem>
                                                    <SelectItem value="student">Student</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="monthlyIncome" className="text-sm font-medium text-gray-700">
                                                Monthly Income ($) *
                                            </Label>
                                            <Input
                                                id="monthlyIncome"
                                                type="number"
                                                min="0"
                                                step="100"
                                                value={formData.monthlyIncome}
                                                onChange={(e) => handleInputChange("monthlyIncome", e.target.value)}
                                                className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Optional Fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="creditScore" className="text-sm font-medium text-gray-700">
                                                Credit Score (Optional)
                                            </Label>
                                            <Input
                                                id="creditScore"
                                                type="number"
                                                min="300"
                                                max="850"
                                                value={formData.creditScore}
                                                onChange={(e) => handleInputChange("creditScore", e.target.value)}
                                                className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]"
                                                placeholder="e.g., 720"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="collateralType" className="text-sm font-medium text-gray-700">
                                                Collateral Type (Optional)
                                            </Label>
                                            <Select
                                                value={formData.collateralType}
                                                onValueChange={(value) => handleInputChange("collateralType", value)}
                                            >
                                                <SelectTrigger className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]">
                                                    <SelectValue placeholder="Select collateral type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="real-estate">Real Estate</SelectItem>
                                                    <SelectItem value="vehicle">Vehicle</SelectItem>
                                                    <SelectItem value="savings">Savings Account</SelectItem>
                                                    <SelectItem value="investments">Investments</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {formData.collateralType && (
                                        <div className="space-y-2">
                                            <Label htmlFor="collateralValue" className="text-sm font-medium text-gray-700">
                                                Collateral Value ($)
                                            </Label>
                                            <Input
                                                id="collateralValue"
                                                type="number"
                                                min="0"
                                                step="100"
                                                value={formData.collateralValue}
                                                onChange={(e) => handleInputChange("collateralValue", e.target.value)}
                                                className="border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]"
                                            />
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-[#F26623] hover:bg-[#E55A1F] text-white py-3 text-lg font-semibold"
                                    >
                                        {isSubmitting ? "Submitting Application..." : "Submit Loan Application"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {loading ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F26623] mx-auto"></div>
                                    <p className="mt-4 text-gray-600">Loading your loan applications...</p>
                                </div>
                            ) : loans.length === 0 ? (
                                <Card className="text-center py-12">
                                    <CardContent>
                                        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Loan Applications</h3>
                                        <p className="text-gray-600 mb-6">You haven't submitted any loan applications yet.</p>
                                        <Button onClick={() => setShowForm(true)} className="bg-[#F26623] hover:bg-[#E55A1F] text-white">
                                            <Plus className="h-4 w-4 mr-2" />
                                            Apply for a Loan
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid gap-6">
                                    {loans.map((loan) => (
                                        <Card key={loan.id} className="shadow-lg border-0 hover:shadow-xl transition-shadow">
                                            <CardHeader className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] text-white">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <CardTitle className="text-xl">
                                                            ${loan.loan_amount.toLocaleString()} Loan Application
                                                        </CardTitle>
                                                        <CardDescription className="text-orange-100">
                                                            Applied on {new Date(loan.created_at).toLocaleDateString()}
                                                        </CardDescription>
                                                    </div>
                                                    <div
                                                        className={`px-3 py-1 rounded-full border text-sm font-semibold flex items-center gap-2 ${getStatusStyle(loan.status)}`}
                                                    >
                                                        {getStatusIcon(loan.status)}
                                                        {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    <div>
                                                        <p className="text-sm text-gray-600">Purpose</p>
                                                        <p className="font-semibold">{loan.loan_purpose}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600">Employment</p>
                                                        <p className="font-semibold">{loan.employment_status.replace("-", " ")}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-gray-600">Monthly Income</p>
                                                        <p className="font-semibold">${loan.monthly_income.toLocaleString()}</p>
                                                    </div>
                                                    {loan.credit_score && (
                                                        <div>
                                                            <p className="text-sm text-gray-600">Credit Score</p>
                                                            <p className="font-semibold">{loan.credit_score}</p>
                                                        </div>
                                                    )}
                                                    {loan.collateral_type && (
                                                        <div>
                                                            <p className="text-sm text-gray-600">Collateral</p>
                                                            <p className="font-semibold">{loan.collateral_type.replace("-", " ")}</p>
                                                        </div>
                                                    )}
                                                    {loan.collateral_value && (
                                                        <div>
                                                            <p className="text-sm text-gray-600">Collateral Value</p>
                                                            <p className="font-semibold">${loan.collateral_value.toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {loan.status === "pending" && (
                                                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                        <p className="text-sm text-yellow-800">
                                                            <Clock className="h-4 w-4 inline mr-2" />
                                                            Your application is under review. We'll notify you once a decision is made.
                                                        </p>
                                                    </div>
                                                )}

                                                {loan.status === "approved" && (
                                                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                                        <p className="text-sm text-green-800">
                                                            <CheckCircle className="h-4 w-4 inline mr-2" />
                                                            Congratulations! Your loan has been approved. You'll receive further instructions soon.
                                                        </p>
                                                    </div>
                                                )}

                                                {loan.status === "rejected" && (
                                                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                                        <p className="text-sm text-red-800">
                                                            <XCircle className="h-4 w-4 inline mr-2" />
                                                            Unfortunately, your loan application was not approved at this time.
                                                        </p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
