"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import type { Database } from "@/lib/supabase";

type User = Database["public"]["Tables"]["users"]["Row"];
type Tax = Database["public"]["Tables"]["taxes"]["Row"] & {
  users?: { name: string; email: string };
};

export default function TaxesTab() {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form state - simplified
  const [selectedUser, setSelectedUser] = useState("");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());
  const [taxStatus, setTaxStatus] = useState("pending");
  const [totalIncome, setTotalIncome] = useState("");
  const [taxRate, setTaxRate] = useState("15");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // User search state
  const [userSearch, setUserSearch] = useState("");

  // Filter users based on search
  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  useEffect(() => {
    const loadData = async () => {
      // Load taxes with user info
      const { data: taxesData } = await supabase
        .from("taxes")
        .select(`*, users!inner(name, email)`)
        .order("created_at", { ascending: false });

      // Load users
      const { data: usersData } = await supabase
        .from("users")
        .select("*")
        .neq("role", "admin")
        .order("name");

      setTaxes(taxesData || []);
      setUsers(usersData || []);
      setLoading(false);
    };

    loadData();

    // Real-time subscription
    const channel = supabase
      .channel("admin_taxes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "taxes" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const income = Number.parseFloat(totalIncome) || 0;
      const calculatedTax = income * (Number.parseFloat(taxRate) / 100);

      const taxData = {
        year: Number.parseInt(taxYear),
        amount: calculatedTax,
        status: taxStatus,
        gross_income: income,
        tax_rate: Number.parseFloat(taxRate),
        due_date: dueDate || null,
        assessment_notes: notes || null,
      };

      if (editingTax) {
        const { error } = await supabase
          .from("taxes")
          .update(taxData)
          .eq("id", editingTax.id);
        if (error) throw error;

        await supabase.from("activity_logs").insert({
          user_id: editingTax.user_id,
          activity: `Tax updated for ${taxYear}: $${calculatedTax.toFixed(2)}`,
        });
      } else {
        const { error } = await supabase
          .from("taxes")
          .insert({ ...taxData, user_id: selectedUser });
        if (error) throw error;

        await supabase.from("activity_logs").insert({
          user_id: selectedUser,
          activity: `Tax created for ${taxYear}: $${calculatedTax.toFixed(2)}`,
        });
      }

      resetForm();
    } catch (error) {
      console.error("Error saving tax:", error);
    }
  };

  const deleteTax = async (tax: Tax) => {
    if (!confirm(`Delete ${tax.year} tax record for ${tax.users?.name}?`))
      return;

    const { error } = await supabase.from("taxes").delete().eq("id", tax.id);
    if (!error) {
      await supabase.from("activity_logs").insert({
        user_id: tax.user_id,
        activity: `Tax record deleted for ${tax.year}`,
      });
    }
  };

  const updateTaxStatus = async (
    taxId: string,
    newStatus: string,
    userId: string,
    year: number
  ) => {
    const { error } = await supabase
      .from("taxes")
      .update({ status: newStatus })
      .eq("id", taxId);
    if (!error) {
      await supabase.from("activity_logs").insert({
        user_id: userId,
        activity: `Tax status updated for ${year}: ${newStatus}`,
      });
    }
  };

  const resetForm = () => {
    setSelectedUser("");
    setTaxYear(new Date().getFullYear().toString());
    setTaxStatus("pending");
    setTotalIncome("");
    setTaxRate("15");
    setDueDate("");
    setNotes("");
    setEditingTax(null);
    setDialogOpen(false);
    setUserSearch("");
  };

  const editTax = (tax: Tax) => {
    setEditingTax(tax);
    setSelectedUser(tax.user_id);
    setTaxYear(tax.year.toString());
    setTaxStatus(tax.status);
    setTotalIncome(tax.gross_income?.toString() || "");
    setTaxRate(tax.tax_rate?.toString() || "15");
    setDueDate(tax.due_date || "");
    setNotes(tax.assessment_notes || "");
    setDialogOpen(true);
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

  // Filter taxes
  const filteredTaxes = taxes.filter((tax) => {
    const matchesSearch =
      tax.users?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.users?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.year.toString().includes(searchTerm);
    const matchesStatus = statusFilter === "all" || tax.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: taxes.length,
    pending: taxes.filter((t) => t.status === "pending").length,
    filed: taxes.filter((t) => t.status === "filed" || t.status === "paid")
      .length,
    totalAmount: taxes.reduce((sum, tax) => sum + Number(tax.amount), 0),
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900">
            Tax Administration
          </h1>
          <p className="text-gray-600">Manage client tax assessments</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => resetForm()}
              className="bg-[#F26623] hover:bg-[#E55A1F] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Tax Assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTax ? "Edit Tax Assessment" : "Create Tax Assessment"}
              </DialogTitle>
              <DialogDescription>
                {editingTax
                  ? "Update tax assessment details"
                  : "Create a new tax assessment for client"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Search Client</Label>
                  <Input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full"
                    disabled={!!editingTax}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax Year</Label>
                  <Input
                    type="number"
                    value={taxYear}
                    onChange={(e) => setTaxYear(e.target.value)}
                    min="2020"
                    max="2030"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={selectedUser}
                  onValueChange={setSelectedUser}
                  disabled={!!editingTax}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Income</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={totalIncome}
                    onChange={(e) => setTotalIncome(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    placeholder="15.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={taxStatus} onValueChange={setTaxStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="filed">Filed</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Tax Calculation Display */}
              {totalIncome && (
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Tax Amount:</span> $
                    {(
                      (Number.parseFloat(totalIncome) || 0) *
                      (Number.parseFloat(taxRate) / 100)
                    ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes..."
                  rows={2}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#F26623] hover:bg-[#E55A1F]"
              >
                {editingTax ? "Update Assessment" : "Create Assessment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Simple Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-[#F26623]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold">
                  ${stats.totalAmount.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{stats.filed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simple Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by name, email, or year..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
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

      {/* Tax Records List */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Records ({filteredTaxes.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">Loading...</div>
          ) : filteredTaxes.length > 0 ? (
            <div className="divide-y">
              {filteredTaxes.map((tax) => (
                <div key={tax.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-[#F26623] rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{tax.users?.name}</h3>
                        <p className="text-sm text-gray-500">
                          {tax.year} •{" "}
                          {new Date(tax.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="font-bold">
                          ${Number(tax.amount).toLocaleString()}
                        </p>
                        <Badge className={getStatusColor(tax.status)}>
                          {getStatusIcon(tax.status)}
                          <span className="ml-1 capitalize">{tax.status}</span>
                        </Badge>
                      </div>

                      <Select
                        value={tax.status}
                        onValueChange={(value) =>
                          updateTaxStatus(tax.id, value, tax.user_id, tax.year)
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="filed">Filed</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editTax(tax)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTax(tax)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No tax records found
              </h3>
              <p className="text-gray-500">
                Create your first tax assessment to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
