import { Pane } from "tweakpane";
import { editor } from "../main.js";

const settings = {
  pageTitle : "Zoomoot",
  title: "hello",
  description: "Amimation by zoomoot",
  background: "#000",
  width: 1280,
  height: 720,
  center_zoom_anim: { y: 720 / 2, x: 1280 / 2 },
  offset: { x: 130, y: 300 },
  ratio: 2.9296875, // 3000 / 1024
  //framerate: 60,
  framerate: 60,
  ease_power : 23 ,
  duration: 120,
  reverse: false,
  video_export: "download",
  bitrate: 15_000_000
};

const pane = new Pane();

const folder_toolbox = pane.addFolder({
  title: "Toolbox",
  expanded: true,
});

const tabs = folder_toolbox.addTab({
  pages: [{ title: "Animate" }, { title: "Edit" }],
});

//tabs.pages[0].addInput(settings, "title");
//tabs.pages[0].addInput(settings, "description");
//tabs.pages[0].addInput(settings, "width");
//tabs.pages[0].addInput(settings, "height");
tabs.pages[0].addInput(settings, "framerate");
tabs.pages[0].addInput(settings, "ease_power");
tabs.pages[0].addInput(settings, "duration");
tabs.pages[0].addInput(settings, "reverse");

/**
 * Start animation
 */
const btnStart = tabs.pages[0].addButton({
  title: "Start",
});
btnStart.on("click", () => {
  editor.play();
});
/**
 * Stop animation
 */
const btnStop = tabs.pages[0].addButton({
  title: "Stop",
});
btnStop.on("click", () => {
  editor.stop();
});
/**
 * Record animation
 */
const btnRecord = tabs.pages[0].addButton({
  title: "Record",
});
btnRecord.on("click", () => {
  editor.record();
});

/**
 * Edit next step
 */
const btnEditNext = tabs.pages[1].addButton({
  title: "Edit Next",
});
btnEditNext.on("click", () => {
  editor.editNext();
});
/**
 * End edition
 */
const btnEditEnd = tabs.pages[1].addButton({
  title: "Edit end",
});
btnEditEnd.on("click", () => {
  editor.editEnd();
});
/**
 * End edition
 */
const btnReset = tabs.pages[1].addButton({
  title: "Reset",
});
btnReset.on("click", () => {
  editor.reset();
});

export { pane, settings };
