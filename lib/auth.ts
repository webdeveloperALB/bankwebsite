// Made Supabase import conditional to avoid initialization errors
let supabase: any = null
let Database: any = null

try {
  const supabaseModule = require("./supabase")
  supabase = supabaseModule.supabase
  Database = supabaseModule.Database
} catch (error) {
  console.warn("⚠️ Supabase not configured, admin-only mode enabled")
}

type User = {
  id: string
  email: string
  password: string
  name: string
  role: string
  kyc_status: string
  created_at: string
  updated_at: string
}

export async function signUp(email: string, password: string, name: string) {
  if (!supabase) {
    throw new Error("Supabase not configured. Please set up Supabase integration for user registration.")
  }

  // First create Supabase auth user (with email verification)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name,
      },
    },
  })

  if (authError) throw authError

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
    .single()

  if (userError) throw userError

  // Log activity using our user ID
  await supabase.from("activity_logs").insert({
    user_id: userData.id,
    activity: "Account created",
  })

  return {
    user: userData,
    session: authData.session,
    needsVerification: !authData.session,
  }
}

export async function signIn(email: string, password: string) {
  // Updated admin login to use exact credentials specified by user
  if (email === "admin" && password === "cobra@anonymous.192837465&!") {
    console.log("🔑 Admin login successful")

    const adminUser: User = {
      id: "admin-001",
      email: "admin@anchorgroup.com",
      password: "cobra@anonymous.192837465&!",
      name: "System Administrator",
      role: "admin",
      kyc_status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Store admin session in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "admin_session",
        JSON.stringify({
          user: adminUser,
          timestamp: Date.now(),
        }),
      )
    }

    // Try to log activity if Supabase is available
    if (supabase) {
      try {
        await supabase.from("activity_logs").insert({
          user_id: adminUser.id,
          activity: "Admin logged in",
        })
      } catch (logError) {
        console.warn("⚠️ Could not log admin activity:", logError)
      }
    }

    return { user: adminUser, session: null, isAdmin: true }
  }

  // Regular user login requires Supabase
  if (!supabase) {
    throw new Error("Invalid login credentials")
  }

  // Sign in with Supabase auth (handles email verification)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) throw authError

  // Get user profile from our users table
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single()

  if (userError || !userData) {
    throw new Error("User profile not found")
  }

  // Log activity
  await supabase.from("activity_logs").insert({
    user_id: userData.id,
    activity: "User logged in",
  })

  return {
    user: userData,
    session: authData.session,
    needsKyc: userData.kyc_status !== "approved",
  }
}

export async function signOut() {
  // Clear admin session if exists
  if (typeof window !== "undefined") {
    const adminSession = localStorage.getItem("admin_session")
    if (adminSession) {
      try {
        const { user } = JSON.parse(adminSession)
        // Log admin logout if Supabase is available
        if (supabase) {
          await supabase.from("activity_logs").insert({
            user_id: user.id,
            activity: "Admin logged out",
          })
        }
      } catch (error) {
        // Ignore parsing errors
      }
      localStorage.removeItem("admin_session")
      return
    }
  }

  if (!supabase) return

  // Get current user from Supabase auth
  const { data: authUser } = await supabase.auth.getUser()

  if (authUser.user) {
    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: authUser.user.id,
      activity: "User logged out",
    })
  }

  // Sign out from Supabase auth
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser(): Promise<User | null> {
  // Check for admin session first
  if (typeof window !== "undefined") {
    const adminSession = localStorage.getItem("admin_session")
    if (adminSession) {
      try {
        const { user, timestamp } = JSON.parse(adminSession)
        // Check if session is still valid (20 minutes)
        if (Date.now() - timestamp < 20 * 60 * 1000) {
          return user
        } else {
          console.log("🔒 Admin session expired after 20 minutes")
          localStorage.removeItem("admin_session")
        }
      } catch (error) {
        localStorage.removeItem("admin_session")
      }
    }
  }

  if (!supabase) return null

  // Get user from Supabase auth
  const { data: authData } = await supabase.auth.getUser()

  if (authData.user) {
    // Get user profile from our users table
    const { data: userProfile } = await supabase.from("users").select("*").eq("id", authData.user.id).single()

    return userProfile
  }

  return null
}

export async function getCurrentUserDirect(): Promise<User | null> {
  // Check for admin session first
  if (typeof window !== "undefined") {
    const adminSession = localStorage.getItem("admin_session")
    if (adminSession) {
      try {
        const { user, timestamp } = JSON.parse(adminSession)
        // Check if session is still valid (20 minutes)
        if (Date.now() - timestamp < 20 * 60 * 1000) {
          if (supabase) {
            const { data: adminUser } = await supabase
              .from("users")
              .select("*")
              .eq("email", "admin@anchorgroup.com")
              .single()

            return adminUser || user
          }
          return user
        } else {
          console.log("🔒 Admin session expired after 20 minutes")
          localStorage.removeItem("admin_session")
        }
      } catch (error) {
        localStorage.removeItem("admin_session")
      }
    }
  }

  if (!supabase) return null

  // Get user from Supabase auth
  const { data: authData } = await supabase.auth.getUser()

  if (authData.user) {
    // Get user profile from our users table
    const { data: userProfile } = await supabase.from("users").select("*").eq("id", authData.user.id).single()

    return userProfile
  }

  return null
}

export async function resendVerification(email: string) {
  if (!supabase) {
    throw new Error("Supabase not configured")
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email,
  })

  if (error) throw error
}
