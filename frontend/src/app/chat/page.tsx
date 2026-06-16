import type { Metadata } from "next";
import ChatLayout from "@/components/chat/ChatLayout";

// Authenticated surface — should never appear in search results.
// noindex applies regardless of any user-defined paths under /chat.
export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false, nocache: true },
};

export default function ChatPage() {
  return <ChatLayout />;
}
