/* =========================================================
   HOME NIGERIA RENTAL — AUTH.JS
   Authentication & Session Service
   ========================================================= */

import {
    createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";


/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL =
    "https://qghumlexkybfndcrkgqk.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_zD3Ht0N3IA_AKLpCDfYP9A_UhNKhE1f";


const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


/* =========================================================
   GET SUPABASE CLIENT
   ========================================================= */

export function getSupabase() {
    return supabase;
}


/* =========================================================
   GET CURRENT SESSION
   ========================================================= */

export async function getCurrentSession() {

    const {
        data,
        error
    } = await supabase.auth.getSession();

    if (error) {
        throw error;
    }

    return data?.session || null;
}


/* =========================================================
   GET CURRENT USER
   ========================================================= */

export async function getCurrentUser() {

    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    return data?.user || null;
}


/* =========================================================
   GET USER PROFILE
   ========================================================= */

export async function getUserProfile(userId) {

    if (!userId) {
        return null;
    }

    const {
        data,
        error
    } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}


/* =========================================================
   LOGIN
   ========================================================= */

export async function loginUser(
    email,
    password
) {

    const cleanEmail =
        String(email || "")
            .trim()
            .toLowerCase();

    if (!cleanEmail) {
        throw new Error(
            "Please enter your email address."
        );
    }

    if (!password) {
        throw new Error(
            "Please enter your password."
        );
    }


    const {
        data,
        error
    } = await supabase.auth.signInWithPassword({

        email:
            cleanEmail,

        password:
            password

    });


    if (error) {
        throw error;
    }


    if (!data?.user) {
        throw new Error(
            "Login was not completed."
        );
    }


    return {

        user:
            data.user,

        session:
            data.session

    };
}


/* =========================================================
   LOGOUT
   ========================================================= */

export async function logoutUser() {

    const {
        error
    } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }

    return true;
}


/* =========================================================
   CHECK WHETHER USER IS LOGGED IN
   ========================================================= */

export async function isLoggedIn() {

    const session =
        await getCurrentSession();

    return !!session?.user;
}


/* =========================================================
   GET COMPLETE AUTHENTICATED USER
   ========================================================= */

export async function getAuthenticatedUser() {

    const session =
        await getCurrentSession();


    if (!session?.user) {

        return {

            user: null,

            profile: null,

            session: null

        };

    }


    const profile =
        await getUserProfile(
            session.user.id
        );


    return {

        user:
            session.user,

        profile:
            profile,

        session:
            session

    };
}


/* =========================================================
   CHECK USER ROLE
   ========================================================= */

export async function getUserRole() {

    const authenticated =
        await getAuthenticatedUser();


    return (
        authenticated.profile?.role ||
        null
    );
}


/* =========================================================
   CHECK ADMIN
   ========================================================= */

export async function isAdmin() {

    const role =
        await getUserRole();

    return role === "admin";
}


/* =========================================================
   CHECK TENANT
   ========================================================= */

export async function isTenant() {

    const role =
        await getUserRole();

    return role === "tenant";
}


/* =========================================================
   PASSWORD RESET
   ========================================================= */

export async function resetPassword(
    email
) {

    const cleanEmail =
        String(email || "")
            .trim()
            .toLowerCase();


    if (!cleanEmail) {

        throw new Error(
            "Please enter your email address."
        );

    }


    const redirectUrl =
        `${window.location.origin}${window.location.pathname}`;


    const {
        error
    } = await supabase.auth
        .resetPasswordForEmail(
            cleanEmail,
            {
                redirectTo:
                    redirectUrl
            }
        );


    if (error) {
        throw error;
    }


    return true;
}


/* =========================================================
   UPDATE PASSWORD
   ========================================================= */

export async function updatePassword(
    newPassword
) {

    if (!newPassword) {

        throw new Error(
            "Please enter a new password."
        );

    }


    if (newPassword.length < 6) {

        throw new Error(
            "Password must be at least 6 characters."
        );

    }


    const {
        data,
        error
    } = await supabase.auth.updateUser({

        password:
            newPassword

    });


    if (error) {
        throw error;
    }


    return data?.user || null;
}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

export function onAuthStateChange(
    callback
) {

    if (
        typeof callback !==
        "function"
    ) {
        throw new Error(
            "Authentication callback must be a function."
        );
    }


    const {
        data
    } = supabase.auth.onAuthStateChange(

        (
            event,
            session
        ) => {

            callback(
                event,
                session
            );

        }

    );


    return data?.subscription || null;
}


/* =========================================================
   SIGN UP
   ========================================================= */

export async function registerUser(
    email,
    password,
    fullName = "",
    phone = ""
) {

    const cleanEmail =
        String(email || "")
            .trim()
            .toLowerCase();


    if (!cleanEmail) {

        throw new Error(
            "Please enter an email address."
        );

    }


    if (!password) {

        throw new Error(
            "Please enter a password."
        );

    }


    if (password.length < 6) {

        throw new Error(
            "Password must be at least 6 characters."
        );

    }


    const {
        data,
        error
    } = await supabase.auth.signUp({

        email:
            cleanEmail,

        password:
            password,

        options: {

            data: {

                full_name:
                    String(fullName || "")
                        .trim(),

                phone:
                    String(phone || "")
                        .trim()

            }

        }

    });


    if (error) {
        throw error;
    }


    return {

        user:
            data?.user || null,

        session:
            data?.session || null

    };
}


/* =========================================================
   UPDATE PROFILE
   ========================================================= */

export async function updateProfile(
    userId,
    profileData
) {

    if (!userId) {

        throw new Error(
            "User ID is required."
        );

    }


    const {
        data,
        error
    } = await supabase
        .from("profiles")
        .update({

            ...profileData,

            updated_at:
                new Date().toISOString()

        })
        .eq(
            "id",
            userId
        )
        .select()
        .maybeSingle();


    if (error) {
        throw error;
    }


    return data || null;
}


/* =========================================================
   EXPORT DEFAULT AUTH SERVICE
   ========================================================= */

const auth = {

    supabase,

    getCurrentSession,

    getCurrentUser,

    getUserProfile,

    loginUser,

    logoutUser,

    isLoggedIn,

    getAuthenticatedUser,

    getUserRole,

    isAdmin,

    isTenant,

    resetPassword,

    updatePassword,

    onAuthStateChange,

    registerUser,

    updateProfile

};


export default auth;
