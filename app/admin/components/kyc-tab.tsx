'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Shield, UserCheck, UserX, Clock, Eye, Download, CheckCircle, XCircle } from 'lucide-react'
import { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type KYCDocument = Database['public']['Tables']['kyc_documents']['Row'] & {
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
        .from('users')
        .select('*')
        .neq('role', 'admin')
        .order('created_at', { ascending: false })

      // Load KYC documents
      const { data: documentsData } = await supabase
        .from('kyc_documents')
        .select(`
          *,
          users!inner(name, email)
        `)
        .order('uploaded_at', { ascending: false })

      setUsers(usersData || [])
      setKycDocuments(documentsData || [])
      setLoading(false)
    }

    loadData()

    // Real-time subscriptions
    const usersChannel = supabase
      .channel('admin_kyc_users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        loadData()
      })
      .subscribe()

    const documentsChannel = supabase
      .channel('admin_kyc_documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_documents' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(usersChannel)
      supabase.removeChannel(documentsChannel)
    }
  }, [])

  const updateKYCStatus = async (userId: string, newStatus: string) => {
    const { error } = await supabase
      .from('users')
      .update({ kyc_status: newStatus })
      .eq('id', userId)

    if (error) {
      console.error('Error updating KYC status:', error)
    } else {
      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          activity: `KYC status updated to: ${newStatus}`
        })
    }
  }

  const viewUserDocuments = async (user: User) => {
    setSelectedUser(user)
    const userDocs = kycDocuments.filter(doc => doc.user_id === user.id)
    setUserDocuments(userDocs)
  }

  const getKycColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'submitted': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const stats = {
    total: users.length,
    approved: users.filter(u => u.kyc_status === 'approved').length,
    pending: users.filter(u => u.kyc_status === 'pending' || u.kyc_status === 'submitted').length,
    rejected: users.filter(u => u.kyc_status === 'rejected').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">KYC Management</h1>
        <p className="text-gray-600">Review and approve user identity verification</p>
      </div>

      {/* KYC Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* KYC Applications */}
      <Card>
        <CardHeader>
          <CardTitle>KYC Applications</CardTitle>
          <CardDescription>Review user identity verification submissions</CardDescription>
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
                <div key={user.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50">
                  <div>
                    <h3 className="font-medium">{user.name}</h3>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    <p className="text-xs text-gray-400">
                      Registered {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getKycColor(user.kyc_status)}>
                      {user.kyc_status}
                    </Badge>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => viewUserDocuments(user)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Docs
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>KYC Documents - {selectedUser?.name}</DialogTitle>
                          <DialogDescription>
                            Review uploaded identity verification documents
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {userDocuments.length > 0 ? (
                            userDocuments.map((doc) => (
                              <div key={doc.id} className="p-4 border rounded-lg">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h4 className="font-medium capitalize">
                                      {doc.document_type.replace('_', ' ')}
                                    </h4>
                                    <p className="text-sm text-gray-500">{doc.file_name}</p>
                                    <p className="text-xs text-gray-400">
                                      Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge className={getKycColor(doc.status)}>
                                      {doc.status}
                                    </Badge>
                                    <Button variant="outline" size="sm">
                                      <Download className="h-4 w-4 mr-1" />
                                      Download
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-gray-500 py-8">
                              No documents uploaded yet
                            </p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {user.kyc_status !== 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => updateKYCStatus(user.id, 'approved')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    )}
                    
                    {user.kyc_status !== 'rejected' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => updateKYCStatus(user.id, 'rejected')}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
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