"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Clock, RefreshCw, LogOut } from "lucide-react";

interface AdminSessionWarningProps {
  isOpen: boolean;
  timeRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
}

export default function AdminSessionWarning({
  isOpen,
  timeRemaining,
  onExtend,
  onLogout,
}: AdminSessionWarningProps) {
  const [countdown, setCountdown] = useState(Math.floor(timeRemaining / 1000));

  useEffect(() => {
    setCountdown(Math.floor(timeRemaining / 1000));
  }, [timeRemaining]);

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onLogout]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-amber-900">
                Session Expiring Soon
              </DialogTitle>
              <DialogDescription className="text-amber-700">
                Your admin session will expire automatically
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <Clock className="h-6 w-6 text-amber-600" />
                <span className="text-2xl font-bold text-amber-900">
                  {formatTime(countdown)}
                </span>
              </div>

              <p className="text-sm text-amber-700">
                Your admin session will automatically expire after exactly 20
                minutes for security reasons. You will need to log in again to
                continue using the admin panel.
              </p>

              <div className="flex space-x-3">
                <Button
                  onClick={onLogout}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Login Again
                </Button>

                <Button
                  onClick={onLogout}
                  variant="outline"
                  className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            🔒 Fixed 20-minute session - no extensions allowed for maximum
            security
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
