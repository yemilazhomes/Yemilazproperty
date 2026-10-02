/* =========================================================
   HOME NIGERIA RENTAL — TENANT.JS
   Tenant Data & Service Module

   IMPORTANT:
   This file does NOT replace app.js.
   It is a service module that we will connect later.
   ========================================================= */

import auth from "./auth.js";

const supabase = auth.supabase;


/* =========================================================
   CURRENT TENANT
   ========================================================= */

export async function getCurrentTenant() {

    const user = await auth.getCurrentUser();

    if (!user) {
        return null;
    }

    const profile = await auth.getUserProfile(user.id);

    if (!profile) {
        return null;
    }

    return {
        user,
        profile
    };
}


/* =========================================================
   TENANT PROFILE
   ========================================================= */

export async function getTenantProfile() {

    const tenant = await getCurrentTenant();

    if (!tenant) {
        return null;
    }

    return tenant.profile;
}


/* =========================================================
   TENANCIES
   ========================================================= */

export async function getTenantTenancies() {

    const user = await auth.getCurrentUser();

    if (!user) {
        throw new Error("You are not logged in.");
    }

    const {
        data,
        error
    } = await supabase
        .from("tenancies")
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    return data || [];
}


/* =========================================================
   ACTIVE TENANCY
   ========================================================= */

export async function getActiveTenantTenancy() {

    const user = await auth.getCurrentUser();

    if (!user) {
        return null;
    }

    const {
        data,
        error
    } = await supabase
        .from("tenancies")
        .select("*")
        .eq("tenant_id", user.id)
        .not("status", "in", '("ended","terminated")')
        .order("created_at", {
            ascending: false
        })
        .limit(1);

    if (error) {
        throw error;
    }

    return data?.[0] || null;
}


/* =========================================================
   TENANT PROPERTY
   ========================================================= */

export async function getTenantProperties() {

    const tenancies = await getTenantTenancies();

    if (!tenancies.length) {
        return [];
    }

    const propertyIds = tenancies
        .map(tenancy => tenancy.property_id)
        .filter(Boolean);

    if (!propertyIds.length) {
        return [];
    }

    const {
        data,
        error
    } = await supabase
        .from("properties")
        .select(`
            *,
            property_images (
                id,
                image_url,
                storage_path,
                caption,
                sort_order
            )
        `)
        .in("id", propertyIds);

    if (error) {
        throw error;
    }

    return data || [];
}


/* =========================================================
   CURRENT TENANT PROPERTY
   ========================================================= */

export async function getCurrentTenantProperty() {

    const tenancy =
        await getActiveTenantTenancy();

    if (!tenancy?.property_id) {
        return null;
    }

    const {
        data,
        error
    } = await supabase
        .from("properties")
        .select(`
            *,
            property_images (
                id,
                image_url,
                storage_path,
                caption,
                sort_order
            )
        `)
        .eq("id", tenancy.property_id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}


/* =========================================================
   TENANT PAYMENTS
   ========================================================= */

export async function getTenantPayments() {

    const user = await auth.getCurrentUser();

    if (!user) {
        throw new Error("You are not logged in.");
    }

    const {
        data,
        error
    } = await supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", user.id)
        .order("payment_date", {
            ascending: false
        })
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    return data || [];
}


/* =========================================================
   TENANT COMPLAINTS
   ========================================================= */

export async function getTenantComplaints() {

    const user = await auth.getCurrentUser();

    if (!user) {
        throw new Error("You are not logged in.");
    }

    const {
        data,
        error
    } = await supabase
        .from("complaints")
        .select("*")
        .eq("tenant_id", user.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    return data || [];
}


/* =========================================================
   TENANT MESSAGES
   ========================================================= */

export async function getTenantMessages() {

    const user = await auth.getCurrentUser();

    if (!user) {
        throw new Error("You are not logged in.");
    }

    const {
        data,
        error
    } = await supabase
        .from("messages")
        .select("*")
        .or(
            `recipient_id.eq.${user.id},send_to_all_tenants.eq.true`
        )
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    return data || [];
}


/* =========================================================
   TENANT NOTIFICATIONS
   ========================================================= */

export async function getTenantNotifications() {

    const user = await auth.getCurrentUser();

    if (!user) {
        throw new Error("You are not logged in.");
    }

    const {
        data,
        error
    } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    return data || [];
}


/* =========================================================
   UNREAD NOTIFICATIONS
   ========================================================= */

export async function getUnreadNotifications() {

    const user = await auth.getCurrentUser();

    if (!user) {
        throw new Error("You are not logged in.");
    }

    const {
        data,
        error
    } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    return data || [];
}


/* =========================================================
   NOTIFICATION COUNT
   ========================================================= */

export async function getUnreadNotificationCount() {

    const user = await auth.getCurrentUser();

    if (!user) {
        return 0;
    }

    const {
        count,
        error
    } = await supabase
        .from("notifications")
        .select("*", {
            count: "exact",
            head: true
        })
        .eq("user_id", user.id)
        .eq("is_read", false);

    if (error) {
        throw error;
    }

    return count || 0;
}


/* =========================================================
   MARK NOTIFICATION AS READ
   ========================================================= */

export async function markNotificationRead(
    notificationId
) {

    const user = await auth.getCurrentUser();

    if (!user) {
        throw new Error("You are not logged in.");
    }

    if (!notificationId) {
        throw new Error("Notification ID is required.");
    }

    const {
        data,
        error
    } = await supabase
        .from("notifications")
        .update({
            is_read: true
        })
        .eq("id", notificationId)
        .eq("user_id", user.id)
        .select()
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}


/* =========================================================
   MARK ALL NOTIFICATIONS AS READ
   ========================================================= */

export async function markAllNotificationsRead() {

    const user = await auth.getCurrentUser();

    if (!user) {
        throw new Error("You are not logged in.");
    }

    const {
        error
    } = await supabase
        .from("notifications")
        .update({
            is_read: true
        })
        .eq("user_id", user.id)
        .eq("is_read", false);

    if (error) {
        throw error;
    }

    return true;
}


/* =========================================================
   SUBMIT TENANT COMPLAINT
   ========================================================= */

export async function submitTenantComplaint({
    title,
    description,
    priority = "medium",
    imageFile = null
} = {}) {

    const user = await auth.getCurrentUser();

    if (!user) {
        throw new Error("You are not logged in.");
    }

    title = String(title || "").trim();
    description = String(description || "").trim();
    priority = String(priority || "medium").trim();

    if (!title) {
        throw new Error("Please enter the complaint title.");
    }

    if (!description) {
        throw new Error("Please describe the complaint.");
    }

    const tenancy =
        await getActiveTenantTenancy();

    if (!tenancy) {
        throw new Error(
            "You do not have an active tenancy."
        );
    }

    let imageUrl = null;

    /* -----------------------------------------------------
       OPTIONAL COMPLAINT IMAGE
       ----------------------------------------------------- */

    if (imageFile) {

        if (!imageFile.type?.startsWith("image/")) {
            throw new Error(
                "The complaint attachment must be an image."
            );
        }

        const safeName =
            String(imageFile.name || "image")
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

        const path =
            `complaints/${user.id}/${Date.now()}_${safeName}`;

        const {
            error: uploadError
        } = await supabase
            .storage
            .from("private-files")
            .upload(
                path,
                imageFile,
                {
                    upsert: false,
                    contentType: imageFile.type
                }
            );

        if (uploadError) {
            throw uploadError;
        }

        const {
            data: publicData
        } = supabase
            .storage
            .from("private-files")
            .getPublicUrl(path);

        imageUrl =
            publicData?.publicUrl || null;
    }


    /* -----------------------------------------------------
       INSERT COMPLAINT
       ----------------------------------------------------- */

    const {
        data,
        error
    } = await supabase
        .from("complaints")
        .insert({
            tenant_id: user.id,
            property_id: tenancy.property_id,
            title,
            description,
            image_url: imageUrl,
            priority,
            status: "open"
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}


/* =========================================================
   TENANT DASHBOARD DATA
   ========================================================= */

export async function getTenantDashboard() {

    const tenant =
        await getCurrentTenant();

    if (!tenant) {
        throw new Error("Tenant account not found.");
    }

    const [
        tenancies,
        properties,
        payments,
        complaints,
        messages,
        notifications
    ] = await Promise.all([
        getTenantTenancies(),
        getTenantProperties(),
        getTenantPayments(),
        getTenantComplaints(),
        getTenantMessages(),
        getTenantNotifications()
    ]);

    return {
        user: tenant.user,
        profile: tenant.profile,
        tenancies,
        properties,
        payments,
        complaints,
        messages,
        notifications
    };
}


/* =========================================================
   TENANT SUMMARY
   ========================================================= */

export async function getTenantSummary() {

    const [
        tenancy,
        property,
        payments,
        complaints,
        unreadNotifications
    ] = await Promise.all([
        getActiveTenantTenancy(),
        getCurrentTenantProperty(),
        getTenantPayments(),
        getTenantComplaints(),
        getUnreadNotifications()
    ]);

    const totalPayments =
        payments.reduce(
            (total, payment) =>
                total +
                Number(payment.amount || 0),
            0
        );

    const openComplaints =
        complaints.filter(
            complaint =>
                complaint.status !== "resolved"
        );

    return {
        tenancy,
        property,
        payments,
        totalPayments,
        complaints,
        openComplaints,
        unreadNotifications,
        unreadNotificationCount:
            unreadNotifications.length
    };
}


/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

const tenant = {

    supabase,

    getCurrentTenant,
    getTenantProfile,

    getTenantTenancies,
    getActiveTenantTenancy,

    getTenantProperties,
    getCurrentTenantProperty,

    getTenantPayments,
    getTenantComplaints,
    getTenantMessages,
    getTenantNotifications,

    getUnreadNotifications,
    getUnreadNotificationCount,

    markNotificationRead,
    markAllNotificationsRead,

    submitTenantComplaint,

    getTenantDashboard,
    getTenantSummary

};

export default tenant;
