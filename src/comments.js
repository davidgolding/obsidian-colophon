class CommentsManager {
    constructor(adapter) {
        this.adapter = adapter;
        this.comments = []; // Array of { id, author, content, timestamp, resolved, replies: [] }
    }

    load(data) {
        this.comments = data || [];
    }

    getComments() {
        return this.comments;
    }

    getComment(id) {
        return this.comments.find(c => c.id === id);
    }

    addComment(id, author = "Me") {
        if (this.getComment(id)) return;

        const newComment = {
            id,
            author,
            content: '',
            timestamp: Date.now(),
            resolved: false,
            replies: []
        };
        this.comments.push(newComment);
        return newComment;
    }

    updateComment(id, updates) {
        const comment = this.getComment(id);
        if (comment) {
            Object.assign(comment, updates);
            // Trigger save via adapter
            this.adapter.triggerUpdate();
        }
    }

    resolveComment(id) {
        const comment = this.getComment(id);
        if (comment) {
            comment.resolved = true;
        }
    }

    deleteComment(id) {
        this.comments = this.comments.filter(c => c.id !== id);
    }

    addReply(commentId, author, content) {
        const comment = this.getComment(commentId);
        if (comment) {
            if (!comment.replies) comment.replies = [];
            comment.replies.push({
                id: `reply-${Date.now()}`,
                author,
                content,
                timestamp: Date.now()
            });
            this.adapter.triggerUpdate();
        }
    }

    // Sync method called by adapter when document changes
    syncWithMarks(activeMarkIds) {
        // 1. Remove comments that no longer have a mark (unless we want to keep history)
        // For simplicity, if the mark is deleted, the comment is deleted.
        // But wait, what if I just cut and paste?
        // Tiptap should preserve the mark on paste.
        // If I delete the text, the mark is gone.

        // Filter out comments that are NOT in activeMarkIds AND are NOT resolved?
        // If we resolved it, we explicitly removed the mark.

        // Let's keep it simple: Data persists only if mark exists.
        // But we need to be careful about "resolved" comments.
        // If resolved, we removed the mark. So it will be removed here.
        // That's fine.

        const activeComments = [];
        activeMarkIds.forEach(id => {
            let comment = this.getComment(id);
            if (!comment) {
                // Orphaned mark without data? Create it.
                comment = {
                    id,
                    author: "Me", // Default, should be updated by UI
                    content: '',
                    timestamp: Date.now(),
                    resolved: false,
                    replies: []
                };
            }
            activeComments.push(comment);
        });

        this.comments = activeComments;
    }
}

module.exports = CommentsManager;
