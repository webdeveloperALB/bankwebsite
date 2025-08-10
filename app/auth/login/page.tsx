"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn(email, password);

      if (result.isAdmin) {
        router.push("/admin");
      } else {
        // Check KYC status before any redirect
        if (result.needsKyc) {
          router.push("/kyc");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-md lg:max-w-lg">
        {/* Header Section */}
        <div className="text-center">
          <div className="flex items-center justify-center">
            <div className="">
              <Image
                src="/anchor2.png"
                alt="Anchor Group Investments Logo"
                width={48}
                height={48}
                className="h-24 w-56"
              />
            </div>
          </div>
          <p className="text-gray-600 text-sm lg:text-base mb-4">
            Your trusted financial partner
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl font-semibold text-gray-900 text-center">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Sign in to access your secure banking dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700"
                >
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="h-12 border-gray-200 focus:border-[#F26623] focus:ring-[#F26623] transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700"
                >
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-12 border-gray-200 focus:border-[#F26623] focus:ring-[#F26623] transition-colors"
                  required
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium transition-colors duration-200 shadow-lg hover:shadow-xl"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Signing In...
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Footer Links */}
            <div className="mt-8 space-y-4">
              <div className="text-center">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-[#F26623] hover:text-[#E55A1F] hover:underline transition-colors"
                >
                  Forgot your password?
                </Link>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">
                    New to Anchor Group Investments?
                  </span>
                </div>
              </div>

              <div className="text-center">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center w-full h-12 px-4 text-sm font-medium text-[#F26623] bg-orange-50 border border-[#F26623] rounded-md hover:bg-orange-100 transition-colors duration-200"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            Your security is our priority. All communications are encrypted and
            protected.
          </p>
        </div>
      </div>
    </div>
  );
}
