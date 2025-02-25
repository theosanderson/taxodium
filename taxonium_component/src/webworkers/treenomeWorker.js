const pre_order = (nodes) => {
  let to_children = {};
  let root_id = null;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].parent_id === nodes[i].node_id) {
      root_id = nodes[i].node_id;
      continue;
    }
    if (to_children[nodes[i].parent_id] !== undefined) {
      to_children[nodes[i].parent_id].push(nodes[i].node_id);
    } else {
      to_children[nodes[i].parent_id] = [nodes[i].node_id];
    }
  }
  let stack = [];
  let po = [];
  stack.push(root_id);
  while (stack.length > 0) {
    const node_id = stack.pop();
    if (to_children[node_id]) {
      for (let child_id of to_children[node_id]) {
        stack.push(child_id);
      }
    }
    po.push(node_id);
  }
  return po;
};

const computeFilteredVariationData = (variation_data, ntBounds, data) => {
  if (!data.data || !data.data.nodes || !variation_data) {
    return [];
  }
  if (data.data.nodes.length < 10000 || ntBounds[1] - ntBounds[0] < 1000) {
    return variation_data;
  } else {
    console.log("FILTERING");
    return variation_data.filter((d) => d.y[1] - d.y[0] > 0.002);
  }
};

const computeYSpan = (preorder_nodes, lookup, root) => {
  let yspan = {};
  for (let i = preorder_nodes.length - 1; i >= 0; i--) {
    // post order
    let node = lookup[preorder_nodes[i]];
    if (node.node_id === root) {
      continue;
    }
    let parent = node.parent_id;

    if (!yspan[node.node_id]) {
      // Leaf
      yspan[node.node_id] = [node.y, node.y];
    }
    let cur_yspan = yspan[node.node_id];
    let par_yspan = yspan[parent];
    if (par_yspan) {
      if (cur_yspan[0] < par_yspan[0]) {
        yspan[parent][0] = cur_yspan[0];
      }
      if (cur_yspan[1] > par_yspan[1]) {
        yspan[parent][1] = cur_yspan[1];
      }
    } else {
      yspan[parent] = [...cur_yspan];
    }
  }
  return yspan;
};

const computeVariationData = async (data, type, ntBounds, jobId) => {
  // compute in chunks starting at memoIndex
  let blank = [[], {}, false];
  let ref = { aa: {}, nt: {} };
  let shouldCache = false;
  let nodes = null;
  let lookup = null;
  if (data && data.data && data.data.nodes && data.data.nodes.length < 90000) {
    nodes = data.data.nodes;
    lookup = data.data.nodeLookup;
  } else {
    if (!data.base_data || !data.base_data.nodes) {
      return blank;
    }
    nodes = data.base_data.nodes;
    lookup = data.base_data.nodeLookup;
    shouldCache = true;
  }

  if (!nodes) {
    return null;
  }
  if (!data.data.nodeLookup) {
    return null;
  }

  const preorder_nodes = pre_order(nodes);
  const root = preorder_nodes.find((id) => id === lookup[id].parent_id);

  // Use rootSequences from config
  if (data.data && data.data.config && data.data.config.rootSequences) {
    ref = data.data.config.rootSequences;
  }

  const chunkSize = 10000;
  const yspan = computeYSpan(preorder_nodes, lookup, root);
  let var_data = [];

  for (
    let memoIndex = 0;
    memoIndex < preorder_nodes.length + chunkSize;
    memoIndex += chunkSize
  ) {
    let this_var_data = [];
    let i;
    for (
      i = memoIndex;
      i < Math.min(memoIndex + chunkSize, preorder_nodes.length);
      i++
    ) {
      const node = lookup[preorder_nodes[i]];
      if (node.node_id === root) {
        continue;
      }
      for (let mut of node.mutations) {
        if (
          (mut.gene === "nt" && type === "nt") ||
          (mut.gene !== "nt" && type === "aa")
        ) {
          this_var_data.push({
            y: yspan[node.node_id],
            m: mut,
          });
        }
      }
    }
    var_data.push(...this_var_data);
    let filteredVarData = computeFilteredVariationData(
      var_data,
      ntBounds,
      data
    );
    if (i === preorder_nodes.length && shouldCache) {
      postMessage({
        type:
          type === "aa"
            ? "variation_data_return_cache_aa"
            : "variation_data_return_cache_nt",
        filteredVarData: filteredVarData,
        treenomeReferenceInfo: ref,
        jobId: jobId,
      });
    } else {
      postMessage({
        type:
          type === "aa"
            ? "variation_data_return_aa"
            : "variation_data_return_nt",
        filteredVarData: filteredVarData,
        treenomeReferenceInfo: ref,
        jobId: jobId,
      });
    }
  }
};

onmessage = async (event) => {
  if (!event.data) {
    return;
  }
  let ntBounds, jobId, data;
  ({ ntBounds, jobId, data } = event.data);

  if (event.data.type === "variation_data_aa") {
    computeVariationData(data, "aa", ntBounds, jobId);
  } else if (event.data.type === "variation_data_nt") {
    computeVariationData(data, "nt", ntBounds, jobId);
  }
};
