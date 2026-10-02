/* =========================================================
   YEMILAZ HOMES — APP.JS
   Property Management System
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
   GLOBAL STATE
   ========================================================= */

let currentUser = null;
let currentProfile = null;

let properties = [];
let propertyImages = [];

let tenants = [];
let tenancies = [];
let payments = [];
let complaints = [];
let messages = [];
let notifications = [];

let editingPropertyId = null;
let editingTenantId = null;

// Prevent the property list from briefly showing an empty state
// while Supabase is still loading the records.
let adminPropertiesLoaded = false;


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function money(value) {
    const amount = Number(value || 0);

    return "₦" + amount.toLocaleString("en-NG", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}


function formatDate(date) {
    if (!date) {
        return "—";
    }

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return "—";
    }

    return d.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}


function formatDateTime(date) {
    if (!date) {
        return "—";
    }

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return "—";
    }

    return d.toLocaleString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}


function todayString() {
    const d = new Date();

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function daysUntil(date) {
    if (!date) {
        return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    return Math.ceil(
        (target - today) / (1000 * 60 * 60 * 24)
    );
}


function showToast(message, type = "success") {
    const toast = $("toast");

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;

    toast.classList.remove(
        "success",
        "error",
        "warning",
        "show"
    );

    toast.classList.add(type);
    toast.classList.add("show");

    clearTimeout(window.__toastTimer);

    window.__toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}


function showError(message) {
    console.error(message);
    showToast(message, "error");
}


function getErrorMessage(error) {
    if (!error) {
        return "An unknown error occurred.";
    }

    if (typeof error === "string") {
        return error;
    }

    /*
     * Supabase errors can contain the useful message in several
     * different places. In particular, an Edge Function/fetch error
     * can put the actual response inside `context`.
     */
    const candidates = [
        error.message,
        error.error_description,
        error.details,
        error.hint,
        error.msg,
        error.error,
        error.context?.message,
        error.context?.error_description,
        error.context?.details,
        error.context?.error,
        error.context?.body?.message,
        error.context?.body?.error,
        error.context?.body?.error_description,
        error.context?.body?.details
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }

    if (error.context?.body) {
        try {
            const body =
                typeof error.context.body === "string"
                    ? JSON.parse(error.context.body)
                    : error.context.body;

            const bodyMessage =
                body?.message ||
                body?.error_description ||
                body?.error ||
                body?.details;

            if (typeof bodyMessage === "string" && bodyMessage.trim()) {
                return bodyMessage.trim();
            }
        } catch (_) {
            if (typeof error.context.body === "string" && error.context.body.trim()) {
                return error.context.body.trim();
            }
        }
    }

    if (error.context?.response) {
        try {
            const response = error.context.response;
            const status = response.status ? ` (HTTP ${response.status})` : "";
            return `${error.message || "Request failed"}${status}`;
        } catch (_) {
            // Continue to the generic fallback below.
        }
    }

    return "An unexpected error occurred.";
}


function getDetailedErrorMessage(error, operation = "Operation") {
    const message = getErrorMessage(error);

    if (!error || typeof error !== "object") {
        return message;
    }

    const parts = [message];

    if (error.code && !message.includes(String(error.code))) {
        parts.push(`Code: ${error.code}`);
    }

    if (error.status && !message.includes(`HTTP ${error.status}`)) {
        parts.push(`HTTP ${error.status}`);
    }

    if (error.statusText && !message.includes(error.statusText)) {
        parts.push(error.statusText);
    }

    if (error.context?.body) {
        try {
            const body =
                typeof error.context.body === "string"
                    ? JSON.parse(error.context.body)
                    : error.context.body;

            const detail =
                body?.message ||
                body?.error_description ||
                body?.error ||
                body?.details ||
                body?.hint;

            if (typeof detail === "string" && detail.trim() && !parts.join(" ").includes(detail.trim())) {
                parts.push(detail.trim());
            }
        } catch (_) {
            // Ignore non-JSON response bodies here.
        }
    }

    const result = parts.filter(Boolean).join(" — ");

    console.error(`${operation} detailed error:`, error);

    return result || "An unexpected error occurred.";
}


function setButtonLoading(button, loading, loadingText = "Please wait...") {
    if (!button) {
        return;
    }

    if (loading) {
        button.dataset.originalText = button.textContent;
        button.disabled = true;
        button.textContent = loadingText;
    } else {
        button.disabled = false;

        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
        }
    }
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    const year = $("currentYear");

    if (year) {
        year.textContent = new Date().getFullYear();
    }

    setupEventListeners();

    await checkExistingSession();

});


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {

    const loginForm = $("loginForm");

    if (loginForm) {
        loginForm.addEventListener(
            "submit",
            handleLogin
        );
    }


    const propertyForm = $("propertyForm");

    if (propertyForm) {
        propertyForm.addEventListener(
            "submit",
            handlePropertySubmit
        );
    }


    const tenantForm = $("tenantForm");

    if (tenantForm) {
        tenantForm.addEventListener(
            "submit",
            handleTenantSubmit
        );
    }


    const paymentForm = $("paymentForm");

    if (paymentForm) {
        paymentForm.addEventListener(
            "submit",
            handlePaymentSubmit
        );
    }


    const complaintForm = $("tenantComplaintForm");

    if (complaintForm) {
        complaintForm.addEventListener(
            "submit",
            handleComplaintSubmit
        );
    }


    const messageForm = $("messageForm");

    if (messageForm) {
        messageForm.addEventListener(
            "submit",
            handleMessageSubmit
        );
    }


    const passwordToggle = $("togglePassword");

    if (passwordToggle) {
        passwordToggle.addEventListener(
            "click",
            togglePassword
        );
    }


    const propertySearch = $("propertySearch");

    if (propertySearch) {
        propertySearch.addEventListener(
            "input",
            renderPublicProperties
        );
    }


    const propertyTypeFilter = $("propertyTypeFilter");

    if (propertyTypeFilter) {
        propertyTypeFilter.addEventListener(
            "change",
            renderPublicProperties
        );
    }


    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {

                closeLoginModal();
                closePropertyDetails();

            }

        }
    );


    supabase.auth.onAuthStateChange(
        async (event, session) => {

            if (event === "SIGNED_OUT") {

                currentUser = null;
                currentProfile = null;

                showPublicApp();

                return;
            }

            if (
                event === "SIGNED_IN" ||
                event === "TOKEN_REFRESHED" ||
                event === "INITIAL_SESSION"
            ) {

                if (session?.user) {
                    await loadUserFromSession(session);
                }

            }

        }
    );
}


/* =========================================================
   SESSION
   ========================================================= */

async function checkExistingSession() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (error) {
            console.error(error);
            return;
        }

        if (data?.session?.user) {

            await loadUserFromSession(
                data.session
            );

        } else {

            showPublicApp();
            await loadPublicProperties();

        }

    } catch (error) {

        console.error(
            "Session check failed:",
            error
        );

        showPublicApp();

        await loadPublicProperties();
    }
}


async function loadUserFromSession(session) {

    if (!session?.user) {
        return;
    }

    currentUser = session.user;

    const {
        data: profile,
        error
    } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (error) {

        console.error(
            "Profile error:",
            error
        );

        showError(
            "Could not load your profile."
        );

        return;
    }


    if (!profile) {

        showError(
            "Your account profile was not found."
        );

        await supabase.auth.signOut();

        return;
    }


    if (profile.active === false) {

        showError(
            "Your account has been deactivated."
        );

        await supabase.auth.signOut();

        return;
    }


    currentProfile = profile;

    closeLoginModal();

    if (profile.role === "admin") {

        await openAdminApplication();

    } else {

        await openTenantApplication();

    }
}


/* =========================================================
   LOGIN
   ========================================================= */

function openLoginModal() {

    const modal = $("loginModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("hidden");
    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    const errorBox = $("loginError");

    if (errorBox) {
        errorBox.textContent = "";
        errorBox.classList.add("hidden");
    }

    setTimeout(() => {

        $("loginEmail")?.focus();

    }, 100);
}


function closeLoginModal() {

    const modal = $("loginModal");

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");
    modal.setAttribute(
        "aria-hidden",
        "true"
    );
}


async function handleLogin(event) {

    event.preventDefault();

    const email = $("loginEmail")?.value
        .trim()
        .toLowerCase();

    const password = $("loginPassword")?.value;

    const button = $("loginSubmitBtn");

    const errorBox = $("loginError");


    if (!email || !password) {

        displayLoginError(
            "Please enter your email and password."
        );

        return;
    }


    setButtonLoading(
        button,
        true,
        "Signing in..."
    );


    if (errorBox) {
        errorBox.classList.add("hidden");
    }


    try {

        const {
            data,
            error
        } = await supabase.auth.signInWithPassword({
            email,
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


        await loadUserFromSession(
            data.session
        );


    } catch (error) {

        console.error(
            "Login failed:",
            error
        );

        displayLoginError(
            getErrorMessage(error)
        );

    } finally {

        setButtonLoading(
            button,
            false
        );

    }
}


function displayLoginError(message) {

    const errorBox = $("loginError");

    if (!errorBox) {
        showError(message);
        return;
    }

    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}


function togglePassword() {

    const input = $("loginPassword");
    const button = $("togglePassword");

    if (!input) {
        return;
    }

    if (input.type === "password") {

        input.type = "text";

        if (button) {
            button.textContent = "🙈";
            button.setAttribute(
                "aria-label",
                "Hide password"
            );
        }

    } else {

        input.type = "password";

        if (button) {
            button.textContent = "👁";
            button.setAttribute(
                "aria-label",
                "Show password"
            );
        }
    }
}


/* =========================================================
   PUBLIC WEBSITE
   ========================================================= */

function showPublicApp() {

    $("publicApp")?.classList.remove("hidden");

    $("adminApp")?.classList.add("hidden");

    $("tenantApp")?.classList.add("hidden");

    loadPublicProperties();
}


function showPublicSection(sectionId) {

    const sections = document.querySelectorAll(
        "#publicApp .public-section"
    );

    sections.forEach(section => {

        section.classList.toggle(
            "active",
            section.id === sectionId
        );

    });


    if (sectionId === "properties") {
        renderPublicProperties();
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


async function loadPublicProperties() {

    try {

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
            .eq("advertised", true)
            .eq("status", "vacant")
            .order("created_at", {
                ascending: false
            });


        if (error) {
            throw error;
        }


        properties = data || [];

        renderPublicProperties();

        renderHomeProperties();

    } catch (error) {

        console.error(
            "Public properties error:",
            error
        );

    }
}


function renderHomeProperties() {

    const container = $("homePropertyList");

    if (!container) {
        return;
    }


    const available = properties
        .filter(
            property =>
                property.advertised === true &&
                property.status === "vacant"
        )
        .slice(0, 6);


    if (!available.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏠</div>
                <h3>Properties coming soon</h3>
                <p>Available properties will appear here.</p>
            </div>
        `;

        return;
    }


    container.innerHTML = available
        .map(renderPropertyCard)
        .join("");
}


function renderPublicProperties() {

    const container = $("propertyList");

    if (!container) {
        return;
    }


    const search = (
        $("propertySearch")?.value || ""
    )
        .trim()
        .toLowerCase();


    const type = (
        $("propertyTypeFilter")?.value || ""
    );


    const filtered = properties.filter(property => {

        const text = [
            property.property_name,
            property.property_type,
            property.address,
            property.city,
            property.state,
            property.description
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        const matchesSearch =
            !search ||
            text.includes(search);


        const matchesType =
            !type ||
            property.property_type === type;


        return (
            matchesSearch &&
            matchesType
        );

    });


    if (!filtered.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏠</div>
                <h3>No properties found</h3>
                <p>Try another search or property type.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        filtered
            .map(renderPropertyCard)
            .join("");
}


function getPropertyImage(property) {

    if (property.main_image_url) {
        return property.main_image_url;
    }


    const images =
        property.property_images ||
        [];


    if (images.length) {

        const sorted =
            [...images].sort(
                (a, b) =>
                    Number(a.sort_order || 0) -
                    Number(b.sort_order || 0)
            );

        return sorted[0]?.image_url || "";
    }


    return "";
}


function renderPropertyCard(property) {

    const image =
        getPropertyImage(property);


    const imageHTML = image
        ? `
            <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(property.property_name)}"
                loading="lazy"
            >
        `
        : `
            <div class="property-image-placeholder">
                🏠
            </div>
        `;


    const location = [
        property.city,
        property.state
    ]
        .filter(Boolean)
        .join(", ");


    return `
        <article
            class="property-card"
            onclick="openPropertyDetails('${property.id}')"
        >

            <div class="property-card-image">
                ${imageHTML}

                <span class="property-status">
                    Available
                </span>
            </div>

            <div class="property-card-content">

                <span class="section-label">
                    ${escapeHTML(
                        property.property_type || "Property"
                    )}
                </span>

                <h3>
                    ${escapeHTML(
                        property.property_name
                    )}
                </h3>

                <p class="property-address">
                    📍 ${escapeHTML(
                        location ||
                        property.address ||
                        "Location not specified"
                    )}
                </p>

                <div class="property-price">
                    ${money(property.rent_amount)}
                    <small>/ rent</small>
                </div>

                <div class="property-meta">

                    ${
                        property.bedrooms !== null &&
                        property.bedrooms !== undefined
                            ? `<span>🛏 ${escapeHTML(property.bedrooms)} beds</span>`
                            : ""
                    }

                    ${
                        property.bathrooms !== null &&
                        property.bathrooms !== undefined
                            ? `<span>🚿 ${escapeHTML(property.bathrooms)} baths</span>`
                            : ""
                    }

                </div>

            </div>

        </article>
    `;
}


/* =========================================================
   PROPERTY DETAILS
   ========================================================= */

async function openPropertyDetails(propertyId) {

    const property =
        properties.find(
            item => String(item.id) === String(propertyId)
        );


    if (!property) {
        return;
    }


    const modal = $("propertyDetailsModal");
    const content = $("propertyDetailsContent");

    if (!modal || !content) {
        return;
    }


    const images =
        property.property_images || [];


    const sortedImages =
        [...images].sort(
            (a, b) =>
                Number(a.sort_order || 0) -
                Number(b.sort_order || 0)
        );


    const allImages = sortedImages.length
        ? sortedImages.map(image => image.image_url)
        : (
            property.main_image_url
                ? [property.main_image_url]
                : []
        );


    const gallery =
        allImages.length
            ? `
                <div class="property-gallery">

                    ${allImages.map(image => `
                        <img
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(property.property_name)}"
                            loading="lazy"
                        >
                    `).join("")}

                </div>
            `
            : `
                <div class="property-gallery-empty">
                    🏠
                </div>
            `;


    const location = [
        property.address,
        property.city,
        property.state
    ]
        .filter(Boolean)
        .join(", ");


    content.innerHTML = `

        ${gallery}

        <div class="property-details-body">

            <span class="section-label">
                ${escapeHTML(
                    property.property_type || "Property"
                )}
            </span>

            <h2>
                ${escapeHTML(
                    property.property_name
                )}
            </h2>

            <p>
                📍 ${escapeHTML(
                    location || "Location not specified"
                )}
            </p>

            <div class="property-detail-price">
                ${money(property.rent_amount)}
                <small> rent</small>
            </div>

            <div class="property-detail-grid">

                <div>
                    <strong>Security Fee</strong>
                    <span>${money(property.security_fee)}</span>
                </div>

                <div>
                    <strong>Service Charge</strong>
                    <span>${money(property.service_charge)}</span>
                </div>

                <div>
                    <strong>Bedrooms</strong>
                    <span>${escapeHTML(
                        property.bedrooms ?? "—"
                    )}</span>
                </div>

                <div>
                    <strong>Bathrooms</strong>
                    <span>${escapeHTML(
                        property.bathrooms ?? "—"
                    )}</span>
                </div>

            </div>

            ${
                property.description
                    ? `
                        <div class="property-description">
                            <h3>Description</h3>
                            <p>
                                ${escapeHTML(
                                    property.description
                                )}
                            </p>
                        </div>
                    `
                    : ""
            }

        </div>
    `;


    modal.classList.remove("hidden");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );
}


function closePropertyDetails() {

    const modal = $("propertyDetailsModal");

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* =========================================================
   ADMIN APPLICATION
   ========================================================= */

async function openAdminApplication() {

    $("publicApp")?.classList.add("hidden");

    $("tenantApp")?.classList.add("hidden");

    $("adminApp")?.classList.remove("hidden");

    adminPropertiesLoaded = false;
    const adminPropertyList = $("adminPropertyList");
    if (adminPropertyList) {
        adminPropertyList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⏳</div>
                <h3>Loading properties...</h3>
                <p>Please wait while your properties are loaded.</p>
            </div>
        `;
    }


    if ($("adminUserName")) {

        $("adminUserName").textContent =
            currentProfile?.full_name ||
            currentProfile?.email ||
            "Landlord";

    }


    await loadAdminData();

    showAdminSection(
        "adminDashboard"
    );
}


async function loadAdminData() {

    await Promise.all([
        loadProperties(),
        loadTenants(),
        loadTenancies(),
        loadPayments(),
        loadComplaints(),
        loadMessages(),
        loadAdminNotifications()
    ]);


    renderAdminDashboard();
    renderAdminProperties();
    renderAdminTenants();
    renderAdminPayments();
    renderAdminComplaints();
    renderAdminMessages();
    renderAdminNotifications();

    populateTenantPropertySelect();
    populatePaymentTenantSelect();
    populateMessageRecipientSelect();
}


async function loadProperties() {

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
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error("Properties load error:", error);
        adminPropertiesLoaded = false;
        throw error;
    }

    properties = Array.isArray(data) ? data : [];
    adminPropertiesLoaded = true;
}

async function loadTenants() {

    const {
        data,
        error
    } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "tenant")
        .order("full_name", {
            ascending: true
        });


    if (error) {

        console.error(
            "Tenant load error:",
            error
        );

        return;
    }


    tenants = data || [];
}


async function loadTenancies() {

    const {
        data,
        error
    } = await supabase
        .from("tenancies")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Tenancy load error:",
            error
        );

        return;
    }


    tenancies = data || [];
}


async function loadPayments() {

    const {
        data,
        error
    } = await supabase
        .from("payments")
        .select("*")
        .order("payment_date", {
            ascending: false
        })
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Payment load error:",
            error
        );

        return;
    }


    payments = data || [];
}


async function loadComplaints() {

    const {
        data,
        error
    } = await supabase
        .from("complaints")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Complaint load error:",
            error
        );

        return;
    }


    complaints = data || [];
}


async function loadMessages() {

    const {
        data,
        error
    } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Message load error:",
            error
        );

        return;
    }


    messages = data || [];
}


async function loadAdminNotifications() {

    if (!currentUser) {
        return;
    }


    const {
        data,
        error
    } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Notification load error:",
            error
        );

        return;
    }


    notifications = data || [];
}


/* =========================================================
   ADMIN NAVIGATION
   ========================================================= */

function showAdminSection(
    sectionId,
    button = null
) {

    document
        .querySelectorAll(
            "#adminApp .private-section"
        )
        .forEach(section => {

            section.classList.toggle(
                "active",
                section.id === sectionId
            );

        });


    document
        .querySelectorAll(
            "#adminApp .sidebar-link[data-section]"
        )
        .forEach(link => {

            link.classList.toggle(
                "active",
                link.dataset.section === sectionId
            );

        });


    if (button) {
        button.classList.add("active");
    }


    const titles = {

        adminDashboard: [
            "Dashboard",
            "Overview of your property business"
        ],

        adminProperties: [
            "Properties",
            "Manage your properties"
        ],

        adminTenants: [
            "Tenants",
            "Manage your tenants"
        ],

        adminPayments: [
            "Payments",
            "Manage rent and other payments"
        ],

        adminComplaints: [
            "Complaints",
            "View and respond to tenant complaints"
        ],

        adminMessages: [
            "Messages",
            "Send important announcements"
        ],

        adminNotifications: [
            "Notifications",
            "Rent reminders and system notifications"
        ]

    };


    const title = titles[sectionId];

    if (title) {

        if ($("adminPageTitle")) {
            $("adminPageTitle").textContent =
                title[0];
        }

        if ($("adminPageSubtitle")) {
            $("adminPageSubtitle").textContent =
                title[1];
        }

    }


    closeMobileSidebars();
}


function toggleSidebar() {

    $("adminSidebar")?.classList.toggle(
        "open"
    );
}


function toggleTenantSidebar() {

    document
        .querySelector(
            ".tenant-sidebar"
        )
        ?.classList.toggle("open");
}


function closeMobileSidebars() {

    $("adminSidebar")?.classList.remove(
        "open"
    );

    document
        .querySelector(
            ".tenant-sidebar"
        )
        ?.classList.remove("open");
}


/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */

function getActiveTenancies() {

    return tenancies.filter(
        tenancy =>
            tenancy.status !== "ended" &&
            tenancy.status !== "terminated"
    );
}


function getExpiringTenancies(days = 30) {

    return getActiveTenancies()
        .filter(tenancy => {

            const remaining =
                daysUntil(tenancy.rent_end);

            return (
                remaining !== null &&
                remaining >= 0 &&
                remaining <= days
            );

        })
        .sort(
            (a, b) =>
                new Date(a.rent_end) -
                new Date(b.rent_end)
        );
}


function renderAdminDashboard() {

    const statProperties =
        $("statProperties");

    const statTenants =
        $("statTenants");

    const statPayments =
        $("statPayments");

    const statExpiring =
        $("statExpiring");


    if (statProperties) {

        statProperties.textContent =
            properties.length;

    }


    if (statTenants) {

        statTenants.textContent =
            tenants.length;

    }


    if (statPayments) {

        const total =
            payments.reduce(
                (sum, payment) =>
                    sum +
                    Number(payment.amount || 0),
                0
            );

        statPayments.textContent =
            money(total);

    }


    const expiring =
        getExpiringTenancies(30);


    if (statExpiring) {

        statExpiring.textContent =
            expiring.length;

    }


    renderDashboardComplaints();

    renderDashboardExpiring();

    updateComplaintBadge();

}


function renderDashboardComplaints() {

    const container =
        $("dashboardComplaints");

    if (!container) {
        return;
    }


    const recent =
        complaints.slice(0, 5);


    if (!recent.length) {

        container.innerHTML = `
            <div class="empty-small">
                No complaints yet.
            </div>
        `;

        return;
    }


    container.innerHTML =
        recent
            .map(renderComplaintSmall)
            .join("");
}


function renderDashboardExpiring() {

    const container =
        $("dashboardExpiring");

    if (!container) {
        return;
    }


    const expiring =
        getExpiringTenancies(30)
            .slice(0, 5);


    if (!expiring.length) {

        container.innerHTML = `
            <div class="empty-small">
                No upcoming expirations.
            </div>
        `;

        return;
    }


    container.innerHTML =
        expiring
            .map(tenancy => {

                const tenant =
                    tenants.find(
                        t =>
                            String(t.id) ===
                            String(tenancy.tenant_id)
                    );


                const property =
                    properties.find(
                        p =>
                            String(p.id) ===
                            String(tenancy.property_id)
                    );


                const days =
                    daysUntil(
                        tenancy.rent_end
                    );


                return `
                    <div class="mini-list-item">

                        <div>
                            <strong>
                                ${escapeHTML(
                                    tenant?.full_name ||
                                    "Tenant"
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    property?.property_name ||
                                    "Property"
                                )}
                            </span>
                        </div>

                        <span>
                            ${
                                days === 0
                                    ? "Expires today"
                                    : `${days} day${days === 1 ? "" : "s"} left`
                            }
                        </span>

                    </div>
                `;

            })
            .join("");
}


function updateComplaintBadge() {

    const badge =
        $("adminComplaintBadge");

    if (!badge) {
        return;
    }


    const pending =
        complaints.filter(
            complaint =>
                complaint.status !== "resolved" &&
                complaint.status !== "closed"
        ).length;


    if (pending > 0) {

        badge.textContent =
            pending;

        badge.classList.remove(
            "hidden"
        );

    } else {

        badge.classList.add(
            "hidden"
        );

    }
}


/* =========================================================
   PROPERTY MANAGEMENT
   ========================================================= */

function openPropertyForm(property = null) {

    const container =
        $("propertyFormContainer");

    const title =
        $("propertyFormTitle");

    const form =
        $("propertyForm");


    if (!container || !form) {
        return;
    }


    container.classList.remove(
        "hidden"
    );


    editingPropertyId =
        property?.id || null;


    if (title) {

        title.textContent =
            property
                ? "Edit Property"
                : "Add Property";

    }


    $("propertyId").value =
        property?.id || "";

    $("propertyName").value =
        property?.property_name || "";

    $("propertyType").value =
        property?.property_type || "";

    $("propertyAddress").value =
        property?.address || "";

    $("propertyCity").value =
        property?.city || "";

    $("propertyState").value =
        property?.state || "";

    $("propertyRent").value =
        property?.rent_amount ?? "";

    $("propertySecurity").value =
        property?.security_fee ?? "";

    $("propertyService").value =
        property?.service_charge ?? "";

    $("propertyBedrooms").value =
        property?.bedrooms ?? "";

    $("propertyBathrooms").value =
        property?.bathrooms ?? "";

    $("propertyDescription").value =
        property?.description || "";

    $("propertyAdvertised").checked =
        property?.advertised === true;


    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


function closePropertyForm() {

    const container =
        $("propertyFormContainer");

    const form =
        $("propertyForm");


    container?.classList.add(
        "hidden"
    );


    editingPropertyId = null;


    form?.reset();


    if ($("propertyAdvertised")) {
        $("propertyAdvertised").checked =
            false;
    }


    if ($("propertyId")) {
        $("propertyId").value = "";
    }
}


async function handlePropertySubmit(event) {

    event.preventDefault();


    if (!currentUser) {

        showError(
            "You are not logged in."
        );

        return;
    }


    const button =
        $("propertySaveBtn");


    setButtonLoading(
        button,
        true,
        "Saving..."
    );


    try {

        const propertyData = {

            property_name:
                $("propertyName").value.trim(),

            property_type:
                $("propertyType").value,

            address:
                $("propertyAddress").value.trim(),

            city:
                $("propertyCity").value.trim() || null,

            state:
                $("propertyState").value.trim() || null,

            rent_amount:
                Number(
                    $("propertyRent").value || 0
                ),

            security_fee:
                Number(
                    $("propertySecurity").value || 0
                ),

            service_charge:
                Number(
                    $("propertyService").value || 0
                ),

            bedrooms:
                $("propertyBedrooms").value
                    ? Number(
                        $("propertyBedrooms").value
                    )
                    : null,

            bathrooms:
                $("propertyBathrooms").value
                    ? Number(
                        $("propertyBathrooms").value
                    )
                    : null,

            description:
                $("propertyDescription").value.trim() ||
                null,

            advertised:
                $("propertyAdvertised").checked,

            updated_at:
                new Date().toISOString()

        };


        if (!propertyData.property_name) {
            throw new Error(
                "Please enter a property name."
            );
        }


        if (!propertyData.property_type) {
            throw new Error(
                "Please select a property type."
            );
        }


        if (!propertyData.address) {
            throw new Error(
                "Please enter the property address."
            );
        }


        if (propertyData.rent_amount < 0) {
            throw new Error(
                "Rent amount cannot be negative."
            );
        }


        let propertyId;


        if (editingPropertyId) {

            const {
                data,
                error
            } = await supabase
                .from("properties")
                .update(propertyData)
                .eq("id", editingPropertyId)
                .select()
                .single();


            if (error) {
                throw error;
            }


            propertyId =
                data.id;

        } else {

            const {
                data,
                error
            } = await supabase
                .from("properties")
                .insert({
                    ...propertyData,
                    status: "vacant"
                })
                .select()
                .single();


            if (error) {
                throw error;
            }


            propertyId =
                data.id;
        }


        const imageResult = await uploadPropertyImages(propertyId);

        if (imageResult.failed > 0) {
            const detail = imageResult.errors.join("\n\n");
            console.error("Property image upload problems:", imageResult.errors);
            showError(
                `Property was saved, but ${imageResult.failed} image(s) failed.\n\n${detail}`
            );
        } else {
            showToast(
                editingPropertyId
                    ? "Property updated successfully."
                    : "Property added successfully."
            );
        }


        closePropertyForm();

        await loadProperties();

        await loadPublicProperties();

        renderAdminProperties();

        renderAdminDashboard();

    } catch (error) {

        console.error(
            "Property save error:",
            error
        );

        showError(
            getErrorMessage(error)
        );

    } finally {

        setButtonLoading(
            button,
            false
        );

    }
}


/* =========================================================
   PROPERTY IMAGE UPLOAD
   ========================================================= */

async function uploadPropertyImages(propertyId) {

    const input = $("propertyImages");

    if (!input || !input.files || input.files.length === 0) {
        return {
            uploaded: 0,
            failed: 0,
            errors: []
        };
    }

    const files = Array.from(input.files);
    const errors = [];
    let uploaded = 0;
    let failed = 0;

    for (let index = 0; index < files.length; index++) {

        const file = files[index];

        if (!file || !file.type || !file.type.startsWith("image/")) {
            failed++;
            errors.push(`${file?.name || "Selected file"}: This is not a valid image file.`);
            continue;
        }

        const safeName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/_+/g, "_");

        const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${safeName}`;
        const path = `properties/${propertyId}/${uniqueName}`;

        try {
            /*
             * The bucket is PUBLIC for reading, but uploading still requires
             * a Storage INSERT policy. Explicit contentType also prevents
             * some browsers from storing the file with an incorrect MIME type.
             */
            const { error: uploadError } = await supabase
                .storage
                .from("property-images")
                .upload(path, file, {
                    cacheControl: "3600",
                    contentType: file.type,
                    upsert: false
                });

            if (uploadError) {
                throw new Error(
                    `Storage upload failed for "${file.name}": ${
                        uploadError.message || uploadError.error_description || JSON.stringify(uploadError)
                    }`
                );
            }

            const { data: publicData } = supabase
                .storage
                .from("property-images")
                .getPublicUrl(path);

            const imageUrl = publicData?.publicUrl;

            if (!imageUrl) {
                throw new Error(`Supabase did not return a public URL for "${file.name}".`);
            }

            /*
             * Save the image URL first. This guarantees the property's main
             * image can still be displayed even if the gallery row is blocked
             * by a separate RLS policy.
             */
            if (index === 0) {
                const { error: mainImageError } = await supabase
                    .from("properties")
                    .update({
                        main_image_url: imageUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", propertyId);

                if (mainImageError) {
                    throw new Error(
                        `Main image URL could not be saved: ${
                            mainImageError.message || JSON.stringify(mainImageError)
                        }`
                    );
                }
            }

            const { error: imageInsertError } = await supabase
                .from("property_images")
                .insert({
                    property_id: propertyId,
                    image_url: imageUrl,
                    storage_path: path,
                    caption: null,
                    sort_order: index
                });

            if (imageInsertError) {
                /*
                 * Do not pretend the gallery record was saved. The actual
                 * storage upload succeeded, so tell the user exactly what
                 * database policy/schema needs attention.
                 */
                throw new Error(
                    `Image uploaded but gallery record could not be saved for "${file.name}": ${
                        imageInsertError.message || JSON.stringify(imageInsertError)
                    }`
                );
            }

            uploaded++;

        } catch (error) {
            failed++;
            const message = error?.message || String(error);
            errors.push(message);
            console.error("Property image upload error:", error);
        }
    }

    return {
        uploaded,
        failed,
        errors
    };
}

async function editProperty(propertyId) {

    const property =
        properties.find(
            item =>
                String(item.id) ===
                String(propertyId)
        );


    if (!property) {
        return;
    }


    openPropertyForm(property);
}


async function deleteProperty(propertyId) {

    const property =
        properties.find(
            item =>
                String(item.id) ===
                String(propertyId)
        );


    if (!property) {
        return;
    }


    const confirmed =
        confirm(
            `Delete "${property.property_name}"?\n\nThis cannot be undone.`
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } = await supabase
            .from("properties")
            .delete()
            .eq("id", propertyId);


        if (error) {
            throw error;
        }


        showToast(
            "Property deleted."
        );


        await loadProperties();

        await loadPublicProperties();

        renderAdminProperties();

        renderAdminDashboard();

    } catch (error) {

        console.error(
            "Delete property error:",
            error
        );

        showError(
            getErrorMessage(error)
        );

    }
}


async function togglePropertyAdvertised(
    propertyId,
    advertised
) {

    try {

        const {
            error
        } = await supabase
            .from("properties")
            .update({
                advertised:
                    !advertised,
                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                propertyId
            );


        if (error) {
            throw error;
        }


        showToast(
            !advertised
                ? "Property is now advertised."
                : "Property removed from advertisement."
        );


        await loadProperties();

        await loadPublicProperties();

        renderAdminProperties();

    } catch (error) {

        console.error(error);

        showError(
            getErrorMessage(error)
        );
    }
}


async function togglePropertyStatus(
    propertyId,
    currentStatus
) {

    const newStatus =
        currentStatus === "vacant"
            ? "occupied"
            : "vacant";


    try {

        const {
            error
        } = await supabase
            .from("properties")
            .update({
                status: newStatus,
                advertised:
                    newStatus === "vacant"
                        ? true
                        : false,
                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                propertyId
            );


        if (error) {
            throw error;
        }


        showToast(
            newStatus === "occupied"
                ? "Property marked as occupied."
                : "Property marked as vacant."
        );


        await loadProperties();

        await loadPublicProperties();

        renderAdminProperties();

        renderAdminDashboard();

    } catch (error) {

        console.error(error);

        showError(
            getErrorMessage(error)
        );
    }
}


function renderAdminProperties() {

    const container =
        $("adminPropertyList");

    if (!container) {
        return;
    }


    if (!adminPropertiesLoaded) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⏳</div>
                <h3>Loading properties...</h3>
                <p>Please wait while your properties are loaded.</p>
            </div>
        `;
        return;
    }


    if (!properties.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏠</div>
                <h3>No properties yet</h3>
                <p>Click "Add Property" to create your first property.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        properties
            .map(property => {

                const image =
                    getPropertyImage(property);


                const status =
                    property.status ||
                    "vacant";


                return `
                    <div class="admin-property-card">

                        <div class="admin-property-image">

                            ${
                                image
                                    ? `
                                        <img
                                            src="${escapeHTML(image)}"
                                            alt="${escapeHTML(property.property_name)}"
                                        >
                                    `
                                    : `
                                        <div>
                                            🏠
                                        </div>
                                    `
                            }

                        </div>


                        <div class="admin-property-content">

                            <div class="admin-card-top">

                                <div>

                                    <span class="section-label">
                                        ${escapeHTML(
                                            property.property_type
                                        )}
                                    </span>

                                    <h3>
                                        ${escapeHTML(
                                            property.property_name
                                        )}
                                    </h3>

                                </div>


                                <span class="status-badge ${escapeHTML(status)}">
                                    ${escapeHTML(status)}
                                </span>

                            </div>


                            <p>
                                📍 ${escapeHTML(
                                    [
                                        property.address,
                                        property.city,
                                        property.state
                                    ]
                                        .filter(Boolean)
                                        .join(", ")
                                )}
                            </p>


                            <strong class="admin-property-price">
                                ${money(property.rent_amount)}
                            </strong>


                            <div class="admin-property-meta">

                                <span>
                                    Security:
                                    ${money(property.security_fee)}
                                </span>

                                <span>
                                    Service:
                                    ${money(property.service_charge)}
                                </span>

                            </div>


                            <div class="admin-card-actions">

                                <button
                                    type="button"
                                    class="secondary-btn"
                                    onclick="editProperty('${property.id}')"
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="secondary-btn"
                                    onclick="togglePropertyAdvertised('${property.id}', ${property.advertised === true})"
                                >
                                    ${
                                        property.advertised
                                            ? "Stop Advertising"
                                            : "Advertise"
                                    }
                                </button>

                                <button
                                    type="button"
                                    class="secondary-btn"
                                    onclick="togglePropertyStatus('${property.id}', '${escapeHTML(status)}')"
                                >
                                    ${
                                        status === "vacant"
                                            ? "Mark Occupied"
                                            : "Mark Vacant"
                                    }
                                </button>

                                <button
                                    type="button"
                                    class="danger-btn"
                                    onclick="deleteProperty('${property.id}')"
                                >
                                    Delete
                                </button>

                            </div>

                        </div>

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   TENANT MANAGEMENT
   ========================================================= */

function getTenantImageInput() {
    return (
        $("tenantImage") ||
        $("tenantPhoto") ||
        $("tenantHouseImage") ||
        $("tenantPropertyImage")
    );
}


function openTenantForm(tenant = null) {

    const container =
        $("tenantFormContainer");

    const form =
        $("tenantForm");

    if (!container || !form) {
        return;
    }

    editingTenantId =
        tenant?.id || null;

    populateTenantPropertySelect(
        getTenantTenancy(tenant?.id)?.property_id || ""
    );

    container.classList.remove("hidden");

    form.reset();

    /*
     * Fill the form AFTER reset.
     * This is important when editing an existing tenant.
     */
    if (tenant) {

        $("tenantFullName").value =
            tenant.full_name || "";

        $("tenantEmail").value =
            tenant.email || "";

        $("tenantPhone").value =
            tenant.phone || "";

        $("tenantAddress").value =
            tenant.address || "";

        const tenancy =
            getTenantTenancy(tenant.id);

        if (tenancy) {

            populateTenantPropertySelect(
                tenancy.property_id || ""
            );

            $("tenantPropertySelect").value =
                tenancy.property_id || "";

            $("tenantRentStart").value =
                tenancy.rent_start || "";

            $("tenantRentEnd").value =
                tenancy.rent_end || "";
        }
    }

    const title =
        $("tenantFormTitle");

    if (title) {
        title.textContent =
            tenant
                ? "Edit Tenant"
                : "Add Tenant";
    }

    const button =
        document.querySelector(
            "#tenantForm button[type='submit']"
        );

    if (button) {
        button.textContent =
            tenant
                ? "Save Changes"
                : "Create Tenant";
    }

    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


function closeTenantForm() {

    $("tenantFormContainer")
        ?.classList.add("hidden");

    $("tenantForm")?.reset();

    editingTenantId = null;

    const title =
        $("tenantFormTitle");

    if (title) {
        title.textContent =
            "Add Tenant";
    }

    const button =
        document.querySelector(
            "#tenantForm button[type='submit']"
        );

    if (button) {
        button.textContent =
            "Create Tenant";
    }
}


function populateTenantPropertySelect(selectedPropertyId = "") {

    const select = $("tenantPropertySelect");

    if (!select) {
        return;
    }

    // Show every property already loaded from the database.
    // Do not filter by status here; the landlord chooses the property.
    const list = Array.isArray(properties) ? properties : [];

    select.innerHTML = `
        <option value="">Select property</option>
        ${list.map(property => {
            const status = String(property.status || "").trim().toLowerCase();
            const name = property.property_name || property.name || "Unnamed property";
            const location = [property.city, property.state].filter(Boolean).join(", ");
            const label = location ? `${name} — ${location}` : name;
            const suffix = status ? ` (${status})` : "";
            return `
                <option value="${escapeHTML(String(property.id))}"
                    ${String(property.id) === String(selectedPropertyId) ? "selected" : ""}>
                    ${escapeHTML(label)} — ${money(property.rent_amount)}${escapeHTML(suffix)}
                </option>
            `;
        }).join("")}
    `;

    if (!list.length) {
        select.innerHTML = `<option value="">No properties have been added yet</option>`;
    }
}


/* =========================================================
   TENANT ACCOUNT CREATION / EDITING
   ========================================================= */

function generateTemporaryPassword() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    let password = "";

    for (let i = 0; i < 10; i++) {

        password +=
            chars[
                Math.floor(
                    Math.random() *
                    chars.length
                )
            ];

    }

    return password + "!";
}


async function uploadTenantImage(tenantId) {

    const input =
        getTenantImageInput();

    if (
        !input ||
        !input.files ||
        input.files.length === 0
    ) {
        return {
            imageUrl: null,
            uploaded: false
        };
    }

    const file =
        input.files[0];

    if (
        !file.type ||
        !file.type.startsWith("image/")
    ) {
        throw new Error(
            "Please select a valid tenant picture."
        );
    }

    const safeName =
        file.name
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/_+/g, "_");

    const path =
        `tenants/${tenantId}/${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${safeName}`;

    /*
     * Use the existing public property-images bucket.
     * This avoids changing the working Storage setup.
     */
    const {
        error: uploadError
    } = await supabase
        .storage
        .from("property-images")
        .upload(
            path,
            file,
            {
                cacheControl: "3600",
                contentType: file.type,
                upsert: false
            }
        );

    if (uploadError) {
        throw new Error(
            `Tenant picture upload failed: ${
                uploadError.message ||
                JSON.stringify(uploadError)
            }`
        );
    }

    const {
        data: publicData
    } = supabase
        .storage
        .from("property-images")
        .getPublicUrl(path);

    const imageUrl =
        publicData?.publicUrl;

    if (!imageUrl) {
        throw new Error(
            "The tenant picture uploaded, but Supabase did not return an image URL."
        );
    }

    return {
        imageUrl,
        uploaded: true
    };
}


async function handleTenantSubmit(event) {

    event.preventDefault();

    if (!currentUser) {
        showError(
            "You are not logged in."
        );
        return;
    }

    const fullName =
        $("tenantFullName").value.trim();

    const email =
        $("tenantEmail").value
            .trim()
            .toLowerCase();

    const phone =
        $("tenantPhone").value.trim() ||
        null;

    const address =
        $("tenantAddress").value.trim() ||
        null;

    const propertyId =
        $("tenantPropertySelect").value ||
        null;

    const rentStart =
        $("tenantRentStart").value ||
        null;

    const rentEnd =
        $("tenantRentEnd").value ||
        null;

    if (!fullName) {
        showError(
            "Please enter the tenant's full name."
        );
        return;
    }

    if (!email) {
        showError(
            "Please enter the tenant's email."
        );
        return;
    }

    const button =
        document.querySelector(
            "#tenantForm button[type='submit']"
        );

    const isEditing =
        Boolean(editingTenantId);

    setButtonLoading(
        button,
        true,
        isEditing
            ? "Saving..."
            : "Creating..."
    );

    let createdAuthUser = null;

    try {

        /*
         * =====================================================
         * EDIT EXISTING TENANT
         * =====================================================
         */
        if (isEditing) {

            const tenantId =
                editingTenantId;

            const oldTenancy =
                getTenantTenancy(
                    tenantId
                );

            const oldPropertyId =
                oldTenancy?.property_id ||
                null;

            /*
             * Update tenant profile.
             * The authentication email is intentionally not changed
             * here because changing another user's Auth email from
             * browser JavaScript is not safe.
             */
            const profileData = {
                full_name:
                    fullName,

                phone:
                    phone,

                address:
                    address,

                role:
                    "tenant",

                active:
                    true,

                updated_at:
                    new Date().toISOString()
            };

            /*
             * Only update the profile email when the value has not
             * changed from the current profile. This prevents the
             * database record from becoming different from the
             * actual Auth login email.
             */
            const existingTenant =
                tenants.find(
                    item =>
                        String(item.id) ===
                        String(tenantId)
                );

            if (
                existingTenant?.email === email
            ) {
                profileData.email =
                    email;
            }

            /*
             * Try the picture only when one was selected.
             * Picture storage is separate from the profile update.
             */
            let newImageUrl = null;

            const imageInput =
                getTenantImageInput();

            if (
                imageInput?.files?.length
            ) {
                const imageResult =
                    await uploadTenantImage(
                        tenantId
                    );

                newImageUrl =
                    imageResult.imageUrl;
            }

            if (newImageUrl) {
                /*
                 * Requires the optional tenant_image_url column.
                 * If it does not exist, the text/profile edit is
                 * still not lost; a clear message is shown below.
                 */
                profileData.tenant_image_url =
                    newImageUrl;
            }

            const {
                error: profileError
            } = await supabase
                .from("profiles")
                .update(profileData)
                .eq(
                    "id",
                    tenantId
                );

            if (profileError) {

                /*
                 * If the only problem is the optional image column,
                 * retry the normal tenant update without the image.
                 */
                if (
                    newImageUrl &&
                    /tenant_image_url|column .*schema cache/i.test(
                        profileError.message || ""
                    )
                ) {

                    delete profileData.tenant_image_url;

                    const {
                        error: retryError
                    } = await supabase
                        .from("profiles")
                        .update(profileData)
                        .eq(
                            "id",
                            tenantId
                        );

                    if (retryError) {
                        throw retryError;
                    }

                    showToast(
                        "Tenant details updated. Add the tenant_image_url column to save the picture."
                    );

                } else {
                    throw profileError;
                }

            }

            /*
             * Handle the tenancy/property assignment.
             */
            if (oldTenancy) {

                if (
                    propertyId &&
                    String(propertyId) !==
                    String(oldPropertyId)
                ) {

                    /*
                     * Release the previous property.
                     */
                    if (oldPropertyId) {
                        await supabase
                            .from("properties")
                            .update({
                                status:
                                    "vacant",

                                advertised:
                                    true,

                                updated_at:
                                    new Date().toISOString()
                            })
                            .eq(
                                "id",
                                oldPropertyId
                            );
                    }

                    const property =
                        properties.find(
                            p =>
                                String(p.id) ===
                                String(propertyId)
                        );

                    const {
                        error: tenancyUpdateError
                    } = await supabase
                        .from("tenancies")
                        .update({
                            property_id:
                                propertyId,

                            rent_start:
                                rentStart,

                            rent_end:
                                rentEnd,

                            rent_amount:
                                Number(
                                    property?.rent_amount ||
                                    0
                                ),

                            security_fee:
                                Number(
                                    property?.security_fee ||
                                    0
                                ),

                            service_charge:
                                Number(
                                    property?.service_charge ||
                                    0
                                ),

                            status:
                                "active"
                        })
                        .eq(
                            "id",
                            oldTenancy.id
                        );

                    if (tenancyUpdateError) {
                        throw tenancyUpdateError;
                    }

                } else {

                    const {
                        error: tenancyUpdateError
                    } = await supabase
                        .from("tenancies")
                        .update({
                            rent_start:
                                rentStart,

                            rent_end:
                                rentEnd,

                            status:
                                "active"
                        })
                        .eq(
                            "id",
                            oldTenancy.id
                        );

                    if (tenancyUpdateError) {
                        throw tenancyUpdateError;
                    }
                }

            } else if (propertyId) {

                const property =
                    properties.find(
                        p =>
                            String(p.id) ===
                            String(propertyId)
                    );

                const {
                    error: tenancyInsertError
                } = await supabase
                    .from("tenancies")
                    .insert({
                        tenant_id:
                            tenantId,

                        property_id:
                            propertyId,

                        rent_start:
                            rentStart,

                        rent_end:
                            rentEnd,

                        rent_amount:
                            Number(
                                property?.rent_amount ||
                                0
                            ),

                        security_fee:
                            Number(
                                property?.security_fee ||
                                0
                            ),

                        service_charge:
                            Number(
                                property?.service_charge ||
                                0
                            ),

                        status:
                            "active"
                    });

                if (tenancyInsertError) {
                    throw tenancyInsertError;
                }
            }

            /*
             * Make the newly assigned property rented.
             */
            if (propertyId) {
                const {
                    error: propertyError
                } = await supabase
                    .from("properties")
                    .update({
                        status:
                            "occupied",

                        advertised:
                            false,

                        updated_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        propertyId
                    );

                if (propertyError) {
                    throw propertyError;
                }
            }

            closeTenantForm();

            showToast(
                "Tenant updated successfully."
            );

            await loadAdminData();
            await loadPublicProperties();

            return;
        }


        /*
         * =====================================================
         * CREATE NEW TENANT
         * =====================================================
         */

        const temporaryPassword =
            generateTemporaryPassword();

        const {
            data: sessionData
        } = await supabase.auth.getSession();

        const adminSession =
            sessionData?.session;

        const {
            data: signUpData,
            error: signUpError
        } = await supabase.auth.signUp({

            email,

            password:
                temporaryPassword,

            options: {
                data: {
                    full_name:
                        fullName,

                    phone:
                        phone
                }
            }
        });

        if (signUpError) {
            throw signUpError;
        }

        createdAuthUser =
            signUpData?.user;

        if (!createdAuthUser) {
            throw new Error(
                "The tenant account could not be created."
            );
        }

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    800
                )
        );

        const {
            error: profileError
        } = await supabase
            .from("profiles")
            .update({

                full_name:
                    fullName,

                email:
                    email,

                phone:
                    phone,

                address:
                    address,

                role:
                    "tenant",

                active:
                    true,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                createdAuthUser.id
            );

        if (profileError) {
            throw new Error(
                `Tenant Auth account was created, but the tenant profile could not be saved: ${getDetailedErrorMessage(profileError, "Tenant profile update")}`
            );
        }

        /*
         * Restore admin session if signUp changed it.
         */
        if (
            adminSession?.access_token &&
            adminSession?.refresh_token
        ) {
            await supabase.auth.setSession({
                access_token:
                    adminSession.access_token,

                refresh_token:
                    adminSession.refresh_token
            });
        }

        /*
         * Upload tenant picture after the Auth/profile account exists.
         * The picture is optional.
         */
        const imageInput =
            getTenantImageInput();

        if (
            imageInput?.files?.length
        ) {

            try {

                const imageResult =
                    await uploadTenantImage(
                        createdAuthUser.id
                    );

                const {
                    error: imageProfileError
                } = await supabase
                    .from("profiles")
                    .update({
                        tenant_image_url:
                            imageResult.imageUrl
                    })
                    .eq(
                        "id",
                        createdAuthUser.id
                    );

                if (imageProfileError) {

                    if (
                        /tenant_image_url|column .*schema cache/i.test(
                            imageProfileError.message || ""
                        )
                    ) {
                        console.warn(
                            "Tenant picture uploaded but tenant_image_url column is missing.",
                            imageProfileError
                        );

                        showToast(
                            "Tenant created. Add tenant_image_url column to save the picture."
                        );
                    } else {
                        throw imageProfileError;
                    }
                }

            } catch (imageError) {

                /*
                 * Do not break tenant creation because of an
                 * optional picture.
                 */
                console.warn(
                    "Tenant picture warning:",
                    imageError
                );

                showError(
                    `Tenant was created, but the picture could not be saved: ${getErrorMessage(imageError)}`
                );
            }
        }

        /*
         * Create tenancy when a property was selected.
         */
        if (propertyId) {

            const property =
                properties.find(
                    p =>
                        String(p.id) ===
                        String(propertyId)
                );

            const {
                error: tenancyError
            } = await supabase
                .from("tenancies")
                .insert({

                    tenant_id:
                        createdAuthUser.id,

                    property_id:
                        propertyId,

                    rent_start:
                        rentStart,

                    rent_end:
                        rentEnd,

                    rent_amount:
                        Number(
                            property?.rent_amount ||
                            0
                        ),

                    security_fee:
                        Number(
                            property?.security_fee ||
                            0
                        ),

                    service_charge:
                        Number(
                            property?.service_charge ||
                            0
                        ),

                    status:
                        "active"

                });

            if (tenancyError) {
                throw tenancyError;
            }

            const {
                error: propertyError
            } = await supabase
                .from("properties")
                .update({
                    status:
                        "occupied",

                    advertised:
                        false,

                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    propertyId
                );

            if (propertyError) {
                throw propertyError;
            }
        }

        closeTenantForm();

        showToast(
            "Tenant account created."
        );

        alert(
            `TENANT ACCOUNT CREATED\n\n` +
            `Name: ${fullName}\n` +
            `Email: ${email}\n\n` +
            `Temporary password:\n${temporaryPassword}\n\n` +
            `Give these login details to the tenant.`
        );

        await loadAdminData();
        await loadPublicProperties();

    } catch (error) {

        const detailedError =
            getDetailedErrorMessage(
                error,
                isEditing
                    ? "Tenant update"
                    : "Tenant creation"
            );

        if (
            createdAuthUser &&
            !isEditing
        ) {
            showError(
                "Tenant account was created, but the rental record could not be completed: " +
                detailedError
            );
        } else {
            showError(
                detailedError
            );
        }

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


async function editTenant(tenantId) {

    const tenant =
        tenants.find(
            item =>
                String(item.id) ===
                String(tenantId)
        );

    if (!tenant) {
        showError(
            "Tenant record could not be found."
        );
        return;
    }

    openTenantForm(
        tenant
    );
}


async function deleteTenant(tenantId) {

    const tenant =
        tenants.find(
            item =>
                String(item.id) ===
                String(tenantId)
        );

    if (!tenant) {
        showError(
            "Tenant record could not be found."
        );
        return;
    }

    const tenancy =
        getTenantTenancy(
            tenantId
        );

    const property =
        properties.find(
            item =>
                String(item.id) ===
                String(tenancy?.property_id)
        );

    const confirmed =
        confirm(
            `Delete tenant "${tenant.full_name || tenant.email}"?\n\n` +
            `This will remove the tenant from the landlord system and release the assigned property.`
        );

    if (!confirmed) {
        return;
    }

    try {

        /*
         * Release the property first.
         */
        if (property) {

            const {
                error: propertyError
            } = await supabase
                .from("properties")
                .update({
                    status:
                        "vacant",

                    advertised:
                        true,

                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    property.id
                );

            if (propertyError) {
                throw propertyError;
            }
        }

        /*
         * Remove the tenancy.
         */
        const {
            error: tenancyError
        } = await supabase
            .from("tenancies")
            .delete()
            .eq(
                "tenant_id",
                tenantId
            );

        if (tenancyError) {
            throw tenancyError;
        }

        /*
         * Remove the tenant profile.
         * The Supabase Auth account cannot safely be deleted
         * with the browser anon key. Once the profile is removed,
         * this application will no longer allow that Auth account
         * to enter the tenant application.
         */
        const {
            error: profileError
        } = await supabase
            .from("profiles")
            .delete()
            .eq(
                "id",
                tenantId
            )
            .eq(
                "role",
                "tenant"
            );

        if (profileError) {
            throw profileError;
        }

        /*
         * Best-effort cleanup of tenant picture files.
         * Failure here should not undo the tenant deletion.
         */
        try {

            const {
                data: files
            } = await supabase
                .storage
                .from("property-images")
                .list(
                    `tenants/${tenantId}`,
                    {
                        limit: 100
                    }
                );

            if (files?.length) {

                await supabase
                    .storage
                    .from("property-images")
                    .remove(
                        files.map(
                            file =>
                                `tenants/${tenantId}/${file.name}`
                        )
                    );
            }

        } catch (storageError) {

            console.warn(
                "Tenant picture cleanup warning:",
                storageError
            );
        }

        showToast(
            "Tenant deleted successfully."
        );

        await loadAdminData();
        await loadPublicProperties();

    } catch (error) {

        console.error(
            "Delete tenant error:",
            error
        );

        showError(
            getDetailedErrorMessage(
                error,
                "Tenant deletion"
            )
        );
    }
}


/* =========================================================
   ADMIN TENANT LIST
   ========================================================= */

function getTenantTenancy(tenantId) {

    return tenancies.find(
        tenancy =>
            String(tenancy.tenant_id) ===
            String(tenantId) &&
            tenancy.status !== "ended" &&
            tenancy.status !== "terminated"
    );
}


function renderAdminTenants() {

    const container =
        $("adminTenantList");

    if (!container) {
        return;
    }

    if (!tenants.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>No tenants yet</h3>
                <p>Tenants will appear here after you add them.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        tenants
            .map(tenant => {

                const tenancy =
                    getTenantTenancy(
                        tenant.id
                    );

                const property =
                    properties.find(
                        p =>
                            String(p.id) ===
                            String(
                                tenancy?.property_id
                            )
                    );

                const days =
                    tenancy
                        ? daysUntil(
                            tenancy.rent_end
                        )
                        : null;

                const tenantImage =
                    tenant.tenant_image_url ||
                    "";

                return `
                    <div class="admin-list-card">

                        <div class="admin-list-main">

                            <div
                                class="user-avatar"
                                style="
                                    overflow:hidden;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                "
                            >
                                ${
                                    tenantImage
                                        ? `
                                            <img
                                                src="${escapeHTML(tenantImage)}"
                                                alt="${escapeHTML(tenant.full_name || "Tenant")}"
                                                style="
                                                    width:100%;
                                                    height:100%;
                                                    object-fit:cover;
                                                "
                                            >
                                        `
                                        : "👤"
                                }
                            </div>

                            <div>

                                <h3>
                                    ${escapeHTML(
                                        tenant.full_name ||
                                        "Unnamed Tenant"
                                    )}
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        tenant.email || ""
                                    )}
                                </p>

                                ${
                                    tenant.phone
                                        ? `
                                            <p>
                                                📞 ${escapeHTML(
                                                    tenant.phone
                                                )}
                                            </p>
                                        `
                                        : ""
                                }

                            </div>

                        </div>

                        <div class="admin-list-details">

                            <div>
                                <strong>Property</strong>
                                <span>
                                    ${escapeHTML(
                                        property?.property_name ||
                                        "Not assigned"
                                    )}
                                </span>
                            </div>

                            <div>
                                <strong>Rent Start</strong>
                                <span>
                                    ${formatDate(
                                        tenancy?.rent_start
                                    )}
                                </span>
                            </div>

                            <div>
                                <strong>Rent End</strong>
                                <span>
                                    ${formatDate(
                                        tenancy?.rent_end
                                    )}
                                </span>
                            </div>

                            <div>
                                <strong>Status</strong>
                                <span>
                                    ${
                                        tenancy
                                            ? (
                                                days !== null &&
                                                days >= 0
                                                    ? "Active"
                                                    : "Expired"
                                            )
                                            : "No tenancy"
                                    }
                                </span>
                            </div>

                        </div>

                        <div class="admin-card-actions">

                            <button
                                type="button"
                                class="secondary-btn"
                                onclick="editTenant('${tenant.id}')"
                            >
                                Edit
                            </button>

                            <button
                                type="button"
                                class="danger-btn"
                                onclick="deleteTenant('${tenant.id}')"
                            >
                                Delete
                            </button>

                        </div>

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   PAYMENT MANAGEMENT
   ========================================================= */

function openPaymentForm() {

    populatePaymentTenantSelect();

    const container =
        $("paymentFormContainer");

    if (!container) {
        return;
    }


    container.classList.remove(
        "hidden"
    );


    $("paymentForm")?.reset();


    if ($("paymentDate")) {
        $("paymentDate").value =
            todayString();
    }


    container.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


function closePaymentForm() {

    $("paymentFormContainer")
        ?.classList.add("hidden");

    $("paymentForm")?.reset();
}


function populatePaymentTenantSelect() {

    const select =
        $("paymentTenant");

    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select tenant
        </option>

        ${tenants.map(tenant => `
            <option value="${tenant.id}">
                ${escapeHTML(
                    tenant.full_name ||
                    tenant.email
                )}
            </option>
        `).join("")}
    `;
}


async function handlePaymentSubmit(event) {

    event.preventDefault();


    const tenantId =
        $("paymentTenant").value;

    const type =
        $("paymentType").value;

    const amount =
        Number(
            $("paymentAmount").value || 0
        );

    const paymentDate =
        $("paymentDate").value;

    const method =
        $("paymentMethod").value ||
        null;

    const reference =
        $("paymentReference").value.trim() ||
        null;

    const note =
        $("paymentNote").value.trim() ||
        null;


    if (!tenantId) {
        showError(
            "Please select a tenant."
        );
        return;
    }


    if (!type) {
        showError(
            "Please select a payment type."
        );
        return;
    }


    if (amount <= 0) {
        showError(
            "Payment amount must be greater than zero."
        );
        return;
    }


    const button =
        document.querySelector(
            "#paymentForm button[type='submit']"
        );


    setButtonLoading(
        button,
        true,
        "Saving..."
    );


    try {

        const tenancy =
            getTenantTenancy(
                tenantId
            );


        const propertyId =
            tenancy?.property_id ||
            null;


        const {
            error
        } = await supabase
            .from("payments")
            .insert({

                tenant_id:
                    tenantId,

                property_id:
                    propertyId,

                tenancy_id:
                    tenancy?.id ||
                    null,

                payment_type:
                    type,

                amount:
                    amount,

                payment_date:
                    paymentDate,

                payment_method:
                    method,

                reference:
                    reference,

                note:
                    note,

                recorded_by:
                    currentUser.id

            });


        if (error) {
            throw error;
        }


        showToast(
            "Payment recorded successfully."
        );


        closePaymentForm();

        await loadPayments();

        renderAdminPayments();

        renderAdminDashboard();


    } catch (error) {

        console.error(
            "Payment error:",
            error
        );

        showError(
            getErrorMessage(error)
        );

    } finally {

        setButtonLoading(
            button,
            false
        );

    }
}


function renderAdminPayments() {

    const container =
        $("adminPaymentList");

    if (!container) {
        return;
    }


    if (!payments.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💰</div>
                <h3>No payments recorded</h3>
                <p>Recorded payments will appear here.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        payments
            .map(payment => {

                const tenant =
                    tenants.find(
                        t =>
                            String(t.id) ===
                            String(
                                payment.tenant_id
                            )
                    );


                const property =
                    properties.find(
                        p =>
                            String(p.id) ===
                            String(
                                payment.property_id
                            )
                    );


                return `
                    <div class="admin-list-card">

                        <div class="admin-list-main">

                            <div class="stat-icon">
                                💰
                            </div>

                            <div>

                                <h3>
                                    ${money(
                                        payment.amount
                                    )}
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        payment.payment_type
                                    )}
                                    —
                                    ${escapeHTML(
                                        tenant?.full_name ||
                                        "Tenant"
                                    )}
                                </p>

                            </div>

                        </div>


                        <div class="admin-list-details">

                            <div>
                                <strong>Property</strong>
                                <span>
                                    ${escapeHTML(
                                        property?.property_name ||
                                        "—"
                                    )}
                                </span>
                            </div>

                            <div>
                                <strong>Date</strong>
                                <span>
                                    ${formatDate(
                                        payment.payment_date
                                    )}
                                </span>
                            </div>

                            <div>
                                <strong>Method</strong>
                                <span>
                                    ${escapeHTML(
                                        payment.payment_method ||
                                        "—"
                                    )}
                                </span>
                            </div>

                        </div>

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   COMPLAINTS
   ========================================================= */

function openTenantComplaintForm() {

    $("tenantComplaintFormContainer")
        ?.classList.remove("hidden");

    $("tenantComplaintForm")
        ?.reset();

    document
        .getElementById(
            "tenantComplaintFormContainer"
        )
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}


function closeTenantComplaintForm() {

    $("tenantComplaintFormContainer")
        ?.classList.add("hidden");

    $("tenantComplaintForm")?.reset();
}


async function handleComplaintSubmit(event) {

    event.preventDefault();


    if (!currentUser) {
        showError(
            "You are not logged in."
        );
        return;
    }


    const title =
        $("complaintTitle").value.trim();

    const priority =
        $("complaintPriority").value;

    const description =
        $("complaintDescription").value.trim();


    if (!title || !description) {

        showError(
            "Please complete the complaint."
        );

        return;
    }


    const button =
        document.querySelector(
            "#tenantComplaintForm button[type='submit']"
        );


    setButtonLoading(
        button,
        true,
        "Submitting..."
    );


    try {

        const tenancy =
            getTenantTenancy(
                currentUser.id
            );


        if (!tenancy) {

            throw new Error(
                "You do not have an active tenancy."
            );

        }


        let imageUrl = null;


        const imageFile =
            $("complaintImage")?.files?.[0];


        if (imageFile) {

            const path =
                `complaints/${currentUser.id}/${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;


            const {
                error: uploadError
            } = await supabase
                .storage
                .from("private-files")
                .upload(
                    path,
                    imageFile,
                    {
                        upsert: false
                    }
                );


            if (!uploadError) {

                const {
                    data
                } = supabase
                    .storage
                    .from("private-files")
                    .getPublicUrl(path);

                imageUrl =
                    data?.publicUrl ||
                    null;

            }

        }


        const {
            error
        } = await supabase
            .from("complaints")
            .insert({

                tenant_id:
                    currentUser.id,

                property_id:
                    tenancy.property_id,

                title:
                    title,

                description:
                    description,

                image_url:
                    imageUrl,

                priority:
                    priority,

                status:
                    "open"

            });


        if (error) {
            throw error;
        }


        showToast(
            "Complaint submitted successfully."
        );


        closeTenantComplaintForm();

        await loadTenantData();

    } catch (error) {

        console.error(
            "Complaint error:",
            error
        );

        showError(
            getErrorMessage(error)
        );

    } finally {

        setButtonLoading(
            button,
            false
        );

    }
}


function getComplaintTenant(complaint) {

    return tenants.find(
        tenant =>
            String(tenant.id) ===
            String(complaint.tenant_id)
    );
}


function getComplaintProperty(complaint) {

    return properties.find(
        property =>
            String(property.id) ===
            String(complaint.property_id)
    );
}


function renderComplaintSmall(complaint) {

    const tenant =
        getComplaintTenant(
            complaint
        );


    return `
        <div class="mini-list-item">

            <div>

                <strong>
                    ${escapeHTML(
                        complaint.title
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        tenant?.full_name ||
                        "Tenant"
                    )}
                </span>

            </div>

            <span>
                ${escapeHTML(
                    complaint.status ||
                    "open"
                )}
            </span>

        </div>
    `;
}


function renderAdminComplaints() {

    const container =
        $("adminComplaintList");

    if (!container) {
        return;
    }


    if (!complaints.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>No complaints</h3>
                <p>Tenant complaints will appear here.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        complaints
            .map(complaint => {

                const tenant =
                    getComplaintTenant(
                        complaint
                    );


                const property =
                    getComplaintProperty(
                        complaint
                    );


                return `
                    <div class="admin-list-card complaint-card">

                        <div class="admin-list-main">

                            <div class="stat-icon">
                                📝
                            </div>

                            <div>

                                <h3>
                                    ${escapeHTML(
                                        complaint.title
                                    )}
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        tenant?.full_name ||
                                        "Tenant"
                                    )}
                                    —
                                    ${escapeHTML(
                                        property?.property_name ||
                                        "Property"
                                    )}
                                </p>

                            </div>

                        </div>


                        <div class="complaint-description">
                            ${escapeHTML(
                                complaint.description
                            )}
                        </div>


                        ${
                            complaint.image_url
                                ? `
                                    <div>
                                        <a
                                            href="${escapeHTML(complaint.image_url)}"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            View attached picture
                                        </a>
                                    </div>
                                `
                                : ""
                        }


                        <div class="admin-list-details">

                            <div>
                                <strong>Priority</strong>
                                <span>
                                    ${escapeHTML(
                                        complaint.priority ||
                                        "normal"
                                    )}
                                </span>
                            </div>

                            <div>
                                <strong>Status</strong>
                                <span>
                                    ${escapeHTML(
                                        complaint.status ||
                                        "open"
                                    )}
                                </span>
                            </div>

                            <div>
                                <strong>Date</strong>
                                <span>
                                    ${formatDateTime(
                                        complaint.created_at
                                    )}
                                </span>
                            </div>

                        </div>


                        <div class="admin-card-actions">

                            ${
                                complaint.status !== "resolved"
                                    ? `
                                        <button
                                            type="button"
                                            class="primary-btn"
                                            onclick="resolveComplaint('${complaint.id}')"
                                        >
                                            Mark Resolved
                                        </button>
                                    `
                                    : ""
                            }

                        </div>

                    </div>
                `;

            })
            .join("");
}


async function resolveComplaint(
    complaintId
) {

    const response =
        prompt(
            "Optional response to tenant:"
        );


    try {

        const {
            error
        } = await supabase
            .from("complaints")
            .update({

                status:
                    "resolved",

                landlord_response:
                    response?.trim() ||
                    null,

                resolved_at:
                    new Date().toISOString(),

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                complaintId
            );


        if (error) {
            throw error;
        }


        showToast(
            "Complaint marked as resolved."
        );


        await loadComplaints();

        renderAdminComplaints();

        renderAdminDashboard();

        updateComplaintBadge();


    } catch (error) {

        console.error(error);

        showError(
            getErrorMessage(error)
        );

    }
}


/* =========================================================
   MESSAGES
   ========================================================= */

function openMessageForm() {

    populateMessageRecipientSelect();

    $("messageFormContainer")
        ?.classList.remove("hidden");

    $("messageForm")?.reset();

    if ($("sendEmailNotification")) {
        $("sendEmailNotification").checked =
            true;
    }

    document
        .getElementById(
            "messageFormContainer"
        )
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}


function closeMessageForm() {

    $("messageFormContainer")
        ?.classList.add("hidden");

    $("messageForm")?.reset();
}


function populateMessageRecipientSelect() {

    const select =
        $("messageRecipient");

    if (!select) {
        return;
    }


    select.innerHTML = `

        <option value="">
            Select tenant
        </option>

        <option value="ALL">
            All Tenants
        </option>

        ${tenants.map(tenant => `
            <option value="${tenant.id}">
                ${escapeHTML(
                    tenant.full_name ||
                    tenant.email
                )}
            </option>
        `).join("")}

    `;
}


async function handleMessageSubmit(event) {

    event.preventDefault();


    if (!currentUser) {
        showError(
            "You are not logged in."
        );
        return;
    }


    const recipient =
        $("messageRecipient").value;

    const title =
        $("messageTitle").value.trim();

    const body =
        $("messageBody").value.trim();

    const sendEmail =
        $("sendEmailNotification").checked;


    if (!recipient) {

        showError(
            "Please select a recipient."
        );

        return;
    }


    if (!title || !body) {

        showError(
            "Please enter the message title and message."
        );

        return;
    }


    const button =
        document.querySelector(
            "#messageForm button[type='submit']"
        );


    setButtonLoading(
        button,
        true,
        "Sending..."
    );


    try {

        if (recipient === "ALL") {

            const {
                error
            } = await supabase
                .from("messages")
                .insert({

                    sender_id:
                        currentUser.id,

                    recipient_id:
                        null,

                    title:
                        title,

                    message:
                        body,

                    send_to_all_tenants:
                        true,

                    email_sent:
                        false

                });


            if (error) {
                throw error;
            }


            /*
             * Create in-app notifications for each tenant.
             */

            if (tenants.length) {

                const rows =
                    tenants.map(tenant => ({

                        user_id:
                            tenant.id,

                        title:
                            title,

                        message:
                            body,

                        notification_type:
                            "message",

                        related_id:
                            null,

                        is_read:
                            false

                    }));


                const {
                    error:
                        notificationError
                } = await supabase
                    .from("notifications")
                    .insert(rows);


                if (notificationError) {

                    console.warn(
                        "Notification creation warning:",
                        notificationError
                    );

                }

            }

        } else {

            const {
                error
            } = await supabase
                .from("messages")
                .insert({

                    sender_id:
                        currentUser.id,

                    recipient_id:
                        recipient,

                    title:
                        title,

                    message:
                        body,

                    send_to_all_tenants:
                        false,

                    email_sent:
                        false

                });


            if (error) {
                throw error;
            }


            await supabase
                .from("notifications")
                .insert({

                    user_id:
                        recipient,

                    title:
                        title,

                    message:
                        body,

                    notification_type:
                        "message",

                    related_id:
                        null,

                    is_read:
                        false

                });

        }


        /*
         * email_sent remains false here.
         * Actual email sending should be handled by
         * a server-side/Edge Function email service.
         */

        if (sendEmail) {

            showToast(
                "Message saved. Email notification requires the email service to be configured.",
                "warning"
            );

        } else {

            showToast(
                "Message sent successfully."
            );

        }


        closeMessageForm();

        await loadMessages();

        renderAdminMessages();

    } catch (error) {

        console.error(
            "Message error:",
            error
        );

        showError(
            getErrorMessage(error)
        );

    } finally {

        setButtonLoading(
            button,
            false
        );

    }
}


function renderAdminMessages() {

    const container =
        $("adminMessageList");

    if (!container) {
        return;
    }


    if (!messages.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📢</div>
                <h3>No messages yet</h3>
                <p>Messages you send will appear here.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        messages
            .map(message => {

                const recipient =
                    tenants.find(
                        tenant =>
                            String(tenant.id) ===
                            String(
                                message.recipient_id
                            )
                    );


                return `
                    <div class="admin-list-card">

                        <div class="admin-list-main">

                            <div class="stat-icon">
                                📢
                            </div>

                            <div>

                                <h3>
                                    ${escapeHTML(
                                        message.title
                                    )}
                                </h3>

                                <p>
                                    ${
                                        message.send_to_all_tenants
                                            ? "All Tenants"
                                            : escapeHTML(
                                                recipient?.full_name ||
                                                "Tenant"
                                            )
                                    }
                                </p>

                            </div>

                        </div>


                        <div class="complaint-description">
                            ${escapeHTML(
                                message.message
                            )}
                        </div>


                        <div class="admin-list-details">

                            <div>
                                <strong>Sent</strong>
                                <span>
                                    ${formatDateTime(
                                        message.created_at
                                    )}
                                </span>
                            </div>

                            <div>
                                <strong>Email</strong>
                                <span>
                                    ${
                                        message.email_sent
                                            ? "Sent"
                                            : "Pending"
                                    }
                                </span>
                            </div>

                        </div>

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   ADMIN NOTIFICATIONS
   ========================================================= */

function renderAdminNotifications() {

    const container =
        $("adminNotificationList");

    if (!container) {
        return;
    }


    if (!notifications.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <h3>No notifications</h3>
                <p>Important alerts will appear here.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        notifications
            .map(notification => `

                <div class="admin-list-card">

                    <div class="admin-list-main">

                        <div class="stat-icon">
                            🔔
                        </div>

                        <div>

                            <h3>
                                ${escapeHTML(
                                    notification.title
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    notification.message
                                )}
                            </p>

                        </div>

                    </div>


                    <div class="admin-list-details">

                        <div>
                            <strong>Type</strong>
                            <span>
                                ${escapeHTML(
                                    notification.notification_type ||
                                    "system"
                                )}
                            </span>
                        </div>

                        <div>
                            <strong>Date</strong>
                            <span>
                                ${formatDateTime(
                                    notification.created_at
                                )}
                            </span>
                        </div>

                        <div>
                            <strong>Status</strong>
                            <span>
                                ${
                                    notification.is_read
                                        ? "Read"
                                        : "Unread"
                                }
                            </span>
                        </div>

                    </div>

                </div>

            `)
            .join("");
}


/* =========================================================
   TENANT APPLICATION
   ========================================================= */

async function openTenantApplication() {

    $("publicApp")?.classList.add("hidden");

    $("adminApp")?.classList.add("hidden");

    $("tenantApp")?.classList.remove("hidden");


    if ($("tenantUserName")) {

        $("tenantUserName").textContent =
            currentProfile?.full_name ||
            currentProfile?.email ||
            "Tenant";

    }


    await loadTenantData();

    showTenantSection(
        "tenantDashboard"
    );
}


async function loadTenantData() {

    if (!currentUser) {
        return;
    }


    await Promise.all([
        loadTenantProperties(),
        loadTenantPayments(),
        loadTenantComplaints(),
        loadTenantMessages(),
        loadTenantNotifications()
    ]);


    renderTenantDashboard();

    renderTenantProperty();

    renderTenantPayments();

    renderTenantComplaints();

    renderTenantMessages();

    renderTenantNotifications();
}


async function loadTenantProperties() {

    const {
        data,
        error
    } = await supabase
        .from("tenancies")
        .select("*")
        .eq(
            "tenant_id",
            currentUser.id
        )
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Tenant tenancy load error:",
            error
        );

        tenancies = [];

        return;
    }


    tenancies = data || [];


    const propertyIds =
        tenancies.map(
            tenancy =>
                tenancy.property_id
        );


    if (!propertyIds.length) {
        return;
    }


    const {
        data: propertyData,
        error: propertyError
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
        .in(
            "id",
            propertyIds
        );


    if (propertyError) {

        console.error(
            "Tenant property load error:",
            propertyError
        );

        return;
    }


    properties =
        propertyData || [];
}


async function loadTenantPayments() {

    const {
        data,
        error
    } = await supabase
        .from("payments")
        .select("*")
        .eq(
            "tenant_id",
            currentUser.id
        )
        .order("payment_date", {
            ascending: false
        })
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Tenant payment error:",
            error
        );

        payments = [];

        return;
    }


    payments = data || [];
}


async function loadTenantComplaints() {

    const {
        data,
        error
    } = await supabase
        .from("complaints")
        .select("*")
        .eq(
            "tenant_id",
            currentUser.id
        )
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Tenant complaints error:",
            error
        );

        complaints = [];

        return;
    }


    complaints = data || [];
}


async function loadTenantMessages() {

    const {
        data,
        error
    } = await supabase
        .from("messages")
        .select("*")
        .or(
            `recipient_id.eq.${currentUser.id},send_to_all_tenants.eq.true`
        )
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Tenant messages error:",
            error
        );

        messages = [];

        return;
    }


    messages = data || [];
}


async function loadTenantNotifications() {

    const {
        data,
        error
    } = await supabase
        .from("notifications")
        .select("*")
        .eq(
            "user_id",
            currentUser.id
        )
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(
            "Tenant notifications error:",
            error
        );

        notifications = [];

        return;
    }


    notifications = data || [];
}


/* =========================================================
   TENANT NAVIGATION
   ========================================================= */

function showTenantSection(
    sectionId,
    button = null
) {

    document
        .querySelectorAll(
            "#tenantApp .private-section"
        )
        .forEach(section => {

            section.classList.toggle(
                "active",
                section.id === sectionId
            );

        });


    document
        .querySelectorAll(
            "#tenantApp .sidebar-link"
        )
        .forEach(link => {

            link.classList.remove(
                "active"
            );

        });


    if (button) {

        button.classList.add(
            "active"
        );

    } else {

        const links =
            document.querySelectorAll(
                "#tenantApp .sidebar-link"
            );

        links.forEach(link => {

            const onclick =
                link.getAttribute(
                    "onclick"
                ) || "";

            if (
                onclick.includes(
                    `'${sectionId}'`
                )
            ) {

                link.classList.add(
                    "active"
                );

            }

        });

    }


    const titles = {

        tenantDashboard:
            "Tenant Dashboard",

        tenantProperty:
            "My Property",

        tenantPayments:
            "My Payments",

        tenantComplaints:
            "Complaints",

        tenantMessages:
            "Messages",

        tenantNotifications:
            "Notifications"

    };


    if ($("tenantPageTitle")) {

        $("tenantPageTitle").textContent =
            titles[sectionId] ||
            "Tenant Dashboard";

    }


    closeMobileSidebars();
}


/* =========================================================
   TENANT DASHBOARD
   ========================================================= */

function getCurrentTenantTenancy() {

    return tenancies.find(
        tenancy =>
            String(tenancy.tenant_id) ===
            String(currentUser?.id) &&
            tenancy.status !== "ended" &&
            tenancy.status !== "terminated"
    );
}


function getTenantCurrentProperty() {

    const tenancy =
        getCurrentTenantTenancy();


    if (!tenancy) {
        return null;
    }


    return properties.find(
        property =>
            String(property.id) ===
            String(tenancy.property_id)
    ) || null;
}


function renderTenantDashboard() {

    const tenancy =
        getCurrentTenantTenancy();


    const property =
        getTenantCurrentProperty();


    if ($("tenantPropertyName")) {

        $("tenantPropertyName").textContent =
            property?.property_name ||
            "—";

    }


    if ($("tenantRentEnd")) {

        $("tenantRentEnd").textContent =
            formatDate(
                tenancy?.rent_end
            );

    }


    if ($("tenantRentAmount")) {

        $("tenantRentAmount").textContent =
            money(
                tenancy?.rent_amount ||
                property?.rent_amount ||
                0
            );

    }


    if ($("tenantNotificationCount")) {

        const unread =
            notifications.filter(
                notification =>
                    !notification.is_read
            ).length;


        $("tenantNotificationCount")
            .textContent =
            unread;

    }


    renderTenantDashboardProperty();

    renderTenantDashboardMessages();
}


function renderTenantDashboardProperty() {

    const container =
        $("tenantDashboardProperty");

    if (!container) {
        return;
    }


    const tenancy =
        getCurrentTenantTenancy();


    const property =
        getTenantCurrentProperty();


    if (!tenancy || !property) {

        container.innerHTML = `
            <div class="empty-small">
                No active tenancy found.
            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="mini-property">

            ${
                getPropertyImage(property)
                    ? `
                        <img
                            src="${escapeHTML(
                                getPropertyImage(property)
                            )}"
                            alt="${escapeHTML(
                                property.property_name
                            )}"
                        >
                    `
                    : `
                        <div class="mini-property-image">
                            🏠
                        </div>
                    `
            }

            <div>

                <strong>
                    ${escapeHTML(
                        property.property_name
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        property.address
                    )}
                </span>

                <span>
                    Rent ends:
                    ${formatDate(
                        tenancy.rent_end
                    )}
                </span>

            </div>

        </div>
    `;
}


function renderTenantDashboardMessages() {

    const container =
        $("tenantDashboardMessages");

    if (!container) {
        return;
    }


    const recent =
        messages.slice(0, 3);


    if (!recent.length) {

        container.innerHTML = `
            <div class="empty-small">
                No messages yet.
            </div>
        `;

        return;
    }


    container.innerHTML =
        recent.map(message => `

            <div class="mini-list-item">

                <div>

                    <strong>
                        ${escapeHTML(
                            message.title
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            message.message
                        ).slice(0, 100)}
                    </span>

                </div>

                <span>
                    ${formatDate(
                        message.created_at
                    )}
                </span>

            </div>

        `).join("");
}


/* =========================================================
   TENANT PROPERTY
   ========================================================= */

function renderTenantProperty() {

    const container =
        $("tenantPropertyDetails");

    if (!container) {
        return;
    }


    const tenancy =
        getCurrentTenantTenancy();


    const property =
        getTenantCurrentProperty();


    if (!tenancy || !property) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏠</div>
                <h3>No active property</h3>
                <p>Your property information will appear here.</p>
            </div>
        `;

        return;
    }


    const image =
        getPropertyImage(property);


    container.innerHTML = `

        <div class="dashboard-card">

            ${
                image
                    ? `
                        <img
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(
                                property.property_name
                            )}"
                            style="
                                width:100%;
                                max-height:350px;
                                object-fit:cover;
                                border-radius:12px;
                                margin-bottom:20px;
                            "
                        >
                    `
                    : ""
            }

            <span class="section-label">
                ${escapeHTML(
                    property.property_type
                )}
            </span>

            <h2>
                ${escapeHTML(
                    property.property_name
                )}
            </h2>

            <p>
                📍 ${escapeHTML(
                    [
                        property.address,
                        property.city,
                        property.state
                    ]
                        .filter(Boolean)
                        .join(", ")
                )}
            </p>

            <div class="property-detail-grid">

                <div>
                    <strong>Rent</strong>
                    <span>
                        ${money(
                            tenancy.rent_amount ||
                            property.rent_amount
                        )}
                    </span>
                </div>

                <div>
                    <strong>Rent Start</strong>
                    <span>
                        ${formatDate(
                            tenancy.rent_start
                        )}
                    </span>
                </div>

                <div>
                    <strong>Rent End</strong>
                    <span>
                        ${formatDate(
                            tenancy.rent_end
                        )}
                    </span>
                </div>

                <div>
                    <strong>Security Fee</strong>
                    <span>
                        ${money(
                            tenancy.security_fee ||
                            property.security_fee
                        )}
                    </span>
                </div>

                <div>
                    <strong>Service Charge</strong>
                    <span>
                        ${money(
                            tenancy.service_charge ||
                            property.service_charge
                        )}
                    </span>
                </div>

                <div>
                    <strong>Status</strong>
                    <span>
                        ${escapeHTML(
                            tenancy.status ||
                            "active"
                        )}
                    </span>
                </div>

            </div>

            ${
                property.description
                    ? `
                        <div class="property-description">
                            <h3>Description</h3>
                            <p>
                                ${escapeHTML(
                                    property.description
                                )}
                            </p>
                        </div>
                    `
                    : ""
            }

        </div>
    `;
}


/* =========================================================
   TENANT PAYMENTS
   ========================================================= */

function renderTenantPayments() {

    const container =
        $("tenantPaymentList");

    if (!container) {
        return;
    }


    if (!payments.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💰</div>
                <h3>No payment records</h3>
                <p>Your payments will appear here.</p>
            </div>
        `;

        return;
    }


    const total =
        payments.reduce(
            (sum, payment) =>
                sum +
                Number(payment.amount || 0),
            0
        );


    container.innerHTML = `

        <div class="dashboard-card">

            <div class="card-heading">

                <div>
                    <h3>Total Payments</h3>
                    <p>All recorded payments</p>
                </div>

                <strong>
                    ${money(total)}
                </strong>

            </div>

        </div>


        ${payments.map(payment => `

            <div class="admin-list-card">

                <div class="admin-list-main">

                    <div class="stat-icon">
                        💰
                    </div>

                    <div>

                        <h3>
                            ${money(
                                payment.amount
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                payment.payment_type
                            )}
                        </p>

                    </div>

                </div>


                <div class="admin-list-details">

                    <div>
                        <strong>Date</strong>
                        <span>
                            ${formatDate(
                                payment.payment_date
                            )}
                        </span>
                    </div>

                    <div>
                        <strong>Method</strong>
                        <span>
                            ${escapeHTML(
                                payment.payment_method ||
                                "—"
                            )}
                        </span>
                    </div>

                    <div>
                        <strong>Reference</strong>
                        <span>
                            ${escapeHTML(
                                payment.reference ||
                                "—"
                            )}
                        </span>
                    </div>

                </div>

            </div>

        `).join("")}
    `;
}


/* =========================================================
   TENANT COMPLAINTS
   ========================================================= */

function renderTenantComplaints() {

    const container =
        $("tenantComplaintList");

    if (!container) {
        return;
    }


    if (!complaints.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>No complaints</h3>
                <p>Your complaints will appear here.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        complaints
            .map(complaint => `

                <div class="admin-list-card">

                    <div class="admin-list-main">

                        <div class="stat-icon">
                            📝
                        </div>

                        <div>

                            <h3>
                                ${escapeHTML(
                                    complaint.title
                                )}
                            </h3>

                            <p>
                                ${formatDateTime(
                                    complaint.created_at
                                )}
                            </p>

                        </div>

                    </div>


                    <div class="complaint-description">

                        ${escapeHTML(
                            complaint.description
                        )}

                    </div>


                    <div class="admin-list-details">

                        <div>
                            <strong>Priority</strong>
                            <span>
                                ${escapeHTML(
                                    complaint.priority ||
                                    "normal"
                                )}
                            </span>
                        </div>

                        <div>
                            <strong>Status</strong>
                            <span>
                                ${escapeHTML(
                                    complaint.status ||
                                    "open"
                                )}
                            </span>
                        </div>

                    </div>


                    ${
                        complaint.landlord_response
                            ? `
                                <div class="dashboard-card">

                                    <strong>
                                        Landlord Response
                                    </strong>

                                    <p>
                                        ${escapeHTML(
                                            complaint.landlord_response
                                        )}
                                    </p>

                                </div>
                            `
                            : ""
                    }

                </div>

            `)
            .join("");
}


/* =========================================================
   TENANT MESSAGES
   ========================================================= */

function renderTenantMessages() {

    const container =
        $("tenantMessageList");

    if (!container) {
        return;
    }


    if (!messages.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📢</div>
                <h3>No messages</h3>
                <p>Messages from your landlord will appear here.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        messages
            .map(message => `

                <div class="admin-list-card">

                    <div class="admin-list-main">

                        <div class="stat-icon">
                            📢
                        </div>

                        <div>

                            <h3>
                                ${escapeHTML(
                                    message.title
                                )}
                            </h3>

                            <p>
                                ${formatDateTime(
                                    message.created_at
                                )}
                            </p>

                        </div>

                    </div>


                    <div class="complaint-description">

                        ${escapeHTML(
                            message.message
                        )}

                    </div>

                </div>

            `)
            .join("");
}


/* =========================================================
   TENANT NOTIFICATIONS
   ========================================================= */

function renderTenantNotifications() {

    const container =
        $("tenantNotificationList");

    if (!container) {
        return;
    }


    if (!notifications.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <h3>No notifications</h3>
                <p>Your notifications will appear here.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        notifications
            .map(notification => `

                <div
                    class="admin-list-card"
                    onclick="markNotificationRead('${notification.id}')"
                >

                    <div class="admin-list-main">

                        <div class="stat-icon">
                            🔔
                        </div>

                        <div>

                            <h3>
                                ${escapeHTML(
                                    notification.title
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    notification.message
                                )}
                            </p>

                        </div>

                    </div>


                    <div class="admin-list-details">

                        <div>
                            <strong>Date</strong>
                            <span>
                                ${formatDateTime(
                                    notification.created_at
                                )}
                            </span>
                        </div>

                        <div>
                            <strong>Status</strong>
                            <span>
                                ${
                                    notification.is_read
                                        ? "Read"
                                        : "Unread"
                                }
                            </span>
                        </div>

                    </div>

                </div>

            `)
            .join("");
}


async function markNotificationRead(
    notificationId
) {

    try {

        const {
            error
        } = await supabase
            .from("notifications")
            .update({
                is_read:
                    true
            })
            .eq(
                "id",
                notificationId
            )
            .eq(
                "user_id",
                currentUser.id
            );


        if (error) {
            throw error;
        }


        const notification =
            notifications.find(
                item =>
                    String(item.id) ===
                    String(notificationId)
            );


        if (notification) {
            notification.is_read = true;
        }


        renderTenantNotifications();

        renderTenantDashboard();

    } catch (error) {

        console.error(
            "Notification update error:",
            error
        );

    }
}


/* =========================================================
   RENT EXPIRY NOTIFICATION GENERATION
   ========================================================= */

async function createRentExpiryNotifications() {

    if (
        !currentUser ||
        currentProfile?.role !== "admin"
    ) {
        return;
    }


    const expiring =
        getExpiringTenancies(30);


    for (const tenancy of expiring) {

        const tenant =
            tenants.find(
                t =>
                    String(t.id) ===
                    String(
                        tenancy.tenant_id
                    )
            );


        const property =
            properties.find(
                p =>
                    String(p.id) ===
                    String(
                        tenancy.property_id
                    )
            );


        if (!tenant) {
            continue;
        }


        const days =
            daysUntil(
                tenancy.rent_end
            );


        const title =
            days === 0
                ? "Rent expires today"
                : "Rent expiring soon";


        const message =
            days === 0
                ? `The rent for ${property?.property_name || "your property"} expires today.`
                : `The rent for ${property?.property_name || "your property"} expires in ${days} day${days === 1 ? "" : "s"}.`;


        /*
         * Prevent repeated notification creation
         * by checking recent matching notifications.
         */

        const {
            data: existing
        } = await supabase
            .from("notifications")
            .select("id")
            .eq(
                "user_id",
                tenant.id
            )
            .eq(
                "notification_type",
                "rent_expiry"
            )
            .eq(
                "related_id",
                tenancy.id
            )
            .gte(
                "created_at",
                new Date(
                    Date.now() -
                    24 * 60 * 60 * 1000
                ).toISOString()
            )
            .limit(1);


        if (existing?.length) {
            continue;
        }


        await supabase
            .from("notifications")
            .insert({

                user_id:
                    tenant.id,

                title:
                    title,

                message:
                    message,

                notification_type:
                    "rent_expiry",

                related_id:
                    tenancy.id,

                is_read:
                    false

            });


        /*
         * Also notify the landlord.
         */

        await supabase
            .from("notifications")
            .insert({

                user_id:
                    currentUser.id,

                title:
                    `Rent expiry: ${tenant.full_name || "Tenant"}`,

                message:
                    message,

                notification_type:
                    "rent_expiry",

                related_id:
                    tenancy.id,

                is_read:
                    false

            });

    }

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutUser() {

    const confirmed =
        confirm(
            "Are you sure you want to logout?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } = await supabase.auth.signOut();


        if (error) {
            throw error;
        }


        currentUser = null;
        currentProfile = null;

        properties = [];
        tenants = [];
        tenancies = [];
        payments = [];
        complaints = [];
        messages = [];
        notifications = [];

        closeMobileSidebars();

        showPublicApp();

        showPublicSection("home");

        showToast(
            "You have been logged out."
        );

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        showError(
            getErrorMessage(error)
        );
    }
}


/* =========================================================
   CREATE EXPIRY NOTIFICATIONS AFTER ADMIN LOAD
   ========================================================= */

const originalOpenAdminApplication =
    openAdminApplication;


/*
 * This wrapper ensures rent-expiry notifications
 * are checked whenever the admin dashboard opens.
 */

openAdminApplication =
    async function () {

        await originalOpenAdminApplication();

        try {

            await createRentExpiryNotifications();

            await loadAdminNotifications();

            renderAdminNotifications();

        } catch (error) {

            console.warn(
                "Expiry notification check failed:",
                error
            );

        }

    };


/* =========================================================
   MAKE FUNCTIONS AVAILABLE TO HTML onclick HANDLERS
   ========================================================= */

window.showPublicSection =
    showPublicSection;

window.openLoginModal =
    openLoginModal;

window.closeLoginModal =
    closeLoginModal;

window.togglePassword =
    togglePassword;

window.showAdminSection =
    showAdminSection;

window.toggleSidebar =
    toggleSidebar;

window.toggleTenantSidebar =
    toggleTenantSidebar;

window.logoutUser =
    logoutUser;

window.openPropertyForm =
    openPropertyForm;

window.closePropertyForm =
    closePropertyForm;

window.editProperty =
    editProperty;

window.deleteProperty =
    deleteProperty;

window.togglePropertyAdvertised =
    togglePropertyAdvertised;

window.togglePropertyStatus =
    togglePropertyStatus;

window.openPropertyDetails =
    openPropertyDetails;

window.closePropertyDetails =
    closePropertyDetails;

window.openTenantForm =
    openTenantForm;

window.closeTenantForm =
    closeTenantForm;

window.editTenant =
    editTenant;

window.deleteTenant =
    deleteTenant;

window.openPaymentForm =
    openPaymentForm;

window.closePaymentForm =
    closePaymentForm;

window.showTenantSection =
    showTenantSection;

window.openTenantComplaintForm =
    openTenantComplaintForm;

window.closeTenantComplaintForm =
    closeTenantComplaintForm;

window.openMessageForm =
    openMessageForm;

window.closeMessageForm =
    closeMessageForm;

window.resolveComplaint =
    resolveComplaint;

window.markNotificationRead =
    markNotificationRead;


/* =========================================================
   FINAL STARTUP PUBLIC LOAD
   =========================================================

   Do NOT load public properties here.
   checkExistingSession() already loads public properties when
   nobody is logged in. If this second load runs at the same
   time as the admin load, it replaces the full admin property
   list with only advertised + vacant properties. That makes
   properties disappear from the tenant-property dropdown.
   ========================================================= */
