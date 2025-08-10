"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signUp, resendVerification } from "@/lib/auth";
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
import { AlertCircle, Mail, CheckCircle, Shield, Lock } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signUp(email, password, name);

      if (result.needsVerification) {
        setNeedsVerification(true);
      } else {
        router.push("/kyc");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    setError("");

    try {
      await resendVerification(email);
      setError("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResendingVerification(false);
    }
  };

  if (needsVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="text-center">
            <div className="flex items-center justify-center">
              <div className=" p-6 rounded-2xl">
                <Image
                  src="/anchor2.png"
                  alt="Anchor Group Investments Logo"
                  width={64}
                  height={64}
                  className="h-24 w-56"
                />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Anchor Group Investments
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Your trusted financial partner
            </p>
          </div>

          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="bg-[#F26623]/10 p-4 rounded-full">
                  <Mail className="h-16 w-16 text-[#F26623]" />
                </div>
              </div>
              <CardTitle className="text-xl sm:text-2xl text-gray-900">
                Check Your Email
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                We&apos;ve sent a verification link to{" "}
                <strong className="text-[#F26623]">{email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-[#F26623]/5 border border-[#F26623]/20 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-[#F26623]" />
                  <span className="text-sm font-semibold text-gray-900">
                    Account Created Successfully
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Your account has been created successfully. Please check your
                  email and click the verification link to complete your
                  registration and access your secure banking dashboard.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <Button
                  onClick={handleResendVerification}
                  variant="outline"
                  className="w-full border-[#F26623] text-[#F26623] hover:bg-[#F26623] hover:text-white transition-colors duration-200"
                  disabled={resendingVerification}
                >
                  {resendingVerification
                    ? "Sending..."
                    : "Resend Verification Email"}
                </Button>

                <div className="text-center pt-2">
                  <Link
                    href="/auth/login"
                    className="text-sm text-[#F26623] hover:text-[#D55A1F] hover:underline transition-colors duration-200"
                  >
                    Back to Sign In
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="flex items-center justify-center">
            <div className="">
              <Image
                src="/anchor2.png"
                alt="Anchor Group Investments Logo"
                width={64}
                height={64}
                className="h-24 w-56"
              />
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-[#F26623]/10 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-[#F26623]" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl text-gray-900 p-0">
                  Create Account
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Join Anchor Group Investments for secure banking
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-sm font-medium text-gray-700"
                >
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="h-11 border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]/20"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700"
                >
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-11 border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]/20"
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
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a secure password"
                    className="h-11 border-gray-300 focus:border-[#F26623] focus:ring-[#F26623]/20 pr-10"
                    required
                    minLength={6}
                  />
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
                      <strong>Important:</strong> You&apos;ll receive an email
                      verification link after registration. Your account will be
                      created immediately, but you&apos;ll need to verify your
                      email to access all banking features.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-[#F26623] hover:bg-[#D55A1F] text-white font-medium transition-colors duration-200 shadow-lg hover:shadow-xl"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="text-[#F26623] hover:text-[#D55A1F] font-medium hover:underline transition-colors duration-200"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
