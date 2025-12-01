const { ItemView, setIcon, Menu } = require('obsidian');

const COMMENT_VIEW_TYPE = 'colophon-comment-view';

class CommentsView extends ItemView {
    constructor(leaf, settings) {
        super(leaf);
        this.settings = settings;
        this.adapter = null;
        this.unsubscribe = null;
    }

    getViewType() {
        return COMMENT_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Comments';
    }

    getIcon() {
        return 'message-square';
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass('colophon-comment-view');
        this.render();
    }

    async onClose() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    setAdapter(adapter) {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.adapter = adapter;

        if (this.adapter) {
            this.unsubscribe = this.adapter.subscribe(() => {
                this.render();
            });
        }
        this.render();
    }

    render() {
        const container = this.contentEl;
        container.empty();

        if (!this.adapter) {
            container.createEl('div', {
                text: 'No active manuscript.',
                cls: 'colophon-comment-empty'
            });
            return;
        }

        const comments = this.adapter.getComments(); // Should return sorted comments

        if (!comments || comments.length === 0) {
            container.createEl('div', {
                text: 'No comments yet.',
                cls: 'colophon-comment-empty'
            });
            return;
        }

        const list = container.createDiv('colophon-comment-list');

        comments.forEach(comment => {
            this.renderCommentCard(list, comment);
        });
    }

    renderCommentCard(container, comment) {
        const card = container.createDiv('colophon-comment-card');
        card.dataset.commentId = comment.id;

        // Header: Author + Timestamp + Resolve
        const header = card.createDiv('colophon-comment-header');
        const authorInfo = header.createDiv('colophon-comment-author-info');
        authorInfo.createSpan({ text: comment.author, cls: 'colophon-comment-author' });

        const date = new Date(comment.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        authorInfo.createSpan({ text: dateStr, cls: 'colophon-comment-date' });

        const resolveBtn = header.createEl('button', { cls: 'colophon-comment-resolve-btn' });
        setIcon(resolveBtn, 'check');
        resolveBtn.setAttribute('aria-label', 'Resolve comment');
        resolveBtn.onclick = (e) => {
            e.stopPropagation();
            this.adapter.resolveComment(comment.id);
        };

        // Content
        const contentArea = card.createEl('textarea', {
            cls: 'colophon-comment-content',
            text: comment.content
        });
        contentArea.placeholder = "Add a comment...";

        // Auto-resize textarea
        contentArea.addEventListener('input', () => {
            contentArea.style.height = 'auto';
            contentArea.style.height = contentArea.scrollHeight + 'px';
            this.adapter.updateComment(comment.id, { content: contentArea.value });
        });
        // Initial resize
        setTimeout(() => {
            contentArea.style.height = 'auto';
            contentArea.style.height = contentArea.scrollHeight + 'px';
        }, 0);

        // Replies
        if (comment.replies && comment.replies.length > 0) {
            const repliesContainer = card.createDiv('colophon-comment-replies');
            comment.replies.forEach(reply => {
                const replyDiv = repliesContainer.createDiv('colophon-comment-reply');
                const rHeader = replyDiv.createDiv('colophon-comment-reply-header');
                rHeader.createSpan({ text: reply.author, cls: 'colophon-comment-author' });
                // rHeader.createSpan({ text: ' • ' });
                // rHeader.createSpan({ text: new Date(reply.timestamp).toLocaleTimeString(), cls: 'colophon-comment-date' });

                replyDiv.createDiv({ text: reply.content, cls: 'colophon-comment-reply-content' });
            });
        }

        // Reply Input
        const replyInput = card.createEl('input', {
            type: 'text',
            cls: 'colophon-comment-reply-input',
            placeholder: 'Reply...'
        });

        replyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && replyInput.value.trim()) {
                const authorName = this.settings.authorName || "Me";
                this.adapter.addReply(comment.id, authorName, replyInput.value.trim());
                replyInput.value = '';
            }
        });

        // Click to scroll
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking textarea or input
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
            this.adapter.scrollToComment(comment.id);
        });
    }

    focusComment(id) {
        const card = this.contentEl.querySelector(`[data-comment-id="${id}"]`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.addClass('is-active');
            // Remove active class from others
            this.contentEl.querySelectorAll('.colophon-comment-card').forEach(c => {
                if (c !== card) c.removeClass('is-active');
            });
        }
    }
}

module.exports = {
    CommentsView,
    COMMENT_VIEW_TYPE
};
