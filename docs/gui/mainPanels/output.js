const OutputPanel = window.OutputPanel = {
  // private, see below
  configTextarea: null,
  jsTextarea: null,
  configLink: null,
  jsLink: null,
  errorDiv: null,

  configEditor: null,
  jsEditor: null,

  isInitialized: false,

  /**
   * Initialize the output panel.
   */
  initialize: function() {
    this.configEditor = CodeMirrorManager.buildNewEditor(
      this.configTextarea, { readOnly: true }
    );
    this.jsEditor     = CodeMirrorManager.buildNewEditor(
      this.jsTextarea, { readOnly: true }
    );

    this.isInitialized = true;
    window.LoadPanel.notifyTestOfInit("OutputPanel");
  },

  /**
   * Ensure we are ready to generate valid Membrane code.
   *
   * @private
   */
  validate: function() {
    while (this.errorDiv.firstChild)
      this.errorDiv.removeChild(this.errorDiv.firstChild);

    if (!MembranePanel.form.reportValidity()) {
      this.errorDiv.appendChild(document.createTextNode(
        `There is a problem with the graph names.  Please return to the ` + 
        `Membrane panel and fix the errors.`
      ));
      return false;
    }

    return true;
  },

  /**
   * Generate the Distortions GUI JSON and the membrane crafting file.
   */
  update: function() {
    if (!this.isInitialized)
      this.initialize();

    if (!this.validate()) {
      this.configEditor.setValue("");
      this.jsEditor.setValue("");
      return;
    }

    /**************************************************************************
     * Step 1:  Gather metadata.                                              *
     **************************************************************************/
    const commonFiles = [];
    if (LoadPanel.zipData.map) {
      LoadPanel.zipData.map.forEach(function(meta, relPath) {
        if (meta.checkbox && meta.checkbox.checked) {
          commonFiles.push(relPath);
        }
      });
    }
    else {
      let fileList = LoadPanel.commonFilesInput.files;
      for (let i = 0; i < fileList.length; i++)
        commonFiles.push(fileList[i].name);
    }

    /**************************************************************************
     * Step 2:  Generate Distortions GUI JSON file.                           *
     **************************************************************************/
    const guiConfigAsJSON = {
      "configurationSetup": {
        "useZip": Boolean(LoadPanel.zipData.map),
        "commonFiles": commonFiles,
        "formatVersion": 1.0,
        "lastUpdated": (new Date()).toUTCString(),
      },
      "membrane": {
        "passThroughSource": MembranePanel.getPassThrough(),
        "passThroughEnabled": MembranePanel.passThroughCheckbox.checked,
        "primordialsPass": MembranePanel.primordialsCheckbox.checked,
      },

      "graphs": []
    };

    {
      const controllers = OuterGridManager.graphNamesCache.controllers;
      controllers.forEach(function(c, i) {
        guiConfigAsJSON.graphs.push(c.exportJSON(i));
      });
    }
    const guiConfig = JSON.stringify(guiConfigAsJSON, null, 2) + "\n";

    this.configEditor.setValue(guiConfig);
    {
      let blob = new Blob([guiConfig, "\n"], { type: "application/json" });
      let href = URL.createObjectURL(blob);
      this.configLink.href = href;
    }

    /**************************************************************************
     * Step 3:  Generate Membrane crafting JavaScript file.                   *
     **************************************************************************/
    const PassThroughSource = MembranePanel.getPassThrough(true);
    const formattedNames = HandlerNames.getFormattedNames();
    var script = `function buildMembrane(___utilities___) {
  "use strict";
  
  const rvMembrane = new Membrane({
    logger: (___utilities___.logger || null)`;
    if (PassThroughSource) {
      script += `,
    passThrough: ${PassThroughSource.replace(/\n/gm, "\n    ")}`;
    }
    script += `
  });

`;

    {
      const controllers = OuterGridManager.graphNamesCache.controllers;
      controllers.forEach(function(c, index) {
        const graph = guiConfigAsJSON.graphs[index];

        script += `  {\n    `;
        if (graph.distortions.length || c.passThroughCheckbox.checked)
          script += `const ___graph___ = `;
        script += `rvMembrane.getHandlerByName(${formattedNames[index]}, { mustCreate: true });\n`;

        if (c.passThroughCheckbox.checked) {
          script += `    ___graph___.passThroughFilter = ${c.getPassThrough(true)};\n`;
        }

        if (graph.distortions.length) {
          script += `    const ___listener___ = rvMembrane.modifyRules.createDistortionsListener();\n`;
          graph.distortions.forEach(function(d) {
            const keys = Reflect.ownKeys(d);
            keys.splice(keys.indexOf("about"), 1);
            keys.forEach(function(k) {
              let indent = "\n    ";
              if (d.about.isGroup)
                indent += "  ";

              let deepCopy = {};
              Object.assign(deepCopy, d[k]);
              delete deepCopy.groupDistortions;
              let distortionsAsJSON = JSON.stringify(deepCopy, null, 2);
              distortionsAsJSON = distortionsAsJSON.replace(/\n/gm, indent);

              let localScript = "";
              if (d.about.isGroup)
              {
                localScript += `    ___listener___.addListener(\n      [\n`;
                const names = OutputPanel.getGroupNames(
                  index, d.about.valueName
                );
                names.forEach(function(name, index) {
                  localScript += `        ${name}`;
                  if (index < names.length - 1)
                    localScript += ",\n";
                });
                localScript += `\n      ],\n      "iterable",\n      `;
              }
              else
              {
                localScript += `    ___listener___.addListener(${d.about.valueName},`;
                localScript += ` "${k}", `;
              }
              localScript += distortionsAsJSON;
              if (d.about.isGroup)
                localScript += "\n    ";
              localScript += ");\n\n";

              script += localScript;
            });
          });
          script += `    ___listener___.bindToHandler(___graph___);\n`;
        }

        script += `  }\n\n`;
      });
    }

    script += "  return rvMembrane;\n}\n";

    this.jsEditor.setValue(script);
    {
      let blob = new Blob([script], { type: "application/javascript" });
      let href = URL.createObjectURL(blob);
      this.jsLink.href = href;
    }

    if (window.LoadPanel.testMode) {
      window.postMessage(
        "OutputPanel updated download links", window.location.origin
      );
    }
  },

  getGroupNames: function(graphIndex, groupName) {
    "use strict";
    groupName = groupName.substring(1, groupName.length - 1);
    let rv = [];
    const graph = OuterGridManager.graphNamesCache.controllers[graphIndex];
    const maps = graph.distortionMaps;
    maps.forEach(function(dm) {
      if (dm.about.isGroup)
        return;
      if ("value" in dm) {
        const name = dm.about.valueName;
        const keys = dm.value.getGroupKeys(groupName);
        keys.forEach(function(k) {
          rv.push(`${name}.${k}`);
        });
      }
      if ("proto" in dm) {
        const name = dm.about.valueName;
        const keys = dm.proto.getGroupKeys(groupName);
        keys.forEach(function(k) {
          rv.push(`${name}.prototype.${k}`);
        });
      }
    }, this);
    return rv;
  }
};

{
  let elems = {
    "configTextarea": "grid-outer-output-configuration",
    "jsTextarea": "grid-outer-output-javascript",
    "configLink": "grid-outer-output-config-download",
    "jsLink": "grid-outer-output-js-download",
    "errorDiv": "grid-outer-output-error",
  };
  let keys = Reflect.ownKeys(elems);
  keys.forEach(function(key) {
    defineElementGetter(OutputPanel, key, elems[key]);
  });
}
