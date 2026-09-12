"use client";
import { useState, useMemo } from "react";
import { MessageSquare, Plus, Trash2, Edit2, X, Search } from "lucide-react";

export default function AIConversations({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onClearAll,
  searchQuery,
  onSearchChange,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");

  const startEdit = (conversation) => {
    setEditingId(conversation.id);
    setDraft(conversation.title);
  };

  const commitEdit = () => {
    if (editingId && draft.trim()) {
      onRename && onRename(editingId, draft.trim().slice(0, 80));
    }
    setEditingId(null);
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery || typeof searchQuery !== "string") return conversations;
    const lower = searchQuery.toLowerCase().trim();
    if (!lower) return conversations;
    return conversations.filter((c) => {
      if (c.title && c.title.toLowerCase().includes(lower)) return true;
      return (c.messages || []).some(
        (m) => typeof m.content === "string" && m.content.toLowerCase().includes(lower)
      );
    });
  }, [conversations, searchQuery]);

  return (
    <div className="ai-conversations">
      <div className="ai-conversations-header">
        <strong>Conversations</strong>
        <button type="button" className="ai-conversations-new" onClick={() => onCreate && onCreate()} aria-label="New conversation">
          <Plus size={12} />
          New
        </button>
      </div>
      {conversations.length > 0 && (
        <div className="ai-conversations-search">
          <Search size={12} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery || ""}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            aria-label="Search conversations"
          />
          {searchQuery && (
            <button
              type="button"
              className="ai-conversations-search-clear"
              onClick={() => onSearchChange && onSearchChange("")}
              aria-label="Clear search"
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}
      {filteredConversations.length === 0 ? (
        <p className="ai-conversations-empty">
          {conversations.length === 0
            ? "No conversations yet. Start a new one."
            : "No matching conversations."}
        </p>
      ) : (
        <ul className="ai-conversations-list" role="list">
          {filteredConversations.map((conversation) => (
            <li key={conversation.id} className={`ai-conversation-item ${conversation.id === activeId ? "ai-conversation-active" : ""}`}>
              {editingId === conversation.id ? (
                <input
                  className="ai-conversation-rename"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitEdit();
                    } else if (event.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  onBlur={commitEdit}
                  autoFocus
                />
              ) : (
                <button type="button" className="ai-conversation-title" onClick={() => onSelect && onSelect(conversation.id)}>
                  <MessageSquare size={12} />
                  {conversation.title}
                </button>
              )}
              <span className="ai-conversation-meta">{conversation.messages?.length ?? 0} msgs</span>
              <button type="button" className="ai-conversation-edit" onClick={() => startEdit(conversation)} aria-label={`Rename ${conversation.title}`}>
                <Edit2 size={12} />
              </button>
              <button type="button" className="ai-conversation-delete" onClick={() => onDelete && onDelete(conversation.id)} aria-label={`Delete ${conversation.title}`}>
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {conversations.length > 0 && (
        <button type="button" className="ai-conversations-clear" onClick={() => onClearAll && onClearAll()}>
          <X size={12} />
          Clear all
        </button>
      )}
    </div>
  );
}
