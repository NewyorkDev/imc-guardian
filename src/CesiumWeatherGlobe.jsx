import React, { useEffect, useRef, useState } from "react";
import {
  ArcType,
  buildModuleUrl,
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  Rectangle,
  TileMapServiceImageryProvider,
  VerticalOrigin,
  Viewer,
  WebMapServiceImageryProvider,
  WebMercatorTilingScheme,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

const gibsWms = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";
const matrixSet = "GoogleMapsCompatible_Level7";
const route = [
  [-82.4493, 27.9167, 70000],
  [-83.1048, 29.6355, 70000],
  [-84.3503, 30.3965, 70000],
];

function expandDomain(domain) {
  const [range, period] = domain.split("/").reduce(
    (result, part, index) => {
      if (index < 2) result[0].push(part);
      else result[1] = part;
      return result;
    },
    [[], "PT10M"],
  );
  if (range.length !== 2) return [];
  const start = new Date(range[0]);
  const end = new Date(range[1]);
  const minutes = Number(period.match(/PT(\d+)M/)?.[1] || 10);
  const values = [];
  for (let time = start.getTime(); time <= end.getTime(); time += minutes * 60000) {
    values.push(new Date(time).toISOString().replace(".000", ""));
  }
  return values;
}

function imageryFor(time = "default") {
  const parameters = {
    transparent: true,
    format: "image/png",
  };
  if (time !== "default") parameters.time = time;
  return new WebMapServiceImageryProvider({
    url: gibsWms,
    layers: "GOES-East_ABI_GeoColor",
    parameters,
    tilingScheme: new WebMercatorTilingScheme(),
    maximumLevel: 7,
    rectangle: Rectangle.fromDegrees(-180, -85, 180, 85),
    credit: "NASA EOSDIS GIBS · GOES-East ABI GeoColor",
    enablePickFeatures: false,
  });
}

export default function CesiumWeatherGlobe({ samples = [] }) {
  const container = useRef(null);
  const viewerRef = useRef(null);
  const weatherLayerRef = useRef(null);
  const sampleEntitiesRef = useRef([]);
  const layerCleanupTimersRef = useRef([]);
  const framesRef = useRef([]);
  const frameRef = useRef(0);
  const focusedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [focused, setFocused] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [frames, setFrames] = useState([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [imageryError, setImageryError] = useState("");

  const showFrame = (index) => {
    const viewer = viewerRef.current;
    if (!viewer || !framesRef.current.length) return;
    const normalized = (index + framesRef.current.length) % framesRef.current.length;
    const priorLayer = weatherLayerRef.current;
    const nextLayer = viewer.imageryLayers.addImageryProvider(
      imageryFor(framesRef.current[normalized]),
    );
    nextLayer.alpha = 0.92;
    nextLayer.brightness = 1.08;
    nextLayer.contrast = 1.12;
    weatherLayerRef.current = nextLayer;
    if (priorLayer) {
      const timer = window.setTimeout(() => {
        if (!viewer.isDestroyed() && viewer.imageryLayers.contains(priorLayer)) {
          viewer.imageryLayers.remove(priorLayer, true);
        }
      }, 2100);
      layerCleanupTimersRef.current.push(timer);
    }
    frameRef.current = normalized;
    setFrameIndex(normalized);
  };

  useEffect(() => {
    if (!container.current) return undefined;
    let disposed = false;
    let rotationRemover;
    const viewer = new Viewer(container.current, {
      baseLayer: false,
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: true,
    });
    viewerRef.current = viewer;
    viewer.scene.backgroundColor = Color.fromCssColorString("#010609");
    viewer.scene.globe.baseColor = Color.fromCssColorString("#07171c");
    viewer.scene.globe.enableLighting = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.sun.show = true;
    viewer.scene.moon.show = false;
    viewer.scene.fog.enabled = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 350000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 32000000;

    const addLayers = async () => {
      try {
        const earth = await TileMapServiceImageryProvider.fromUrl(
          buildModuleUrl("Assets/Textures/NaturalEarthII"),
        );
        if (disposed) return;
        const earthLayer = viewer.imageryLayers.addImageryProvider(earth);
        earthLayer.brightness = 0.56;
        earthLayer.contrast = 1.28;
        weatherLayerRef.current = viewer.imageryLayers.addImageryProvider(imageryFor());
        weatherLayerRef.current.alpha = 0.92;
        weatherLayerRef.current.brightness = 1.08;
        weatherLayerRef.current.contrast = 1.12;
      } catch (error) {
        setImageryError(error.message);
      }
    };
    addLayers();

    viewer.entities.add({
      name: "Tampa to Tallahassee route",
      polyline: {
        positions: route.map(([lon, lat, height]) => Cartesian3.fromDegrees(lon, lat, height)),
        width: 5,
        material: Color.fromCssColorString("#cbff3d"),
        arcType: ArcType.GEODESIC,
      },
    });
    [
      ["KTPF", -82.4493, 27.9167, "#63ed9d", "TAMPA · VFR"],
      ["KCTY", -83.1048, 29.6355, "#67a9ff", "CROSS CITY · MVFR"],
      ["KTLH", -84.3503, 30.3965, "#ff6d57", "TALLAHASSEE · IFR"],
    ].forEach(([id, lon, lat, color, label]) => {
      viewer.entities.add({
        id,
        position: Cartesian3.fromDegrees(lon, lat, 85000),
        point: {
          pixelSize: 13,
          color: Color.fromCssColorString(color),
          outlineColor: Color.WHITE,
          outlineWidth: 3,
          scaleByDistance: new NearFarScalar(2e5, 1.4, 1e7, 0.65),
        },
        label: {
          text: label,
          font: "600 14px Inter Tight",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian2(16, 0),
          distanceDisplayCondition: new DistanceDisplayCondition(0, 4500000),
          scaleByDistance: new NearFarScalar(3e5, 1, 4.5e6, 0.55),
        },
      });
    });
    viewer.entities.add({
      position: Cartesian3.fromDegrees(-83.01, 29.25, 115000),
      label: {
        text: "✈",
        font: "34px sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        scaleByDistance: new NearFarScalar(3e5, 1.1, 6e6, 0.5),
      },
    });
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(-76, 23, 17800000),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-89), roll: 0 },
    });
    rotationRemover = viewer.clock.onTick.addEventListener(() => {
      if (!focusedRef.current && !viewer.scene.screenSpaceCameraController._aggregator?.anyButtonDown) {
        viewer.scene.camera.rotate(Cartesian3.UNIT_Z, -0.000035);
      }
    });
    setReady(true);

    const loadTimes = async () => {
      try {
        const end = new Date();
        end.setUTCSeconds(0, 0);
        const start = new Date(end.getTime() - 105 * 60000);
        const iso = (date) => date.toISOString().replace(".000Z", "Z");
        const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/GOES-East_ABI_GeoColor/default/${matrixSet}/all/${iso(start)}--${iso(end)}.xml`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`NASA time service returned ${response.status}`);
        const text = await response.text();
        const domain = text.match(/<Domain>(.*?)<\/Domain>/)?.[1];
        const available = domain ? expandDomain(domain).slice(-10) : [];
        if (available.length) {
          framesRef.current = available;
          setFrames(available);
          showFrame(available.length - 1);
        }
      } catch (error) {
        setImageryError(error.message);
      }
    };
    loadTimes();
    return () => {
      disposed = true;
      rotationRemover?.();
      layerCleanupTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      viewerRef.current = null;
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    sampleEntitiesRef.current.forEach((entity) => viewer.entities.remove(entity));
    sampleEntitiesRef.current = samples
      .filter((sample) => Number.isFinite(sample.lon) && Number.isFinite(sample.lat))
      .map((sample) => viewer.entities.add({
        position: Cartesian3.fromDegrees(sample.lon, sample.lat, 80000),
        point: {
          pixelSize: 6,
          color: Color.fromCssColorString("#a5e6f3").withAlpha(0.85),
          outlineColor: Color.WHITE,
          outlineWidth: 1,
          distanceDisplayCondition: new DistanceDisplayCondition(5e6, 3e7),
        },
        label: {
          text: `${sample.name?.toUpperCase() || "WEATHER"} · ${String(sample.conditionCode || "CURRENT").toUpperCase()}`,
          font: "500 9px DM Mono",
          fillColor: Color.fromCssColorString("#d9f7ff"),
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian2(9, 0),
          distanceDisplayCondition: new DistanceDisplayCondition(7e6, 2.4e7),
          scaleByDistance: new NearFarScalar(7e6, 1, 2.4e7, 0.55),
        },
      }));
  }, [ready, samples]);

  useEffect(() => {
    if (!playing || frames.length < 2) return undefined;
    const timer = window.setInterval(() => showFrame(frameRef.current + 1), 2600);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  const focusFlorida = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    focusedRef.current = true;
    setFocused(true);
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(-83.25, 29.2, 1700000),
      orientation: { heading: CesiumMath.toRadians(0), pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 2.8,
    });
  };
  const spaceView = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    focusedRef.current = false;
    setFocused(false);
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(-76, 23, 17800000),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-89), roll: 0 },
      duration: 2.4,
    });
  };

  return (
    <div className="cesium-weather-experience">
      <div ref={container} className="cesium-globe" />
      <div className="space-sequence"><span className={!focused ? "active" : ""}>SPACE VIEW</span><i>→</i><span>LIVE CLOUDS</span><i>→</i><span className={focused ? "active" : ""}>FLORIDA ROUTE</span><i>→</i><span>IMC RISK</span></div>
      <div className="globe-controls">
        <button className={!focused ? "active" : ""} onClick={spaceView}>EARTH</button>
        <button className={focused ? "active" : ""} onClick={focusFlorida}>FOCUS FLORIDA</button>
      </div>
      <div className="satellite-status">
        <span><i className={ready ? "ready" : ""} /> NASA GOES-EAST</span>
        <b>{frames.length ? "10-MINUTE SATELLITE FRAMES" : "LATEST SATELLITE TEXTURE"}</b>
        <small>{frames[frameIndex] ? formatSatelliteTime(frames[frameIndex]) : "CONNECTING TO GIBS"}</small>
      </div>
      <div className="time-player">
        <button onClick={() => setPlaying((value) => !value)}>{playing ? "❚❚" : "▶"}</button>
        <div>{frames.map((time, index) => <button className={index === frameIndex ? "active" : ""} onClick={() => showFrame(index)} title={formatSatelliteTime(time)} key={time} />)}</div>
        <span>LAST 90 MIN</span>
      </div>
      <div className="route-risk-card"><span>FLORIDA DEMO ROUTE</span><b>KTPF → KTLH</b><small>VFR → MVFR → IFR · 188 NM VIA KCTY</small></div>
      {imageryError && <div className="imagery-warning">Satellite animation fallback active: {imageryError}</div>}
    </div>
  );
}

function formatSatelliteTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "LATEST";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}
