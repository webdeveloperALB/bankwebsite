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
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Building2,
  Search,
  Filter,
  Receipt,
  Calculator,
} from "lucide-react"
import type { Database } from "@/lib/supabase"

type User = Database["public"]["Tables"]["users"]["Row"]
type Tax = Database["public"]["Tables"]["taxes"]["Row"] & {
  users?: { name: string; email: string }
}

export default function TaxesTab() {
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTax, setEditingTax] = useState<Tax | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Form state
  const [selectedUser, setSelectedUser] = useState("")
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString())
  const [taxStatus, setTaxStatus] = useState("pending")

  // Enhanced form state
  const [assessmentType, setAssessmentType] = useState("annual")
  const [priorityLevel, setPriorityLevel] = useState("standard")
  const [periodFrom, setPeriodFrom] = useState("")
  const [periodTo, setPeriodTo] = useState("")
  const [employmentIncome, setEmploymentIncome] = useState("")
  const [businessIncome, setBusinessIncome] = useState("")
  const [investmentIncome, setInvestmentIncome] = useState("")
  const [otherIncome, setOtherIncome] = useState("")
  const [standardDeduction, setStandardDeduction] = useState("")
  const [itemizedDeductions, setItemizedDeductions] = useState("")
  const [taxCredits, setTaxCredits] = useState("")
  const [taxRate, setTaxRate] = useState("15")
  const [filingStatus, setFilingStatus] = useState("")
  const [dependents, setDependents] = useState("")
  const [preparedBy, setPreparedBy] = useState("")
  const [reviewDate, setReviewDate] = useState("")
  const [assessmentNotes, setAssessmentNotes] = useState("")
  const [complianceNotes, setComplianceNotes] = useState("")
  const [dueDate, setDueDate] = useState("")

  useEffect(() => {
    const loadData = async () => {
      // Load taxes with user info
      const { data: taxesData } = await supabase
        .from("taxes")
        .select(
          `
          *,
          users!inner(name, email)
        `,
        )
        .order("created_at", { ascending: false })

      // Load users
      const { data: usersData } = await supabase.from("users").select("*").neq("role", "admin").order("name")

      setTaxes(taxesData || [])
      setUsers(usersData || [])
      setLoading(false)
    }

    loadData()

    // Real-time subscription
    const channel = supabase
      .channel("admin_taxes")
      .on("postgres_changes", { event: "*", schema: "public", table: "taxes" }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      // Calculate totals
      const grossIncome =
        (Number.parseFloat(employmentIncome) || 0) +
        (Number.parseFloat(businessIncome) || 0) +
        (Number.parseFloat(investmentIncome) || 0) +
        (Number.parseFloat(otherIncome) || 0)

      const totalDeductions = Math.max(
        Number.parseFloat(standardDeduction) || 0,
        Number.parseFloat(itemizedDeductions) || 0,
      )

      const taxableIncome = Math.max(0, grossIncome - totalDeductions)
      const calculatedTax = Math.max(
        0,
        taxableIncome * (Number.parseFloat(taxRate) / 100) - (Number.parseFloat(taxCredits) || 0),
      )

      if (editingTax) {
        // Update existing tax
        const { error } = await supabase
          .from("taxes")
          .update({
            year: Number.parseInt(taxYear),
            amount: calculatedTax,
            status: taxStatus,
            assessment_type: assessmentType,
            priority_level: priorityLevel,
            assessment_period_from: periodFrom || null,
            assessment_period_to: periodTo || null,
            employment_income: Number.parseFloat(employmentIncome) || 0,
            business_income: Number.parseFloat(businessIncome) || 0,
            investment_income: Number.parseFloat(investmentIncome) || 0,
            other_income: Number.parseFloat(otherIncome) || 0,
            standard_deduction: Number.parseFloat(standardDeduction) || 0,
            itemized_deductions: Number.parseFloat(itemizedDeductions) || 0,
            tax_credits: Number.parseFloat(taxCredits) || 0,
            tax_rate: Number.parseFloat(taxRate),
            taxable_income: taxableIncome,
            gross_income: grossIncome,
            prepared_by: preparedBy || null,
            review_date: reviewDate || null,
            assessment_notes: assessmentNotes || null,
            compliance_notes: complianceNotes || null,
            filing_status: filingStatus || null,
            dependents: Number.parseInt(dependents) || 0,
            due_date: dueDate || null,
          })
          .eq("id", editingTax.id)

        if (error) throw error

        // Log activity
        await supabase.from("activity_logs").insert({
          user_id: editingTax.user_id,
          activity: `Professional tax assessment updated for ${taxYear}: $${calculatedTax.toFixed(2)} (${taxStatus})`,
        })
      } else {
        // Create new tax
        const { error } = await supabase.from("taxes").insert({
          user_id: selectedUser,
          year: Number.parseInt(taxYear),
          amount: calculatedTax,
          status: taxStatus,
          assessment_type: assessmentType,
          priority_level: priorityLevel,
          assessment_period_from: periodFrom || null,
          assessment_period_to: periodTo || null,
          employment_income: Number.parseFloat(employmentIncome) || 0,
          business_income: Number.parseFloat(businessIncome) || 0,
          investment_income: Number.parseFloat(investmentIncome) || 0,
          other_income: Number.parseFloat(otherIncome) || 0,
          standard_deduction: Number.parseFloat(standardDeduction) || 0,
          itemized_deductions: Number.parseFloat(itemizedDeductions) || 0,
          tax_credits: Number.parseFloat(taxCredits) || 0,
          tax_rate: Number.parseFloat(taxRate),
          taxable_income: taxableIncome,
          gross_income: grossIncome,
          prepared_by: preparedBy || null,
          review_date: reviewDate || null,
          assessment_notes: assessmentNotes || null,
          compliance_notes: complianceNotes || null,
          filing_status: filingStatus || null,
          dependents: Number.parseInt(dependents) || 0,
          due_date: dueDate || null,
        })

        if (error) throw error

        // Log activity
        await supabase.from("activity_logs").insert({
          user_id: selectedUser,
          activity: `Professional tax assessment created for ${taxYear}: $${calculatedTax.toFixed(2)} (${taxStatus})`,
        })
      }

      resetForm()
    } catch (error) {
      console.error("Error saving tax:", error)
    }
  }

  const deleteTax = async (tax: Tax) => {
    if (!confirm(`Are you sure you want to delete the ${tax.year} tax record for ${tax.users?.name}?`)) return

    const { error } = await supabase.from("taxes").delete().eq("id", tax.id)

    if (error) {
      console.error("Error deleting tax:", error)
    } else {
      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: tax.user_id,
        activity: `Tax record deleted for ${tax.year}`,
      })
    }
  }

  const updateTaxStatus = async (taxId: string, newStatus: string, userId: string, year: number) => {
    const { error } = await supabase.from("taxes").update({ status: newStatus }).eq("id", taxId)

    if (error) {
      console.error("Error updating tax status:", error)
    } else {
      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: userId,
        activity: `Tax status updated for ${year}: ${newStatus}`,
      })
    }
  }

  const resetForm = () => {
    setSelectedUser("")
    setTaxYear(new Date().getFullYear().toString())
    setTaxStatus("pending")
    setAssessmentType("annual")
    setPriorityLevel("standard")
    setPeriodFrom("")
    setPeriodTo("")
    setEmploymentIncome("")
    setBusinessIncome("")
    setInvestmentIncome("")
    setOtherIncome("")
    setStandardDeduction("")
    setItemizedDeductions("")
    setTaxCredits("")
    setTaxRate("15")
    setFilingStatus("")
    setDependents("")
    setPreparedBy("")
    setReviewDate("")
    setAssessmentNotes("")
    setComplianceNotes("")
    setDueDate("")
    setEditingTax(null)
    setDialogOpen(false)
  }

  const editTax = (tax: Tax) => {
    setEditingTax(tax)
    setSelectedUser(tax.user_id)
    setTaxYear(tax.year.toString())
    setTaxStatus(tax.status)
    setAssessmentType(tax.assessment_type || "annual")
    setPriorityLevel(tax.priority_level || "standard")
    setPeriodFrom(tax.assessment_period_from || "")
    setPeriodTo(tax.assessment_period_to || "")
    setEmploymentIncome(tax.employment_income?.toString() || "")
    setBusinessIncome(tax.business_income?.toString() || "")
    setInvestmentIncome(tax.investment_income?.toString() || "")
    setOtherIncome(tax.other_income?.toString() || "")
    setStandardDeduction(tax.standard_deduction?.toString() || "")
    setItemizedDeductions(tax.itemized_deductions?.toString() || "")
    setTaxCredits(tax.tax_credits?.toString() || "")
    setTaxRate(tax.tax_rate?.toString() || "15")
    setFilingStatus(tax.filing_status || "")
    setDependents(tax.dependents?.toString() || "")
    setPreparedBy(tax.prepared_by || "")
    setReviewDate(tax.review_date || "")
    setAssessmentNotes(tax.assessment_notes || "")
    setComplianceNotes(tax.compliance_notes || "")
    setDueDate(tax.due_date || "")
    setDialogOpen(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-amber-600" />
      case "filed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "paid":
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case "overdue":
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "filed":
        return "bg-green-50 text-green-700 border-green-200"
      case "paid":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "overdue":
        return "bg-red-50 text-red-700 border-red-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
  }

  // Filter taxes based on search and status
  const filteredTaxes = taxes.filter((tax) => {
    const matchesSearch =
      tax.users?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.users?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.year.toString().includes(searchTerm)
    const matchesStatus = statusFilter === "all" || tax.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalTaxes = taxes.reduce((sum, tax) => sum + Number(tax.amount), 0)
  const currentYear = new Date().getFullYear()

  const stats = {
    total: taxes.length,
    pending: taxes.filter((t) => t.status === "pending").length,
    filed: taxes.filter((t) => t.status === "filed" || t.status === "paid").length,
    currentYear: taxes.filter((t) => t.year === currentYear).length,
    totalAmount: totalTaxes,
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-gray-900">Tax Administration</h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600">Comprehensive tax management and oversight</p>
        </div>

        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
          <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500">
            <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-[#F26623]" />
            <span>Admin Control Panel</span>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => resetForm()}
                className="bg-[#F26623] hover:bg-[#E55A1F] text-white shadow-lg text-sm sm:text-base px-3 py-2 sm:px-4 sm:py-2 h-auto"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Create Professional Tax Assessment</span>
                <span className="sm:hidden">Create Assessment</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {editingTax ? "Edit Professional Tax Assessment" : "Create Professional Tax Assessment"}
                </DialogTitle>
                <DialogDescription>
                  {editingTax
                    ? "Update comprehensive tax assessment for the client"
                    : "Create a comprehensive professional tax assessment for a client"}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Client Information Section */}
                <Card className="border-[#F26623]/20 bg-[#F26623]/5">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-[#F26623]" />
                      <CardTitle className="text-gray-900">Client Information</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-800">Client Account</Label>
                      <Select value={selectedUser} onValueChange={setSelectedUser} disabled={!!editingTax}>
                        <SelectTrigger className="h-11 border-[#F26623]/30">
                          <SelectValue placeholder="Select client account for tax assessment" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-[#F26623]/10 rounded-full flex items-center justify-center">
                                  <span className="text-[#F26623] font-semibold text-xs">
                                    {user.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium">{user.name}</span>
                                  <span className="text-gray-500 ml-2">({user.email})</span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Tax Period & Classification */}
                <Card className="border-green-200 bg-green-50/30">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-green-900">Tax Period & Classification</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-800">Assessment Year</Label>
                        <Input
                          type="number"
                          value={taxYear}
                          onChange={(e) => setTaxYear(e.target.value)}
                          min="2020"
                          max="2030"
                          className="h-11 border-green-200"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-800">Assessment Type</Label>
                        <Select value={assessmentType} onValueChange={setAssessmentType}>
                          <SelectTrigger className="h-11 border-green-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="annual">Annual Assessment</SelectItem>
                            <SelectItem value="quarterly">Quarterly Assessment</SelectItem>
                            <SelectItem value="amended">Amended Return</SelectItem>
                            <SelectItem value="audit">Audit Assessment</SelectItem>
                            <SelectItem value="estimated">Estimated Tax</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-800">Priority Level</Label>
                        <Select value={priorityLevel} onValueChange={setPriorityLevel}>
                          <SelectTrigger className="h-11 border-green-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="high">High Priority</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="audit">Audit Review</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-800">Period From</Label>
                        <Input
                          type="date"
                          value={periodFrom}
                          onChange={(e) => setPeriodFrom(e.target.value)}
                          className="h-11 border-green-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-800">Period To</Label>
                        <Input
                          type="date"
                          value={periodTo}
                          onChange={(e) => setPeriodTo(e.target.value)}
                          className="h-11 border-green-200"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Income Assessment */}
                <Card className="border-purple-200 bg-purple-50/30">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-purple-900">Income Assessment</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-purple-800">Employment Income</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-400" />
                          <Input
                            type="number"
                            step="0.01"
                            value={employmentIncome}
                            onChange={(e) => setEmploymentIncome(e.target.value)}
                            placeholder="0.00"
                            className="h-11 pl-10 border-purple-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-purple-800">Business Income</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-400" />
                          <Input
                            type="number"
                            step="0.01"
                            value={businessIncome}
                            onChange={(e) => setBusinessIncome(e.target.value)}
                            placeholder="0.00"
                            className="h-11 pl-10 border-purple-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-purple-800">Investment Income</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-400" />
                          <Input
                            type="number"
                            step="0.01"
                            value={investmentIncome}
                            onChange={(e) => setInvestmentIncome(e.target.value)}
                            placeholder="0.00"
                            className="h-11 pl-10 border-purple-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-purple-800">Other Income</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-400" />
                          <Input
                            type="number"
                            step="0.01"
                            value={otherIncome}
                            onChange={(e) => setOtherIncome(e.target.value)}
                            placeholder="0.00"
                            className="h-11 pl-10 border-purple-200"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Deductions & Credits */}
                <Card className="border-indigo-200 bg-indigo-50/30">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-2">
                      <Receipt className="h-5 w-5 text-indigo-600" />
                      <CardTitle className="text-indigo-900">Deductions & Credits</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-indigo-800">Standard Deduction</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-indigo-400" />
                          <Input
                            type="number"
                            step="0.01"
                            value={standardDeduction}
                            onChange={(e) => setStandardDeduction(e.target.value)}
                            placeholder="0.00"
                            className="h-11 pl-10 border-indigo-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-indigo-800">Itemized Deductions</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-indigo-400" />
                          <Input
                            type="number"
                            step="0.01"
                            value={itemizedDeductions}
                            onChange={(e) => setItemizedDeductions(e.target.value)}
                            placeholder="0.00"
                            className="h-11 pl-10 border-indigo-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-indigo-800">Tax Credits</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-indigo-400" />
                          <Input
                            type="number"
                            step="0.01"
                            value={taxCredits}
                            onChange={(e) => setTaxCredits(e.target.value)}
                            placeholder="0.00"
                            className="h-11 pl-10 border-indigo-200"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tax Calculation & Status */}
                <Card className="border-rose-200 bg-rose-50/30">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-2">
                      <Calculator className="h-5 w-5 text-rose-600" />
                      <CardTitle className="text-rose-900">Tax Calculation & Status</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-rose-800">Tax Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={taxRate}
                          onChange={(e) => setTaxRate(e.target.value)}
                          placeholder="15.00"
                          className="h-11 border-rose-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-rose-800">Filing Status</Label>
                        <Select value={filingStatus} onValueChange={setFilingStatus}>
                          <SelectTrigger className="h-11 border-rose-200">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="married_joint">Married Filing Jointly</SelectItem>
                            <SelectItem value="married_separate">Married Filing Separately</SelectItem>
                            <SelectItem value="head_household">Head of Household</SelectItem>
                            <SelectItem value="qualifying_widow">Qualifying Widow(er)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-rose-800">Dependents</Label>
                        <Input
                          type="number"
                          value={dependents}
                          onChange={(e) => setDependents(e.target.value)}
                          placeholder="0"
                          className="h-11 border-rose-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-rose-800">Assessment Status</Label>
                        <Select value={taxStatus} onValueChange={setTaxStatus}>
                          <SelectTrigger className="h-11 border-rose-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending Review</SelectItem>
                            <SelectItem value="filed">Filed</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-rose-800">Due Date</Label>
                        <Input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="h-11 border-rose-200"
                        />
                      </div>
                    </div>

                    {/* Tax Calculation Summary */}
                    {(employmentIncome || businessIncome || investmentIncome || otherIncome) && (
                      <div className="mt-6 p-4 bg-rose-100 rounded-lg border border-rose-200">
                        <h4 className="font-semibold text-rose-900 mb-3">Tax Calculation Summary</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-rose-700">
                              <span className="font-medium">Gross Income:</span> $
                              {(
                                (Number.parseFloat(employmentIncome) || 0) +
                                (Number.parseFloat(businessIncome) || 0) +
                                (Number.parseFloat(investmentIncome) || 0) +
                                (Number.parseFloat(otherIncome) || 0)
                              ).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                            <p className="text-rose-700">
                              <span className="font-medium">Deductions:</span> $
                              {Math.max(
                                Number.parseFloat(standardDeduction) || 0,
                                Number.parseFloat(itemizedDeductions) || 0,
                              ).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-rose-700">
                              <span className="font-medium">Taxable Income:</span> $
                              {Math.max(
                                0,
                                (Number.parseFloat(employmentIncome) || 0) +
                                (Number.parseFloat(businessIncome) || 0) +
                                (Number.parseFloat(investmentIncome) || 0) +
                                (Number.parseFloat(otherIncome) || 0) -
                                Math.max(
                                  Number.parseFloat(standardDeduction) || 0,
                                  Number.parseFloat(itemizedDeductions) || 0,
                                ),
                              ).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                            <p className="text-rose-800 font-semibold">
                              <span className="font-medium">Final Tax Amount:</span> $
                              {Math.max(
                                0,
                                Math.max(
                                  0,
                                  (Number.parseFloat(employmentIncome) || 0) +
                                  (Number.parseFloat(businessIncome) || 0) +
                                  (Number.parseFloat(investmentIncome) || 0) +
                                  (Number.parseFloat(otherIncome) || 0) -
                                  Math.max(
                                    Number.parseFloat(standardDeduction) || 0,
                                    Number.parseFloat(itemizedDeductions) || 0,
                                  ),
                                ) *
                                (Number.parseFloat(taxRate) / 100) -
                                (Number.parseFloat(taxCredits) || 0),
                              ).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Administrative Details */}
                <Card className="border-amber-200 bg-amber-50/30">
                  <CardHeader className="pb-4">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5 text-amber-600" />
                      <CardTitle className="text-amber-900">Administrative Details</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-amber-800">Prepared By</Label>
                        <Input
                          value={preparedBy}
                          onChange={(e) => setPreparedBy(e.target.value)}
                          placeholder="Tax Administrator Name"
                          className="h-11 border-amber-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-amber-800">Review Date</Label>
                        <Input
                          type="date"
                          value={reviewDate}
                          onChange={(e) => setReviewDate(e.target.value)}
                          className="h-11 border-amber-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-amber-800">Assessment Notes</Label>
                      <Textarea
                        value={assessmentNotes}
                        onChange={(e) => setAssessmentNotes(e.target.value)}
                        placeholder="Additional notes about this tax assessment..."
                        rows={3}
                        className="border-amber-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-amber-800">Compliance Notes</Label>
                      <Textarea
                        value={complianceNotes}
                        onChange={(e) => setComplianceNotes(e.target.value)}
                        placeholder="Regulatory compliance notes and audit trail information..."
                        rows={3}
                        className="border-amber-200"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Button
                  type="submit"
                  className="w-full h-12 bg-[#F26623] hover:bg-[#E55A1F] text-lg font-semibold shadow-lg"
                >
                  {editingTax ? "Update Professional Tax Assessment" : "Create Professional Tax Assessment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
        <Card className="border-l-4 border-l-[#F26623]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Total Records</CardTitle>
            <div className="h-6 w-6 sm:h-8 sm:w-8 bg-[#F26623]/10 rounded-full flex items-center justify-center">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-[#F26623]" />
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.total}</div>
            <p className="text-xs text-gray-500 mt-1">All tax records</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Total Amount</CardTitle>
            <div className="h-6 w-6 sm:h-8 sm:w-8 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
              $
              {stats.totalAmount.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">Total collected</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Pending</CardTitle>
            <div className="h-6 w-6 sm:h-8 sm:w-8 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.pending}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting action</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 col-span-2 sm:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Completed</CardTitle>
            <div className="h-6 w-6 sm:h-8 sm:w-8 bg-purple-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.filed}</div>
            <p className="text-xs text-gray-500 mt-1">Filed or paid</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 col-span-2 sm:col-span-3 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">Current Year</CardTitle>
            <div className="h-6 w-6 sm:h-8 sm:w-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.currentYear}</div>
            <p className="text-xs text-gray-500 mt-1">{currentYear} records</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by user name, email, or year..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="filed">Filed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Records */}
      <Card className="shadow-sm">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">
                Tax Records Management
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1">
                {filteredTaxes.length} of {taxes.length} records shown
              </CardDescription>
            </div>
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center justify-between p-4 border-b">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-48"></div>
                          <div className="h-3 bg-gray-200 rounded w-32"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                        <div className="h-6 bg-gray-200 rounded w-20"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredTaxes.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredTaxes.map((tax) => (
                <div key={tax.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">{tax.users?.name}</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-1 space-y-1 sm:space-y-0">
                          <p className="text-xs sm:text-sm text-gray-500">{tax.users?.email}</p>
                          <Separator orientation="vertical" className="h-4 hidden sm:block" />
                          <p className="text-xs sm:text-sm text-gray-500">Year: {tax.year}</p>
                          <Separator orientation="vertical" className="h-4 hidden sm:block" />
                          <p className="text-xs sm:text-sm text-gray-500">
                            Created {new Date(tax.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-6">
                      <div className="text-left sm:text-right">
                        <p className="text-xl sm:text-2xl font-bold text-gray-900">
                          $
                          {Number(tax.amount).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">Tax Amount</p>
                      </div>

                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <Select
                          value={tax.status}
                          onValueChange={(value) => updateTaxStatus(tax.id, value, tax.user_id, tax.year)}
                        >
                          <SelectTrigger className="w-28 sm:w-32 text-xs sm:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="filed">Filed</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>

                        <Badge className={`${getStatusColor(tax.status)} border text-xs`}>
                          {getStatusIcon(tax.status)}
                          <span className="ml-1 capitalize font-medium">{tax.status.replace("_", " ")}</span>
                        </Badge>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editTax(tax)}
                          className="hover:bg-[#F26623]/5 hover:border-[#F26623]/30"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteTax(tax)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || statusFilter !== "all" ? "No matching tax records" : "No tax records yet"}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search criteria or filters"
                  : "Create tax records for your users to get started with tax management"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
