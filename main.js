import { el } from "@fxi/el";
import Split from "split.js";
import { Editor, Images } from "./zoomoot/";
import { data as loaderDefault } from "./data/projects/reflection/index.js";
import "./style.css";
import "./zoomoot/style.css";

const elApp = document.getElementById("app");

const elImages = el("div", { class: "zo--panel" });
const elEditor = el("div", { class: "zo--panel" });
//const elPlayer = el("div", { class: "zo--panel" });

const elColumnLeft = el(
  "div",
  { class: "zo--column", style: { width: "200px" } },
  [elImages]
);
const elColumnRight = el("div", { class: "zo--column" }, [elEditor]);

const elContainer = el(
  "div",
  {
    class: ["zo--container", "dark"],
  },
  [elColumnLeft, elColumnRight]
);

elApp.appendChild(elContainer);

alert("Early version: expect a lot of bugs 🐞")

const images = new Images(elImages, { loaderDefault: loaderDefault });
const editor = new Editor(elEditor);
//const player = new Player(elEditor, images);

//Split([elPlayer, elEditor], { direction: "vertical", minSize: 250 });
Split([elColumnLeft, elColumnRight], { minSize: [200, 1000] });

window._zo = { editor, images };

export { editor, images };
