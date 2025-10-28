// src/hooks/useChatbot.js
import { useContext } from "react";
import { ChatbotContext } from "../context/ChatbotContext";

export const useChatbot = () => {
  const context = useContext(ChatbotContext);
  if (!context) {
    throw new Error("useChatbot must be used within a ChatbotProvider");
  }
  return context;
};