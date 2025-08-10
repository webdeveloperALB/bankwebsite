"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  ArrowUpDown,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Clock,
  Shield,
  Building2,
  Filter,
  Download,
  Search,
  Banknote,
  ArrowLeftRight,
  ArrowUp,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import type { Database } from "@/lib/supabase"

type User = Database["public"]["Tables"]["users"]["Row"]
type Transaction = Database["public"]["Tables"]["transactions"]["Row"]
type Balance = Database["public"]["Tables"]["balances"]["Row"]

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF"]

export default function TransactionsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState<"main" | "transfer" | "inside-bank" | "outside-bank" | "withdrawal">(
    "main",
  )

  // Form states
  const [transferType, setTransferType] = useState<"inside" | "outside">("inside")
  const [fromCurrency, setFromCurrency] = useState("")
  const [toCurrency, setToCurrency] = useState("")
  const [amount, setAmount] = useState("")

  // Outside bank transfer fields
  const [beneficiaryName, setBeneficiaryName] = useState("")
  const [beneficiaryBank, setBeneficiaryBank] = useState("")
  const [beneficiaryIban, setBeneficiaryIban] = useState("")
  const [beneficiarySwift, setBeneficiarySwift] = useState("")
  const [beneficiaryAddress, setBeneficiaryAddress] = useState("")
  const [transferCurrency, setTransferCurrency] = useState("")

  useEffect(() => {
    let pollInterval: NodeJS.Timeout

    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) return

        setUser(currentUser)

        // Load transactions
        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("*")
          .or(`user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
          .order("created_at", { ascending: false })

        setTransactions(transactionsData || [])

        // Load user balances
        const { data: balancesData } = await supabase.from("balances").select("*").eq("user_id", currentUser.id)

        setBalances(balancesData || [])

        // Set up real-time subscription
        const channel = supabase
          .channel("transactions")
          .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
            // Reload transactions
            supabase
              .from("transactions")
              .select("*")
              .or(`user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
              .order("created_at", { ascending: false })
              .then(({ data }) => setTransactions(data || []))
          })
          .subscribe()

        // Set up polling every second to check for changes
        pollInterval = setInterval(async () => {
          try {
            // Reload transactions
            const { data: transactionsData } = await supabase
              .from("transactions")
              .select("*")
              .or(`user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
              .order("created_at", { ascending: false })

            setTransactions(transactionsData || [])

            // Reload balances
            const { data: balancesData } = await supabase.from("balances").select("*").eq("user_id", currentUser.id)

            setBalances(balancesData || [])
          } catch (error) {
            console.error("Error polling for updates:", error)
          }
        }, 1000) // Poll every 1 second

        return () => {
          supabase.removeChannel(channel)
          if (pollInterval) {
            clearInterval(pollInterval)
          }
        }
      } catch (error) {
        console.error("Error loading transactions:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Cleanup function for the useEffect
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [])

  const handleDeposit = () => {
    router.push("/dashboard/deposits")
  }

  const generatePDFStatement = async () => {
    if (!user || !transactions.length) {
      alert("No data available for export")
      return
    }

    try {
      // Import jsPDF and autoTable
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      // Create new PDF document
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.width
      const pageHeight = doc.internal.pageSize.height

      // Header Section
      doc.setFillColor(242, 102, 35) // Orange color
      doc.rect(0, 0, pageWidth, 40, "F")

      // Bank Logo/Name
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(24)
      doc.setFont("helvetica", "bold")
      doc.text("Anchor Investments", 20, 25)

      // Statement Title
      doc.setFontSize(16)
      doc.text("Account Statement", pageWidth - 20, 25, { align: "right" })

      // Reset text color
      doc.setTextColor(0, 0, 0)

      // User Information Section
      let yPos = 60
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("Account Holder:", 20, yPos)
      doc.setFont("helvetica", "normal")
      doc.text(user.name, 80, yPos)

      yPos += 8
      doc.setFont("helvetica", "bold")
      doc.text("Account ID:", 20, yPos)
      doc.setFont("helvetica", "normal")
      doc.text(user.id.slice(0, 12), 80, yPos)

      yPos += 8
      doc.setFont("helvetica", "bold")
      doc.text("Email:", 20, yPos)
      doc.setFont("helvetica", "normal")
      doc.text(user.email, 80, yPos)

      yPos += 8
      doc.setFont("helvetica", "bold")
      doc.text("Export Date:", 20, yPos)
      doc.setFont("helvetica", "normal")
      doc.text(new Date().toLocaleDateString(), 80, yPos)

      // Summary Section
      yPos += 20
      doc.setFillColor(248, 249, 250)
      doc.rect(15, yPos - 5, pageWidth - 30, 50, "F")

      doc.setFont("helvetica", "bold")
      doc.setFontSize(14)
      doc.text("Account Summary", 20, yPos + 5)

      yPos += 15
      doc.setFontSize(10)

      // Calculate totals
      const totalTransactions = transactions.length
      const totalDeposits = transactions
        .filter((t) => t.type === "deposit" || (t.type === "transfer" && t.to_user_id === user.id))
        .reduce((sum, t) => sum + Number(t.amount), 0)
      const totalWithdrawals = transactions
        .filter((t) => t.type === "withdrawal" || (t.type === "transfer" && t.user_id === user.id))
        .reduce((sum, t) => sum + Number(t.amount), 0)

      // Left side - Transaction summary
      doc.text(`Total Transactions: ${totalTransactions}`, 20, yPos)
      doc.text(`Total Deposits: $${totalDeposits.toFixed(2)}`, 20, yPos + 8)
      doc.text(`Total Withdrawals: $${totalWithdrawals.toFixed(2)}`, 20, yPos + 16)

      // Right side - Current Balances (aligned horizontally)
      doc.setFont("helvetica", "bold")
      doc.text("Current Balances:", 120, yPos)
      doc.setFont("helvetica", "normal")
      balances.forEach((balance, index) => {
        doc.text(`${balance.currency}: ${Number(balance.amount).toFixed(2)}`, 120, yPos + 8 + index * 8)
      })

      // Transaction History Table
      yPos += 60

      const tableColumns = ["Date/Time", "Type", "Amount", "Currency", "Status", "Notes"]
      const tableRows = transactions.map((transaction) => {
        const isIncoming = transaction.type === "deposit" || transaction.to_user_id === user.id
        const sign = isIncoming ? "+" : "-"
        const amount = `${sign}${Number(transaction.amount).toFixed(2)}`

        let transactionType = transaction.type
        if (transaction.type === "transfer") {
          if (transaction.transaction_subtype === "inside_bank") {
            transactionType = "Currency Conv."
          } else if (transaction.transaction_subtype === "outside_bank") {
            transactionType = "External Transfer"
          }
        }

        const notes =
          transaction.beneficiary_name ||
          (transaction.transaction_subtype === "inside_bank"
            ? `${transaction.from_currency} to ${transaction.to_currency}`
            : "-")

        return [
          new Date(transaction.created_at).toLocaleString(),
          transactionType,
          amount,
          transaction.currency,
          transaction.status || "Completed",
          notes,
        ]
      })

      // Use autoTable function with proper typing
      autoTable(doc as any, {
        head: [tableColumns],
        body: tableRows,
        startY: yPos,
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [242, 102, 35],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250],
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 25 },
          2: { cellWidth: 20 },
          3: { cellWidth: 15 },
          4: { cellWidth: 20 },
          5: { cellWidth: 35 },
        },
      })

      // Footer
      const finalY = (doc as any).lastAutoTable?.finalY || yPos + 100

      if (finalY > pageHeight - 60) {
        doc.addPage()
        yPos = 30
      } else {
        yPos = finalY + 20
      }

      doc.setFillColor(242, 102, 35)
      doc.rect(0, yPos, pageWidth, 40, "F")

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(
        "This statement is generated electronically and is valid without a signature.",
        pageWidth / 2,
        yPos + 15,
        {
          align: "center",
        },
      )
      doc.text("For support contact: support@AnchorGroupInvestments.com | Phone: +1 (555) 123-4567", pageWidth / 2, yPos + 25, {
        align: "center",
      })

      // Save the PDF
      const fileName = `Account_Statement_${user.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
      doc.save(fileName)

      alert("PDF statement generated successfully!")
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  const handleInsideBankTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !amount || !fromCurrency || !toCurrency) return

    setSending(true)

    try {
      const transferAmount = Number(amount)

      // Check if user has sufficient balance
      const userBalance = balances.find((b) => b.currency === fromCurrency)
      if (!userBalance || Number(userBalance.amount) < transferAmount) {
        alert("Insufficient balance")
        return
      }

      // Create transaction record with pending status
      const { error: transactionError } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "transfer",
        transaction_subtype: "inside_bank",
        currency: fromCurrency,
        amount: transferAmount,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        status: "pending",
        notes: `Currency conversion from ${fromCurrency} to ${toCurrency}`,
      })

      if (transactionError) throw transactionError

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: `Requested currency conversion: ${transferAmount} ${fromCurrency} to ${toCurrency}`,
      })

      resetForm()
      alert("Transfer request submitted for approval")
    } catch (error) {
      console.error("Error creating transfer:", error)
      alert("Transfer failed. Please try again.")
    } finally {
      setSending(false)
    }
  }

  const handleOutsideBankTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !amount || !transferCurrency || !beneficiaryName || !beneficiaryBank) return

    setSending(true)

    try {
      const transferAmount = Number(amount)

      // Check if user has sufficient balance
      const userBalance = balances.find((b) => b.currency === transferCurrency)
      if (!userBalance || Number(userBalance.amount) < transferAmount) {
        alert("Insufficient balance")
        return
      }

      // Create transaction record with pending status
      const { error: transactionError } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "transfer",
        transaction_subtype: "outside_bank",
        currency: transferCurrency,
        amount: transferAmount,
        beneficiary_name: beneficiaryName,
        beneficiary_bank: beneficiaryBank,
        beneficiary_iban: beneficiaryIban,
        beneficiary_swift: beneficiarySwift,
        beneficiary_address: beneficiaryAddress,
        status: "pending",
        notes: `External bank transfer to ${beneficiaryName}`,
      })

      if (transactionError) throw transactionError

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: `Requested external bank transfer: ${transferAmount} ${transferCurrency} to ${beneficiaryName}`,
      })

      resetForm()
      alert("External transfer request submitted for approval")
    } catch (error) {
      console.error("Error creating transfer:", error)
      alert("Transfer failed. Please try again.")
    } finally {
      setSending(false)
    }
  }

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !amount || !transferCurrency || !beneficiaryName || !beneficiaryBank) return

    setSending(true)

    try {
      const withdrawalAmount = Number(amount)

      // Check if user has sufficient balance
      const userBalance = balances.find((b) => b.currency === transferCurrency)
      if (!userBalance || Number(userBalance.amount) < withdrawalAmount) {
        alert("Insufficient balance")
        return
      }

      // Create transaction record with pending status
      const { error: transactionError } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "withdrawal",
        currency: transferCurrency,
        amount: withdrawalAmount,
        beneficiary_name: beneficiaryName,
        beneficiary_bank: beneficiaryBank,
        beneficiary_iban: beneficiaryIban,
        beneficiary_swift: beneficiarySwift,
        beneficiary_address: beneficiaryAddress,
        status: "pending",
        notes: `Withdrawal to ${beneficiaryName}`,
      })

      if (transactionError) throw transactionError

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: `Requested withdrawal: ${withdrawalAmount} ${transferCurrency} to ${beneficiaryName}`,
      })

      resetForm()
      alert("Withdrawal request submitted for approval")
    } catch (error) {
      console.error("Error creating withdrawal:", error)
      alert("Withdrawal failed. Please try again.")
    } finally {
      setSending(false)
    }
  }

  const resetForm = () => {
    setCurrentStep("main")
    setTransferType("inside")
    setFromCurrency("")
    setToCurrency("")
    setAmount("")
    setBeneficiaryName("")
    setBeneficiaryBank("")
    setBeneficiaryIban("")
    setBeneficiarySwift("")
    setBeneficiaryAddress("")
    setTransferCurrency("")
    setDialogOpen(false)
  }

  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type === "deposit") {
      return <ArrowDownLeft className="h-5 w-5 text-green-600" />
    } else if (transaction.type === "transfer") {
      if (transaction.user_id === user?.id) {
        return <ArrowUpRight className="h-5 w-5 text-red-600" />
      } else {
        return <ArrowDownLeft className="h-5 w-5 text-green-600" />
      }
    } else if (transaction.type === "withdrawal") {
      return <ArrowUp className="h-5 w-5 text-red-600" />
    }
    return <ArrowUpDown className="h-5 w-5 text-gray-600" />
  }

  const getTransactionDescription = (transaction: Transaction) => {
    if (transaction.type === "deposit") {
      return "Account Deposit"
    } else if (transaction.type === "transfer") {
      if (transaction.transaction_subtype === "inside_bank") {
        return "Currency Conversion"
      } else if (transaction.transaction_subtype === "outside_bank") {
        return "External Bank Transfer"
      } else if (transaction.user_id === user?.id) {
        return "Outgoing Transfer"
      } else {
        return "Incoming Transfer"
      }
    } else if (transaction.type === "withdrawal") {
      return "Withdrawal"
    }
    return transaction.type
  }

  const getTransactionAmount = (transaction: Transaction) => {
    const isIncoming = transaction.type === "deposit" || transaction.to_user_id === user?.id
    const sign = isIncoming ? "+" : "-"
    const colorClass = isIncoming ? "text-green-600" : "text-red-600"

    return {
      sign,
      colorClass,
      amount: Number(transaction.amount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
      }),
    }
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
      case "completed":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const renderDialogContent = () => {
    if (currentStep === "main") {
      return (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-[#F26623] text-xl font-bold flex items-center">
              <Send className="h-5 w-5 mr-2" />
              Send Money
            </DialogTitle>
            <DialogDescription className="text-gray-600">Choose your transaction type</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Button
              onClick={handleDeposit}
              className="flex items-center justify-start p-6 h-auto bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-2 border-green-200 text-green-800"
              variant="outline"
            >
              <Banknote className="h-8 w-8 mr-4 text-green-600" />
              <div className="text-left">
                <div className="font-semibold text-lg">Deposit</div>
                <div className="text-sm text-green-600">Add money to your account</div>
              </div>
            </Button>

            <Button
              onClick={() => setCurrentStep("transfer")}
              className="flex items-center justify-start p-6 h-auto bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-200 text-blue-800"
              variant="outline"
            >
              <ArrowLeftRight className="h-8 w-8 mr-4 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold text-lg">Transfer</div>
                <div className="text-sm text-blue-600">Send money to banks or convert currency</div>
              </div>
            </Button>

            <Button
              onClick={() => setCurrentStep("withdrawal")}
              className="flex items-center justify-start p-6 h-auto bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border-2 border-red-200 text-red-800"
              variant="outline"
            >
              <ArrowUp className="h-8 w-8 mr-4 text-red-600" />
              <div className="text-left">
                <div className="font-semibold text-lg">Withdrawal</div>
                <div className="text-sm text-red-600">Withdraw money to your bank account</div>
              </div>
            </Button>
          </div>
        </div>
      )
    }

    if (currentStep === "transfer") {
      return (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-[#F26623] text-xl font-bold flex items-center">
              <ArrowLeftRight className="h-5 w-5 mr-2" />
              Transfer Options
            </DialogTitle>
            <DialogDescription className="text-gray-600">Choose your transfer type</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Button
              onClick={() => setCurrentStep("inside-bank")}
              className="flex items-center justify-start p-6 h-auto bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border-2 border-purple-200 text-purple-800"
              variant="outline"
            >
              <ArrowLeftRight className="h-8 w-8 mr-4 text-purple-600" />
              <div className="text-left">
                <div className="font-semibold text-lg">Inside Bank</div>
                <div className="text-sm text-purple-600">Convert between your currencies</div>
              </div>
            </Button>

            <Button
              onClick={() => setCurrentStep("outside-bank")}
              className="flex items-center justify-start p-6 h-auto bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 border-2 border-orange-200 text-orange-800"
              variant="outline"
            >
              <Building2 className="h-8 w-8 mr-4 text-orange-600" />
              <div className="text-left">
                <div className="font-semibold text-lg">Outside Bank</div>
                <div className="text-sm text-orange-600">Transfer to external bank account</div>
              </div>
            </Button>
          </div>

          <Button onClick={() => setCurrentStep("main")} variant="outline" className="w-full">
            Back
          </Button>
        </div>
      )
    }

    if (currentStep === "inside-bank") {
      return (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-[#F26623] text-xl font-bold flex items-center">
              <ArrowLeftRight className="h-5 w-5 mr-2" />
              Currency Conversion
            </DialogTitle>
            <DialogDescription className="text-gray-600">Convert between your account currencies</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInsideBankTransfer} className="space-y-4">
            <div className="space-y-2">
              <Label>From Currency</Label>
              <Select value={fromCurrency} onValueChange={setFromCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency to convert from" />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((balance) => (
                    <SelectItem key={balance.id} value={balance.currency}>
                      {balance.currency} (Available: {Number(balance.amount).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>To Currency</Label>
              <Select value={toCurrency} onValueChange={setToCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency to convert to" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.filter((curr) => curr !== fromCurrency).map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
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

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                This transaction requires admin approval and may take 1-2 business days to process.
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={() => setCurrentStep("transfer")} variant="outline" className="flex-1">
                Back
              </Button>
              <Button type="submit" className="flex-1 bg-gradient-to-r from-[#F26623] to-[#E55A1F]" disabled={sending}>
                {sending ? "Processing..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </div>
      )
    }

    if (currentStep === "outside-bank") {
      return (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-[#F26623] text-xl font-bold flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              External Bank Transfer
            </DialogTitle>
            <DialogDescription className="text-gray-600">Transfer money to an external bank account</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleOutsideBankTransfer} className="space-y-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={transferCurrency} onValueChange={setTransferCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((balance) => (
                    <SelectItem key={balance.id} value={balance.currency}>
                      {balance.currency} (Available: {Number(balance.amount).toFixed(2)})
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

            <div className="space-y-2">
              <Label>Beneficiary Name</Label>
              <Input
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                placeholder="Full name of recipient"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={beneficiaryBank}
                onChange={(e) => setBeneficiaryBank(e.target.value)}
                placeholder="Name of recipient's bank"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input
                value={beneficiaryIban}
                onChange={(e) => setBeneficiaryIban(e.target.value)}
                placeholder="International Bank Account Number"
              />
            </div>

            <div className="space-y-2">
              <Label>SWIFT Code</Label>
              <Input
                value={beneficiarySwift}
                onChange={(e) => setBeneficiarySwift(e.target.value)}
                placeholder="Bank SWIFT/BIC code"
              />
            </div>

            <div className="space-y-2">
              <Label>Beneficiary Address</Label>
              <Textarea
                value={beneficiaryAddress}
                onChange={(e) => setBeneficiaryAddress(e.target.value)}
                placeholder="Full address of recipient"
                rows={3}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                External transfers require admin approval and may take 3-5 business days to process.
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={() => setCurrentStep("transfer")} variant="outline" className="flex-1">
                Back
              </Button>
              <Button type="submit" className="flex-1 bg-gradient-to-r from-[#F26623] to-[#E55A1F]" disabled={sending}>
                {sending ? "Processing..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </div>
      )
    }

    if (currentStep === "withdrawal") {
      return (
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-[#F26623] text-xl font-bold flex items-center">
              <ArrowUp className="h-5 w-5 mr-2" />
              Withdrawal Request
            </DialogTitle>
            <DialogDescription className="text-gray-600">Withdraw money to your bank account</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWithdrawal} className="space-y-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={transferCurrency} onValueChange={setTransferCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((balance) => (
                    <SelectItem key={balance.id} value={balance.currency}>
                      {balance.currency} (Available: {Number(balance.amount).toFixed(2)})
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

            <div className="space-y-2">
              <Label>Account Holder Name</Label>
              <Input
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                placeholder="Your full name as on bank account"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={beneficiaryBank}
                onChange={(e) => setBeneficiaryBank(e.target.value)}
                placeholder="Name of your bank"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input
                value={beneficiaryIban}
                onChange={(e) => setBeneficiaryIban(e.target.value)}
                placeholder="Your International Bank Account Number"
              />
            </div>

            <div className="space-y-2">
              <Label>SWIFT Code</Label>
              <Input
                value={beneficiarySwift}
                onChange={(e) => setBeneficiarySwift(e.target.value)}
                placeholder="Your bank's SWIFT/BIC code"
              />
            </div>

            <div className="space-y-2">
              <Label>Your Address</Label>
              <Textarea
                value={beneficiaryAddress}
                onChange={(e) => setBeneficiaryAddress(e.target.value)}
                placeholder="Your full address"
                rows={3}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                Withdrawal requests require admin approval and may take 2-3 business days to process.
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={() => setCurrentStep("main")} variant="outline" className="flex-1">
                Back
              </Button>
              <Button type="submit" className="flex-1 bg-gradient-to-r from-[#F26623] to-[#E55A1F]" disabled={sending}>
                {sending ? "Processing..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </div>
      )
    }
  }

  return (
    <DashboardLayout currentSection="transactions">
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
        {/* Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#F26623] via-[#E55A1F] to-[#D94E1A] rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute top-0 right-0 w-32 sm:w-48 md:w-64 h-32 sm:h-48 md:h-64 bg-white/10 rounded-full -translate-y-16 sm:-translate-y-24 md:-translate-y-32 translate-x-16 sm:translate-x-24 md:translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-24 sm:w-36 md:w-48 h-24 sm:h-36 md:h-48 bg-white/5 rounded-full translate-y-12 sm:translate-y-18 md:translate-y-24 -translate-x-12 sm:-translate-x-18 md:-translate-x-24"></div>

          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6 mb-6">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 sm:p-4">
                  <ArrowUpDown className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Transaction Center</h1>
                  <p className="text-xs sm:text-white lg:text-lg font-medium">
                    <span className="hidden sm:inline">Secure banking transactions and transfer management</span>
                    <span className="sm:hidden">Banking transactions</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={generatePDFStatement}
                  variant="outline"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white backdrop-blur-sm font-semibold"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Export Statement</span>
                  <span className="sm:hidden">Export</span>
                </Button>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-white text-[#F26623] hover:bg-gray-100 font-semibold shadow-lg">
                      <Send className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Send Money</span>
                      <span className="sm:hidden">Send</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    {renderDialogContent()}
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Transaction Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <ArrowUpDown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">Total Transactions</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">{transactions.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">Pending</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {transactions.filter((t) => t.status === "pending").length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">Completed</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {transactions.filter((t) => t.status === "completed" || t.status === "approved").length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <Card className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#F26623]/10">
          <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 rounded-full p-3">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-2xl font-bold text-white">Transaction History</CardTitle>
                  <CardDescription className="text-orange-100">
                    <span className="hidden sm:inline">Complete record of all your banking transactions</span>
                    <span className="sm:hidden">Your transaction history</span>
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white backdrop-blur-sm"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Filter</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white backdrop-blur-sm"
                >
                  <Search className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Search</span>
                </Button>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-gradient-to-r from-[#F26623]/5 to-[#E55A1F]/10 rounded-xl p-6 border border-[#F26623]/10"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-[#F26623]/20 rounded-full"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-[#F26623]/20 rounded w-32"></div>
                          <div className="h-3 bg-[#F26623]/10 rounded w-24"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-5 bg-[#F26623]/20 rounded w-20"></div>
                        <div className="h-3 bg-[#F26623]/10 rounded w-16"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.map((transaction) => {
                  const { sign, colorClass, amount } = getTransactionAmount(transaction)

                  return (
                    <div
                      key={transaction.id}
                      className="bg-gradient-to-r from-[#F26623]/5 to-[#E55A1F]/10 rounded-xl p-6 border-2 border-[#F26623]/10 hover:border-[#F26623]/30 transition-all duration-300 hover:shadow-lg"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                        <div className="flex items-center space-x-4">
                          <div className="bg-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg">
                            {getTransactionIcon(transaction)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-gray-900 text-base sm:text-lg">
                                {getTransactionDescription(transaction)}
                              </p>
                              {getStatusBadge(transaction.status || "completed")}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <p className="text-sm text-gray-600">
                                {new Date(transaction.created_at).toLocaleString()}
                              </p>
                            </div>
                            {transaction.transaction_subtype && (
                              <div className="bg-[#F26623]/10 text-[#F26623] px-3 py-1 rounded-full text-xs font-semibold inline-block mt-2">
                                {transaction.transaction_subtype === "inside_bank"
                                  ? "Currency Conversion"
                                  : transaction.transaction_subtype === "outside_bank"
                                    ? "External Transfer"
                                    : transaction.transaction_subtype}
                              </div>
                            )}
                            {transaction.beneficiary_name && (
                              <p className="text-xs text-gray-500 mt-1">To: {transaction.beneficiary_name}</p>
                            )}
                            <div className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold inline-block mt-2">
                              ID: {transaction.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                        <div className="text-right sm:text-left">
                          <p className={`text-xl sm:text-2xl font-bold ${colorClass} mb-1`}>
                            {sign}
                            {amount}
                          </p>
                          <div className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold inline-block">
                            {transaction.currency}
                          </div>
                          <div className="flex items-center justify-end sm:justify-start mt-2">
                            <Shield className="h-3 w-3 text-green-500 mr-1" />
                            <span className="text-xs text-green-600 font-medium">Verified</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-[#F26623]/10 to-[#E55A1F]/20 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-8">
                  <ArrowUpDown className="h-16 w-16 text-[#F26623]" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">No Transactions Yet</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Your transaction history will appear here once you start making transfers, deposits, or withdrawals
                </p>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] hover:from-[#E55A1F] hover:to-[#D94E1A] text-white font-semibold px-8 py-4 text-base sm:text-lg">
                      <Send className="h-5 w-5 mr-2" />
                      Start Your First Transaction
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
