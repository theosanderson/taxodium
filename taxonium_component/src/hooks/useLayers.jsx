import {
  LineLayer,
  ScatterplotLayer,
  PolygonLayer,
  TextLayer,
  SolidPolygonLayer,
} from "@deck.gl/layers";

import { useMemo, useCallback } from "react";
import useTreenomeLayers from "./useTreenomeLayers";
import getSVGfunction from "../utils/deckglToSvg";

// Function to calculate "nice" tick values
const generateNiceTicks = (min, max, maxTicks) => {
  const range = max - min;
  const roughTickSize = range / (maxTicks - 1);
  const orderOfMagnitude = Math.floor(Math.log10(roughTickSize));
  const pow10 = Math.pow(10, orderOfMagnitude);

  const possibleTickSizes = [1, 2, 5, 10];
  let tickSize = possibleTickSizes[0] * pow10;
  for (let i = 0; i < possibleTickSizes.length; i++) {
    tickSize = possibleTickSizes[i] * pow10;
    if (range / tickSize <= maxTicks) {
      break;
    }
  }

  const niceMin = Math.floor(min / tickSize) * tickSize;
  const niceMax = Math.ceil(max / tickSize) * tickSize;

  const ticks = [];
  for (let x = niceMin; x <= niceMax; x += tickSize) {
    ticks.push(x);
  }

  return ticks;
};

const getKeyStuff = (getNodeColorField, colorByField, dataset, toRGB) => {
  const counts = {};
  for (const node of dataset.nodes) {
    const value = getNodeColorField(node, dataset);
    if (value in counts) {
      counts[value]++;
    } else {
      counts[value] = 1;
    }
  }
  const keys = Object.keys(counts);
  const output = [];
  for (const key of keys) {
    output.push({ value: key, count: counts[key], color: toRGB(key) });
  }
  return output;
};

const useLayers = ({
  data,
  search,
  viewState,
  colorHook,
  setHoverInfo,
  hoverInfo,
  colorBy,
  xType,
  modelMatrix,
  selectedDetails,
  xzoom,
  settings,
  isCurrentlyOutsideBounds,
  config,
  treenomeState,
  treenomeReferenceInfo,
  setTreenomeReferenceInfo,
  hoveredKey,
}) => {
  const lineColor = settings.lineColor;
  const getNodeColorField = colorBy.getNodeColorField;
  const colorByField = colorBy.colorByField;

  const { toRGB } = colorHook;

  const layers = [];

  // Treenome Browser layers
  const treenomeLayers = useTreenomeLayers(
    treenomeState,
    data,
    viewState,
    colorHook,
    setHoverInfo,
    settings,
    treenomeReferenceInfo,
    setTreenomeReferenceInfo,
    selectedDetails,
    isCurrentlyOutsideBounds
  );
  layers.push(...treenomeLayers);

  const getX = useCallback((node) => node[xType], [xType]);

  const detailed_data = useMemo(() => {
    if (data.data && data.data.nodes) {
      data.data.nodes.forEach((node) => {
        node.parent_x = getX(data.data.nodeLookup[node.parent_id]);
        node.parent_y = data.data.nodeLookup[node.parent_id].y;
      });
      return data.data;
    } else {
      return { nodes: [], nodeLookup: {} };
    }
  }, [data.data, getX]);

  const keyStuff = useMemo(() => {
    return getKeyStuff(getNodeColorField, colorByField, detailed_data, toRGB);
  }, [detailed_data, getNodeColorField, colorByField, toRGB]);

  const clade_accessor = "pango";

  const clade_data = useMemo(() => {
    const initial_data = detailed_data.nodes.filter(
      (n) => n.clades && n.clades[clade_accessor]
    );

    const rev_sorted_by_num_tips = initial_data.sort(
      (a, b) => b.num_tips - a.num_tips
    );

    // pick top settings.minTipsForCladeText
    const top_nodes = rev_sorted_by_num_tips.slice(0, settings.maxCladeTexts);
    return top_nodes;
  }, [detailed_data.nodes, settings.maxCladeTexts, clade_accessor]);

  const base_data = useMemo(() => {
    if (data.base_data && data.base_data.nodes) {
      data.base_data.nodes.forEach((node) => {
        node.parent_x = getX(data.base_data.nodeLookup[node.parent_id]);
        node.parent_y = data.base_data.nodeLookup[node.parent_id].y;
      });
      return {
        nodes: data.base_data.nodes,
        nodeLookup: data.base_data.nodeLookup,
      };
    } else {
      return { nodes: [], nodeLookup: {} };
    }
  }, [data.base_data, getX]);

  const detailed_scatter_data = useMemo(() => {
    return detailed_data.nodes.filter(
      (node) =>
        node.is_tip ||
        (node.is_tip === undefined && node.num_tips === 1) ||
        settings.displayPointsForInternalNodes
    );
  }, [detailed_data, settings.displayPointsForInternalNodes]);

  const minimap_scatter_data = useMemo(() => {
    return base_data
      ? base_data.nodes.filter(
          (node) =>
            node.is_tip ||
            (node.is_tip === undefined && node.num_tips === 1) ||
            settings.displayPointsForInternalNodes
        )
      : [];
  }, [base_data, settings.displayPointsForInternalNodes]);

  const outer_bounds = [
    [-100000, -100000],
    [100000, -100000],
    [1000000, 1000000],
    [-100000, 1000000],
    [-100000, -100000],
  ];
  const inner_bounds = [
    [viewState.min_x, viewState.min_y < -1000 ? -1000 : viewState.min_y],
    [viewState.max_x, viewState.min_y < -1000 ? -1000 : viewState.min_y],
    [viewState.max_x, viewState.max_y > 10000 ? 10000 : viewState.max_y],
    [viewState.min_x, viewState.max_y > 10000 ? 10000 : viewState.max_y],
  ];

  const bound_contour = [[outer_bounds, inner_bounds]];

  const scatter_layer_common_props = {
    getPosition: (d) => [getX(d), d.y],
    getFillColor: (d) => toRGB(getNodeColorField(d, detailed_data)),
    getRadius: settings.nodeSize,
    getLineColor: [100, 100, 100],
    opacity: settings.opacity,
    stroked: data.data.nodes && data.data.nodes.length < 3000,
    lineWidthUnits: "pixels",
    lineWidthScale: 1,
    pickable: true,
    radiusUnits: "pixels",
    onHover: (info) => setHoverInfo(info),
    modelMatrix: modelMatrix,
    updateTriggers: {
      getFillColor: [detailed_data, getNodeColorField, colorHook],
      getRadius: [settings.nodeSize],
      getPosition: [xType],
    },
  };

  const line_layer_horiz_common_props = {
    getSourcePosition: (d) => [getX(d), d.y],
    getTargetPosition: (d) => [d.parent_x, d.y],
    getColor: lineColor,
    pickable: true,
    widthUnits: "pixels",
    getWidth: (d) =>
      d === (hoverInfo && hoverInfo.object)
        ? 3
        : selectedDetails.nodeDetails &&
          selectedDetails.nodeDetails.node_id === d.node_id
        ? 3.5
        : 1,
    onHover: (info) => setHoverInfo(info),
    modelMatrix: modelMatrix,
    updateTriggers: {
      getSourcePosition: [detailed_data, xType],
      getTargetPosition: [detailed_data, xType],
      getWidth: [hoverInfo, selectedDetails.nodeDetails],
    },
  };

  const line_layer_vert_common_props = {
    getSourcePosition: (d) => [d.parent_x, d.y],
    getTargetPosition: (d) => [d.parent_x, d.parent_y],
    onHover: (info) => setHoverInfo(info),
    getColor: lineColor,
    pickable: true,
    getWidth: (d) =>
      d === (hoverInfo && hoverInfo.object)
        ? 2
        : selectedDetails.nodeDetails &&
          selectedDetails.nodeDetails.node_id === d.node_id
        ? 2.5
        : 1,
    modelMatrix: modelMatrix,
    updateTriggers: {
      getSourcePosition: [detailed_data, xType],
      getTargetPosition: [detailed_data, xType],
      getWidth: [hoverInfo, selectedDetails.nodeDetails],
    },
  };

  if (detailed_data.nodes) {
    const main_scatter_layer = {
      layerType: "ScatterplotLayer",
      ...scatter_layer_common_props,
      id: "main-scatter",
      data: detailed_scatter_data,
    };

    const pretty_stroke_background_layer = settings.prettyStroke.enabled
      ? {
          ...main_scatter_layer,
          getFillColor: settings.prettyStroke.color,
          getLineWidth: 0,
          getRadius: main_scatter_layer.getRadius + settings.prettyStroke.width,
        }
      : null;

    const fillin_scatter_layer = {
      layerType: "ScatterplotLayer",
      ...scatter_layer_common_props,
      id: "fillin-scatter",
      data: minimap_scatter_data,
      getFillColor: (d) => toRGB(getNodeColorField(d, base_data)),
    };

    const main_line_layer = {
      layerType: "LineLayer",
      ...line_layer_horiz_common_props,
      id: "main-line-horiz",
      data: detailed_data.nodes,
    };

    const main_line_layer2 = {
      layerType: "LineLayer",
      ...line_layer_vert_common_props,
      id: "main-line-vert",
      data: detailed_data.nodes,
    };

    const fillin_line_layer = {
      layerType: "LineLayer",
      ...line_layer_horiz_common_props,
      id: "fillin-line-horiz",
      data: base_data.nodes,
    };

    const fillin_line_layer2 = {
      layerType: "LineLayer",
      ...line_layer_vert_common_props,
      id: "fillin-line-vert",
      data: base_data.nodes,
    };

    const selectedLayer = {
      layerType: "ScatterplotLayer",
      data: selectedDetails.nodeDetails ? [selectedDetails.nodeDetails] : [],
      visible: true,
      opacity: 1,
      getRadius: 6,
      radiusUnits: "pixels",
      id: "main-selected",
      filled: false,
      stroked: true,
      modelMatrix,
      getLineColor: [0, 0, 0],
      getPosition: (d) => [d[xType], d.y],
      lineWidthUnits: "pixels",
      lineWidthScale: 2,
    };

    const hoveredLayer = {
      layerType: "ScatterplotLayer",
      data: hoverInfo && hoverInfo.object ? [hoverInfo.object] : [],
      visible: true,
      opacity: 0.3,
      getRadius: 4,
      radiusUnits: "pixels",
      id: "main-hovered",
      filled: false,
      stroked: true,
      modelMatrix,
      getLineColor: [0, 0, 0],
      getPosition: (d) => [d[xType], d.y],
      lineWidthUnits: "pixels",
      lineWidthScale: 2,
    };

    const clade_label_layer = {
      layerType: "TextLayer",
      id: "main-clade-node",
      getPixelOffset: [-5, -6],
      data: clade_data,
      getPosition: (d) => [getX(d), d.y],
      getText: (d) => d.clades[clade_accessor],
      getColor: settings.cladeLabelColor,
      getAngle: 0,
      fontFamily: "Roboto, sans-serif",
      fontWeight: 700,
      billboard: true,
      getTextAnchor: "end",
      getAlignmentBaseline: "center",
      getSize: 11,
      modelMatrix: modelMatrix,
      updateTriggers: {
        getPosition: [getX],
      },
    };

    layers.push(
      main_line_layer,
      main_line_layer2,
      fillin_line_layer,
      fillin_line_layer2,
      pretty_stroke_background_layer,
      main_scatter_layer,
      fillin_scatter_layer,
      clade_label_layer,
      selectedLayer,
      hoveredLayer
    );
  }

  const proportionalToNodesOnScreen = config.num_tips / 2 ** viewState.zoom;

  // If leaves are fewer than max_text_number, add a text layer
  if (
    data.data.nodes &&
    proportionalToNodesOnScreen <
      0.8 * 10 ** settings.thresholdForDisplayingText
  ) {
    const node_label_layer = {
      layerType: "TextLayer",
      id: "main-text-node",
      fontFamily: "Roboto, sans-serif",
      fontWeight: 100,
      data: data.data.nodes.filter((node) =>
        settings.displayTextForInternalNodes
          ? true
          : node.is_tip || (node.is_tip === undefined && node.num_tips === 1)
      ),
      getPosition: (d) => [getX(d), d.y],
      getText: (d) => d[config.name_accessor],
      getColor: settings.terminalNodeLabelColor,
      getAngle: 0,
      billboard: true,
      getTextAnchor: "start",
      getAlignmentBaseline: "center",
      getSize: data.data.nodes.length < 200 ? 12 : 9.5,
      modelMatrix: modelMatrix,
      getPixelOffset: [10, 0],
    };

    layers.push(node_label_layer);
  }

  const minimap_scatter = {
    layerType: "ScatterplotLayer",
    id: "minimap-scatter",
    data: minimap_scatter_data,
    getPolygonOffset: ({ layerIndex }) => [0, -4000],
    getPosition: (d) => [getX(d), d.y],
    getFillColor: (d) => toRGB(getNodeColorField(d, base_data)),
    getRadius: 2,
    getLineColor: [100, 100, 100],
    opacity: 0.6,
    radiusUnits: "pixels",
    onHover: (info) => setHoverInfo(info),
    updateTriggers: {
      getFillColor: [base_data, getNodeColorField],
      getPosition: [minimap_scatter_data, xType],
    },
  };

  const minimap_line_horiz = {
    layerType: "LineLayer",
    id: "minimap-line-horiz",
    getPolygonOffset: ({ layerIndex }) => [0, -4000],
    data: base_data.nodes,
    getSourcePosition: (d) => [getX(d), d.y],
    getTargetPosition: (d) => [d.parent_x, d.y],
    getColor: lineColor,
    updateTriggers: {
      getSourcePosition: [base_data, xType],
      getTargetPosition: [base_data, xType],
    },
  };

  const minimap_line_vert = {
    layerType: "LineLayer",
    id: "minimap-line-vert",
    getPolygonOffset: ({ layerIndex }) => [0, -4000],
    data: base_data.nodes,
    getSourcePosition: (d) => [d.parent_x, d.y],
    getTargetPosition: (d) => [d.parent_x, d.parent_y],
    getColor: lineColor,
    updateTriggers: {
      getSourcePosition: [base_data, xType],
      getTargetPosition: [base_data, xType],
    },
  };

  const minimap_polygon_background = {
    layerType: "PolygonLayer",
    id: "minimap-bound-background",
    data: [outer_bounds],
    getPolygon: (d) => d,
    pickable: true,
    stroked: true,
    opacity: 0.3,
    filled: true,
    getPolygonOffset: ({ layerIndex }) => [0, -2000],
    getFillColor: (d) => [255, 255, 255],
  };

  const minimap_bound_polygon = {
    layerType: "PolygonLayer",
    id: "minimap-bound-line",
    data: bound_contour,
    getPolygon: (d) => d,
    pickable: true,
    stroked: true,
    opacity: 0.3,
    filled: true,
    wireframe: true,
    getFillColor: (d) => [240, 240, 240],
    getLineColor: [80, 80, 80],
    getLineWidth: 1,
    lineWidthUnits: "pixels",
    getPolygonOffset: ({ layerIndex }) => [0, -6000],
  };

  const { searchSpec, searchResults, searchesEnabled } = search;

  const search_layers = searchSpec.map((spec, i) => {
    const data = searchResults[spec.key]
      ? searchResults[spec.key].result.data
      : [];
    const lineColor = search.getLineColor(i);

    return {
      layerType: "ScatterplotLayer",
      data: data,
      id: "main-search-scatter-" + spec.key,
      getPosition: (d) => [d[xType], d.y],
      getLineColor: settings.displaySearchesAsPoints ? [0, 0, 0] : lineColor,
      getRadius: settings.displaySearchesAsPoints
        ? settings.searchPointSize
        : 5 + 2 * i,
      radiusUnits: "pixels",
      lineWidthUnits: "pixels",
      stroked: true,
      visible: searchesEnabled[spec.key],
      wireframe: true,
      getLineWidth: 1,
      filled: true,
      getFillColor: settings.displaySearchesAsPoints
        ? lineColor
        : [255, 0, 0, 0],
      modelMatrix: modelMatrix,
      updateTriggers: {
        getPosition: [xType],
      },
    };
  });

  const search_mini_layers = searchSpec.map((spec, i) => {
    const data = searchResults[spec.key]
      ? searchResults[spec.key].overview
      : [];
    const lineColor = search.getLineColor(i);

    return {
      layerType: "ScatterplotLayer",
      data: data,
      getPolygonOffset: ({ layerIndex }) => [0, -9000],
      id: "mini-search-scatter-" + spec.key,
      visible: searchesEnabled[spec.key],
      getPosition: (d) => [d[xType], d.y],
      getLineColor: lineColor,
      getRadius: 5 + 2 * i,
      radiusUnits: "pixels",
      lineWidthUnits: "pixels",
      stroked: true,
      wireframe: true,
      getLineWidth: 1,
      filled: false,
      getFillColor: [255, 0, 0, 0],
      updateTriggers: { getPosition: [xType] },
    };
  });

  layers.push(...search_layers, ...search_mini_layers);
  layers.push(minimap_polygon_background);
  layers.push(minimap_line_horiz, minimap_line_vert, minimap_scatter);
  layers.push(minimap_bound_polygon);

  // Add x-axis layers with intelligent tick values
  const xAxisLayers = useMemo(() => {
    // Determine x-axis position
    const xAxisY =
      viewState.min_y < -1000
        ? -1000
        : viewState.max_y - (viewState.max_y - viewState.min_y) * 0.05;

    // Determine x-axis range
    const xAxisMinX = viewState.min_x;
    const xAxisMaxX = viewState.max_x;

    // Decide on the maximum number of ticks
    const maxTicks = 10;

    // Generate nice tick positions
    const tickPositions = generateNiceTicks(xAxisMinX, xAxisMaxX, maxTicks);

    // Axis line layer
    const xAxisLineLayer = {
      layerType: "LineLayer",
      id: "x-axis-line",
      data: [
        {
          sourcePosition: [tickPositions[0], xAxisY],
          targetPosition: [tickPositions[tickPositions.length - 1], xAxisY],
        },
      ],
      getSourcePosition: (d) => d.sourcePosition,
      getTargetPosition: (d) => d.targetPosition,
      getColor: [0, 0, 0],
      getWidth: 2,
      widthUnits: "pixels",
      modelMatrix: modelMatrix,
      updateTriggers: {
        getSourcePosition: [tickPositions[0], xAxisY],
        getTargetPosition: [tickPositions[tickPositions.length - 1], xAxisY],
      },
    };

    // Tick marks layer
    const xAxisTickMarksLayer = {
      layerType: "LineLayer",
      id: "x-axis-ticks",
      data: tickPositions.map((x) => ({
        sourcePosition: [x, xAxisY],
        targetPosition: [x, xAxisY - 10], // Adjust the tick length as needed
      })),
      getSourcePosition: (d) => d.sourcePosition,
      getTargetPosition: (d) => d.targetPosition,
      getColor: [0, 0, 0],
      getWidth: 1,
      widthUnits: "pixels",
      modelMatrix: modelMatrix,
      updateTriggers: {
        data: [tickPositions, xAxisY],
      },
    };

    // Tick labels layer
    const xAxisLabelsLayer = {
      layerType: "TextLayer",
      id: "x-axis-labels",
      data: tickPositions.map((x) => ({
        position: [x, xAxisY - 15], // Position labels below the tick marks
        text: x.toFixed(2), // Format the x-value as needed
      })),
      getPosition: (d) => d.position,
      getText: (d) => d.text,
      getColor: [0, 0, 0],
      getSize: 12,
      getTextAnchor: "middle",
      getAlignmentBaseline: "top",
      modelMatrix: modelMatrix,
      updateTriggers: {
        data: [tickPositions, xAxisY],
      },
    };

    return [xAxisLineLayer, xAxisTickMarksLayer, xAxisLabelsLayer];
  }, [viewState.min_x, viewState.max_x, viewState.min_y, modelMatrix]);

  // Add the x-axis layers to the layers array
  layers.push(...xAxisLayers);

  const layerFilter = useCallback(
    ({ layer, viewport, renderPass }) => {
      const first_bit =
        (layer.id.startsWith("main") && viewport.id === "main") ||
        (layer.id.startsWith("mini") && viewport.id === "minimap") ||
        (layer.id.startsWith("fillin") &&
          viewport.id === "main" &&
          isCurrentlyOutsideBounds) ||
        (layer.id.startsWith("browser-loaded") &&
          viewport.id === "browser-main") ||
        (layer.id.startsWith("browser-fillin") &&
          viewport.id === "browser-main" &&
          isCurrentlyOutsideBounds) ||
        (layer.id.startsWith("x-axis") && viewport.id === "main");

      return first_bit;
    },
    [isCurrentlyOutsideBounds]
  );

  const processedLayers = layers
    .filter((x) => x !== null)
    .map((layer) => {
      if (layer.layerType === "ScatterplotLayer") {
        return new ScatterplotLayer(layer);
      }
      if (layer.layerType === "LineLayer") {
        return new LineLayer(layer);
      }
      if (layer.layerType === "PolygonLayer") {
        return new PolygonLayer(layer);
      }
      if (layer.layerType === "TextLayer") {
        return new TextLayer(layer);
      }
      if (layer.layerType === "SolidPolygonLayer") {
        return new SolidPolygonLayer(layer);
      }
      console.log("could not map layer spec for ", layer);
    });

  const { triggerSVGdownload } = getSVGfunction(
    layers.filter((x) => x !== null),
    viewState
  );

  return { layers: processedLayers, layerFilter, keyStuff, triggerSVGdownload };
};

export default useLayers;
