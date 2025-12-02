const { setIcon, Menu } = require('obsidian');

class CommentsPanel {
    constructor(containerEl, settings, isSpellcheckEnabled) {
        this.containerEl = containerEl;
        this.settings = settings;
        this.isSpellcheckEnabled = isSpellcheckEnabled;
        this.adapter = null;
        this.unsubscribe = null;
        this.isVisible = false;
        this.el = null;
    }

    create() {
        this.el = this.containerEl.createDiv('colophon-comments-panel');
        // Initial state is hidden by CSS default
        this.render();
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.el) {
            this.el.remove();
        }
    }

    toggle(show) {
        this.isVisible = show;
        if (this.el) {
            this.el.classList.toggle('is-visible', show);
            if (show) {
                this.render();
            }
        }
    }

    setAdapter(adapter) {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.adapter = adapter;

        if (this.adapter) {
            this.unsubscribe = this.adapter.subscribe((event) => {
                if (event && event.type === 'open-comments-panel') {
                    if (!this.isVisible) {
                        this.toggle(true);
                        // Notify view to update button state?
                        // View calls toggle() which updates button.
                        // But here we toggle directly.
                        // We should probably call view.toggleComments(true) but we don't have ref to view.
                        // But wait, toggle() updates `this.isVisible` and `this.el`.
                        // The view button state won't update unless we notify view.
                        // But `CommentsPanel` is child of `ColophonView`.
                        // Maybe we can dispatch a DOM event or just accept button might be out of sync?
                        // Better: `ColophonView` should listen to adapter too?
                        // Or `CommentsPanel` takes `onToggle` callback?
                        // Let's just open it for now. The button state is visual.
                    }
                } else if (event && event.type === 'focus-comment') {
                    if (!this.isVisible) this.toggle(true);
                    this.focusComment(event.id);
                } else {
                    // Normal update
                    if (this.isVisible) {
                        this.render();
                    }
                }
            });
        }

        if (this.isVisible) {
            this.render();
        }
    }

    render() {
        if (!this.el) return;

        const container = this.el;
        container.empty();

        // Header
        const header = container.createDiv('colophon-comments-panel-header');
        header.createSpan({ text: 'Comments', cls: 'colophon-comments-panel-title' });

        // Close button (optional, maybe just use toolbar toggle)
        // const closeBtn = header.createEl('button', { cls: 'colophon-ui-btn colophon-icon-only' });
        // setIcon(closeBtn, 'x');
        // closeBtn.onclick = () => this.toggle(false);

        if (!this.adapter) {
            container.createEl('div', {
                text: 'No active manuscript.',
                cls: 'colophon-comment-empty'
            });
            return;
        }

        const comments = this.adapter.getComments();

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

        const menuBtn = header.createEl('button', { cls: 'colophon-comment-resolve-btn' });
        setIcon(menuBtn, 'more-vertical');
        menuBtn.setAttribute('aria-label', 'More options');
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            const menu = new Menu();

            menu.addItem((item) => {
                item
                    .setTitle('Resolve comment')
                    .setIcon('check')
                    .onClick(() => {
                        this.adapter.resolveComment(comment.id);
                    });
            });

            menu.addItem((item) => {
                item
                    .setTitle('Delete comment')
                    .setIcon('trash')
                    .onClick(() => {
                        this.adapter.deleteComment(comment.id);
                    });
            });

            menu.showAtMouseEvent(e);
        };

        // Content
        const contentArea = card.createEl('textarea', {
            cls: 'colophon-comment-content',
            text: comment.content,
            attr: {
                spellcheck: this.isSpellcheckEnabled ? 'true' : 'false'
            }
        });
        contentArea.placeholder = "Add a comment...";

        // Auto-resize textarea
        contentArea.addEventListener('input', () => {
            contentArea.style.height = 'auto';
            contentArea.style.height = contentArea.scrollHeight + 'px';
        });

        contentArea.addEventListener('blur', () => {
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

                replyDiv.createDiv({ text: reply.content, cls: 'colophon-comment-reply-content' });
            });
        }

        // Reply Input
        const replyInput = card.createEl('input', {
            type: 'text',
            cls: 'colophon-comment-reply-input',
            placeholder: 'Reply...',
            attr: {
                spellcheck: this.isSpellcheckEnabled ? 'true' : 'false'
            }
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
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
            this.adapter.scrollToComment(comment.id);
        });
    }

    focusComment(id) {
        if (!this.isVisible) {
            this.toggle(true);
        }
        // Wait for render
        setTimeout(() => {
            const card = this.el.querySelector(`[data-comment-id="${id}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.addClass('is-active');
                this.el.querySelectorAll('.colophon-comment-card').forEach(c => {
                    if (c !== card) c.removeClass('is-active');
                });
            }
        }, 50);
    }
}

module.exports = CommentsPanel;
