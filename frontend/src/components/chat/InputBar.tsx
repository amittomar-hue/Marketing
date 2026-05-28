"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useChatStore } from "@/lib/chat-store";
import { generateMockResponse } from "@/lib/mock-responses";
import ModelSelector from "./ModelSelector";
import { Paperclip, ArrowUp, Globe, Hammer } from "lucide-react";

export default function InputBar() {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { activeId, newConversation, addMessage, updateMessage, selectedModel } = useChatStore();

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 280) + "px";
    }
  }, [value]);

  const send = async () => {
    const text = value.trim();
    if (!text) return;

    let convId = activeId;
    if (!convId) convId = newConversation();

    addMessage(convId, { role: "user", content: text });
    setValue("");

    // Assistant placeholder for streaming
    const asstId = addMessage(convId, {
      role: "assistant",
      content: "",
      model: selectedModel,
      isStreaming: true,
    });

    // Simulate streaming
    const full = generateMockResponse(text, selectedModel);
    let acc = "";
    for (let i = 0; i < full.length; i += 4) {
      acc = full.slice(0, i + 4);
      await new Promise((r) => setTimeout(r, 18));
      updateMessage(convId, asstId, { content: acc });
    }
    updateMessage(convId, asstId, { content: full, isStreaming: false });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div className="rounded-3xl bg-white border border-[#e5e5e5] shadow-sm focus-within:border-[#c96442] focus-within:shadow-md transition-all">
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder="How can Marketing LLM help you today?"
          className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-[#f0f0f0] transition-colors text-[#5a5a5a]"
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#f0f0f0] transition-colors text-sm text-[#3d3d3d]"
              title="Web search"
            >
              <Globe size={13} />
              <span>Search</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#f0f0f0] transition-colors text-sm text-[#3d3d3d]"
              title="Use a marketing tool"
            >
              <Hammer size={13} />
              <span>Tools</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector />
            <button
              onClick={send}
              disabled={!value.trim()}
              className="w-8 h-8 rounded-lg bg-[#c96442] text-white flex items-center justify-center disabled:bg-[#e5e0d8] disabled:text-[#aaa] hover:bg-[#b85838] transition-colors"
            >
              <ArrowUp size={15} />
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-[11px] text-[#9a9a9a] mt-2">
        Marketing LLM can generate creative campaign content. Verify against brand guidelines before publishing.
      </p>
    </div>
  );
}
