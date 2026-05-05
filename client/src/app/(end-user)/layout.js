// client/src/app/(end-user)/layout.js
"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, User, Search, Inbox } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  FaFacebook,
  FaTwitter,
  FaInstagram,
  FaHome,
  FaCalendarAlt,
  FaInfoCircle,
  FaEnvelope,
  FaChalkboardTeacher,
  FaClipboardList,
  FaFutbol,
  FaDumbbell,
} from "react-icons/fa";
import { api } from "@/lib/admin/eventApi";
import FavoriteList from "@/app/(end-user)/favorites/FavoriteList";
import NotificationsBell from "@/components/NotificationsBell";

export default function EndUserLayout({ children }) {
  // -------- Sports menu state (click-to-open) --------
  const [sportsOpen, setSportsOpen] = useState(false);
  const sportsRef = useRef(null);

  // -------- Profile menu (click-to-open) --------
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // current user role & name (used to conditionally render menu items)
  const [role, setRole] = useState(null);
  const [name, setName] = useState("");
  // current user object (needed to pass userId to FavoriteList)
  const [me, setMe] = useState(null);

  // load current user's info (use api helper like admin layout)
  useEffect(() => {
    let mounted = true;
    const fetchMe = async () => {
      try {
        const res = await api("/auth/me");
        let payload = res;
        if (res && typeof res.json === "function") payload = await res.json();
        const me = payload?.data ?? payload?.user ?? payload;
        if (!mounted) return;
        setMe(me);
        setRole(me?.role ? String(me.role).toLowerCase() : null);
        setName(me?.fullName ?? me?.name ?? "");
      } catch (err) {
        // ignore — unauthenticated or fetch failed
      }
    };
    fetchMe();
    return () => {
      mounted = false;
    };
  }, []);

  // close profile dropdown on outside click or Escape
  useEffect(() => {
    function onDocClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const handleLogout = async () => {
    try {
      // try server logout route, ignore errors and redirect to homepage
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (e) {
      /* ignore */
    }
    window.location.href = "/";
  };

  const handleWallet = () => {
    if (
      !role ||
      !["student", "staff", "ta", "professor"].includes(
        String(role).toLowerCase()
      )
    ) {
      alert("Your user role is not eligible for a wallet.");
      return;
    }
    window.location.href = "/wallet";
  };

  // Close Sports dropdown on outside click / Escape
  useEffect(() => {
    function onDocClick(e) {
      if (sportsRef.current && !sportsRef.current.contains(e.target)) {
        setSportsOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === "Escape") setSportsOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const normalizedRole = String(role || "").toLowerCase();
  const loyaltyAllowedRoles = [
    "student",
    "staff",
    "ta",
    "professor",
    "event_office",
    "admin",
  ];
  const showLoyalty =
    loyaltyAllowedRoles.includes(normalizedRole);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="bg-primary text-root-primary text-sm px-6 py-2 flex justify-between items-center">
        <span>Welcome to Our Events Website</span>
        <div className="flex items-center space-x-4">
          <span>Follow us:</span>
          <div className="flex space-x-3">
            <FaFacebook className="w-4 h-4 text-root-primary hover:bg-root hover:text-root-primary rounded-sm p-0.5 cursor-pointer" />
            <FaTwitter className="w-4 h-4 text-root-primary hover:bg-root hover:text-root-primary rounded-sm p-0.5 cursor-pointer" />
            <FaInstagram className="w-4 h-4 text-root-primary hover:bg-root hover:text-root-primary rounded-sm p-0.5 cursor-pointer" />
          </div>
        </div>
      </header>

      {/* Nav Bar */}
      <nav className="bg-root text-root-primary px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/home" className="flex items-center space-x-2">
          <Image
            src="/logo.png"
            alt="Logo"
            width={80}
            height={80}
            className=""
            priority
          />
        </Link>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-6">
          <div className="flex items-center border border-root rounded-md overflow-hidden bg-root">
            <input
              type="text"
              placeholder="Search for anything..."
              className="flex-1 px-4 py-2 text-root-primary bg-root outline-none"
            />
            <button
              className="px-4 text-root-primary hover:bg-primary hover:text-root-primary transition rounded-md"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Icons */}
        <div className="flex items-center space-x-6">
          <NotificationsBell />
          <FavoriteList userId={me?.id} />
          {/* Inbox icon */}
          <Link href="/inbox" className="hover:text-primary flex items-center" aria-label="Inbox">
            <Inbox className="w-6 h-6" />
          </Link>
          {/* Profile dropdown */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              className="hover:text-primary flex items-center rounded-md  cursor-pointer"
            >
              <User className="w-6 h-6" />
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 bg-root text-primary border border-root rounded-md shadow-elevated overflow-hidden z-50"
              >
                <Link
                  href="/profile"
                  role="menuitem"
                  className="block px-4 py-2 hover:bg-primary hover:text-primary"
                  onClick={() => setProfileOpen(false)}
                >
                  Profile
                </Link>
                {role &&
                  ["student", "staff", "ta", "professor"].includes(
                    String(role).toLowerCase()
                  ) && (
                    <Link
                      href="/wallet"
                      role="menuitem"
                      className="block px-4 py-2 hover:bg-primary hover:text-primary"
                      onClick={() => {
                        setProfileOpen(false);
                        handleWallet();
                      }}
                    >
                      Wallet
                    </Link>
                  )}
                <Link
                  href="/"
                  role="menuitem"
                  className="w-full text-left px-4 py-2 hover:bg-primary hover:text-primary"
                  onClick={() => handleLogout()
                  }
                >
                  Logout
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Secondary Nav (z-index so dropdown is clickable) */}
      <div className="bg-root shadow-md relative z-40">
        <div className="flex justify-center space-x-10 py-3 text-root-primary font-medium">
          <Link
            href="/home"
            className="flex items-center space-x-2 hover:text-primary transition"
          >
            <FaHome className="w-5 h-5" />
            <span>Home</span>
          </Link>

          <Link
            href="/events"
            className="flex items-center space-x-2 hover:text-primary transition"
          >
            <FaCalendarAlt className="w-5 h-5" />
            <span>Events</span>
          </Link>

          {/* Polls - visible to all users except vendors */}
          {normalizedRole !== "vendor" && (
            <Link
              href="/polls"
              className="flex items-center space-x-2 hover:text-primary transition"
            >
              <FaClipboardList className="w-5 h-5" />
              <span>Polls</span>
            </Link>
          )}

          {/* 🔹 Loyalty Program – only for Student/Staff/TA/Professor/Event Office/Admin */}
          {showLoyalty && (
            <Link
              href="/gucLoyaltyProgram"
              className="flex items-center space-x-2 hover:text-primary transition"
            >
              <Heart className="w-5 h-5" />
              <span>Loyalty Program</span>
            </Link>
          )}

          {normalizedRole === "professor" && (
            <Link
              href="/workshops"
              className="flex items-center space-x-2 hover:text-primary transition"
            >
              <FaChalkboardTeacher className="w-5 h-5" />
              <span>Workshop</span>
            </Link>
          )}

          {/* Sports (only render the wrapper when role is allowed) */}
          {["student", "professor", "staff", "ta"].includes(
            normalizedRole
          ) && (
            <div ref={sportsRef} className="relative">
              <button
                type="button"
                onClick={() => setSportsOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={sportsOpen}
                className="flex items-center space-x-2 hover:text-primary transition rounded-md p-1"
              >
                <FaFutbol className="w-5 h-5" />
                <span>Sports</span>
                <svg
                  className="w-3 h-3 ml-1 opacity-70"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" />
                </svg>
              </button>

              {sportsOpen && (
                <div
                  role="menu"
                  className="
                    absolute top-full left-1/2 -translate-x-1/2 mt-2
                    bg-root text-root-primary border border-root rounded-md shadow-elevated
                    min-w-[240px] z-50 pointer-events-auto
                  "
                >
                  <Link
                    href="/sports"
                    role="menuitem"
                    className="px-4 py-2 hover:bg-primary hover:text-primary flex items-center gap-2"
                    onClick={() => setSportsOpen(false)}
                  >
                    <FaFutbol className="w-4 h-4" />
                    <span>Sports Courts Reservation</span>
                  </Link>
                  <Link
                    href="/gym"
                    role="menuitem"
                    className="px-4 py-2 hover:bg-primary hover:text-primary flex items-center gap-2 rounded-b-md"
                    onClick={() => setSportsOpen(false)}
                  >
                    <FaDumbbell className="w-4 h-4" />
                    <span>Gym Sessions Reservation</span>
                  </Link>
                </div>
              )}
            </div>
          )}

      
         {/* 🔹 Vendor Program & Applications (vendors only) */}
{normalizedRole === "vendor" && (
  <>
    <Link
      href="/programs"
      className="flex items-center space-x-2 hover:text-primary transition"
    >
      <Heart className="w-5 h-5" />
      <span>Loyalty Programs</span>
    </Link>

    <Link
      href="/vendor-requests"
      className="flex items-center space-x-2 hover:text-primary transition"
    >
      <FaClipboardList className="w-5 h-5" />
      <span>My Applications</span>
    </Link>
  </>
)}


          <Link
            href="/about"
            className="flex items-center space-x-2 hover:text-primary transition"
          >
            <FaInfoCircle className="w-5 h-5" />
            <span>About</span>
          </Link>

          <Link
            href="/contact-us"
            className="flex items-center space-x-2 hover:text-primary transition"
          >
            <FaEnvelope className="w-5 h-5" />
            <span>Contact</span>
          </Link>
        </div>
      </div>

      {/* Page Content */}
      <main className="flex-1 bg-root text-root-primary p-6">{children}</main>

      {/* Footer & Mobile bar */}
      <EndUserFooter />
      <MobileBottomBar role={role} />
    </div>
  );
}

/* ---------- Footer ---------- */
function EndUserFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="text-root-primary bg-root border-t border-root">
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <h3 className="font-semibold text-lg mb-3">About</h3>
          <p className="opacity-80 text-sm">
            <strong>UNINEST</strong> helps students and staff{" "}
            <em>Discover, Book, Attend</em> — find events, workshops, trips,
            and campus activities in one place.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-lg mb-3">Quick Links</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/home"
                className="hover:bg-primary hover:text-root-primary px-1 rounded"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/events"
                className="hover:bg-primary hover:text-root-primary px-1 rounded"
              >
                Events
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="hover:bg-primary hover:text-root-primary px-1 rounded"
              >
                About
              </Link>
            </li>
            <li>
              <Link
                href="/contact-us"
                className="hover:bg-primary hover:text-root-primary px-1 rounded"
              >
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-lg mb-3">Contact</h3>
          <ul className="space-y-2 text-sm opacity-90">
            <li>Email: support@acliansexample.edu</li>
            <li>Location: New Cairo, Egypt</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-lg mb-3">Follow</h3>
          <div className="flex items-center gap-4">
            <Link
              href="https://facebook.com"
              target="_blank"
              className="hover:bg-primary hover:text-root-primary px-1 rounded"
            >
              <FaFacebook className="w-5 h-5" />
            </Link>
            <Link
              href="https://twitter.com"
              target="_blank"
              className="hover:bg-primary hover:text-root-primary px-1 rounded"
            >
              <FaTwitter className="w-5 h-5" />
            </Link>
            <Link
              href="https://instagram.com"
              target="_blank"
              className="hover:bg-primary hover:text-root-primary px-1 rounded"
            >
              <FaInstagram className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-root">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs opacity-70 flex items-center justify-between">
          <span>© {year} UNINEST</span>
          <div className="flex gap-4">
            <Link
              href="/terms"
              className="hover:bg-primary hover:text-root-primary px-1 rounded"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="hover:bg-primary hover:text-root-primary px-1 rounded"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Mobile Bottom Tab Bar (hidden on md+) ---------- */
function MobileBottomBar({ role }) {
  const normalizedRole = String(role || "").toLowerCase();
  const loyaltyAllowedRoles = [
    "student",
    "staff",
    "ta",
    "professor",
    "event_office",
    "admin",
  ];
  const showLoyalty =
    loyaltyAllowedRoles.includes(normalizedRole);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-root text-root-primary border-t border-root">
      <ul className="flex justify-around items-center py-2 text-xs">
        <li>
          <Link
            href="/"
            className="flex flex-col items-center gap-1 hover:bg-primary hover:text-root-primary px-2 py-1 rounded"
          >
            <FaHome className="w-5 h-5" />
            <span>Home</span>
          </Link>
        </li>
        <li>
          <Link
            href="/events"
            className="flex flex-col items-center gap-1 hover:bg-primary hover:text-root-primary px-2 py-1 rounded"
          >
            <FaCalendarAlt className="w-5 h-5" />
            <span>Events</span>
          </Link>
        </li>

        {/* 🔹 Mobile Loyalty Program item with same role-gate */}
        {showLoyalty && (
          <li>
            <Link
              href="/gucLoyaltyProgram"
              className="flex flex-col items-center gap-1 hover:bg-primary hover:text-root-primary px-2 py-1 rounded"
            >
              <Heart className="w-5 h-5" />
              <span>Loyalty</span>
            </Link>
          </li>
        )}

        <li>
          <Link
            href="/vendor-requests"
            className="flex flex-col items-center gap-1 hover:bg-primary hover:text-root-primary px-2 py-1 rounded"
          >
            <FaClipboardList className="w-5 h-5" />
            <span>Applications</span>
          </Link>
        </li>
        <li>
          <Link
            href="/about"
            className="flex flex-col items-center gap-1 hover:bg-primary hover:text-root-primary px-2 py-1 rounded"
          >
            <FaInfoCircle className="w-5 h-5" />
            <span>About</span>
          </Link>
        </li>
        <li>
          <Link
            href="/contact-us"
            className="flex flex-col items-center gap-1 hover:bg-primary hover:text-root-primary px-2 py-1 rounded"
          >
            <FaEnvelope className="w-5 h-5" />
            <span>Contact</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
