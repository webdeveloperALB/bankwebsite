"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
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
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Send,
  User,
  Shield,
  Search,
  Clock,
  CheckCircle,
  Users,
  Mail,
  Phone,
  RefreshCw,
} from "lucide-react";
import { Database } from "@/lib/supabase";

type User = Database["public"]["Tables"]["users"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  users?: { name: string; email: string };
};

interface AdminMessagesPageProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AdminMessagesPage({
  activeTab,
  onTabChange,
}: AdminMessagesPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) console.log("📨 Admin loading messages...");

      const { data: messagesData } = await supabase
        .from("messages")
        .select(
          `
          *,
          users!inner(name, email)
        `
        )
        .order("created_at", { ascending: true });

      if (!silent)
        console.log("📨 Admin loaded messages:", messagesData?.length);

      // Only update if there are actual changes to prevent unnecessary re-renders
      setMessages((prevMessages) => {
        if (
          JSON.stringify(prevMessages) !== JSON.stringify(messagesData || [])
        ) {
          return messagesData || [];
        }
        return prevMessages;
      });

      return messagesData || [];
    } catch (error) {
      if (!silent) console.error("❌ Error loading messages:", error);
      return [];
    }
  };

  const loadUsers = async (silent = false) => {
    try {
      if (!silent) console.log("👥 Admin loading users...");

      const { data: usersData } = await supabase
        .from("users")
        .select("*")
        .neq("role", "admin")
        .order("name");

      if (!silent) console.log("👥 Admin loaded users:", usersData?.length);

      setUsers(usersData || []);
      setFilteredUsers(usersData || []);
      return usersData || [];
    } catch (error) {
      if (!silent) console.error("❌ Error loading users:", error);
      return [];
    }
  };

  // Auto-refresh function (silent to avoid spam logs)
  const autoRefresh = async () => {
    if (!autoRefreshEnabled) return;

    try {
      await Promise.all([loadMessages(true), loadUsers(true)]);
    } catch (error) {
      console.error("❌ Auto-refresh failed:", error);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    console.log("🔄 Admin manually refreshing messages...");

    try {
      await Promise.all([loadMessages(false), loadUsers(false)]);
      console.log("✅ Admin refresh completed");
    } catch (error) {
      console.error("❌ Admin refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
    console.log(
      "🔄 Admin auto-refresh:",
      !autoRefreshEnabled ? "ENABLED" : "DISABLED"
    );
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([loadMessages(false), loadUsers(false)]);
      setLoading(false);
    };

    initializeData();
  }, []);

  // Auto-refresh every second
  useEffect(() => {
    if (autoRefreshEnabled) {
      console.log("🔄 Admin starting auto-refresh every 1 second");
      autoRefreshIntervalRef.current = setInterval(autoRefresh, 1000);
    } else {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    }

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, [autoRefreshEnabled]);

  // Real-time subscription as backup
  useEffect(() => {
    console.log("📡 Admin setting up real-time subscription as backup...");

    const messagesChannel = supabase
      .channel("admin_messages_backup", {
        config: {
          broadcast: { self: true },
          presence: { key: "admin" },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          console.log("🔄 Admin real-time backup update:", payload.eventType);
          // Just trigger a refresh instead of complex logic
          await autoRefresh();
        }
      )
      .subscribe((status) => {
        console.log("📡 Admin backup subscription status:", status);
      });

    return () => {
      console.log("🔌 Admin cleaning up backup subscription...");
      supabase.removeChannel(messagesChannel);
    };
  }, []);

  // Filter user messages when selected user changes
  useEffect(() => {
    if (selectedUser) {
      const filtered = messages.filter((m) => m.user_id === selectedUser.id);
      setUserMessages(filtered);
      setTimeout(scrollToBottom, 100);
    }
  }, [selectedUser, messages]);

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(
        (user) =>
          user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newMessage.trim()) return;

    setSending(true);
    console.log("📤 Admin sending message to:", selectedUser.name);

    try {
      const messageData = {
        user_id: selectedUser.id,
        from_admin: true,
        message: newMessage.trim(),
      };

      const { data, error } = await supabase
        .from("messages")
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      console.log("✅ Admin message sent successfully:", data);

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: selectedUser.id,
        activity: `Received admin message`,
      });

      setNewMessage("");

      // Force immediate refresh after sending
      setTimeout(() => {
        autoRefresh();
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error("❌ Error sending admin message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const getUserMessageCount = (userId: string) => {
    return messages.filter((m) => m.user_id === userId).length;
  };

  const getLastMessage = (userId: string) => {
    const userMsgs = messages.filter((m) => m.user_id === userId);
    return userMsgs[userMsgs.length - 1];
  };

  const getUnreadCount = (userId: string) => {
    return messages.filter((m) => m.user_id === userId && !m.from_admin).length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Hero Header with Refresh Controls */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#F26623] via-[#E55A1F] to-[#D94E1A] rounded-2xl p-6 sm:p-8 mb-8 shadow-2xl">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <MessageSquare className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                  Customer Support Chat
                </h1>
                <p className="text-orange-100 text-sm sm:text-base lg:text-lg font-medium">
                  Real-time messaging with auto-refresh every second
                </p>
              </div>
            </div>

            {/* Refresh Controls */}
            <div className="flex items-center space-x-3">
              {/* Auto-refresh toggle */}
              <Button
                onClick={toggleAutoRefresh}
                className={`${
                  autoRefreshEnabled
                    ? "bg-green-500/20 hover:bg-green-500/30 text-green-100 border-green-300/30"
                    : "bg-red-500/20 hover:bg-red-500/30 text-red-100 border-red-300/30"
                } backdrop-blur-sm`}
                variant="outline"
                size="sm"
              >
                <div
                  className={`w-2 h-2 rounded-full mr-2 ${
                    autoRefreshEnabled
                      ? "bg-green-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                ></div>
                {autoRefreshEnabled ? "Auto ON" : "Auto OFF"}
              </Button>

              {/* Manual refresh button */}
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                variant="outline"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <Card className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
          <div className="relative p-6">
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center justify-between">
                <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-3 shadow-lg">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-sm font-semibold text-gray-600">
                  Total Messages
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-3xl font-bold text-gray-900">
                {messages.length}
              </div>
            </CardContent>
          </div>
        </Card>

        <Card className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
          <div className="relative p-6">
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center justify-between">
                <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-3 shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-sm font-semibold text-gray-600">
                  Active Users
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-3xl font-bold text-gray-900">
                {users.length}
              </div>
            </CardContent>
          </div>
        </Card>

        <Card className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
          <div className="relative p-6">
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center justify-between">
                <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-3 shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-sm font-semibold text-gray-600">
                  Admin Replies
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-3xl font-bold text-gray-900">
                {messages.filter((m) => m.from_admin).length}
              </div>
            </CardContent>
          </div>
        </Card>

        <Card className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
          <div className="relative p-6">
            <CardHeader className="p-0 mb-4">
              <div className="flex items-center justify-between">
                <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-3 shadow-lg">
                  <User className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-sm font-semibold text-gray-600">
                  User Messages
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-3xl font-bold text-gray-900">
                {messages.filter((m) => !m.from_admin).length}
              </div>
            </CardContent>
          </div>
        </Card>
      </div>

      {/* Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Users List */}
        <Card className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#F26623]/10">
          <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 rounded-full p-3">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-white">
                    Customer List
                  </CardTitle>
                  <CardDescription className="text-orange-100">
                    Auto-updating every second
                  </CardDescription>
                </div>
              </div>

              {/* Auto-refresh status indicator */}
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    autoRefreshEnabled
                      ? "bg-green-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                ></div>
                <span className="text-white text-xs">
                  {autoRefreshEnabled ? "Live" : "Paused"}
                </span>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-[#F26623]/30 focus:border-[#F26623] focus:ring-[#F26623]/20"
              />
            </div>

            {/* Users List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse p-4 bg-gray-100 rounded-xl"
                    >
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const messageCount = getUserMessageCount(user.id);
                  const lastMessage = getLastMessage(user.id);
                  const unreadCount = getUnreadCount(user.id);

                  return (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
                        selectedUser?.id === user.id
                          ? "bg-gradient-to-r from-[#F26623]/10 to-[#E55A1F]/20 border-[#F26623]/30"
                          : "bg-gray-50 border-gray-200 hover:bg-[#F26623]/5 hover:border-[#F26623]/20"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-r from-[#F26623] to-[#E55A1F] rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-lg">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                              <span className="text-white text-xs font-bold">
                                {unreadCount}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-gray-900 truncate">
                              {user.name}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {messageCount} msgs
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mb-1">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <p className="text-sm text-gray-600 truncate">
                              {user.email}
                            </p>
                          </div>
                          {lastMessage && (
                            <p className="text-xs text-gray-500 truncate">
                              Last: {lastMessage.message.substring(0, 30)}...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No users found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#F26623]/10">
          {selectedUser ? (
            <>
              {/* Chat Header with Auto-refresh Status */}
              <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-lg">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {selectedUser.name}
                      </h3>
                      <p className="text-orange-100 text-sm">
                        {selectedUser.email}
                      </p>
                    </div>
                  </div>

                  {/* Live status indicator */}
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          autoRefreshEnabled
                            ? "bg-green-400 animate-pulse"
                            : "bg-red-400"
                        }`}
                      ></div>
                      <span className="text-white text-sm">
                        {autoRefreshEnabled ? "Live Chat" : "Paused"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="p-6">
                <div className="space-y-4 max-h-96 overflow-y-auto mb-6 pr-2 messages-container scrollbar-hide">
                  {userMessages.length > 0 ? (
                    userMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex space-x-3 ${
                          message.from_admin ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                            message.from_admin
                              ? "bg-gradient-to-br from-[#F26623] to-[#E55A1F]"
                              : "bg-gradient-to-br from-gray-500 to-gray-600"
                          }`}
                        >
                          {message.from_admin ? (
                            <Shield className="h-5 w-5 text-white" />
                          ) : (
                            <User className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <div
                          className={`flex-1 max-w-xs lg:max-w-md ${
                            message.from_admin ? "text-right" : "text-left"
                          }`}
                        >
                          <div
                            className={`p-4 rounded-2xl shadow-lg ${
                              message.from_admin
                                ? "bg-gradient-to-br from-[#F26623]/10 to-[#E55A1F]/20 border-2 border-[#F26623]/20 text-gray-900"
                                : "bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-200 text-gray-900"
                            }`}
                          >
                            <p className="text-sm leading-relaxed">
                              {message.message}
                            </p>
                            {message.from_admin && (
                              <div className="flex items-center mt-2 text-xs text-[#F26623] font-semibold">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Support Team
                              </div>
                            )}
                          </div>
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(message.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">
                        No messages yet. Start the conversation!
                      </p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send Message Form */}
                <form
                  onSubmit={sendMessage}
                  className="space-y-4 border-t-2 border-[#F26623]/10 pt-6"
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="message"
                      className="text-gray-700 font-semibold flex items-center"
                    >
                      <Send className="h-4 w-4 mr-2 text-[#F26623]" />
                      Reply to {selectedUser.name}
                    </Label>
                    <Textarea
                      id="message"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your response..."
                      rows={3}
                      required
                      className="border-[#F26623]/30 focus:border-[#F26623] focus:ring-[#F26623]/20 rounded-xl"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] hover:from-[#E55A1F] hover:to-[#D94E1A] text-white font-semibold px-6 py-3 rounded-xl shadow-lg disabled:opacity-50"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sending ? "Sending..." : "Send Reply"}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full min-h-96">
              <div className="text-center">
                <div className="bg-gradient-to-br from-[#F26623]/10 to-[#E55A1F]/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="h-12 w-12 text-[#F26623]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Select a Customer
                </h3>
                <p className="text-gray-600">
                  Choose a customer from the list to start chatting
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
