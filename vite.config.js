import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const cesiumSource = "node_modules/cesium/Build/Cesium";
const cesiumBaseUrl = "cesiumStatic";
const cesiumFolder = (name) => ({
  src: `${cesiumSource}/${name}/**/*`,
  dest: `${cesiumBaseUrl}/${name}`,
  rename: { stripBase: 5 },
});

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`),
  },
  server: {
    proxy: {
      "/api": {
        target: "https://imc-guardian.vercel.app",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        cesiumFolder("ThirdParty"),
        cesiumFolder("Workers"),
        cesiumFolder("Assets"),
        cesiumFolder("Widgets"),
      ],
    }),
  ],
});
