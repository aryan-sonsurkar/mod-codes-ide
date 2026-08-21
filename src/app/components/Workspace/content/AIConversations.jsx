"use client";
import { useState } from "react";
import { MessageSquare, Plus, Trash2, Edit2, X } from "lucide-react";

export default function AIConversations({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onClearAll,
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

  return (
    <div className="ai-conversations">
      <div className="ai-conversations-header">
        <strong>Conversations</strong>
        <button type="button" className="ai-conversations-new" onClick={() => onCreate && onCreate()} aria-label="New conversation">
          <Plus size={12} />
          New
        </button>
      </div>
      {conversations.length === 0 ? (
        <p className="ai-conversations-empty">No conversations yet. Start a new one.</p>
      ) : (
        <ul className="ai-conversations-list" role="list">
          {conversations.map((conversation) => (
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
