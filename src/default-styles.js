
const DEFAULT_STYLES = {
    "scale": "100%",
    "supertitle": {
        "name": "Supertitle",
        "type": "paragraph",
        "font-size": "11.5pt",
        "text-align": "center",
        "line-spacing": "14pt",
        "before-paragraph": "0pt",
        "after-paragraph": "18pt",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "font-variant": "Regular"
    },
    "title": {
        "name": "Title",
        "type": "paragraph",
        "font-size": "18pt",
        "text-align": "center",
        "line-spacing": "18pt",
        "before-paragraph": "0pt",
        "after-paragraph": "4pt",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "font-variant": "Regular"
    },
    "subtitle": {
        "name": "Subtitle",
        "type": "paragraph",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "font-variant": "Regular",
        "font-size": "14pt",
        "line-spacing": "18pt",
        "after-paragraph": "28pt",
        "text-align": "center"
    },
    "epigraph": {
        "name": "Epigraph",
        "type": "paragraph",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "font-variant": "Regular",
        "font-size": "11.5pt",
        "line-spacing": "16pt",
        "left-indent": "1in",
        "right-indent": "1in",
        "before-paragraph": "48pt",
        "after-paragraph": "56pt"
    },
    "body-first": {
        "name": "Body First",
        "type": "paragraph",
        "font-size": "11.5pt",
        "text-align": "left",
        "first-indent": "0in",
        "left-indent": "0in",
        "right-indent": "0in",
        "line-spacing": "16pt",
        "before-paragraph": "0pt",
        "after-paragraph": "0pt",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "font-variant": "Regular",
        "following-style": "body"
    },
    "body": {
        "name": "Body",
        "type": "paragraph",
        "font-size": "11.5pt",
        "text-align": "left",
        "first-indent": "0.3in",
        "left-indent": "0in",
        "right-indent": "0in",
        "line-spacing": "16pt",
        "before-paragraph": "0pt",
        "after-paragraph": "0pt",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "font-variant": "Regular"
    },
    "footnote": {
        "name": "Footnote",
        "type": "paragraph",
        "font-size": "7pt",
        "text-align": "left",
        "first-indent": "0in",
        "left-indent": "0in",
        "right-indent": "0in",
        "line-spacing": "9pt",
        "before-paragraph": "0pt",
        "after-paragraph": "0pt",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "font-variant": "Regular",
        "space-between-notes": "10pt",
        "format": "1, 2, 3, …",
        "numbering": "continuous"
    },
    "footnote-number": {
        "name": "Footnote Number",
        "type": "pararaph",
        "font-weight": "bold",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "color": "var(--text-accent)",
        "font-size": "7pt",
        "line-spacing": "9pt"
    },
    "heading-1": {
        "name": "Heading 1",
        "type": "paragraph",
        "font-size": "11.5pt",
        "text-align": "left",
        "first-indent": "0in",
        "left-indent": "0in",
        "right-indent": "0in",
        "line-spacing": "28pt",
        "before-paragraph": "28pt",
        "after-paragraph": "14pt",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "font-variant": "Italic",
        "keep-with-next": true,
        "following-style": "body-first"
    },
    "heading-2": {
        "name": "Heading 2",
        "type": "paragraph",
        "font-size": "11.5pt",
        "text-align": "left",
        "first-indent": "0in",
        "left-indent": "0in",
        "right-indent": "0in",
        "line-spacing": "28pt",
        "before-paragraph": "28pt",
        "after-paragraph": "14pt",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "font-variant": "Regular",
        "capitalization": "small-caps",
        "character-spacing": "2%",
        "keep-with-next": true,
        "following-style": "body-first"
    },
    "heading-3": {
        "name": "Heading 3",
        "type": "paragraph",
        "font-size": "11.5pt",
        "text-align": "center",
        "first-indent": "0in",
        "left-indent": "0in",
        "right-indent": "0in",
        "line-spacing": "28pt",
        "before-paragraph": "28pt",
        "after-paragraph": "14pt",
        "font-family": "var(--font-text-theme), var(--font-text-override)",
        "font-variant": "Regular",
        "keep-with-next": true,
        "following-style": "body-first"
    },
    "bullet": {
        "name": "Bullet",
        "type": "list",
        "defaults": {
            "list-type": "unordered",
            "marker": "•",
            "color": "inherit",
            "size": "100%",
            "align": "0pt",
            "marker-indent": "0in",
            "text-indent": "0.25in"
        }
    },
    "numbered": {
        "name": "Numbered",
        "type": "list",
        "defaults": {
            "list-type": "ordered",
            "marker": "decimal",
            "suffix": ".",
            "color": "inherit",
            "size": "100%",
            "align": "0pt",
            "marker-indent": "0in",
            "text-indent": "0.25in"
        }
    }
};

module.exports = DEFAULT_STYLES;
