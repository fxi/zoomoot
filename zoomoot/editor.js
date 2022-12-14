import loadMP4Module, {
  isWebCodecsSupported,
} from "https://unpkg.com/mp4-wasm@1.0.6";
import { el } from "@fxi/el";
import { settings } from "./settings.js";
import { images } from "./../main.js";
import { fabric } from "./filter_vignette";
import Big from "big.js";
fabric.Object.NUM_FRACTION_DIGITS = 100;
fabric.Object.prototype.objectCaching = false;
Big.DP = 100;
//const res = [];

const vignette = new fabric.Image.filters.Vignette({
  radius: settings.vignette_radius,
  smoothness: settings.vignette_smoothness,
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
    zo.initBinds();
    zo.initAutoSave();
    //zo.initInactiveTabTrick();
    zo.initWakeLock();
    zo.initOpacityOnDrag();
    zo.initZoom();
    zo.lock();
    zo.render();
  }
  initWakeLock() {
    const zo = this;
    document.addEventListener("visibilitychange", async () => {
      try {
        if (document.visibilityState === "visible") {
          await zo.wakeLockEnable();
        }
      } catch (e) {
        console.warn(e);
      }
    });
    zo.wakeLockEnable().catch(console.warn);
  }

  initBinds() {
    const zo = this;
    /*
     * binds
     * -> used in callbacks
     */
    zo.handleZoom = zo.handleZoom.bind(zo);
  }

  initZoom() {
    const zo = this;
    zo._canvas.on("mouse:wheel", zo.handleZoom);
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

  async wakeLockEnable() {
    const zo = this;
    const available = "wakeLock" in navigator;
    if (zo._wake_lock) {
      to.wakeLockDisable();
    }
    if (!available) {
      alert(
        "WakeLock API not available : recording can be interrupted by sleep mode. Use Chromium based browser to avoid that."
      );
    } else {
      zo._wake_lock = await navigator.wakeLock.request("screen");
      zo._wake_lock.addEventListener("release", () => {
        delete zo._wake_lock;
      });
    }
  }

  wakeLockDisable() {
    const zo = this;
    if (zo._wake_lock) {
      zo._wake_lock.release();
      delete zo._wake_lock;
    }
  }

  setTitle(title) {
    document.title = title || settings.pageTitle;
  }
  setProgress(percent) {
    const zo = this;
    const msg =
      percent > 0
        ? `${zo._recording ? "????" : "??????"}${
            Math.ceil(percent * 100 * 100) / 100
          }`
        : null;
    zo.setTitle(msg);
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
      zo._curr = zo._n - 1;
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
    if (zo._animate || zo._recording) {
      alert("Editing is not possible during animation");
    }
    zo.unlock();
    let imgToUpdate;

    if (typeof n !== "undefined" && n > -1 && n < zo._n) {
      zo._curr = n;
    }

    /**
     * Set first image bellow the current one as editable
     */
    zo._canvas.forEachObject((img, i) => {
      if (i === zo._curr - 1) {
        imgToUpdate = img;
      }
    });

    if (!imgToUpdate) {
      return;
    }

    /**
     * Apply default settings :
     * - Hide all, except the ref image and the image to edit
     * - Only the image to edit can be selected, rescaled and moved
     */
    zo._canvas.forEachObject((img, i) => {
      if (i === zo._curr) {
        /**
         * Automatically
         * - set default scale based on ratio * reference image width
         * - set default position, near reference image
         * Skip if timestamp already exist.
         */
        if (imgToUpdate.timestamp) {
          zo.zoomToObject(imgToUpdate);
        } else {
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

  async updateVignette(opt) {
    const zo = this;
    opt = Object.assign(
      {
        radius: settings.vignette_radius,
        smoothness: settings.vignette_smoothness,
      },
      opt
    );
    vignette.radius = opt.radius;
    vignette.smoothness = opt.smoothness;
    const objects = zo._canvas.getObjects();
    for (const object of objects) {
      object.applyFilters();
    }
    zo.render();
  }

  async updateLimits() {
    const zo = this;
    const stat = await zo.getStoreImagesStats();
    zo._zoom_min_max = {
      min: zo._canvas.width / stat.maxWidth,
      max: zo._canvas.width / stat.minWidth,
    };
    zo._n = stat.n;
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

  /*async getZoomMin() {*/
  /*const zo = this;*/
  /*const stat = await zo.getStoreImagesStats();*/
  /*return zo._canvas.height / (stat.minHeight * stat.maxScale);*/
  /*}*/
  /*async getZoomMax() {*/
  /*const zo = this;*/
  /*const stat = await zo.getStoreImagesStats();*/
  /*return zo._canvas.height / (stat.maxHeight * stat.minScale);*/
  /*}*/

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
    return {
      x: panX,
      y: panY,
    };
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
    const zo = this;
    if (!isWebCodecsSupported()) {
      alert("WebCodeds not supported in this browser");
      return;
    }
    return zo.play(true);
  }

  async play(recording) {
    const zo = this;
    try {
      const s = settings;
      const steps = [];
      if (zo._animate) {
        zo.stop();
        return;
      }
      zo.setProgress(0);
      zo._animate = true;
      zo._recording = !!recording;
      zo._mp4_encoder = null;
      zo._animate_steps_n = s.duration * s.framerate;
      const stat = await zo.getStoreImagesStats();
      if (stat.nMissingConf > 0) {
        /* if nothing to play, quit */
        alert(
          "The animation is not fully configured (apparently).Use Toolbox -> edit."
        );
        return;
      }
      if (zo._recording) {
        const ok = confirm("Recording can use a lot of ressources. Continue?");
        if (!ok) {
          return;
        }

        const MP4 = await loadMP4Module();
        zo._mp4_encoder = MP4.createWebCodecsEncoder({
          width: s.width * window.devicePixelRatio,
          height: s.height * window.devicePixelRatio,
          fps: s.framerate,
          bitrate: s.bitrate,
        });
      }

      /**
       * Precompute steps for performance
       * Uses big.js to handle very large significant numbers
       */
      if (s.reverse) {
        zo.zoomToLargest();
        for (let i = zo._animate_steps_n; i >= 0; i--) {
          const percent = i / zo._animate_steps_n;
          const zoom = zo._big_step(percent).toPrecision();
          steps.push({
            percent: 1 - percent,
            zoom,
          });
        }
      } else {
        zo.zoomToSmallest();
        for (let i = 0; i <= zo._animate_steps_n; i++) {
          const percent = i / zo._animate_steps_n;
          const zoom = zo._big_step(percent).toPrecision();
          steps.push({
            percent,
            zoom,
          });
        }
      }

      for (const step of steps) {
        if (!zo._animate) {
          continue;
        }
        await zo._animate_step(step);
        await zo.nextFrame();
      }

      if (zo._recording) {
        await zo.save();
      }
    } catch (e) {
      console.error(e);
    } finally {
      zo.stop();
      zo.setProgress(-1);
      delete zo._mp4_encoder;
    }
  }

  async save() {
    const zo = this;
    if (zo._recording && zo._mp4_encoder) {
      const data = await zo._mp4_encoder.end();
      const blob = new Blob([data]);
      switch (settings.video_export) {
        case "download":
          downloadBlob(blob, "zoomoot.mp4");
          break;
        case "open":
          openBlob(blob);
          break;
        default:
          createVideoElement(blob);
      }
    }
  }

  stop() {
    const zo = this;
    zo._animate = false;
    if (zo._recording) {
      delete zo._mp4_encoder;
      zo._recording = false;
    }
  }

  _big_step(percent) {
    const zo = this;
    const bigP = zo._big_ease(percent);
    const bigZ = zo._big_zoom(bigP);
    return bigZ;
  }

  _big_ease(percent) {
    // using https://easings.net/
    const zo = this;
    const one = Big(1);
    // ease easeInOutSine
    const eased = -(Math.cos(Math.PI * percent) - 1) / 2;
    // normalize easeOutExpo
    const pow = Big(Math.pow(zo._n || 20, -10 * eased));
    return one.minus(pow);
  }

  _big_zoom(bigP) {
    const zo = this;
    const zoomMinMax = zo.getZoomMinMaxCache();
    const bigFrom = Big(zoomMinMax.max);
    const bigTo = Big(zoomMinMax.min);
    const bigZ = zo._big_linrp(bigFrom, bigTo, bigP);
    return bigZ;
  }

  _big_linrp(bigFrom, bigTo, bigPercent) {
    const b = Big(1);
    return bigFrom.times(b.minus(bigPercent)).plus(bigTo.times(bigPercent));
  }

  async _animate_step(step) {
    const zo = this;
    if (!step || !zo._animate) {
      console.warn("No step to animate :/");
      return;
    }
    /**
     * Animation
     */
    zo.setZoom(step.zoom);
    zo.setProgress(step.percent);
    if (zo._recording) {
      /*
       * Extract bitmap and add frame;
       */
      const bitmap = await createImageBitmap(zo._el_canvas);
      await zo._mp4_encoder.addFrame(bitmap);
    }
  }

  handleZoom(opt) {
    const zo = this;
    const zmm = zo.getZoomMinMaxCache();

    if (zo._recording) {
      return;
    }

    if (zo._animate) {
      // stop animation
      zo.stop();
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
      const ok = confirm("Reset all iamge ? Changes will be lost");
      if (!ok) {
        return;
      }
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

  nextFrame() {
    return new Promise((resolve) => {
      if (settings.framerate === 60) {
        requestAnimationFrame(resolve);
      } else {
        setTimeout(resolve, (1 / settings.framerate) * 1000);
      }
    });
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
