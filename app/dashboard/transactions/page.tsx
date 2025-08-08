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
import {
  ArrowUpDown,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  TrendingUp,
  DollarSign,
  CreditCard,
  Clock,
  Shield,
  Users,
  Building2,
  Filter,
  Download,
  Search,
  Calendar,
} from "lucide-react";
import { Database } from "@/lib/supabase";
import { convertCurrency, getCurrencyRate } from "@/lib/exchange-rates";

type User = Database["public"]["Tables"]["users"]["Row"];
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Balance = Database["public"]["Tables"]["balances"]["Row"];

export default function TransactionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Transfer form state
  const [transferAmount, setTransferAmount] = useState("");
  const [transferCurrency, setTransferCurrency] = useState("");
  const [transferToUser, setTransferToUser] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        setUser(currentUser);

        // Load transactions
        const { data: transactionsData } = await supabase
          .from("transactions")
          .select("*")
          .or(`user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`)
          .order("created_at", { ascending: false });

        setTransactions(transactionsData || []);

        // Load user balances
        const { data: balancesData } = await supabase
          .from("balances")
          .select("*")
          .eq("user_id", currentUser.id);

        setBalances(balancesData || []);

        // Load other users for transfers
        const { data: usersData } = await supabase
          .from("users")
          .select("*")
          .neq("id", currentUser.id);

        setUsers(usersData || []);

        // Set up real-time subscription
        const channel = supabase
          .channel("transactions")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "transactions" },
            () => {
              // Reload transactions
              supabase
                .from("transactions")
                .select("*")
                .or(
                  `user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id}`
                )
                .order("created_at", { ascending: false })
                .then(({ data }) => setTransactions(data || []));
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error("Error loading transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !transferAmount || !transferCurrency || !transferToUser)
      return;

    setSending(true);

    try {
      const amount = Number(transferAmount);

      // Check if user has sufficient balance
      const userBalance = balances.find((b) => b.currency === transferCurrency);
      if (!userBalance || Number(userBalance.amount) < amount) {
        alert("Insufficient balance");
        return;
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "transfer",
          currency: transferCurrency,
          amount: amount,
          to_user_id: transferToUser,
        });

      if (transactionError) throw transactionError;

      // Update sender balance
      const { error: senderError } = await supabase
        .from("balances")
        .update({
          amount: Number(userBalance.amount) - amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userBalance.id);

      if (senderError) throw senderError;

      // Update or create receiver balance
      const { data: receiverBalance } = await supabase
        .from("balances")
        .select("*")
        .eq("user_id", transferToUser)
        .eq("currency", transferCurrency)
        .single();

      if (receiverBalance) {
        // Update existing balance
        const { error: receiverError } = await supabase
          .from("balances")
          .update({
            amount: Number(receiverBalance.amount) + amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", receiverBalance.id);

        if (receiverError) throw receiverError;
      } else {
        // Create new balance
        const { error: newBalanceError } = await supabase
          .from("balances")
          .insert({
            user_id: transferToUser,
            currency: transferCurrency,
            amount: amount,
          });

        if (newBalanceError) throw newBalanceError;
      }

      // Log activities
      await supabase.from("activity_logs").insert([
        {
          user_id: user.id,
          activity: `Sent ${amount} ${transferCurrency} to another user`,
        },
        {
          user_id: transferToUser,
          activity: `Received ${amount} ${transferCurrency} from another user`,
        },
      ]);

      // Reload balances
      const { data: updatedBalances } = await supabase
        .from("balances")
        .select("*")
        .eq("user_id", user.id);

      setBalances(updatedBalances || []);

      setTransferAmount("");
      setTransferCurrency("");
      setTransferToUser("");
      setDialogOpen(false);
    } catch (error) {
      console.error("Error sending transfer:", error);
      alert("Transfer failed. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type === "deposit") {
      return <ArrowDownLeft className="h-5 w-5 text-green-600" />;
    } else if (transaction.type === "transfer") {
      if (transaction.user_id === user?.id) {
        return <ArrowUpRight className="h-5 w-5 text-red-600" />;
      } else {
        return <ArrowDownLeft className="h-5 w-5 text-green-600" />;
      }
    }
    return <ArrowUpDown className="h-5 w-5 text-gray-600" />;
  };

  const getTransactionDescription = (transaction: Transaction) => {
    if (transaction.type === "deposit") {
      return "Account Deposit";
    } else if (transaction.type === "transfer") {
      if (transaction.user_id === user?.id) {
        return "Outgoing Transfer";
      } else {
        return "Incoming Transfer";
      }
    }
    return transaction.type;
  };

  const getTransactionAmount = (transaction: Transaction) => {
    const isIncoming =
      transaction.type === "deposit" || transaction.to_user_id === user?.id;
    const sign = isIncoming ? "+" : "-";
    const colorClass = isIncoming ? "text-green-600" : "text-red-600";

    return {
      sign,
      colorClass,
      amount: Number(transaction.amount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
      }),
    };
  };

  return (
    <DashboardLayout currentSection="transactions">
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
        {/* Hero Header - Professional Banking Style */}
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
                  <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                    Transaction Center
                  </h1>
                  <p className="text-xs sm:text-white lg:text-lg font-medium">
                    <span className="hidden sm:inline">
                      Secure banking transactions and transfer management
                    </span>
                    <span className="sm:hidden">Banking transactions</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
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
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-[#F26623] text-xl font-bold flex items-center">
                        <Send className="h-5 w-5 mr-2" />
                        Send Money
                      </DialogTitle>
                      <DialogDescription className="text-gray-600">
                        Transfer funds securely to another user
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleTransfer} className="space-y-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="recipient"
                          className="text-gray-700 font-semibold"
                        >
                          Recipient
                        </Label>
                        <Select
                          value={transferToUser}
                          onValueChange={setTransferToUser}
                        >
                          <SelectTrigger className="border-[#F26623]/30 focus:border-[#F26623] focus:ring-[#F26623]/20">
                            <SelectValue placeholder="Select recipient" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-gradient-to-r from-[#F26623] to-[#E55A1F] rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">
                                      {u.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="font-semibold">
                                      {u.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {u.email}
                                    </div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="currency"
                          className="text-gray-700 font-semibold"
                        >
                          Currency
                        </Label>
                        <Select
                          value={transferCurrency}
                          onValueChange={setTransferCurrency}
                        >
                          <SelectTrigger className="border-[#F26623]/30 focus:border-[#F26623] focus:ring-[#F26623]/20">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {balances.map((balance) => (
                              <SelectItem
                                key={balance.id}
                                value={balance.currency}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-semibold">
                                    {balance.currency}
                                  </span>
                                  <span className="text-sm text-gray-500 ml-4">
                                    Available:{" "}
                                    {Number(balance.amount).toFixed(2)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="amount"
                          className="text-gray-700 font-semibold"
                        >
                          Amount
                        </Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          placeholder="0.00"
                          required
                          className="border-[#F26623]/30 focus:border-[#F26623] focus:ring-[#F26623]/20"
                        />
                        {transferAmount && transferCurrency && (
                          <div className="bg-[#F26623]/5 border border-[#F26623]/20 rounded-lg p-3">
                            <p className="text-sm text-[#F26623] font-semibold">
                              Transfer Amount: {transferAmount}{" "}
                              {transferCurrency}
                            </p>
                          </div>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-[#F26623] to-[#E55A1F] hover:from-[#E55A1F] hover:to-[#D94E1A] text-white font-semibold py-3"
                        disabled={sending}
                      >
                        {sending ? "Processing Transfer..." : "Send Money"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Transaction Summary Stats - Now 3 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <ArrowUpDown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">
                      Total Transactions
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {transactions.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <ArrowUpRight className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">Sent</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {
                        transactions.filter(
                          (t) => t.user_id === user?.id && t.type === "transfer"
                        ).length
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 rounded-full p-2">
                    <ArrowDownLeft className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">
                      Received
                    </p>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {
                        transactions.filter((t) => t.to_user_id === user?.id)
                          .length
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Statistics Cards - Professional Design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <Card className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F26623]/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>

            <div className="relative p-6">
              <CardHeader className="p-0 mb-4">
                <div className="flex items-center justify-between">
                  <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-3 shadow-lg">
                    <ArrowUpDown className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-right">
                    <CardTitle className="text-sm font-semibold text-gray-600">
                      Total Transactions
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  {transactions.length}
                </div>
                <p className="text-sm text-gray-600">All time activity</p>
              </CardContent>
            </div>
          </Card>

          <Card className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F26623]/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>

            <div className="relative p-6">
              <CardHeader className="p-0 mb-4">
                <div className="flex items-center justify-between">
                  <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-3 shadow-lg">
                    <ArrowUpRight className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-right">
                    <CardTitle className="text-sm font-semibold text-gray-600">
                      Outgoing Transfers
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  {
                    transactions.filter(
                      (t) => t.user_id === user?.id && t.type === "transfer"
                    ).length
                  }
                </div>
                <p className="text-sm text-gray-600">Money sent</p>
              </CardContent>
            </div>
          </Card>

          <Card className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30 sm:col-span-2 lg:col-span-1">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F26623]/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>

            <div className="relative p-6">
              <CardHeader className="p-0 mb-4">
                <div className="flex items-center justify-between">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-3 shadow-lg">
                    <ArrowDownLeft className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-right">
                    <CardTitle className="text-sm font-semibold text-gray-600">
                      Incoming Transfers
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  {transactions.filter((t) => t.to_user_id === user?.id).length}
                </div>
                <p className="text-sm text-gray-600">Money received</p>
              </CardContent>
            </div>
          </Card>
        </div>

        {/* Transaction History - Professional Banking Design */}
        <Card className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#F26623]/10">
          <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 rounded-full p-3">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-2xl font-bold text-white">
                    Transaction History
                  </CardTitle>
                  <CardDescription className="text-orange-100">
                    <span className="hidden sm:inline">
                      Complete record of all your banking transactions
                    </span>
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
                  const { sign, colorClass, amount } =
                    getTransactionAmount(transaction);

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
                            <p className="font-bold text-gray-900 text-base sm:text-lg">
                              {getTransactionDescription(transaction)}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <p className="text-sm text-gray-600">
                                {new Date(
                                  transaction.created_at
                                ).toLocaleString()}
                              </p>
                            </div>
                            <div className="bg-[#F26623]/10 text-[#F26623] px-3 py-1 rounded-full text-xs font-semibold inline-block mt-2">
                              Transaction ID: {transaction.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                        <div className="text-right sm:text-left">
                          <p
                            className={`text-xl sm:text-2xl font-bold ${colorClass} mb-1`}
                          >
                            {sign}
                            {amount}
                          </p>
                          <div className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold inline-block">
                            {transaction.currency}
                          </div>
                          <div className="flex items-center justify-end sm:justify-start mt-2">
                            <Shield className="h-3 w-3 text-green-500 mr-1" />
                            <span className="text-xs text-green-600 font-medium">
                              Verified
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-gradient-to-br from-[#F26623]/10 to-[#E55A1F]/20 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-8">
                  <ArrowUpDown className="h-16 w-16 text-[#F26623]" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                  No Transactions Yet
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Your transaction history will appear here once you start
                  making transfers or deposits
                </p>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] hover:from-[#E55A1F] hover:to-[#D94E1A] text-white font-semibold px-8 py-4 text-base sm:text-lg">
                      <Send className="h-5 w-5 mr-2" />
                      Send Your First Transfer
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
