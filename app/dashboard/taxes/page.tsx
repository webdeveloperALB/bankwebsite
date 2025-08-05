"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Calendar,
  DollarSign,
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  Building2,
  Receipt,
  TrendingUp,
  Info,
  Plus,
  Calculator,
  Shield,
  FileCheck,
  Banknote,
  PieChart,
} from "lucide-react";
import { Database } from "@/lib/supabase";
import { convertCurrency } from "@/lib/exchange-rates";

type User = Database["public"]["Tables"]["users"]["Row"];
type Tax = Database["public"]["Tables"]["taxes"]["Row"];
type Balance = Database["public"]["Tables"]["balances"]["Row"];
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

export default function TaxesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filing, setFiling] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Tax filing form state
  const [filingYear, setFilingYear] = useState(
    new Date().getFullYear().toString()
  );
  const [employmentIncome, setEmploymentIncome] = useState("");
  const [businessIncome, setBusinessIncome] = useState("");
  const [investmentIncome, setInvestmentIncome] = useState("");
  const [otherIncome, setOtherIncome] = useState("");
  const [deductions, setDeductions] = useState("");
  const [filingStatus, setFilingStatus] = useState("");
  const [dependents, setDependents] = useState("");
  const [taxComments, setTaxComments] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        setUser(currentUser);

        // Load tax records
        const { data: taxesData } = await supabase
          .from("taxes")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("year", { ascending: false });

        setTaxes(taxesData || []);

        // Load user balances for tax calculation context
        const { data: balancesData } = await supabase
          .from("balances")
          .select("*")
          .eq("user_id", currentUser.id);

        setBalances(balancesData || []);

        // Load transactions for tax year
        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", currentUser.id)
          .gte("created_at", `${new Date().getFullYear()}-01-01`)
          .lte("created_at", `${new Date().getFullYear()}-12-31`);

        setTransactions(transactionsData || []);

        // Set up real-time subscription
        const channel = supabase
          .channel("taxes")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "taxes",
              filter: `user_id=eq.${currentUser.id}`,
            },
            () => {
              // Reload taxes
              supabase
                .from("taxes")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("year", { ascending: false })
                .then(({ data }) => setTaxes(data || []));
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error("Error loading tax data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleTaxFiling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !agreeTerms) return;

    setFiling(true);

    try {
      // Calculate total income
      const totalIncome =
        (parseFloat(employmentIncome) || 0) +
        (parseFloat(businessIncome) || 0) +
        (parseFloat(investmentIncome) || 0) +
        (parseFloat(otherIncome) || 0);

      // Calculate taxable income (after deductions)
      const taxableIncome = Math.max(
        0,
        totalIncome - (parseFloat(deductions) || 0)
      );

      // Calculate tax amount (15% rate as example)
      const taxAmount = taxableIncome * 0.15;

      // Create tax filing request
      const { error } = await supabase.from("taxes").insert({
        user_id: user.id,
        year: parseInt(filingYear),
        amount: taxAmount,
        status: "pending",
      });

      if (error) throw error;

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: `Filed tax return for ${filingYear}: $${taxAmount.toFixed(
          2
        )} (Pending Review)`,
      });

      // Reset form
      setEmploymentIncome("");
      setBusinessIncome("");
      setInvestmentIncome("");
      setOtherIncome("");
      setDeductions("");
      setFilingStatus("");
      setDependents("");
      setTaxComments("");
      setAgreeTerms(false);
      setDialogOpen(false);
    } catch (error) {
      console.error("Error filing tax return:", error);
      alert("Tax filing failed. Please try again or contact support.");
    } finally {
      setFiling(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-amber-600" />;
      case "filed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "paid":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "overdue":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "filed":
        return "bg-green-50 text-green-700 border-green-200";
      case "paid":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "overdue":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const currentYear = new Date().getFullYear();
  const currentYearTax = taxes.find((t) => t.year === currentYear);
  const totalTaxes = taxes.reduce((sum, tax) => sum + Number(tax.amount), 0);
  const pendingTaxes = taxes.filter((t) => t.status === "pending").length;
  const completedTaxes = taxes.filter(
    (t) => t.status === "filed" || t.status === "paid"
  ).length;

  // Calculate account summary for tax context
  const totalAccountValue = balances.reduce((sum, balance) => {
    return (
      sum + convertCurrency(Number(balance.amount), balance.currency, "USD")
    );
  }, 0);

  const yearlyTransactionVolume = transactions.reduce((sum, transaction) => {
    return (
      sum +
      convertCurrency(Number(transaction.amount), transaction.currency, "USD")
    );
  }, 0);

  return (
    <DashboardLayout currentSection="taxes">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Tax Center
            </h1>
            <p className="text-lg text-gray-600">
              Comprehensive tax management and reporting
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Building2 className="h-4 w-4" />
            <span>SecureBank Tax Services</span>
          </div>
        </div>

        {/* Tax Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Current Year
              </CardTitle>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                $
                {currentYearTax
                  ? Number(currentYearTax.amount).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })
                  : "0.00"}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tax Year {currentYear}
              </p>
              {currentYearTax && (
                <Badge
                  className={`mt-2 ${getStatusColor(currentYearTax.status)}`}
                >
                  {getStatusIcon(currentYearTax.status)}
                  <span className="ml-1 capitalize">
                    {currentYearTax.status}
                  </span>
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Tax History
              </CardTitle>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                $
                {totalTaxes.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-gray-500 mt-1">All years combined</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Pending Items
              </CardTitle>
              <div className="h-8 w-8 bg-amber-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {pendingTaxes}
              </div>
              <p className="text-xs text-gray-500 mt-1">Require attention</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Completed
              </CardTitle>
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {completedTaxes}
              </div>
              <p className="text-xs text-gray-500 mt-1">Filed or paid</p>
            </CardContent>
          </Card>
        </div>

        {/* Tax Records */}
        <Card className="shadow-sm">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Tax Records
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Annual tax statements and documentation
                </CardDescription>
              </div>
              <Receipt className="h-6 w-6 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center justify-between p-4 border-b">
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                          <div className="h-3 bg-gray-200 rounded w-48"></div>
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
            ) : taxes.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {taxes.map((tax, index) => (
                  <div
                    key={tax.id}
                    className="p-6 hover:bg-gray-50 transition-colors duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                          <FileText className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            Tax Year {tax.year}
                          </h3>
                          <div className="flex items-center space-x-4 mt-1">
                            <p className="text-sm text-gray-500">
                              Filed:{" "}
                              {new Date(tax.created_at).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                }
                              )}
                            </p>
                            <Separator orientation="vertical" className="h-4" />
                            <p className="text-sm text-gray-500">
                              ID: #{tax.id.substring(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">
                            $
                            {Number(tax.amount).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-sm text-gray-500">Tax Amount</p>
                        </div>

                        <div className="flex items-center space-x-3">
                          <Badge
                            className={`${getStatusColor(tax.status)} border`}
                          >
                            {getStatusIcon(tax.status)}
                            <span className="ml-1 capitalize font-medium">
                              {tax.status.replace("_", " ")}
                            </span>
                          </Badge>

                          <Button
                            variant="outline"
                            size="sm"
                            className="hover:bg-blue-50 hover:border-blue-300"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
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
                  No Tax Records Available
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Tax records are created and managed by our tax administration
                  team. You will be notified when new tax documents are
                  available.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tax Information Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-blue-900">
                  Tax Calculation Method
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-blue-200">
                <span className="text-sm font-medium text-blue-800">
                  Tax Rate
                </span>
                <span className="text-sm text-blue-700">
                  15% on transaction volume
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-blue-200">
                <span className="text-sm font-medium text-blue-800">
                  Filing Deadline
                </span>
                <span className="text-sm text-blue-700">
                  April 15th annually
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-blue-800">
                  Processing Time
                </span>
                <span className="text-sm text-blue-700">2-3 business days</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-amber-900">
                  Important Notice
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-800 leading-relaxed">
                Tax records displayed here are for informational purposes and
                are managed by SecureBank&apos;s tax administration team. For
                personalized tax advice and filing requirements, please consult
                with a qualified tax professional or contact our tax support
                team.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                Contact Tax Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
