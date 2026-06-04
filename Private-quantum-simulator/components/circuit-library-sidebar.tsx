"use client";
import React, { useState } from "react";
import { IconHistory, IconSearch } from "@tabler/icons-react";
import { BrandLogo } from "./brand-logo";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { CircuitHistoryPanel, type SavedCircuit } from "./circuit-history-panel";

interface CircuitLibrarySidebarProps {
  savedCircuits?: SavedCircuit[];
  onLoadCircuit?: (circuit: SavedCircuit) => void;
  onDeleteCircuit?: (circuitId: string) => void;
  isAuthenticated?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  className?: string;
  onExpandChange?: (expanded: boolean) => void;
  collapsedWidth?: number;
  expandedWidth?: number;
}

export default function CircuitLibrarySidebar({
  savedCircuits = [],
  onLoadCircuit,
  onDeleteCircuit,
  isAuthenticated,
  searchQuery = "",
  onSearchChange,
  className,
  onExpandChange,
  collapsedWidth = 50,
  expandedWidth = 260,
}: CircuitLibrarySidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      className={cn(
        // Fixed left rail that overlays content and spans full height
        "fixed inset-y-0 left-0 z-40 bg-card border-r border-border shadow-md flex flex-col",
        className
      )}
      animate={{
        width: isExpanded ? `${expandedWidth}px` : `${collapsedWidth}px`,
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      onMouseEnter={() => {
        setIsExpanded(true);
        onExpandChange?.(true);
      }}
      onMouseLeave={() => {
        setIsExpanded(false);
        onExpandChange?.(false);
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted">
        <div className="flex items-center gap-2">
          <BrandLogo size={isExpanded ? 40 : 28} withLink={true} />
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-w-0"
              >
                <h2 className="text-lg font-semibold text-foreground tracking-tight">
                  Library
                </h2>
                <p className="text-sm text-muted-foreground">Circuit Library</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search Input */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="mt-4"
            >
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search circuits..."
                  className="w-full h-9 rounded-lg border border-border pl-9 pr-3 text-sm bg-background shadow-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                />
                <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-2"
            >
              <CircuitHistoryPanel
                savedCircuits={savedCircuits}
                onLoadCircuit={onLoadCircuit || (() => {})}
                onDeleteCircuit={onDeleteCircuit || (() => {})}
                isAuthenticated={isAuthenticated}
                searchQuery={searchQuery}
                showSearch={false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Profile */}
    </motion.div>
  );
}
