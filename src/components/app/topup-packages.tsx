"use client";

import { createContext, useContext } from "react";

import type { PackageOption } from "@/server/topup-packages";

/** Active top-up packages, loaded once by the app layout for every `TopUpSheet`. */
const PackagesContext = createContext<PackageOption[]>([]);

export function TopupPackagesProvider({
  packages,
  children,
}: {
  packages: PackageOption[];
  children: React.ReactNode;
}) {
  return <PackagesContext value={packages}>{children}</PackagesContext>;
}

export const useTopupPackages = () => useContext(PackagesContext);
