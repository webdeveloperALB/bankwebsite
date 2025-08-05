import { supabase } from "./supabase";
import { Database } from "./supabase";

type User = Database["public"]["Tables"]["users"]["Row"];

export async function signUp(email: string, password: string, name: string) {
  // First create Supabase auth user (with email verification)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name,
      },
    },
  });

  if (authError) throw authError;

  // Also create our custom user profile with plain text password
  const { data: userData, error: userError } = await supabase
    .from("users")
    .insert({
      id: authData.user?.id, // Use the same ID as Supabase auth
      email,
      password, // Plain text password as requested
      name,
      role: "client",
    })
    .select()
    .single();

  if (userError) throw userError;

  // Log activity using our user ID
  await supabase.from("activity_logs").insert({
    user_id: userData.id,
    activity: "Account created",
  });

  return {
    user: userData,
    session: authData.session,
    needsVerification: !authData.session,
  };
}

export async function signIn(email: string, password: string) {
  // Check for admin login
  if (email === "admin" && password === "admin") {
    // Create or get admin user - first check if exists
    let { data: adminUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", "admin@securebank.com")
      .single();

    if (fetchError || !adminUser) {
      // Create admin user if doesn't exist
      const { data: newAdmin, error: createError } = await supabase
        .from("users")
        .upsert(
          {
            email: "admin@securebank.com",
            password: "admin",
            name: "System Administrator",
            role: "admin",
            kyc_status: "approved",
          },
          {
            onConflict: "email",
          }
        )
        .select()
        .single();

      if (createError) throw createError;
      adminUser = newAdmin;
    }

    // Store admin session in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "admin_session",
        JSON.stringify({
          user: adminUser,
          timestamp: Date.now(),
        })
      );
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: adminUser.id,
      activity: "Admin logged in",
    });

    return { user: adminUser, session: null, isAdmin: true };
  }

  // Sign in with Supabase auth (handles email verification)
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError) throw authError;

  // Get user profile from our users table
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (userError || !userData) {
    throw new Error("User profile not found");
  }

  // Log activity
  await supabase.from("activity_logs").insert({
    user_id: userData.id,
    activity: "User logged in",
  });

  return {
    user: userData,
    session: authData.session,
    needsKyc: userData.kyc_status !== "approved",
  };
}

export async function signOut() {
  // Clear admin session if exists
  if (typeof window !== "undefined") {
    const adminSession = localStorage.getItem("admin_session");
    if (adminSession) {
      try {
        const { user } = JSON.parse(adminSession);
        // Log admin logout
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          activity: "Admin logged out",
        });
      } catch (error) {
        // Ignore parsing errors
      }
      localStorage.removeItem("admin_session");
      return;
    }
  }

  // Get current user from Supabase auth
  const { data: authUser } = await supabase.auth.getUser();

  if (authUser.user) {
    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: authUser.user.id,
      activity: "User logged out",
    });
  }

  // Sign out from Supabase auth
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  // Check for admin session first
  if (typeof window !== "undefined") {
    const adminSession = localStorage.getItem("admin_session");
    if (adminSession) {
      try {
        const { user, timestamp } = JSON.parse(adminSession);
        // Check if session is still valid (24 hours)
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          return user;
        } else {
          localStorage.removeItem("admin_session");
        }
      } catch (error) {
        localStorage.removeItem("admin_session");
      }
    }
  }

  // Get user from Supabase auth
  const { data: authData } = await supabase.auth.getUser();

  if (authData.user) {
    // Get user profile from our users table
    const { data: userProfile } = await supabase
      .from("users")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    return userProfile;
  }

  return null;
}

export async function getCurrentUserDirect(): Promise<User | null> {
  // Check for admin session first
  const adminSession = localStorage.getItem("admin_session");
  if (adminSession) {
    const { data: adminUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", "admin@securebank.com")
      .single();

    return adminUser;
  }

  // Get user from Supabase auth
  const { data: authData } = await supabase.auth.getUser();

  if (authData.user) {
    // Get user profile from our users table
    const { data: userProfile } = await supabase
      .from("users")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    return userProfile;
  }

  return null;
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email,
  });

  if (error) throw error;
}
