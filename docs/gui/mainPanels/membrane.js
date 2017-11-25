window.MembranePanel = {
  isInitialized: false,

  initialize: function() {
    "use strict";

    this.form.reset();
    this.passThroughEditor = CodeMirrorManager.buildNewEditor(
      this.passThroughTextarea
    );

    // CodeMirror uses 0 for the first line of text.
    CodeMirrorManager.getTextLock(this.passThroughEditor, 3, Infinity);
    this.primordialsTextSet = CodeMirrorManager.getTextLock(
      this.passThroughEditor, 0, 2
    );

    this.primordialsCheckbox.addEventListener("change", this, true);
    this.handlePrimordials({target: this.primordialsCheckbox});

    this.passThroughCheckbox.addEventListener("change", this, true);
    this.handlePassThrough({target: this.passThroughCheckbox});

    this.isInitialized = true;
    window.LoadPanel.notifyTestOfInit("MembranePanel");
  },

  handlePrimordials: function(event) {
    const checked = event.target.checked;
    let source = `const PassThroughFilter = (function() {\n  const items = `;
    source += (checked ? "Membrane.Primordials.slice(0)" : "[]") + ";\n";
    this.primordialsTextSet(source);
  },

  handlePassThrough: function(event) {
    const checked = event.target.checked;
    this.primordialsCheckbox.disabled = !checked;
    CodeMirrorManager.setEditorEnabled(this.passThroughEditor, checked);
  },

  handleEvent: function(event) {
    if (event.target === this.primordialsCheckbox)
      return this.handlePrimordials(event);
    if (event.target === this.passThroughCheckbox)
      return this.handlePassThrough(event);
  },

  configureMembrane: function() {
    OuterGridManager.addPanelRadio.disabled = false;
    OuterGridManager.outputPanelRadio.disabled = false;

    OuterGridManager.addPanelRadio.click();
  },

  getPassThrough: function() {
    if (!this.passThroughCheckbox.checked)
      return null;
    let value = this.passThroughEditor.getValue();
    value = value.substr(value.indexOf("("));
    value = value.replace(/;\n$/, ",\n");
    return value;
  },

  update: async function() {
    if (!this.isInitialized)
      this.initialize();

    if (!this.cachedConfig)
      await this.reset();
  },

  reset: async function() {
    try {
      this.cachedConfig = await window.LoadPanel.getConfiguration();
      this.validity.setCustomValidity("");
    }
    catch (e) {
      this.cachedConfig = null;
      this.validity.setCustomValidity(e.message);
      if (window.LoadPanel.testMode) {
        window.postMessage(
          "MembranePanel exception thrown in reset", window.location.origin
        );
      }
      throw e;
    }

    if (window.LoadPanel.testMode) {
      window.postMessage(
        "MembranePanel cached configuration reset", window.location.origin
      );
    }
  },
};

{
  let elems = {
    "form": "grid-outer-membrane-configForm",
    "passThroughCheckbox": "grid-outer-membrane-enablePT",
    "passThroughTextarea": "grid-outer-membrane-passthrough",
    "primordialsCheckbox": "grid-outer-membrane-primordials",
    "validity": "grid-outer-membrane-graphnames-validity",
  };
  let keys = Reflect.ownKeys(elems);
  keys.forEach(function(key) {
    defineElementGetter(window.MembranePanel, key, elems[key]);
  });
}