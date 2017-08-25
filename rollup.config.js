// rollup.config.js
import filesize from "rollup-plugin-filesize";
import uglify from "rollup-plugin-uglify";

export default {
  entry: "src/main.js",
  format: "iife",
  plugins: [uglify(), filesize()],
  dest: "build/ax.min.js"
};
