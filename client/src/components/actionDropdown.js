"use client";
import { useState, useRef, useEffect, useMemo, createContext, useContext } from "react";

// Create context for managing open state across all dropdowns
const DropdownContext = createContext(null);

export function DropdownProvider({ children }) {
    const [openDropdownId, setOpenDropdownId] = useState(null);
    return (
        <DropdownContext.Provider value={{ openDropdownId, setOpenDropdownId }}>
            {children}
        </DropdownContext.Provider>
    );
}

export function ActionsDropdown({ event, canEdit, onEdit, onDelete, onView, actions }) {
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);
    const dropdownId = useRef(Math.random().toString(36)).current; // unique id for this instance
    
    const context = useContext(DropdownContext);
    const isOpen = context?.openDropdownId === dropdownId;

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCoords({
                x: rect.right - 130,
                y: rect.bottom + window.scrollY + 5,
            });
        }
    }, [isOpen]);

    useEffect(() => {
        const closeOnOutsideClick = (e) => {
            if (!buttonRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
                context?.setOpenDropdownId(null);
            }
        };
        window.addEventListener("click", closeOnOutsideClick);
        return () => window.removeEventListener("click", closeOnOutsideClick);
    }, [context]);

    const defaultActions = useMemo(() => {
        const list = [
            {
                label: "Details",
                onClick: () => onView?.(event),
            },
        ];
        if (canEdit) {
            list.push({
                label: "Edit",
                onClick: () => onEdit?.(event),
            });
        }
        list.push({
            label: "Delete",
            onClick: () => onDelete?.(event?._id),
            danger: true,
        });
        return list;
    }, [event, onEdit, onDelete, onView]);

    const renderActions = Array.isArray(actions) && actions.length ? actions : defaultActions;

    const toggleDropdown = (e) => {
        e.stopPropagation();
        if (isOpen) {
            context?.setOpenDropdownId(null);
        } else {
            context?.setOpenDropdownId(dropdownId);
        }
    };

    return (
        <>
            <button
                ref={buttonRef}
                onClick={toggleDropdown}
                className="px-3 py-1.5 rounded-xl btn-primary text-root-primary text-sm hover:opacity-90 transition"
            >
                Actions ▾
            </button>

            {isOpen && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: "fixed",
                        top: coords.y,
                        left: coords.x,
                        zIndex: 9999,
                    }}
                    className="w-48 rounded-xl bg-surface border border-root text-root-primary text-sm shadow-elevated"
                >
                    {renderActions.map((a, i) => {
                        const Icon = a.icon;
                        return (
                          <button
                            key={i}
                            onClick={(ev) => {
                                ev.stopPropagation();
                                try {
                                    a.onClick?.();
                                } finally {
                                    context?.setOpenDropdownId(null);
                                }
                            }}
                            className={`flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-highlight transition ${a.danger ? "text-error" : "text-root-primary"} ${a.disabled ? "opacity-40 pointer-events-none" : ""}`}
                          >
                            {Icon && <Icon className="text-sm" />}
                            <span>{a.label}</span>
                          </button>
                        );
                    })}
                </div>
            )}
        </>
    );
}