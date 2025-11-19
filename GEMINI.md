# **Project: Colophon (Obsidian Plugin)**

## **1\. Project Objective**

To build an Obsidian plugin ("Colophon") that enhances the writing experience for long-form manuscripts. The goal is to emulate features found in "Apple Pages" or "Word"—specifically **Comments**, **Track Changes**, and **Automated Footnotes**—while strictly maintaining **Markdown** as the storage format.

## **2\. Architectural Decisions**

We initially considered using Tiptap with a custom JSON format but rejected it in favor of a "Kanban-style" Markdown approach to preserve interoperability and searchability.

### **Core Architecture:**

* **File Format:** Standard .md files.  
* **Detection Mechanism:** The plugin listens for specific frontmatter:  
  \---  
  colophon-plugin: manuscript  
  \---

* **View Handling:** \* When a file with this frontmatter is opened, the plugin intercepts the opening process and swaps the default MarkdownView for a custom ColophonView.  
  * ColophonView extends the native MarkdownView, inheriting standard editing capabilities but allowing for custom CSS classes and CodeMirror 6 (CM6) extensions.  
* **Tech Stack:** Vanilla JavaScript (CommonJS), Obsidian API, CodeMirror 6\. **No TypeScript/Build step.**

## **3\. Current Implementation Status**

**Phase 1 (Completed):** Skeleton and View Interceptor.

* **main.js**: Implements the ColophonView class and the file-open event listener. It successfully detects the frontmatter and swaps the view. It creates a "New Manuscript" via a ribbon icon.  
* **styles.css**: Basic implementation of a "Page View" (gray background, centered white editor).  
* **manifest.json**: Standard boilerplate.

### **Current main.js Logic Summary:**

// Extends MarkdownView to keep editor functionality  
class ColophonView extends MarkdownView { ... }

// On file-open, checks cache.frontmatter\['colophon-plugin'\] \=== 'manuscript'  
// If true, performs leaf.setViewState({ type: 'colophon-view' })

## **4\. Roadmap**

### **Phase 2: Visual Polish (Immediate Next Step)**

* Refine styles.css to ensure the editor looks like a piece of paper (A4/Letter proportions).  
* Ensure the editor handles margins and padding correctly without breaking the cursor position.

### **Phase 3: Commenting System**

* **Storage:** Decide between Inline CriticMarkup ({\>\> comment \<\<}) or Sidecar data (JSON in a bottom comment block %% colophon:data ... %%).  
* **Implementation:** Create a CodeMirror 6 **Decoration Widget** that hides the raw comment syntax and renders a floating bubble/icon in the margin.  
* **UI:** Clicking the bubble opens an input for editing the comment.

### **Phase 4: Track Changes**

* **Storage:** CriticMarkup syntax: {++ added \++}, {-- deleted \--}.  
* **Implementation:** Create a CM6 **Transaction Filter**.  
  * If "Track Changes" is ON: Intercept user typing/deleting.  
  * Convert typed text to {++ text \++}.  
  * Convert deleted text to {-- text \--}.  
* **Visuals:** CM6 Decorations to style additions green and deletions red/strikethrough.

### **Phase 5: Smart Footnotes**

* Auto-renumber footnotes when one is deleted.  
* Auto-insert footnotes at the bottom of the file.

## **5\. Instructions for the Coding Agent**

1. **Maintain the Architecture:** Do not switch to Tiptap or JSON storage. Stick to modifying the internal CodeMirror instance of the MarkdownView.  
2. **Language:** Write all code in **Vanilla JavaScript**. Do not provide TypeScript code requiring compilation.  
3. **Context:** We are currently identifying files via colophon-plugin: manuscript.  
4. **Next Task:** Proceed with **Phase 3 (Commenting System)** or **Phase 2 (Visual Refinement)** based on user prompt.