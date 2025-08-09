"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Shield, UserCheck, UserX, Clock, Eye, Download, CheckCircle, XCircle } from "lucide-react"
import type { Database } from "@/lib/supabase"

type User = Database["public"]["Tables"]["users"]["Row"]
type KYCDocument = Database["public"]["Tables"]["kyc_documents"]["Row"] & {
  users?: { name: string; email: string }
}

export default function KYCTab() {
  const [users, setUsers] = useState<User[]>([])
  const [kycDocuments, setKycDocuments] = useState<KYCDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userDocuments, setUserDocuments] = useState<KYCDocument[]>([])

  useEffect(() => {
    const loadData = async () => {
      // Load users
      const { data: usersData } = await supabase
        .from("users")
        .select("*")
        .neq("role", "admin")
        .order("created_at", { ascending: false })

      // Load KYC documents
      const { data: documentsData } = await supabase
        .from("kyc_documents")
        .select(`
          *,
          users!inner(name, email)
        `)
        .order("uploaded_at", { ascending: false })

      setUsers(usersData || [])
      setKycDocuments(documentsData || [])
      setLoading(false)
    }

    loadData()

    // Real-time subscriptions
    const usersChannel = supabase
      .channel("admin_kyc_users")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        loadData()
      })
      .subscribe()

    const documentsChannel = supabase
      .channel("admin_kyc_documents")
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_documents" }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(usersChannel)
      supabase.removeChannel(documentsChannel)
    }
  }, [])

  const updateKYCStatus = async (userId: string, newStatus: string) => {
    const { error } = await supabase.from("users").update({ kyc_status: newStatus }).eq("id", userId)

    if (error) {
      console.error("Error updating KYC status:", error)
    } else {
      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: userId,
        activity: `KYC status updated to: ${newStatus}`,
      })
    }
  }

  const viewUserDocuments = async (user: User) => {
    setSelectedUser(user)
    const userDocs = kycDocuments.filter((doc) => doc.user_id === user.id)
    setUserDocuments(userDocs)
  }

  const downloadDocument = async (doc: KYCDocument) => {
    try {
      const { data, error } = await supabase.storage.from("kyc-documents").download(doc.file_path)

      if (error) {
        console.error("Error downloading document:", error)
        return
      }

      // Create blob URL and trigger download
      const url = URL.createObjectURL(data)
      const a = document.createElement("a")
      a.href = url
      a.download = doc.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading document:", error)
    }
  }

  const getKycColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      case "submitted":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const stats = {
    total: users.length,
    approved: users.filter((u) => u.kyc_status === "approved").length,
    pending: users.filter((u) => u.kyc_status === "pending" || u.kyc_status === "submitted").length,
    rejected: users.filter((u) => u.kyc_status === "rejected").length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">KYC Management</h1>
        <p className="text-sm sm:text-base text-gray-600">Review and approve user identity verification</p>
      </div>

      {/* KYC Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card className="border-l-4 border-l-[#F26623]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-700">Total Applications</CardTitle>
            <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-[#F26623]" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-[#F26623]">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-700">Approved</CardTitle>
            <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-700">Pending Review</CardTitle>
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-700">Rejected</CardTitle>
            <UserX className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* KYC Applications */}
      <Card className="shadow-lg border-t-4 border-t-[#F26623]">
        <CardHeader className="bg-gradient-to-r from-[#F26623]/5 to-[#F26623]/10">
          <CardTitle className="text-lg sm:text-xl text-gray-900">KYC Applications</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Review user identity verification submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse p-4 border rounded-lg">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 border rounded-lg hover:bg-gray-50 hover:border-[#F26623]/30 transition-colors space-y-3 sm:space-y-0"
                  key={user.id}
                >
                  <div className="flex-1">
                    <h3 className="text-sm sm:text-base font-medium text-gray-900">{user.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{user.email}</p>
                    <p className="text-xs text-gray-400">Registered {new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={getKycColor(user.kyc_status)}>{user.kyc_status}</Badge>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewUserDocuments(user)}
                          className="text-xs sm:text-sm border-[#F26623]/20 hover:border-[#F26623] hover:text-[#F26623]"
                        >
                          <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">View Docs</span>
                          <span className="sm:hidden">Docs</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
                        <DialogHeader>
                          <DialogTitle className="text-lg sm:text-xl">KYC Documents - {selectedUser?.name}</DialogTitle>
                          <DialogDescription className="text-sm sm:text-base">
                            Review uploaded identity verification documents
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                          {userDocuments.length > 0 ? (
                            userDocuments.map((doc) => (
                              <div key={doc.id} className="p-3 sm:p-4 border rounded-lg bg-gray-50">
                                <div className="flex flex-col space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm sm:text-base font-medium capitalize text-gray-900 truncate">
                                        {doc.document_type.replace("_", " ")}
                                      </h4>
                                      <p className="text-xs sm:text-sm text-gray-500 truncate">{doc.file_name}</p>
                                      <p className="text-xs text-gray-400">
                                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                                      </p>
                                      {doc.file_size && (
                                        <p className="text-xs text-gray-400">
                                          Size: {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                                      <Badge className={getKycColor(doc.status)}>{doc.status}</Badge>
                                    </div>
                                  </div>
                                  <div className="flex justify-end">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => downloadDocument(doc)}
                                      className="text-xs sm:text-sm border-[#F26623]/20 hover:border-[#F26623] hover:text-[#F26623] w-full sm:w-auto"
                                    >
                                      <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                      Download Document
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-12">
                              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Shield className="h-8 w-8 text-gray-400" />
                              </div>
                              <p className="text-gray-500 text-sm sm:text-base">No documents uploaded yet</p>
                              <p className="text-gray-400 text-xs sm:text-sm mt-1">
                                Documents will appear here once uploaded
                              </p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {user.kyc_status !== "approved" && (
                      <Button
                        size="sm"
                        onClick={() => updateKYCStatus(user.id, "approved")}
                        className="bg-[#F26623] hover:bg-[#F26623]/90 text-xs sm:text-sm"
                      >
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Approve</span>
                        <span className="sm:hidden">✓</span>
                      </Button>
                    )}

                    {user.kyc_status !== "rejected" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => updateKYCStatus(user.id, "rejected")}
                        className="text-xs sm:text-sm"
                      >
                        <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Reject</span>
                        <span className="sm:hidden">✗</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
