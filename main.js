var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => ColophonPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_view2 = require("@codemirror/view");
var import_state3 = require("@codemirror/state");

// src/footnotes.js
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");
var import_state2 = require("@codemirror/state");
var SIDECAR_REGEX = /^%%colophon:data\n([\s\S]*?)\n%%$/m;
var FOOTNOTE_REFERENCE_REGEX = /\[\^([a-zA-Z0-9-]+?)\]/g;
var FOOTNOTE_DEFINITION_BLOCK_REGEX = /\n+(?:\[\^([a-zA-Z0-9\-]+?)\]: .*?\n*)+$/;
function getSidecarData(state) {
  console.log("getSidecarData called. Doc length:", state.doc.length);
  const doc = state.doc.toString();
  const match = doc.match(SIDECAR_REGEX);
  if (match && match[1]) {
    try {
      const data = JSON.parse(match[1]);
      console.log("Sidecar data found:", data);
      return data;
    } catch (e) {
      console.error("Colophon: Error parsing sidecar JSON:", e);
      return null;
    }
  }
  console.log("No sidecar data found.");
  return null;
}
function setSidecarData(view, data) {
  console.log("setSidecarData called with data:", data);
  const currentDoc = view.state.doc.toString();
  const serializedData = JSON.stringify(data, null, 2);
  const newSidecarBlock = `%%colophon:data
${serializedData}
%%`;
  const match = currentDoc.match(SIDECAR_REGEX);
  let transaction;
  if (match) {
    console.log("Replacing existing sidecar block.");
    const start = match.index;
    const end = match.index + match[0].length;
    transaction = view.state.update({
      changes: { from: start, to: end, insert: newSidecarBlock }
    });
  } else {
    console.log("Appending new sidecar block.");
    transaction = view.state.update({
      changes: { from: currentDoc.length, insert: `

${newSidecarBlock}` }
    });
  }
  if (transaction) {
    view.dispatch(transaction);
  }
}
function generateFootnoteId() {
  return `fn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}
var editorViewField = import_state.StateField.define({
  create: (state) => null,
  // Initial value
  update: (value, tr) => {
    for (let effect of tr.effects) {
      if (effect.is(setEditorView)) {
        return effect.value;
      }
    }
    return value;
  }
});
var setEditorView = import_state.StateEffect.define();
var updateSidecarEffect = import_state.StateEffect.define();
var footnotePlugin = import_view.EditorView.updateListener.of((update) => {
  for (let effect of update.transactions.flatMap((tr) => tr.effects)) {
    if (effect.is(updateSidecarEffect)) {
      const view = update.view.state.field(editorViewField);
      if (view) {
        setSidecarData(view, effect.value);
      }
    }
  }
  if (update.docChanged) {
    console.log("footnotePlugin update triggered. docChanged:", update.docChanged);
    const view = update.view;
    const state = update.state;
    const doc = state.doc.toString();
    const currentSidecar = getSidecarData(state);
    const footnotesInSidecar = currentSidecar?.footnotes || [];
    const changes = [];
    const footnoteReferencesInDoc = [];
    let match;
    while ((match = FOOTNOTE_REFERENCE_REGEX.exec(doc)) !== null) {
      footnoteReferencesInDoc.push({
        id: match[1],
        from: match.index,
        to: match.index + match[0].length,
        originalText: match[0]
      });
    }
    console.log("Footnote references in doc:", footnoteReferencesInDoc);
    const footnoteMap = /* @__PURE__ */ new Map();
    footnotesInSidecar.forEach((fn) => footnoteMap.set(fn.id, fn));
    const usedFootnoteIds = /* @__PURE__ */ new Set();
    const newFootnoteDefinitions = [];
    let footnoteNumber = 1;
    for (const ref of footnoteReferencesInDoc) {
      if (!usedFootnoteIds.has(ref.id)) {
        usedFootnoteIds.add(ref.id);
        const fn = footnoteMap.get(ref.id);
        if (fn) {
          const newRefText = `[^${footnoteNumber}]`;
          if (ref.originalText !== newRefText) {
            changes.push({ from: ref.from, to: ref.to, insert: newRefText });
          }
          newFootnoteDefinitions.push({ number: footnoteNumber, content: fn.content });
          footnoteNumber++;
        } else {
          console.warn(`Colophon: Footnote reference [^${ref.id}] found in document but not in sidecar data.`);
        }
      }
    }
    console.log("New footnote definitions:", newFootnoteDefinitions);
    let newDefinitionBlock = "";
    if (newFootnoteDefinitions.length > 0) {
      newDefinitionBlock += "\n\n";
      newFootnoteDefinitions.forEach((fn) => {
        newDefinitionBlock += `[^${fn.number}]: ${fn.content}
`;
      });
    }
    const oldDefinitionBlockMatch = doc.match(FOOTNOTE_DEFINITION_BLOCK_REGEX);
    if (oldDefinitionBlockMatch) {
      changes.push({
        from: oldDefinitionBlockMatch.index,
        to: oldDefinitionBlockMatch.index + oldDefinitionBlockMatch[0].length,
        insert: ""
        // Remove old block
      });
    }
    if (newDefinitionBlock) {
      changes.push({ from: doc.length, insert: newDefinitionBlock });
    }
    if (changes.length > 0) {
      console.log("Dispatching document changes:", changes);
      const tr = state.update({ changes: import_state2.ChangeSet.of(changes, state.doc.length) });
      view.dispatch(tr);
    }
  }
});
var footnoteTransactionFilter = import_state.EditorState.transactionFilter.of((tr) => {
  console.log("footnoteTransactionFilter triggered. tr.docChanged:", tr.docChanged);
  if (!tr.docChanged) return tr;
  let collectedDocChanges = [];
  let sidecarUpdate = null;
  tr.changes.iterChanges((fromA, toA, fromB, toB, insertedText) => {
    console.log("Inserted Text:", insertedText);
    if (insertedText.match(/\[\^\]$/) || insertedText.match(/\[\^(\w+)\]$/)) {
      console.log("Footnote insertion detected!");
      const currentSidecar = getSidecarData(tr.startState);
      const footnotes = currentSidecar?.footnotes || [];
      const newId = generateFootnoteId();
      const newFootnote = { id: newId, content: "" };
      footnotes.push(newFootnote);
      sidecarUpdate = { ...currentSidecar, footnotes };
      console.log("Sidecar update prepared:", sidecarUpdate);
      const textToInsert = `[^${newId}]`;
      collectedDocChanges.push({ from: fromB, to: toB, insert: textToInsert });
    }
  });
  if (collectedDocChanges.length > 0) {
    let newTr = tr.startState.update(tr);
    newTr = newTr.update({ changes: import_state2.ChangeSet.of(collectedDocChanges, newTr.startState.doc.length) });
    if (sidecarUpdate) {
      newTr = newTr.update({ effects: updateSidecarEffect.of(sidecarUpdate) });
    }
    return newTr;
  }
  return tr;
});

// src/main.js
var VIEW_TYPE = "colophon-view";
var ColophonView = class extends import_obsidian.MarkdownView {
  constructor(leaf) {
    super(leaf);
    this.observer = null;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return this.file ? this.file.basename : "No File";
  }
  getIcon() {
    return "feather";
  }
  // Override the editorExtensions getter to provide our CodeMirror extensions
  get editorExtensions() {
    const extensions = [
      footnotePlugin,
      footnoteTransactionFilter,
      // editorViewField should be initialized to null initially.
      // The EditorView instance will be set via effect once it's available.
      editorViewField.init(() => null),
      import_view2.EditorView.domEventHandlers({
        // Add any global event handlers here if needed
      }),
      import_view2.EditorView.updateListener.of((update) => {
      })
    ];
    return extensions;
  }
  async onOpen() {
    await super.onOpen();
    this.containerEl.classList.add("colophon-workspace");
    const sourceView = this.containerEl.querySelector(".markdown-source-view.mod-cm6");
    if (sourceView) {
      this.suppressProperties(sourceView);
    }
    if (this.editor && this.editor.cm) {
      const editorView = this.editor.cm;
      console.log("ColophonView.onOpen: Dispatching setEditorView effect.");
      editorView.dispatch({
        effects: setEditorView.of(editorView)
      });
    } else {
      console.error("ColophonView.onOpen: this.editor.cm is not available after super.onOpen().");
    }
  }
  suppressProperties(sourceView) {
    sourceView.classList.remove("show-properties");
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          if (sourceView.classList.contains("show-properties")) {
            sourceView.classList.remove("show-properties");
          }
        }
      });
    });
    this.observer.observe(sourceView, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }
  async onClose() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    await super.onClose();
  }
};
var ColophonPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.registerView(
      VIEW_TYPE,
      (leaf) => new ColophonView(leaf)
    );
    this.registerEvent(
      this.app.workspace.on("file-open", this.handleFileOpen.bind(this))
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", this.handleActiveLeafChange.bind(this))
    );
    this.addRibbonIcon("feather", "New manuscript", async () => {
      await this.createNewManuscript();
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        const isFolder = file instanceof import_obsidian.TFolder;
        const path = isFolder ? file.path : file.parent.path;
        menu.addItem((item) => {
          item.setTitle("New manuscript").setIcon("feather").onClick(async () => {
            await this.createNewManuscript(path);
          });
        });
      })
    );
    this.addCommand({
      id: "create-new-colophon-manuscript",
      name: "New manuscript",
      callback: () => this.createNewManuscript()
    });
  }
  async handleActiveLeafChange(leaf) {
    if (!leaf) return;
    const file = leaf.view.file;
    if (!file) return;
    await this.ensureCorrectView(leaf, file);
  }
  async handleFileOpen(file) {
    if (!file) return;
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf) return;
    await this.ensureCorrectView(leaf, file);
  }
  async ensureCorrectView(leaf, file) {
    const cache = this.app.metadataCache.getFileCache(file);
    const isColophon = cache?.frontmatter && cache.frontmatter["colophon-plugin"] === "manuscript";
    const currentViewType = leaf.view.getViewType();
    if (isColophon && currentViewType === "markdown") {
      const state = leaf.view.getState();
      await leaf.setViewState({
        type: VIEW_TYPE,
        state,
        active: true
        // Make it the active tab
      });
    } else if (!isColophon && currentViewType === VIEW_TYPE) {
      const state = leaf.view.getState();
      await leaf.setViewState({
        type: "markdown",
        state,
        active: true
      });
    }
  }
  async createNewManuscript(folder) {
    let target;
    if (folder) {
      if (typeof folder === "string") {
        target = this.app.vault.getAbstractFileByPath(folder);
      } else {
        target = folder;
      }
    } else {
      target = this.app.fileManager.getNewFileParent(
        this.app.workspace.getActiveFile()?.path || ""
      );
    }
    if (!target || !target.path) {
      new import_obsidian.Notice("Invalid folder location");
      return;
    }
    const initialContent = "---\ncolophon-plugin: manuscript\n---\n\n";
    const finalPath = await this.getUniqueFilePath(target);
    try {
      const newFile = await this.app.vault.create(finalPath, initialContent);
      await this.ensureViewOpen();
      await this.app.workspace.getLeaf(false).openFile(newFile);
    } catch (e) {
      new import_obsidian.Notice(`Failed to create manuscript: ${e.toString()}`);
    }
  }
  async getUniqueFilePath(folder) {
    let counter = 0;
    while (true) {
      const suffix = counter === 0 ? "" : ` ${counter}`;
      const fileName = `Untitled${suffix}.md`;
      const filePath = (0, import_obsidian.normalizePath)(`${folder.path}/${fileName}`);
      if (!await this.app.vault.exists(filePath)) {
        return filePath;
      }
      counter++;
    }
  }
  async ensureViewOpen() {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
      await this.app.workspace.getRightLeaf(false).setViewState({
        type: VIEW_TYPE
      });
    }
  }
  onunload() {
  }
};
