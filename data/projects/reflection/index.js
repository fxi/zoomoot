const pdata = [
  import("./items/001.png.json"),
  import("./items/002.png.json"),
  import("./items/003.png.json"),
  import("./items/004.png.json"),
  import("./items/005.png.json"),
  import("./items/006.png.json"),
  import("./items/007.png.json"),
  import("./items/008.png.json"),
  import("./items/009.png.json"),
  import("./items/010.png.json"),
  import("./items/011.png.json"),
  import("./items/012.png.json"),
  import("./items/013.png.json"),
  import("./items/014.png.json"),
  import("./items/015.png.json"),
  import("./items/016.png.json"),
  import("./items/017.png.json"),
  import("./items/018.png.json"),
  import("./items/019.png.json"),
  import("./items/020.png.json"),
  import("./items/021.png.json"),
  import("./items/022.png.json"),
  import("./items/023.png.json"),
  import("./items/024.png.json"),
  import("./items/025.png.json"),
];

export async function data() {
  const out = [];
  const modules = await Promise.all(pdata);
  for (const m of modules) {
    out.push(m.default);
  }
  return out;
}
