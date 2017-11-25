const AddValuePanel = window.AddValuePanel = {
  isInitialized: false,
  initialize: function() {
    this.sourceGraphSelect.addEventListener("change", (function() {
      const index = this.sourceGraphSelect.selectedIndex;
      if (this.lastSourceSelected >= 0)
        this.targetGraphSelect.options[this.lastSourceSelected].disabled = false;

      if (index >= 0)
        this.targetGraphSelect.options[index].disabled = true;

      this.lastSourceSelected = index;
      if (this.targetGraphSelect.selectedIndex === index)
        this.targetGraphSelect.selectedIndex = -1;
    }).bind(this), true);

    this.getValueEditor = CodeMirrorManager.buildNewEditor(this.textarea);

    this.isInitialized = true;
    window.LoadPanel.notifyTestOfInit("AddValuePanel");
  },

  update: function() {
    if (!this.isInitialized)
      this.initialize();

    this.updateSelects();
  },

  // private, see below
  form: null,
  textarea: null,
  sourceGraphSelect: null,
  targetGraphSelect: null,
  
  // private
  lastSourceSelected: -1,

  // private
  getValueEditor: null,

  updateSelects: function() {
    const names = HandlerNames.getFormattedNames();
    const frag = document.createDocumentFragment();
    names.forEach(function(n, i) {
      let option = document.createElement("option");
      option.value = i;
      option.text = n;
      frag.appendChild(option);
    });

    const r = document.createRange();
    r.selectNodeContents(this.targetGraphSelect);
    r.deleteContents();
    this.targetGraphSelect.appendChild(frag.cloneNode(true));

    r.selectNodeContents(this.sourceGraphSelect);
    r.deleteContents();
    this.sourceGraphSelect.appendChild(frag);

    r.detach();
  }
};

{
  let elems = {
    "form": "grid-outer-addValue",
    "textarea": "grid-outer-addValue-valueReference",
    "sourceGraphSelect": "grid-outer-addValue-sourcegraph",
    "targetGraphSelect": "grid-outer-addValue-targetgraph",
  };
  let keys = Reflect.ownKeys(elems);
  keys.forEach(function(key) {
    defineElementGetter(AddValuePanel, key, elems[key]);
  });
}