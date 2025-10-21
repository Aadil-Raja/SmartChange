// src/hooks/useAdminTraining.js
import { useContext } from "react";
import { AdminTrainingContext } from "../context/AdminTrainingContext";

export const useAdminTraining = () => {
  const context = useContext(AdminTrainingContext);
  if (!context) {
    throw new Error("useAdminTraining must be used within an AdminTrainingProvider");
  }
  return context;
};