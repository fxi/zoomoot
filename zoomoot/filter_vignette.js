import { fabric } from "fabric";

fabric.textureSize = 4096; //for filters on large images

fabric.Image.filters.Vignette = fabric.util.createClass(
  fabric.Image.filters.BaseFilter,
  {
    type: "Vignette",
    radius: 0.1,
    smoothness: 0.5,
    mainParameter: "radius",
    /**
     * Fragment source for the redify program
     */
    fragmentSource: `
      precision highp float;
      uniform sampler2D uTexture;
      uniform float uRadius;
      uniform float uSmoothness;
      varying vec2 vTexCoord;
      float vignette(vec2 uv, float radius, float smoothness) {
      float diff = radius - distance(uv, vec2(0.5, 0.5));
      return smoothstep(-smoothness, smoothness, diff);
      }
      void main() {
      vec2 p = -1.0 + 2.0 * vTexCoord;
      float r = 1.0 - uRadius;
      float vignetteValue = vignette(vTexCoord, r, uSmoothness);
      vec4 color = vec4(texture2D(uTexture, vTexCoord).rgb ,vignetteValue);
      gl_FragColor = color;
      }`,

    applyTo2d: (options) => {
      const data = options.imageData;
      const len = data.length;
      let i;
      for (i = 0; i < len; i += 4) {
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    },
    getUniformLocations: (gl, program) => {
      return {
        uRadius: gl.getUniformLocation(program, "uRadius"),
        uSmoothness: gl.getUniformLocation(program, "uSmoothness"),
      };
    },
    sendUniformData: function (gl, uniformLocations) {
      gl.uniform1f(uniformLocations.uRadius, this.radius);
      gl.uniform1f(uniformLocations.uSmoothness, this.smoothness);
    },
  }
);

fabric.Image.filters.Vignette.fromObject =
  fabric.Image.filters.BaseFilter.fromObject;

export { fabric };
