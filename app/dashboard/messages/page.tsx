"use client";

import { useEffect, useState, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Send,
  User,
  Shield,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Database } from "@/lib/supabase";

type User = Database["public"]["Tables"]["users"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

export default function MessagesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async (currentUser: User, silent = false) => {
    try {
      if (!silent) console.log("📨 Client loading messages...");

      const { data: messagesData } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: true });

      if (!silent)
        console.log("📨 Client loaded messages:", messagesData?.length);

      // Only update if there are actual changes to prevent unnecessary re-renders
      setMessages((prevMessages) => {
        if (
          JSON.stringify(prevMessages) !== JSON.stringify(messagesData || [])
        ) {
          setTimeout(scrollToBottom, 100);
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

  // Auto-refresh function (silent to avoid spam logs)
  const autoRefresh = async () => {
    if (!autoRefreshEnabled || !user) return;

    try {
      await loadMessages(user, true);
    } catch (error) {
      console.error("❌ Client auto-refresh failed:", error);
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    if (!user) return;

    setRefreshing(true);
    console.log("🔄 Client manually refreshing messages...");

    try {
      await loadMessages(user, false);
      console.log("✅ Client refresh completed");
    } catch (error) {
      console.error("❌ Client refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
    console.log(
      "🔄 Client auto-refresh:",
      !autoRefreshEnabled ? "ENABLED" : "DISABLED"
    );
  };

  useEffect(() => {
    const initializeData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        setUser(currentUser);
        await loadMessages(currentUser, false);
      } catch (error) {
        console.error("Error loading messages:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  // Auto-refresh every second
  useEffect(() => {
    if (autoRefreshEnabled && user) {
      console.log("🔄 Client starting auto-refresh every 1 second");
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
  }, [autoRefreshEnabled, user]);

  // Real-time subscription as backup
  useEffect(() => {
    if (!user) return;

    console.log("📡 Client setting up real-time subscription as backup...");
    const messagesChannel = supabase
      .channel(`user_messages_backup_${user.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("🔄 Client real-time backup update:", payload.eventType);
          // Just trigger a refresh instead of complex logic
          autoRefresh();
        }
      )
      .subscribe((status) => {
        console.log("📡 Client backup subscription status:", status);
      });

    return () => {
      console.log("🔌 Client cleaning up backup subscription...");
      supabase.removeChannel(messagesChannel);
    };
  }, [user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    setSending(true);
    console.log("📤 Client sending message:", newMessage.trim());

    try {
      const messageData = {
        user_id: user.id,
        from_admin: false,
        message: newMessage.trim(),
      };

      const { data, error } = await supabase
        .from("messages")
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      console.log("✅ Client message sent successfully:", data);

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        activity: "Sent message to support",
      });

      setNewMessage("");

      // Force immediate refresh after sending
      setTimeout(() => {
        autoRefresh();
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout currentSection="messages">
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
                    Support Messages
                  </h1>
                  <p className="text-orange-100 text-sm sm:text-base lg:text-lg font-medium">
                    Real-time chat with auto-refresh every second
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
                    className={`h-4 w-4 mr-2 ${
                      refreshing ? "animate-spin" : ""
                    }`}
                  />
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Message Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <Card className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F26623]/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>

            <div className="relative p-6">
              <CardHeader className="p-0 mb-4">
                <div className="flex items-center justify-between">
                  <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-3 shadow-lg">
                    <Mail className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-right">
                    <CardTitle className="text-sm font-semibold text-gray-600">
                      Total Messages
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {messages.length}
                </div>
                <p className="text-sm text-gray-600">All conversations</p>
              </CardContent>
            </div>
          </Card>

          <Card className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F26623]/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>

            <div className="relative p-6">
              <CardHeader className="p-0 mb-4">
                <div className="flex items-center justify-between">
                  <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-3 shadow-lg">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-right">
                    <CardTitle className="text-sm font-semibold text-gray-600">
                      Your Messages
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {messages.filter((m) => !m.from_admin).length}
                </div>
                <p className="text-sm text-gray-600">Messages sent by you</p>
              </CardContent>
            </div>
          </Card>

          <Card className="group relative bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden border-2 border-[#F26623]/10 hover:border-[#F26623]/30 sm:col-span-2 lg:col-span-1">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F26623]/5 to-[#E55A1F]/10"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F26623]/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-700"></div>

            <div className="relative p-6">
              <CardHeader className="p-0 mb-4">
                <div className="flex items-center justify-between">
                  <div className="bg-gradient-to-br from-[#F26623] to-[#E55A1F] rounded-2xl p-3 shadow-lg">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-right">
                    <CardTitle className="text-sm font-semibold text-gray-600">
                      Support Replies
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {messages.filter((m) => m.from_admin).length}
                </div>
                <p className="text-sm text-gray-600">Professional responses</p>
              </CardContent>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
          {/* Message Thread */}
          <Card className="xl:col-span-2 bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#F26623]/10">
            <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/20 rounded-full p-3">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl sm:text-2xl font-bold text-white">
                      Conversation
                    </CardTitle>
                    <CardDescription className="text-orange-100">
                      Auto-updating every second
                    </CardDescription>
                  </div>
                </div>

                {/* Live status indicator */}
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      autoRefreshEnabled
                        ? "bg-green-400 animate-pulse"
                        : "bg-red-400"
                    }`}
                  ></div>
                  <span className="text-white text-sm">
                    {autoRefreshEnabled ? "Live" : "Paused"}
                  </span>
                </div>
              </div>
            </div>

            <CardContent className="p-6">
              <div className="space-y-4 max-h-96 overflow-y-auto mb-6 pr-2 messages-container scrollbar-hide">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex space-x-3">
                          <div className="w-10 h-10 bg-[#F26623]/20 rounded-full"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-[#F26623]/20 rounded w-3/4"></div>
                            <div className="h-3 bg-[#F26623]/10 rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex space-x-3 ${
                        message.from_admin ? "flex-row" : "flex-row-reverse"
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
                          message.from_admin ? "text-left" : "text-right"
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
                    <div className="bg-gradient-to-br from-[#F26623]/10 to-[#E55A1F]/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                      <MessageSquare className="h-12 w-12 text-[#F26623]" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      No messages yet
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Start a secure conversation with our support team
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Send Message Form */}
              <form
                onSubmit={handleSendMessage}
                className="space-y-4 border-t-2 border-[#F26623]/10 pt-6"
              >
                <div className="space-y-2">
                  <Label
                    htmlFor="message"
                    className="text-gray-700 font-semibold flex items-center"
                  >
                    <Send className="h-4 w-4 mr-2 text-[#F26623]" />
                    Send Message
                  </Label>
                  <Textarea
                    id="message"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your secure message here..."
                    rows={4}
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
                  {sending ? "Sending..." : "Send Secure Message"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#F26623]/10">
            <div className="bg-gradient-to-r from-[#F26623] to-[#E55A1F] p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 rounded-full p-3">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-white">
                    Quick Actions
                  </CardTitle>
                  <CardDescription className="text-orange-100">
                    Common support topics
                  </CardDescription>
                </div>
              </div>
            </div>

            <CardContent className="p-6 space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start text-left p-4 h-auto border-[#F26623]/30 hover:bg-[#F26623]/10 hover:border-[#F26623] hover:text-[#F26623] transition-all duration-300"
                onClick={() =>
                  setNewMessage(
                    "I need help with my account balance and recent transactions."
                  )
                }
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-[#F26623]/10 rounded-full p-2">
                    <User className="h-4 w-4 text-[#F26623]" />
                  </div>
                  <div>
                    <div className="font-semibold">Account Balance Help</div>
                    <div className="text-xs text-gray-500">
                      Balance inquiries & transactions
                    </div>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start text-left p-4 h-auto border-[#F26623]/30 hover:bg-[#F26623]/10 hover:border-[#F26623] hover:text-[#F26623] transition-all duration-300"
                onClick={() =>
                  setNewMessage(
                    "I have a question about a specific transaction on my account."
                  )
                }
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-[#F26623]/10 rounded-full p-2">
                    <MessageSquare className="h-4 w-4 text-[#F26623]" />
                  </div>
                  <div>
                    <div className="font-semibold">Transaction Inquiry</div>
                    <div className="text-xs text-gray-500">
                      Questions about payments
                    </div>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start text-left p-4 h-auto border-[#F26623]/30 hover:bg-[#F26623]/10 hover:border-[#F26623] hover:text-[#F26623] transition-all duration-300"
                onClick={() =>
                  setNewMessage(
                    "I need to update my account information and personal details."
                  )
                }
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-[#F26623]/10 rounded-full p-2">
                    <User className="h-4 w-4 text-[#F26623]" />
                  </div>
                  <div>
                    <div className="font-semibold">Account Update</div>
                    <div className="text-xs text-gray-500">
                      Personal information changes
                    </div>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start text-left p-4 h-auto border-[#F26623]/30 hover:bg-[#F26623]/10 hover:border-[#F26623] hover:text-[#F26623] transition-all duration-300"
                onClick={() =>
                  setNewMessage(
                    "I have a security concern about my account that needs immediate attention."
                  )
                }
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-red-100 rounded-full p-2">
                    <Shield className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-red-600">
                      Security Issue
                    </div>
                    <div className="text-xs text-gray-500">
                      Urgent security matters
                    </div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
