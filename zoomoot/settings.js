const settings = {
  title: "hello",
  description: "Amimation by zoomoot",
  background: "#000",
  width: 1024,
  height: 768,
  center: { y: 300, x: 512 },
  ratio: 3,
  framerate: 60,
  duration: 120,
  zoom_start: 1,
  zoom_end: 3.574553695752968e-12,
  reverse : false 
};

import { Pane } from "tweakpane";

const pane = new Pane();

const folder_settings = pane.addFolder({
  title: "Settings",
  expanded: false,
});

folder_settings.addInput(settings, "title");
folder_settings.addInput(settings, "description");
folder_settings.addInput(settings, "background");
folder_settings.addInput(settings, "width");
folder_settings.addInput(settings, "height");
folder_settings.addInput(settings, "framerate");
folder_settings.addInput(settings, "center");
folder_settings.addInput(settings, "reverse");

const btnUpdate = folder_settings.addButton({
  title: "Update",
  label: "update", // optional
});

export { pane, settings };
