import { el } from "@fxi/el";
import { fabric } from "fabric";
import config from "./config.json";
import dataDefault from "./data_final.json";
import WebMWriter from "webm-writer";

fabric.Object.NUM_FRACTION_DIGITS = 100;
fabric.Object.prototype.objectCaching = false;

//const baseZoom = 282429536481;
const baseZoom = 1;

//const res = [];

const videoWriter = new WebMWriter({
  quality: 0.95,
  frameRate: config.animation.framerate,
  transparent: false,
});

export class Scroller {
  constructor(elContainer) {
    const sc = this;
    sc._el_container = elContainer;
    sc.init().catch(console.error);
  }

  n() {
    const sc = this;
    if (sc._curr < 0) {
      return;
    }
    sc._curr--;
    sc.v(false);
  }
  v() {
    const sc = this;
    const r = config.creation.ratio_nesting;
    let imgRef;
    if (sc._locked === true) {
      return;
    }
    sc._canvas.forEachObject((img, i) => {
      if (i === sc._curr - 1) {
        console.log(`Setting ref image as ${img.getSrc()}`);
        imgRef = img;
        console.log("img ref", i, img.getSrc());
      }
    });

    sc._canvas.forEachObject((img, i) => {
      if (i === sc._curr) {
        console.log("img current", i, img.getSrc());
        const zO = sc.zoom;
        sc._canvas.setZoom(1 / baseZoom);
        const wRef = img ? img.getScaledWidth() : sc._w;
        const hRef = img ? img.getScaledHeight() : sc._h;
        const topRef = img ? img.top : 0;
        const leftRef = img ? img.left : 0;
        imgRef.scaleToWidth((wRef * r) / baseZoom);
        imgRef.scaleToHeight((hRef * r) / baseZoom);
        imgRef.set("top", topRef - hRef / 3);
        imgRef.set("left", leftRef - wRef / 3);
        sc._canvas.setZoom(zO);
      }

      if (i == sc._curr || img === imgRef) {
        img.visible = true;
      } else {
        img.visible = false;
      }
    });

    sc._canvas.renderAll();
  }

  async init() {
    const sc = this;
    sc._s = 1;
    sc._n = config.images.length;
    sc._w = config.image_size.width * sc._s;
    sc._h = config.image_size.height * sc._s;
    sc._curr = sc._n;
    sc._el_canvas = el("canvas", {
      class: "kb--canvas",
      style: {
        width: `${sc._w}px`,
        height: `${sc._h}px`,
      },
    });
    sc._el_container.appendChild(sc._el_canvas);
    sc._canvas = new fabric.Canvas(sc._el_canvas, {
      preserveObjectStacking: true,
    });
    sc._canvas.setHeight(sc._h);
    sc._canvas.setWidth(sc._w);
    const saved = localStorage.getItem("sc");

    if (dataDefault) {
      console.log("load from file");
      sc._locked = true;
      sc._data = dataDefault;
    } else if (saved) {
      console.log("load from localStorage");
      sc._data = sc.parse(saved);
    } else {
      createNew = confirm("Create new ?");
      if (createNew) {
        await sc.create();
      }
    }
    if (sc._data) {
      sc._data.objects.forEach((d, i) => {
        d.selectable = sc._locked ? false : i !== 0;
        d.visible = true;
      });

      await sc.loadFromJSON(sc._data);
    }
    sc._canvas.on("mouse:wheel", sc.handleZoom.bind(sc));
    sc._canvas.renderAll();
    sc.initOpacityOnDrag();
    sc._canvas.setZoom(1 / baseZoom);
  }

  parse(data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return false;
    }
  }

  get zoom() {
    const sc = this;
    return sc._canvas.getZoom();
  }

  async animate(recording) {
    const sc = this;
    const a = config.animation;
    sc._animate = true;
    const nSteps = a.duration * a.framerate;

    for (let i = 0; i <= nSteps; i++) {
      console.log(`${i}/${nSteps}`);
      const percent = sc.ease(i / nSteps);
      await sc._animate_next(percent, recording);
    }
    if (recording) {
      const blob = await videoWriter.complete();
      sc._el_video = el("video");
      sc._el_video.setAttribute("src", URL.createObjectURL(blob));
      document.body.appendChild(sc._el_video);
      window.open(URL.createObjectURL(blob));
    }
  }

  ease(t) {
    // 1 + --t * Math.pow(t,12)
    // lol
    return 1 + --t * t * t * t * t * t * t * t * t * t * t * t * t;
  }

  async _animate_next(percent, recording) {
    return new Promise((resolve, reject) => {
      try {
        const sc = this;
        const a = config.animation;
        const s = a.zoom_start;
        const e = a.zoom_end;
        const z = sc._linrp({ from: s, to: e, percent });
        sc._canvas.zoomToPoint(a.center, z);
        if (recording) {
          videoWriter.addFrame(sc._el_canvas);
        }
        setTimeout(resolve, recording ? 0 : (1 / a.framerate) * 1000);
      } catch (e) {
        reject(e);
      }
    });
  }

  handleZoom(opt) {
    const sc = this;
    const a = config.animation;
    let delta = opt.e.deltaY;
    let zoom = sc.zoom;
    zoom *= 0.999 ** delta;
    const x = sc._locked ? config.animation.center.x : opt.e.offsetX;
    const y = sc._locked ? config.animation.center.y : opt.e.offsetY;

    if (zoom > a.zoom_start) zoom = a.zoom_start;
    if (zoom < a.zoom_end) zoom = a.zoom_end;

    sc._canvas.zoomToPoint({ x, y }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
  }

  initOpacityOnDrag() {
    const sc = this;
    const canvas = sc._canvas;
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
    const sc = this;
    let i = 0;
    for (const p of config.images) {
      await sc.initImage(p, {
        left: 0,
        top: 0,
        selectable: i != sc._n - 1,
        srcFromAttribute: true,
      });
      i++;
    }
    sc._canvas.renderAll();
  }

  async initImage(url, opt) {
    const sc = this;
    const img = await sc.loadImage(url);
    img.scale(baseZoom);
    img.set(opt);
    img.setControlsVisibility({
      mtr: false,
      mt: false,
      mb: false,
      ml: false,
      mr: false,
    });
    console.log(`Add image ${img.getSrc()}`);
    sc._canvas.add(img);
  }

  async loadImage(url) {
    return new Promise((resolve) => {
      fabric.Image.fromURL(url, resolve);
    });
  }

  async loadFromJSON(item) {
    const sc = this;
    return new Promise((resolve) => {
      sc._canvas.loadFromJSON(item, resolve);
    });
  }

  toJSON() {
    const sc = this;
    return JSON.stringify(sc._canvas);
  }
  save() {
    const sc = this;
    const data = sc.toJSON();
    localStorage.setItem("sc", data);
  }
  clear() {
    const ok = confirm("Erase?");
    if (ok) {
      localStorage.setItem("sc", null);
    }
  }
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
