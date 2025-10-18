// ============================================
// FILE: src/hooks/useTeams.js
// ============================================
import { useContext } from "react";
import { TeamContext } from "../context/TeamContext";

export const useTeams = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeams must be used within a TeamProvider");
  }
  return context;
};