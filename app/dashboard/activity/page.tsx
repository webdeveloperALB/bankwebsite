'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import DashboardLayout from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Activity, Search, Calendar, User, TrendingUp } from 'lucide-react'
import { Database } from '@/lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type ActivityLog = Database['public']['Tables']['activity_logs']['Row']

export default function ActivityPage() {
  const [user, setUser] = useState<User | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [filteredActivities, setFilteredActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('all')

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) return

        setUser(currentUser)

        // Load activity logs
        const { data: activitiesData } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })

        setActivities(activitiesData || [])
        setFilteredActivities(activitiesData || [])

        // Set up real-time subscription
        const channel = supabase
          .channel('activity_logs')
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'activity_logs', filter: `user_id=eq.${currentUser.id}` },
            () => {
              // Reload activities
              supabase
                .from('activity_logs')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .then(({ data }) => {
                  setActivities(data || [])
                  setFilteredActivities(data || [])
                })
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }

      } catch (error) {
        console.error('Error loading activity logs:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    let filtered = activities

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(activity =>
        activity.activity.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply time period filter
    if (filterPeriod !== 'all') {
      const now = new Date()
      let cutoffDate = new Date()

      switch (filterPeriod) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          cutoffDate.setDate(now.getDate() - 7)
          break
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1)
          break
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1)
          break
      }

      filtered = filtered.filter(activity =>
        new Date(activity.created_at) >= cutoffDate
      )
    }

    setFilteredActivities(filtered)
  }, [activities, searchTerm, filterPeriod])

  const getActivityIcon = (activity: string) => {
    if (activity.includes('login') || activity.includes('logged')) {
      return <User className="h-4 w-4 text-blue-600" />
    } else if (activity.includes('deposit') || activity.includes('added')) {
      return <TrendingUp className="h-4 w-4 text-green-600" />
    } else if (activity.includes('transfer') || activity.includes('sent')) {
      return <Activity className="h-4 w-4 text-orange-600" />
    } else if (activity.includes('message') || activity.includes('ticket')) {
      return <Activity className="h-4 w-4 text-purple-600" />
    }
    return <Activity className="h-4 w-4 text-gray-600" />
  }

  const getActivityColor = (activity: string) => {
    if (activity.includes('login') || activity.includes('logged')) {
      return 'border-l-blue-500'
    } else if (activity.includes('deposit') || activity.includes('added')) {
      return 'border-l-green-500'
    } else if (activity.includes('transfer') || activity.includes('sent')) {
      return 'border-l-orange-500'
    } else if (activity.includes('message') || activity.includes('ticket')) {
      return 'border-l-purple-500'
    }
    return 'border-l-gray-500'
  }

  const todayActivities = activities.filter(a => {
    const today = new Date()
    const activityDate = new Date(a.created_at)
    return activityDate.toDateString() === today.toDateString()
  }).length

  const thisWeekActivities = activities.filter(a => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return new Date(a.created_at) >= weekAgo
  }).length

  return (
    <DashboardLayout currentSection="activity">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Account Activity</h1>
          <p className="text-gray-600">Track all your account activities and transactions</p>
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activities.length}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayActivities}</div>
              <p className="text-xs text-muted-foreground">
                Activities today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{thisWeekActivities}</div>
              <p className="text-xs text-muted-foreground">
                Past 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Daily</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activities.length > 0 ? Math.round(activities.length / 30) : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Activities per day
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Activities</CardTitle>
            <CardDescription>
              Search and filter your account activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Past Week</SelectItem>
                    <SelectItem value="month">Past Month</SelectItem>
                    <SelectItem value="year">Past Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>
              Chronological list of your account activities
              {filteredActivities.length !== activities.length && (
                <span className="ml-2 text-blue-600">
                  ({filteredActivities.length} of {activities.length} activities shown)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse flex items-center space-x-4 p-4 border-l-4 border-gray-200 bg-gray-50 rounded-r-lg">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredActivities.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredActivities.map((activity) => (
                  <div key={activity.id} className={`flex items-center space-x-4 p-4 border-l-4 ${getActivityColor(activity.activity)} bg-gray-50 rounded-r-lg hover:bg-gray-100 transition-colors`}>
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                      {getActivityIcon(activity.activity)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.activity}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || filterPeriod !== 'all' ? 'No matching activities' : 'No activities yet'}
                </h3>
                <p className="text-gray-500">
                  {searchTerm || filterPeriod !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Your account activities will appear here as you use the banking features'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}