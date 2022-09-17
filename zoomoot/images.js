import { Swappable, Plugins } from "@shopify/draggable";
import { el } from "@fxi/el";
import localforage from "localforage";
import { settings } from "./settings.js";
import { editor } from "./../main.js";
/*const storeImages = localforage.createInstance({*/
/*name: "zo@images_data",*/
/*});*/

const storeImages = localforage.createInstance({
  name: "zo@images_data_test",
});
/**
 * Store Images as blob in local forage and serve them from there when required
 * refs:
 * - https://www.smashingmagazine.com/2018/01/drag-drop-file-uploader-vanilla-js/"
 * function logURL(requestDetails) {
 *  console.log(`Loading: ${requestDetails.url}`);
 * }
 *
 * browser.webRequest.onBeforeRequest.addListener(
 *  logURL,
 *  {urls: ["<all_urls>"]}
 * );
 */

export class Images {
  constructor(elContainer, opt) {
    const zo = this;
    zo._opt = Object.assign({}, { loaderDefault: null }, opt);
    zo._settings = settings;
    zo._el_container = elContainer;
    zo.init().catch(console.error);
  }

  async init() {
    const zo = this;
    zo._store = storeImages;
    zo.build();
    zo.initListener();
    await zo.initImages();
  }

  async length() {
    const zo = this;
    const n = await zo._store.length();
    return n;
  }

  addImageList(imagesList) {
    const zo = this;
    const frag = document.createDocumentFragment();
    for (const imgObj of imagesList) {
      const elImageContainer = zo.buildImagePreview(imgObj, 100, 100);
      if (elImageContainer) {
        frag.appendChild(elImageContainer);
      }
    }
    zo._el_gallery.appendChild(frag);
    //zo.initSortable();
  }

  async removeImage(id) {
    const zo = this;
    const elContainer = document.getElementById(id);
    elContainer.remove();
    await zo._store.removeItem(id);
    await editor.removeObject(id);
  }

  async getItem(id) {
    const zo = this;
    const item = await zo._store.getItem(id);
    return item;
  }

  async updateItem(id, obj) {
    const zo = this;
    const item = await zo.getItem(id);
    if (item) {
      Object.assign(item, {}, obj);
      await zo._store.setItem(id, item);
    }
    console.log("Saved item id");
  }

  getIdOrder() {
    const zo = this;
    const order = [];
    const elImages = zo._el_gallery.querySelectorAll(".zo--image-container");
    for (const elImg of elImages) {
      order.push(elImg.id);
    }
    return order;
  }

  async getItems(sorted) {
    const zo = this;
    const out = [];
    const ids = zo.getIdOrder();
    if (!ids.length || !sorted) {
      // No order from ui
      await zo._store.iterate((item) => {
        out.push(item);
      });
    } else {
      // Order from ui
      for (const id of ids) {
        const item = await zo._store.getItem(id);
        out.push(item);
      }
    }
    return out;
  }

  build() {
    const zo = this;
    zo._el_gallery = el("div", { class: "zo--images-gallery" });
    zo._el_container.appendChild(zo._el_gallery);
  }

  async initImages() {
    const zo = this;
    try {
      zo.busyGallery(true, "restoring");
      const n = await zo._store.length();
      if (n === 0) {
        await zo.importFromDefault();
      } else {
        await zo.importFromStore();
      }
      await editor.addImagesFromStore();
    } catch (e) {
      console.error(e);
    } finally {
      zo.busyGallery(false);
    }
  }

  initListener() {
    /**/
    const zo = this;
    const allEvents = ["dragenter", "dragover", "dragleave", "drop"];
    for (const ev of allEvents) {
      window.addEventListener(ev, preventDefaults, false);
    }
    zo._el_gallery.addEventListener("drop", zo.handleDropImages.bind(zo));
  }

  busyGallery(busy, message) {
    const zo = this;
    if (busy) {
      zo._el_gallery.classList.add("busy");
    } else {
      zo._el_gallery.classList.remove("busy");
    }
    zo._el_gallery.dataset.message = message;
  }

  async handleDropImages(e) {
    const zo = this;
    try {
      const files = e.dataTransfer.files;
      if (!files) {
        return;
      }
      const imagesList = [];
      const n = files.length;
      let i = 1;
      for (const file of files) {
        zo.busyGallery(true, `Importing image ${i++}/${n}`);
        if (!isImageNameValid(file.name)) {
          alert(
            `Image name not valid : ${file.name}. Format: 001.png -> 999.png. This limitation will be removed later.`
          );
        } else {
          const imgObj = await zo.fileToImgObj(file);
          imagesList.push(imgObj);
        }
      }
      zo.addImageList(imagesList);
      await zo.saveImages(imagesList);
      await editor.addImagesFromStore();
    } catch (e) {
      console.error(e);
    } finally {
      zo.busyGallery(false);
    }
  }

  async importFromStore() {
    const zo = this;
    const images = [];
    const n = await zo._store.length();
    await zo._store.iterate((image, _, i) => {
      zo.busyGallery(true, `Restoring image ${i}/${n}`);
      images.push(image);
    });
    zo.addImageList(images);
  }

  async importFromDefault() {
    const zo = this;
    const ok = confirm("Empty project. Download default project ?");
    if (ok) {
      const data = await zo._opt.loaderDefault();
      zo.addImageList(data);
      await zo.saveImages(data);
    }
  }

  async fileToImgObj(file) {
    const zo = this;
    const src = await fileToUrl(file);
    const dim = await zo.getImageSrcSize(src);
    return {
      src: src,
      id: file.name,
      w: dim.width,
      h: dim.height,
      x: settings.width / 2 - dim.width / 2,
      y: settings.height / 2 - dim.height / 2,
      s: 1,
      t: null, // timestamp last modif
    };
  }

  async getImageSrcSize(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
        });
      };
    });
  }

  async getStats() {
    /**
     *  MaxLeft and MaxTop should be 0
     *  MinLeft and Mintop should be negative
     *
     *                            │
     *                            │
     *                            │
     *                            │
     *         -12                │
     *         ┌──────────────────┼─────────────────────────────────────┐
     *         │                  │                                     │
     *         │                  │                                     │
     *         │                  │                                     │
     *         │                  │                                     │
     *         │        -6        │                                     │
     *         │        ┌─────────┼───────────────────────────┐         │
     *         │        │         │                           │         │
     *         │        │         │                           │         │
     *         │        │         │                           │         │
     * ────────┼────────┼─────────┼───────────────────────────┼─────────┼───────
     *         │        │         │ 0,0                       │         │
     *         │        │         │ ┌──────────┐              │         │
     *         │        │         │ │          │              │         │
     *         │        │         │ │          │              │         │
     *         │        │         │ │          │              │         │
     *         │        │         │ │          │              │         │
     *         │        │         │ └──────────┘              │         │
     *         │        │         │                           │         │
     *         │        │         │                           │         │
     *         │        │         │                           │         │
     *         │        │         │                           │         │
     *         │        │         │                           │         │
     *         │        └─────────┼───────────────────────────┘         │
     *         │                  │                                     │
     *         │                  │                                     │
     *         │                  │                                     │
     *         │                  │                                     │
     *         └──────────────────┼─────────────────────────────────────┘
     *                            │
     *                            │
     */
    const zo = this;
    const images = await zo.getItems(false);
    const stat = {
      n: images.length,
      minWidth: 1,
      maxWidth: 1,
      minHeight: 1,
      maxHeight: 1,
      minScale: 1,
      maxScale: 1,
      minTop: 0,
      maxTop: 0,
      minLeft: 0,
      maxLeft: 0,
      center: { x: 0, y: 0 },
      nMissingConf: images.length - 1,
    };
    let first = true;
    let largest, h, w;
    for (const img of images) {
      h = img.h * img.s;
      w = img.w * img.s;

      if (first) {
        first = false;
        stat.maxScale = img.s;
        stat.minScale = img.s;
        stat.minHeight = h;
        stat.maxHeight = h;
        stat.minWidth = w;
        stat.maxWidth = w;
        stat.minLeft = img.x;
        stat.maxLeft = img.x;
        stat.minTop = img.y;
        stat.maxTop = img.y;
        largest = img;
        continue;
      }
      if (img.t > 0) {
        /*
         * Check for timestamp
         */
        stat.nMissingConf--;
      }
      if (img.s > stat.maxScale) {
        stat.maxScale = img.s;
      }
      if (img.s < stat.minScale) {
        stat.minScale = img.s;
      }
      if (h < stat.minHeight) {
        stat.minHeight = h;
      }
      if (h > stat.maxHeight) {
        stat.maxHeight = h;
      }
      if (w < stat.minWidth) {
        stat.minWidth = w;
      }
      if (w > stat.maxWidth) {
        stat.maxWidth = w;
        largest = img;
      }
      if (img.x < stat.minLeft) {
        stat.minLeft = img.x;
      }
      if (img.x > stat.maxLeft) {
        stat.maxLeft = img.x;
      }
      if (img.y < stat.minTop) {
        stat.minTop = img.y;
      }
      if (img.y > stat.maxTop) {
        stat.maxTop = img.y;
      }
    }

    /**
     * Center
     * Anim center is the largest item's center
     */
    if (largest) {
      /*
       * TODO: offset should be available
       * during the animation. Center could be computed
       * at last minutes, withou relaunched getStats
       */
      stat.center.x =
        settings.width -
        settings.offset.x -
        (largest.x + largest.w * largest.s) / largest.s;
      stat.center.y =
        settings.height +
        settings.offset.y -
        (largest.y + largest.h * largest.s) / largest.s;
    }
    return stat;
  }

  buildImagePreview(imgObj, width, height) {
    const zo = this;
    const elContainerPrevious = document.getElementById(imgObj.id);
    /**
     * Update
     */
    if (elContainerPrevious) {
      const elImagePrevious = elContainerPrevious.querySelector("img");
      elImagePrevious.setAttribute("src", imgObj.src);
      return;
    }

    /**
     * New
     */
    const elImage = el("img", {
      title: imgObj.id,
      width: width,
      height: height,
      draggable : false,
      src: imgObj.src,
      style: {
        display: "block",
      },
      on: [
        "click",
        () => {
          editor.zoomToObjectId(imgObj.id);
        },
      ],
    });
    const elButton = el(
      "button",
      {
        class: "zo--btn zo--btn-circle-small",
        title: "remove",
        on: [
          "click",
          () => {
            zo.removeImage(imgObj.id).catch(console.errror);
          },
        ],
      },
      "⤫"
    );
    const elContainer = el(
      "div",
      { id: imgObj.id, class: "zo--image-container" },
      [elButton, elImage]
    );

    return elContainer;
  }

  async saveImages(imagesList) {
    const zo = this;
    for (const imgObj of imagesList) {
      await zo._store.setItem(imgObj.id, imgObj);
    }
  }

  initSortable() {
    /**
    * Not used. 
    * TODO:
    * - Order should be independent of image data 
    * - check branch feature/order 
    */
    const zo = this;
    if (!zo._images_sortable) {
      zo._images_sortable = new Swappable(zo._el_gallery, {
        draggable: ".zo--image-container",
        delay: 300,
        mirror: {
          //appendTo: containerSelector,
          constrainDimensions: true,
        },
        plugins: [Plugins.ResizeMirror],
      });
      zo._images_sortable.on("swappable:swapped", async () => {
        const items = await zo.getItems();
        console.log(items);
      });
    }
  }

  async export() {
    const out = [];
    await storeImages.iterate((item) => {
      out.push(item);
    });
    console.log(out);
  }
  import(data) {
    console.log(data);
  }
}

function isImageNameValid(name) {
  return /^[0-9]{3,4}\.(jpe?g|png|gif)$/i.test(name);
}
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function natsort(a, b) {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  } else if (typeof a === "number" && typeof b !== "number") {
    return -1;
  } else if (typeof a !== "number" && typeof b === "number") {
    return 1;
  } else {
    return a > b ? 1 : -1;
  }
}
async function fileToUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => {
        resolve(reader.result);
      },
      false
    );
    reader.readAsDataURL(file);
  });
}
