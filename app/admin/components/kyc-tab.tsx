"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
type KYCDocument = Database["public"]["Tables"]["kyc_documents"]["Row"]
type KYCApplication = Database["public"]["Tables"]["kyc_applications"]["Row"] & {
  users?: { name: string; email: string }
}

export default function KYCTab() {
  const [users, setUsers] = useState<User[]>([])
  const [kycApplications, setKycApplications] = useState<KYCApplication[]>([])
  const [kycDocuments, setKycDocuments] = useState<KYCDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedApplication, setSelectedApplication] = useState<KYCApplication | null>(null)
  const [userDocuments, setUserDocuments] = useState<KYCDocument[]>([])
  const [reviewNotes, setReviewNotes] = useState("")

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load users
        const { data: usersData } = await supabase
          .from("users")
          .select("*")
          .neq("role", "admin")
          .order("created_at", { ascending: false })

        // Load KYC applications (might be empty)
        const { data: applicationsData } = await supabase
          .from("kyc_applications")
          .select(`
            *,
            users!inner(name, email)
          `)
          .order("created_at", { ascending: false })

        // Load KYC documents
        const { data: documentsData } = await supabase
          .from("kyc_documents")
          .select("*")
          .order("uploaded_at", { ascending: false })

        setUsers(usersData || [])
        setKycApplications(applicationsData || [])
        setKycDocuments(documentsData || [])
        setLoading(false)
      } catch (error) {
        console.error("Error loading data:", error)
        setLoading(false)
      }
    }

    loadData()

    // Real-time subscriptions
    const usersChannel = supabase
      .channel("admin_kyc_users")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        loadData()
      })
      .subscribe()

    const applicationsChannel = supabase
      .channel("admin_kyc_applications")
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_applications" }, () => {
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
      supabase.removeChannel(applicationsChannel)
      supabase.removeChannel(documentsChannel)
    }
  }, [])

  const updateKYCStatus = async (userId: string, newStatus: string, applicationId?: string) => {
    // Update user status
    const { error: userError } = await supabase.from("users").update({ kyc_status: newStatus }).eq("id", userId)

    // Update application status if application exists
    if (applicationId) {
      const { error: applicationError } = await supabase
        .from("kyc_applications")
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          notes: reviewNotes || null,
        })
        .eq("id", applicationId)

      if (applicationError) {
        console.error("Error updating application:", applicationError)
      }
    }

    if (userError) {
      console.error("Error updating user KYC status:", userError)
    } else {
      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: userId,
        activity: `KYC status updated to: ${newStatus}`,
      })
      setReviewNotes("")
    }
  }

  const viewUserDetails = async (user: User) => {
    setSelectedUser(user)

    // Find application for this user
    const application = kycApplications.find((app) => app.user_id === user.id)
    setSelectedApplication(application || null)
    setReviewNotes(application?.notes || "")

    // Get documents for this user
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
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-700">Total Users</CardTitle>
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

      {/* Users and KYC Data */}
      <Card className="shadow-lg border-t-4 border-t-[#F26623]">
        <CardHeader className="bg-gradient-to-r from-[#F26623]/5 to-[#F26623]/10">
          <CardTitle className="text-lg sm:text-xl text-gray-900">KYC Applications & Documents</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Review user identity verification submissions and documents
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
              {users.map((user) => {
                const userApplication = kycApplications.find((app) => app.user_id === user.id)
                const userDocs = kycDocuments.filter((doc) => doc.user_id === user.id)

                return (
                  <div
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 border rounded-lg hover:bg-gray-50 hover:border-[#F26623]/30 transition-colors space-y-3 sm:space-y-0"
                    key={user.id}
                  >
                    <div className="flex-1">
                      <h3 className="text-sm sm:text-base font-medium text-gray-900">{user.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-500">{user.email}</p>
                      <p className="text-xs text-gray-400">
                        Registered {new Date(user.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-400">
                        Documents: {userDocs.length} | Application: {userApplication ? "Yes" : "No"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={getKycColor(user.kyc_status)}>{user.kyc_status}</Badge>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewUserDetails(user)}
                            className="text-xs sm:text-sm border-[#F26623]/20 hover:border-[#F26623] hover:text-[#F26623]"
                          >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden sm:inline">View Details</span>
                            <span className="sm:hidden">Details</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
                          <DialogHeader>
                            <DialogTitle className="text-lg sm:text-xl">KYC Details - {selectedUser?.name}</DialogTitle>
                            <DialogDescription className="text-sm sm:text-base">
                              Review complete user information and documents
                            </DialogDescription>
                          </DialogHeader>

                          {selectedUser && (
                            <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                              {/* Application Information */}
                              {selectedApplication ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <Card>
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-base">Personal Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                      <div>
                                        <strong>Name:</strong> {selectedApplication.first_name}{" "}
                                        {selectedApplication.last_name}
                                      </div>
                                      <div>
                                        <strong>Date of Birth:</strong>{" "}
                                        {new Date(selectedApplication.date_of_birth).toLocaleDateString()}
                                      </div>
                                      <div>
                                        <strong>Nationality:</strong> {selectedApplication.nationality}
                                      </div>
                                      <div>
                                        <strong>Phone:</strong> {selectedApplication.phone_number}
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-base">Address Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                      <div>
                                        <strong>Address:</strong> {selectedApplication.address}
                                      </div>
                                      <div>
                                        <strong>City:</strong> {selectedApplication.city}
                                      </div>
                                      <div>
                                        <strong>Postal Code:</strong> {selectedApplication.postal_code}
                                      </div>
                                      <div>
                                        <strong>Country:</strong> {selectedApplication.country}
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-base">Financial Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                      <div>
                                        <strong>Occupation:</strong> {selectedApplication.occupation}
                                      </div>
                                      <div>
                                        <strong>Source of Funds:</strong> {selectedApplication.source_of_funds}
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-base">Application Status</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                      <div>
                                        <strong>Status:</strong>{" "}
                                        <Badge className={getKycColor(selectedApplication.status)}>
                                          {selectedApplication.status}
                                        </Badge>
                                      </div>
                                      <div>
                                        <strong>Submitted:</strong>{" "}
                                        {new Date(
                                          selectedApplication.submitted_at || selectedApplication.created_at,
                                        ).toLocaleString()}
                                      </div>
                                      {selectedApplication.reviewed_at && (
                                        <div>
                                          <strong>Reviewed:</strong>{" "}
                                          {new Date(selectedApplication.reviewed_at).toLocaleString()}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                </div>
                              ) : (
                                <Card>
                                  <CardContent className="text-center py-8">
                                    <p className="text-gray-500">No KYC application submitted yet</p>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Documents */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-base">Uploaded Documents</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {userDocuments.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {userDocuments.map((doc) => (
                                        <div key={doc.id} className="p-3 border rounded-lg bg-gray-50">
                                          <h4 className="text-sm font-medium capitalize text-gray-900 mb-2">
                                            {doc.document_type.replace("_", " ")}
                                          </h4>
                                          <p className="text-xs text-gray-500 mb-2 truncate">{doc.file_name}</p>
                                          <p className="text-xs text-gray-400 mb-2">
                                            {new Date(doc.uploaded_at).toLocaleDateString()}
                                          </p>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => downloadDocument(doc)}
                                            className="w-full text-xs"
                                          >
                                            <Download className="h-3 w-3 mr-1" />
                                            Download
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500 text-center py-4">No documents uploaded</p>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Review Notes */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-base">Review Notes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    <div>
                                      <Label htmlFor="reviewNotes">Add review notes (optional)</Label>
                                      <Textarea
                                        id="reviewNotes"
                                        value={reviewNotes}
                                        onChange={(e) => setReviewNotes(e.target.value)}
                                        placeholder="Add any notes about this user's KYC..."
                                        className="mt-1"
                                      />
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      {selectedUser.kyc_status !== "approved" && (
                                        <Button
                                          onClick={() =>
                                            updateKYCStatus(selectedUser.id, "approved", selectedApplication?.id)
                                          }
                                          className="bg-[#F26623] hover:bg-[#F26623]/90 flex-1"
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          Approve KYC
                                        </Button>
                                      )}
                                      {selectedUser.kyc_status !== "rejected" && (
                                        <Button
                                          variant="destructive"
                                          onClick={() =>
                                            updateKYCStatus(selectedUser.id, "rejected", selectedApplication?.id)
                                          }
                                          className="flex-1"
                                        >
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Reject KYC
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      {user.kyc_status !== "approved" && (
                        <Button
                          size="sm"
                          onClick={() => updateKYCStatus(user.id, "approved", userApplication?.id)}
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
                          onClick={() => updateKYCStatus(user.id, "rejected", userApplication?.id)}
                          className="text-xs sm:text-sm"
                        >
                          <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">Reject</span>
                          <span className="sm:hidden">✗</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
