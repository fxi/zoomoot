import { el } from "@fxi/el";
import { Editor, Images } from "./zoomoot/";
import { data as loaderDefault } from "./data/projects/reflection/index.js";
import "./style.css";
import "./zoomoot/style.css";

const elApp = document.getElementById("app");
const elRowBottom = el("div", { class: "zo--row" });
const elRowTop = el("div", { class: "zo--row" });

const elContainer = el(
  "div",
  {
    class: ["zo--container", "dark"],
  },
  [elRowTop, elRowBottom]
);

elApp.appendChild(elContainer);

const images = new Images(elRowBottom, { loaderDefault: loaderDefault });
const editor = new Editor(elRowTop);

window.zo = { editor, images };

export { editor, images };
