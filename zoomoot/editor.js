import { el } from "@fxi/el";
import { fabric } from "./filter_vignette";
//import dataDefault from "./data_final.json";
import WebMWriter from "webm-writer";
import { settings } from "./settings.js";

fabric.Object.NUM_FRACTION_DIGITS = 100;
fabric.Object.prototype.objectCaching = false;

//const baseZoom = 282429536481;
const baseZoom = 1;

//const res = [];

const vignette = new fabric.Image.filters.Vignette({
  radius: 0.5,
  smoothness: 0.2,
});

const videoWriter = new WebMWriter({
  quality: 0.95,
  frameRate: settings.framerate,
  transparent: false,
});

export { fabric };

export class Editor {
  constructor(elContainer, images) {
    const zo = this;
    zo._el_container = elContainer;
    zo._images = images;
    zo.init().catch(console.error);
  }

  n() {
    const zo = this;
    if (zo._curr < 0) {
      return;
    }
    zo._curr--;
    zo.v(false);
  }
  v() {
    const zo = this;
    const r = settings.ratio;
    let imgToUpdate;
    if (zo._locked === true) {
      return;
    }
    zo._canvas.forEachObject((img, i) => {
      if (i === zo._curr - 1) {
        imgToUpdate = img;
      }
    });

    const alreadyUpdated = imgToUpdate.timestamp > 0;

    zo._canvas.forEachObject((img, i) => {
      if (i === zo._curr && !alreadyUpdated) {
        const zO = zo.zoom;
        zo._canvas.setZoom(1 / baseZoom);
        const wRef = img ? img.getScaledWidth() : zo._w;
        const hRef = img ? img.getScaledHeight() : zo._h;
        const topRef = img ? img.top : 0;
        const leftRef = img ? img.left : 0;
        imgToUpdate.scaleToWidth((wRef * r) / baseZoom);
        imgToUpdate.scaleToHeight((hRef * r) / baseZoom);
        imgToUpdate.set("top", topRef - hRef / 3);
        imgToUpdate.set("left", leftRef - wRef / 3);
        zo._canvas.setZoom(zO);
      }

      if (i == zo._curr) {
        img.selectable = false;
      }

      if (i == zo._curr || img === imgToUpdate) {
        img.visible = true;
      } else {
        img.visible = false;
      }
    });

    zo._canvas.renderAll();
  }

  async init() {
    const zo = this;
    zo._s = 1;
    zo._n = await zo._images.length();
    zo._w = settings.width * zo._s;
    zo._h = settings.height * zo._s;
    zo._curr = zo._n;
    zo._el_canvas = el("canvas", {
      class: "zo--canvas",
      style: {
        width: `${zo._w}px`,
        height: `${zo._h}px`,
      },
    });
    (zo._el_container.style.backgroundColor = settings.background),
      zo._el_container.appendChild(zo._el_canvas);
    zo._canvas = new fabric.Canvas(zo._el_canvas, {
      preserveObjectStacking: true,
    });
    zo._canvas.setHeight(zo._h);
    zo._canvas.setWidth(zo._w);

    if (zo._n > 0) {
      const items = await zo._images.getItems();
      items.reverse();
      const n = items.length;
      let i = 0;
      for (const item of items) {
        const selectable = i++ < n - 1;
        await zo.initImage(item.src, {
          id: item.id,
          timestamp: item.t,
          left: item.x,
          top: item.y,
          scaleX: item.s,
          scaleY: item.s,
          filters: [vignette],
          selectable: selectable,
          srcFromAttribute: false,
        });
      }
    }

    zo._canvas.on("object:modified", async (e) => {
      const id = e.target?.id;
      const item = await zo._images.getItem(id);
      item.s = e.target.scaleX;
      item.h = e.target.height;
      item.w = e.target.width;
      item.x = e.target.left;
      item.y = e.target.top;
      item.t = Date.now();
      zo._images.updateItem(id, item);
    });
    /*const saved = localStorage.getItem("sc");*/

    zo._locked = true;

    /*debugger;*/
    /*if (dataDefault) {*/
    /*console.log("load from file");*/
    /*zo._data = dataDefault;*/
    /*} else if (saved) {*/
    /*console.log("load from localStorage");*/
    /*zo._data = zo.parse(saved);*/
    /*} else {*/
    /*createNew = confirm("Create new ?");*/
    /*if (createNew) {*/
    /*await zo.create();*/
    /*}*/
    /*}*/
    /*if (zo._data) {*/
    /*zo._data.objects.forEach((d, i) => {*/
    /*d.selectable = zo._locked ? false : i !== 0;*/
    /*d.visible = true;*/
    /*});*/

    /*await zo.loadFromJSON(zo._data);*/
    /*}*/
    zo._canvas.on("mouse:wheel", zo.handleZoom.bind(zo));
    zo._canvas.renderAll();
    zo.initOpacityOnDrag();
    zo._canvas.setZoom(1 / baseZoom);
  }

  parse(data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return false;
    }
  }

  get zoom() {
    const zo = this;
    return zo._canvas.getZoom();
  }

  async animate(recording) {
    const zo = this;
    const s = settings;
    zo._animate = true;
    const nSteps = s.duration * s.framerate;
    if (s.reverse) {
      for (let i = nSteps; i >= 0; i--) {
        const percent = zo.ease(i / nSteps);
        console.log(percent);
        await zo._animate_next(percent, recording);
      }
    } else {
      for (let i = 0; i <= nSteps; i++) {
        const percent = zo.ease(i / nSteps);
        await zo._animate_next(percent, recording);
      }
    }

    if (recording) {
      const blob = await videoWriter.complete();
      zo._el_video = el("video");
      zo._el_video.setAttribute("src", URL.createObjectURL(blob));
      document.body.appendChild(zo._el_video);
      window.open(URL.createObjectURL(blob));
    }
  }

  ease(t) {
    // lol
    return 1 - t * t * t * t * t * t * t * t * t * t * t * t * t;
  }

  async _animate_next(percent, recording) {
    return new Promise((resolve, reject) => {
      try {
        const zo = this;
        const a = settings;
        const s = a.zoom_start;
        const e = a.zoom_end;
        const z = zo._linrp({ from: s, to: e, percent });
        zo._canvas.zoomToPoint(a.center, z);

        if (recording) {
          console.log(`recording ${Math.floor(percent*100)}`);
          videoWriter.addFrame(zo._el_canvas);
        }
        setTimeout(resolve, (1 / a.framerate) * 1000);
      } catch (e) {
        reject(e);
      }
    });
  }

  handleZoom(opt) {
    const zo = this;
    const a = settings;
    let delta = opt.e.deltaY;
    let zoom = zo.zoom;
    zoom *= 0.999 ** delta;
    const x = zo._locked ? settings.center.x : opt.e.offsetX;
    const y = zo._locked ? settings.center.y : opt.e.offsetY;

    if (zoom > a.zoom_start) zoom = a.zoom_start;
    if (zoom < a.zoom_end) zoom = a.zoom_end;

    zo._canvas.zoomToPoint({ x, y }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
  }

  initOpacityOnDrag() {
    const zo = this;
    const canvas = zo._canvas;
    canvas.on({
      "object:moving": hideOther,
      "object:scaling": hideOther,
      "object:modified": () => {
        canvas.forEachObject((o) => {
          o.opacity = 1;
        });
      },
    });
    function hideOther(e) {
      let found = false;
      canvas.forEachObject((o) => {
        if (!found) {
          if (o === e.target) {
            // curent object
            o.opacity = 1;
            found = true;
          } else {
            // parent
            o.opacity = 0.5;
          }
        } else {
          // nested
          o.opacity = 0.5;
          switch (e.transform.action) {
            case "scale":
              break;
            case "drag":
              break;
          }
        }
      });
    }
  }

  async create() {
    // TODO: use Promise.all + reorder afterwards.
    const zo = this;
    let i = 0;
    for (const p of config.images) {
      await zo.initImage(p, {
        left: 0,
        top: 0,
        selectable: i != zo._n - 1,
        srcFromAttribute: true,
      });
      i++;
    }
    zo._canvas.renderAll();
  }

  async initImage(url, opt) {
    const zo = this;
    const img = await zo.loadImage(url);
    img.scale(baseZoom);
    img.set(opt);
    img.setControlsVisibility({
      mtr: false,
      mt: false,
      mb: false,
      ml: false,
      mr: false,
    });
    zo._canvas.add(img);
    if (opt.filters || opt.filters.length) {
      img.applyFilters();
    }
  }

  async loadImage(url) {
    return new Promise((resolve) => {
      fabric.Image.fromURL(url, resolve);
    });
  }

  /*async loadFromJSON(item) {*/
  /*const zo = this;*/
  /*return new Promise((resolve) => {*/
  /*zo._canvas.loadFromJSON(item, resolve);*/
  /*});*/
  /*}*/

  toJSON() {
    const zo = this;
    return JSON.stringify(zo._canvas);
  }
  /*  save() {*/
  /*const zo = this;*/
  /*const data = zo.toJSON();*/
  /*localStorage.setItem("sc", data);*/
  /*}*/
  /*clear() {*/
  /*const ok = confirm("Erase?");*/
  /*if (ok) {*/
  /*localStorage.setItem("sc", null);*/
  /*}*/
  /*}*/
  _linrp(o) {
    if (Array.isArray(o.from) && Array.isArray(o.to)) {
      const out = [];
      for (let i = 0; i < Math.min(o.from.length, o.to.length); i++) {
        out[i] = o.from[i] * (1.0 - o.percent) + o.to[i] * o.percent;
      }
      return out;
    } else {
      return o.from * (1.0 - o.percent) + o.to * o.percent;
    }
  }
}
