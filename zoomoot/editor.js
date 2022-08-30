import WebMWriter from "webm-writer";
import { el } from "@fxi/el";
import { settings } from "./settings.js";
import { images } from "./../main.js";
import { fabric } from "./filter_vignette";
fabric.Object.NUM_FRACTION_DIGITS = 100;
fabric.Object.prototype.objectCaching = false;

//const res = [];

const vignette = new fabric.Image.filters.Vignette({
  radius: 0.5,
  smoothness: 0.2,
});

export { fabric };

export class Editor {
  constructor(elContainer) {
    const zo = this;
    zo._el_container = elContainer;
    zo._images = images;
    zo.init().catch(console.error);
  }
  async init() {
    const zo = this;
    zo.build();
    zo.initAutoSave();
    zo.initOpacityOnDrag();
    zo.initZoom();
    zo.lock();
    zo.render();
  }
  initZoom() {
    const zo = this;
    zo._canvas.on("mouse:wheel", zo.handleZoom.bind(zo));
  }
  initMousePointerCoord() {
    const zo = this;
    zo._canvas.on("mouse:move", (options) => {
      const p = canvas.getPointer(options.e);
      console.log({ x: Math.round(p.x), y: Math.round(p.y) });
    });
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
  initAutoSave() {
    const zo = this;
    zo._canvas.on("object:modified", async (e) => {
      try {
        if (zo.locked) {
          console.warn("Can't save in lock mode");
          return;
        }
        const id = e.target?.id;
        const item = await zo._images.getItem(id);
        item.s = e.target.scaleX;
        item.h = e.target.height;
        item.w = e.target.width;
        item.x = e.target.left;
        item.y = e.target.top;
        item.t = Date.now();
        await zo._images.updateItem(id, item);
        await zo.updateLimits();
      } catch (e) {
        console.error(e);
      }
    });
  }

  get width() {
    return this._canvas.width;
  }
  get height() {
    return this._canvas.height;
  }
  setCenterZoomAnim(center) {
    this._center_zoom_anim = center || settings.center_zoom_anim;
  }
  get centerZoomAnim() {
    const zo = this;
    const center = zo._center_zoom_anim || settings.center_zoom_anim;
    return center;
  }

  render() {
    const zo = this;
    zo._canvas.discardActiveObject().renderAll();
  }

  lock() {
    this._locked = true;
  }
  get locked() {
    return this._locked;
  }
  unlock() {
    this._locked = false;
  }
  editFirst() {
    const zo = this;
    zo._curr = zo._n;
    zo.editStep(zo._curr);
  }
  editNext() {
    const zo = this;
    zo.unlock();
    zo._curr--;
    if (zo._curr < 0) {
      to._curr = zo._n;
    }
    zo.editStep(zo._curr);
  }
  editPrevious() {
    const zo = this;
    zo._curr++;
    if (zo._curr > zo._n) {
      zo._curr = 0;
    }
    zo.editStep(zo._curr);
  }
  editLast() {
    const zo = this;
    zo._curr = 0;
    zo.editStep(zo._curr);
  }
  editStep(n) {
    const zo = this;
    const r = settings.ratio;
    if (zo._animate) {
      alert("Editing is not possible during animation");
    }
    zo.unlock();
    let imgToUpdate;

    if (typeof n !== "undefined" && n > -1 && n < zo._n) {
      zo._curr = n;
    }

    zo._canvas.forEachObject((img, i) => {
      if (i === zo._curr - 1) {
        imgToUpdate = img;
      }
    });

    zo._canvas.forEachObject((img, i) => {
      if (i === zo._curr) {
        const zO = zo.zoom;
        zo._canvas.setZoom(1);
        const wRef = img ? img.getScaledWidth() : zo._w;
        const hRef = img ? img.getScaledHeight() : zo._h;
        const topRef = img ? img.top : 0;
        const leftRef = img ? img.left : 0;
        imgToUpdate.scaleToWidth(wRef * r);
        imgToUpdate.scaleToHeight(hRef * r);
        imgToUpdate.set("top", topRef - hRef / 3);
        imgToUpdate.set("left", leftRef - wRef / 3);
        zo._canvas.setZoom(zO);
      }

      img.set("selectable", false);
      img.set("visible", false);

      if (i == zo._curr) {
        img.set("visible", true);
      }
    });

    imgToUpdate.set("selectable", true);
    imgToUpdate.set("visible", true);
    zo.render();
  }

  editEnd() {
    const zo = this;
    zo._canvas.forEachObject((img) => {
      img.set("visible", true);
      img.set("selectable", false);
    });
    zo.lock();
    zo.zoomToOrigin();
  }

  build() {
    const zo = this;
    zo._w = settings.width;
    zo._h = settings.height;

    zo._el_canvas = el("canvas", {
      class: "zo--canvas",
      style: {
        width: `${zo._w}px`,
        height: `${zo._h}px`,
      },
    });
    zo._el_container.style.backgroundColor = settings.background;
    zo._el_container.appendChild(zo._el_canvas);
    zo._canvas = new fabric.Canvas(zo._el_canvas, {
      preserveObjectStacking: true,
    });
    zo._canvas.setHeight(zo._h);
    zo._canvas.setWidth(zo._w);
    zo._el_canvas.parentElement.classList.add("zo--editor");
  }
  parse(data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return false;
    }
  }

  async updateLimits() {
    console.log("update limits");
    const zo = this;
    const stat = await zo.getStoreImagesStats();
    zo._zoom_min_max = {
      min: zo._canvas.height / (stat.maxHeight * stat.maxScale),
      max: zo._canvas.width / (stat.minWidth * stat.minScale),
    };
    zo.setCenterZoomAnim(stat?.center);
  }

  setZoom(z) {
    const zo = this;
    zo._canvas.zoomToPoint(
      { x: zo.centerZoomAnim.x, y: zo.centerZoomAnim.y },
      z
    );
  }

  get zoom() {
    const zo = this;
    return zo._canvas.getZoom();
  }

  getZoomMinMaxCache() {
    const zo = this;
    return zo._zoom_min_max || {};
  }

  async getZoomMin() {
    const zo = this;
    const stat = await zo.getStoreImagesStats();
    return zo._canvas.height / (stat.minHeight * stat.maxScale);
  }
  async getZoomMax() {
    const zo = this;
    const stat = await zo.getStoreImagesStats();
    return zo._canvas.height / (stat.maxHeight * stat.minScale);
  }

  zoomToOrigin() {
    const zo = this;
    zo._canvas.absolutePan({ x: 0, y: 0 });
    zo._canvas.setZoom(1);
  }

  panToObjectId(id) {
    const zo = this;
    zo.panToObject(zo.getObjectById(id));
  }

  panToObject(object, zoom) {
    /**
     * Pan the canvas to the selected object
     */
    const zo = this;
    const canvas = zo._canvas;
    const z = zoom || zo._canvas.getZoom();
    const wC = canvas.getWidth();
    const hC = canvas.getHeight();
    const hO = object.getScaledHeight();
    const wO = object.getScaledWidth();
    const pos = {
      x: object.aCoords.tl.x,
      y: object.aCoords.tl.y,
    };

    const panX = (wC / z / 2 - pos.x - wO / 2) * z;
    const panY = (hC / z / 2 - pos.y - hO / 2) * z;
    canvas.setViewportTransform([z, 0, 0, z, panX, panY]);
    const center = {
      x: panX,
      y: panY,
    };
    console.log(center);
  }

  zoomToObject(object, zoom) {
    const zo = this;
    const z = zoom || zo._canvas.width / object.getScaledWidth();
    zo.panToObject(object, z);
    const c = {
      x: zo._canvas.width / 2,
      y: zo._canvas.height / 2,
    };
    zo._canvas.zoomToPoint(c, z);
  }
  zoomToObjectId(id, zoom) {
    const zo = this;
    const object = zo.getObjectById(id);
    zo.zoomToObject(object, zoom);
  }

  zoomToLargest() {
    const zo = this;
    const largest = zo.getObjectLargest();
    if (largest) {
      zo.zoomToObject(largest);
    }
  }
  zoomToSmallest() {
    const zo = this;
    const smallest = zo.getObjectSmallest();
    if (smallest) {
      zo.zoomToObject(smallest);
    }
  }
  async record() {
    return this.play(true);
  }

  async play(recording) {
    const zo = this;
    try {
      const s = settings;
      if (zo._animate) {
        zo._animate = false;
        return;
      }
      const stat = await zo.getStoreImagesStats();
      if (stat.nMissingConf > 0) {
        /* if nothing to play, quit */
        alert(
          "The animation is not fully configured (apparently).Use Toolbox -> edit."
        );
        return;
      }
      if (recording) {
        const ok = confirm("Recording can use a lot of ressources. Continue?");
        if (!ok) {
          return;
        }
        zo._video_writer = new WebMWriter({
          quality: 0.95,
          frameRate: s.framerate,
          transparent: false,
        });
      }

      zo._animate = true;
      const nSteps = s.duration * s.framerate;
      const steps = new Set();
      if (s.reverse) {
        for (let i = nSteps; i >= 0; i--) {
          const percent = zo.ease(i / nSteps);
          steps.add(percent);
        }
      } else {
        for (let i = 0; i <= nSteps; i++) {
          const percent = zo.ease(i / nSteps);
          steps.add(percent);
        }
      }

      for (const percent of steps) {
        if (!this._animate) {
          return;
        }
        await zo._animate_next(percent, recording);
      }

      zo._animate = false;
      if (recording) {
        const blob = await zo._video_writer.complete();
        switch (settings.video_export) {
          case "download":
            downloadBlob(blob, "zoomoot.webm");
            break;
          case "open":
            openBlob(blob);
            break;
          default:
            createVideoElement(blob);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      zo._animate = false;
    }
  }

  stop() {
    this._animate = false;
  }

  ease(t) {
    // lol
    return 1 - t * t * t * t * t * t * t * t * t * t * t * t * t;
  }

  async _animate_next(percent, recording) {
    const zo = this;
    const zoomMinMax = zo.getZoomMinMaxCache();
    return new Promise((resolve, reject) => {
      try {
        const a = settings;
        const s = zoomMinMax.max;
        const e = zoomMinMax.min;
        const z = zo._linrp({ from: s, to: e, percent });

        zo._canvas.zoomToPoint(zo.centerZoomAnim, z);

        if (recording) {
          console.log(`recording:${percent}`);
          zo._video_writer.addFrame(zo._el_canvas);
        }
        setTimeout(resolve, recording ? 0 : (1 / a.framerate) * 1000);
      } catch (e) {
        reject(e);
      }
    });
  }

  handleZoom(opt) {
    const zo = this;
    const zmm = zo.getZoomMinMaxCache();

    if (zo._animate) {
      // stop animation
      zo._animate = false;
    }
    let delta = opt.e.deltaY;
    let zoom = zo.zoom;
    zoom *= 0.999 ** delta;

    const x = zo.locked ? zo.centerZoomAnim.x : opt.e.offsetX;
    const y = zo.locked ? zo.centerZoomAnim.y : opt.e.offsetY;
    if (zo.locked) {
      if (zoom > zmm.max) zoom = zmm.max;
      if (zoom < zmm.min) zoom = zmm.min;
    }
    if (zoom > 0 && zoom < Infinity) {
      // case when no animation configured
      zo._canvas.zoomToPoint({ x, y }, zoom);
    }
    opt.e.preventDefault();
    opt.e.stopPropagation();
  }

  async reset() {
    const zo = this;
    try {
      const images = await zo.getStoreImages();

      for (const item of images) {
        item.s = 1;
        item.x = settings.width / 2 - item.w / 2;
        item.y = settings.height / 2 - item.h / 2;
        item.t = null;
        await zo._images.updateItem(item.id, item);
      }
      zo.clear();
      await zo.addImagesFromStore();
      await zo.updateLimits();
      zo.zoom(1);
    } catch (e) {
      console.error;
    }
  }

  getObjectById(id) {
    const zo = this;
    const objects = zo._canvas.getObjects();
    for (const object of objects) {
      if (object.id === id) {
        return object;
      }
    }
  }

  toggleBorders() {
    const zo = this;
    const objects = zo._canvas.getObjects();
    const enabled = zo._show_border;
    for (const object of objects) {
      object.set("strokeWidth", enabled ? 0 : 5);
    }
    zo._show_border = true;
  }

  getObjectLargest() {
    const zo = this;
    const objects = zo._canvas.getObjects();
    let largest;
    for (const object of objects) {
      if (!largest) {
        largest = object;
        continue;
      }
      if (object.width * object.scaleX > largest.width * largest.scaleX) {
        largest = object;
      }
    }
    return largest;
  }
  getObjectSmallest() {
    const zo = this;
    const objects = zo._canvas.getObjects();
    let smallest;
    for (const object of objects) {
      if (!smallest) {
        smallest = object;
        continue;
      }
      if (object.width * object.scaleX < smallest.width * smallest.scaleX) {
        smallest = object;
      }
    }
    return smallest;
  }

  async removeObject(id) {
    const zo = this;
    zo.clearCache();
    const object = zo.getObjectById(id);
    if (object) {
      zo._canvas.remove(object);
      await zo.updateLimits();
      zo.zoomToLargest();
      zo.render();
    }
  }

  async getStoreImagesStats() {
    const zo = this;
    return zo._images.getStats();
  }

  async getStoreImagesLength() {
    const zo = this;
    return zo._images.length();
  }

  async addImage(url, opt, skipUpdate) {
    const zo = this;
    const img = await zo.createImage(url);
    zo.clearCache();
    img.scale(1);
    img.set(opt);
    img.setControlsVisibility({
      mtr: false,
      mt: false,
      mb: false,
      ml: false,
      mr: false,
    });
    if (opt?.id) {
      await zo.removeObject(opt.id);
    }
    zo._canvas.add(img);
    if (opt.filters && opt.filters?.length > 0) {
      img.applyFilters();
    }
    if (!skipUpdate) {
      await zo.updateLimits();
    }
  }

  async createImage(url) {
    return new Promise((resolve) => {
      fabric.Image.fromURL(url, resolve);
    });
  }

  async getStoreImages() {
    const zo = this;
    const items = await zo._images.getItems();
    items.reverse();
    return items;
  }

  clear() {
    const zo = this;
    zo._canvas.clear();
  }

  async addImagesFromStore() {
    const zo = this;
    const n = await zo.getStoreImagesLength();
    if (n === 0) {
      console.warn("No images to render");
      return;
    }
    const stat = await zo.getStoreImagesStats();
    zo.zoomToOrigin();
    zo._n = stat.n;
    if (zo._n > 0) {
      zo._curr = zo._n;
      zo.clear();
      const items = await zo.getStoreImages();
      let first = true;
      for (const item of items) {
        await zo.addImage(
          item.src,
          {
            id: item.id,
            timestamp: item.t,
            left: item.x,
            top: item.y,
            scaleX: item.s,
            scaleY: item.s,
            originY: "top",
            originX: "left",
            filters: first ? null : [vignette],
            selectable: false,
            srcFromAttribute: false,
            zoom: first,
          },
          true
        );
        first = false;
      }
      await zo.updateLimits();
    }
  }

  toJSON() {
    const zo = this;
    return JSON.stringify(zo._canvas);
  }

  clearCache() {
    const zo = this;
    delete zo._zoom_min_max;
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

/**
 * Utils
 */
function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.style.display = "none";
  const url = URL.createObjectURL(blob);
  a.download = name;
  a.setAttribute("href", url);
  a.addEventListener("click", () => {
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60 * 1000);
    a.remove();
  });
  document.body.appendChild(a);
  a.click();
}
function openBlob(blob) {
  window.open(URL.createObjectURL(blob));
}
function createVideoElement(blob) {
  const v = document.createElement("video");
  v.setAttribute("src", URL.createObjectURL(blob));
  document.body.appendChild(v);
}
