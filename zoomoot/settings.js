import { Pane } from "tweakpane";
import { editor } from "../main.js";

const settings = {
  title: "hello",
  description: "Amimation by zoomoot",
  background: "#000",
  width: 1024,
  height: 1024,
  center: { y: 300, x: 512 },
  ratio: 2.9296875, // 3000 / 1024
  framerate: 60,
  duration: 120,
  reverse: false,
  zoom_base: 1,
  video_export: "download",
};

const pane = new Pane();

const folder_toolbox = pane.addFolder({
  title: "Toolbox",
  expanded: true,
});

const tabs = folder_toolbox.addTab({
  pages: [{ title: "Animate" }, { title: "Edit" }],
});

tabs.pages[0].addInput(settings, "title");
tabs.pages[0].addInput(settings, "description");
tabs.pages[0].addInput(settings, "width");
tabs.pages[0].addInput(settings, "height");
tabs.pages[0].addInput(settings, "framerate");
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
 * Edit first step
 */
/*const btnEditFirst = tabs.pages[1].addButton({*/
  /*title: "Edit first",*/
/*});*/
/*btnEditFirst.on("click", () => {*/
  /*editor.editFirst();*/
/*});*/
/**
 * Edit Previous step
 */
/*const btnEditPrevious = tabs.pages[1].addButton({*/
  /*title: "Edit previous",*/
/*});*/
/*btnEditPrevious.on("click", () => {*/
  /*editor.editPrevious();*/
/*});*/
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
 * Edit last step
 */
/*const btnEditLast = tabs.pages[1].addButton({*/
  /*title: "Edit last",*/
/*});*/
/*btnEditLast.on("click", () => {*/
  /*editor.editLast();*/
/*});*/
/**
 * Edit last step
 */
const btnEditEnd = tabs.pages[1].addButton({
  title: "Edit end",
});
btnEditEnd.on("click", () => {
  editor.editEnd();
});
export { pane, settings };
