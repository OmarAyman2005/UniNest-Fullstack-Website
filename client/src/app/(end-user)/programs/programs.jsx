// app/programs/programs.jsx
"use client";

import { useRouter } from "next/navigation";
import { FaRegCalendarAlt } from "react-icons/fa";

/* ---------- Helpers ---------- */
function getTypeMeta(type) {
  const baseIconClass = "w-10 h-10";
  return {
    key: "loyaltyProgram",
    label: "Loyalty Program",
    icon: (
      <svg
        className={baseIconClass}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M12 .587l3.668 7.431L23 9.748l-5.5 5.36L18.335 24 12 20.201 5.665 24 7.5 15.108 2 9.748l7.332-1.73z" />
      </svg>
    ),
    bgClass: "bg-indigo-600/90",
    textClass: "text-white",
    ring: "ring-2 ring-indigo-300/30",
  };
}

/* ---------- Component ---------- */
export default function ProgramsClient() {
  const router = useRouter();

  const program = {
    id: "691a1ef5fc1dbc7776bec897",
    name: "GUC Loyalty Program",
    description:
      "The GUC Loyalty Program gives students and staff access to exclusive discounts from a wide range of partner vendors. From dining and shopping to services and entertainment, members enjoy special offers designed to make everyday experiences more affordable and rewarding.",
    type: "loyaltyProgram",
  };

  const meta = getTypeMeta(program.type);

  const handleRegisterClick = () => {
    router.push(`/vendorApplyingLoyaltyProgram/${program.id}`);
  };

  return (
    <div className="min-h-screen bg-root px-6 py-10 text-root-secondary">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-1">
            Programs Marketplace
          </h1>
          <p className="text-root-secondary">
            Discover ongoing loyalty programs and benefits.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
          <article className="relative bg-surface border border-root rounded-2xl p-6 hover:shadow-elevated transition-colors duration-200 flex flex-col h-full">
            <div
              className={`w-24 h-24 rounded-lg flex items-center justify-center p-2 mb-4 ${meta.bgClass} ${meta.textClass} ${meta.ring}`}
            >
              <div className="flex items-center justify-center">{meta.icon}</div>
            </div>

            <h3 className="text-xl font-semibold text-secondary mb-2">
              {program.name}
            </h3>
            <p className="text-sm text-gray-300 mb-6">{program.description}</p>

            <div className="mt-auto">
              <button
                onClick={handleRegisterClick}
                className="w-full px-4 py-2 rounded-lg btn-primary font-medium hover:opacity-95 transition cursor-pointer"
              >
                Register
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
