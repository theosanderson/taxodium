import pako from "pako";
import axios from "axios";
import reduceMaxOrMin from "./reduceMaxOrMin";
import { downloadWithProxy } from "./downloadWithProxy";
import { kn_expand_node, kn_calxy } from "./jstree";

const emptyList = [];

const nodeMutationsFromNextStrainToTaxonium = (
  mutations,
  unique_mutations,
  mutation_lookup
) => {
  //console.log("mutations", mutations);
  const keys = Object.keys(mutations);
  const nuc_muts = mutations["nuc"] ? mutations["nuc"] : [];

  const genes = keys.filter((key) => key !== "nuc");
  const taxonium_muts = [];
  nuc_muts.forEach((nuc_mut) => {
    // input format is like "C123T", we want to break this into old_residue, position and new_residue
    // use regex to match the position
    const position = nuc_mut.match(/\d+/g);
    const index_of_position = nuc_mut.indexOf(position[0]);
    const previous_residue = nuc_mut.substring(0, index_of_position);
    const new_residue = nuc_mut.substring(
      index_of_position + position[0].length
    );
    const tax_format = {
      type: "nt",
      gene: "nt",
      previous_residue,
      new_residue,
      residue_pos: parseInt(position[0]),
    };
    const jsonned = JSON.stringify(tax_format);
    //console.log("jsonned", jsonned);
    if (mutation_lookup[jsonned]) {
      taxonium_muts.push(mutation_lookup[jsonned]);
    } else {
      unique_mutations.push({
        ...tax_format,
        mutation_id: unique_mutations.length,
      });
      const this_index = unique_mutations.length - 1;
      mutation_lookup[jsonned] = this_index;
      taxonium_muts.push(this_index);
    }
  });

  genes.forEach((gene) => {
    const gene_muts = mutations[gene];
    gene_muts.forEach((gene_mut) => {
      // input format is like "Q123F", we want to break this into old_residue, position and new_residue
      // use regex to match the position
      const position = gene_mut.match(/\d+/g);
      const index_of_position = gene_mut.indexOf(position[0]);
      const previous_residue = gene_mut.substring(0, index_of_position);
      const new_residue = gene_mut.substring(
        index_of_position + position[0].length
      );
      const tax_format = {
        type: "aa",
        gene,
        previous_residue,
        new_residue,
        residue_pos: parseInt(position[0]),
      };
      const jsonned = JSON.stringify(tax_format);
      //console.log("jsonned", jsonned);
      if (mutation_lookup[jsonned]) {
        taxonium_muts.push(mutation_lookup[jsonned]);
      } else {
        unique_mutations.push({
          ...tax_format,
          mutation_id: unique_mutations.length,
        });
        const this_index = unique_mutations.length - 1;
        mutation_lookup[jsonned] = this_index;
        taxonium_muts.push(this_index);
      }
    });
  });

  return taxonium_muts;
};

async function do_fetch(url, sendStatusMessage, whatIsBeingDownloaded) {
  if (!sendStatusMessage) {
    sendStatusMessage = () => {};
  }
  // send progress on downloadProgress

  if (url.endsWith(".gz")) {
    const response = await downloadWithProxy(url, {
      responseType: "arraybuffer",
      onDownloadProgress: (progress) => {
        sendStatusMessage({
          message: "Downloading compressed " + whatIsBeingDownloaded,
          percentage: (progress.loaded / progress.total) * 100,
        });
      },
    });
    sendStatusMessage({
      message: "Decompressing compressed " + whatIsBeingDownloaded,
    });
    const inflated = pako.ungzip(response.data);
    const text = new TextDecoder("utf-8").decode(inflated);
    return text;
  } else {
    const response = await axios.get(url, {
      transformResponse: (res) => {
        // Do your own parsing here if needed ie JSON.parse(res);
        return res;
      },
      responseType: "json",
      onDownloadProgress: (progress) => {
        sendStatusMessage({
          message: "Downloading " + whatIsBeingDownloaded,
          percentage: (progress.loaded / progress.total) * 100,
        });
      },
    });
    const text = response.data;
    //parse text:
    return text;
  }
}

function fetch_or_extract(file_obj, sendStatusMessage, whatIsBeingDownloaded) {
  if (file_obj.status === "url_supplied") {
    return do_fetch(
      file_obj.filename,
      sendStatusMessage,
      whatIsBeingDownloaded
    );
  } else if (file_obj.status === "loaded") {
    if (file_obj.filename.includes(".gz")) {
      const compressed_data = file_obj.data;
      sendStatusMessage({
        message: "Decompressing compressed " + whatIsBeingDownloaded,
      });
      const inflated = pako.ungzip(compressed_data);
      const text = new TextDecoder("utf-8").decode(inflated);
      return text;
    } else {
      // convert array buffer to string
      const text = new TextDecoder("utf-8").decode(file_obj.data);
      return text;
    }
  }
}

// TODO: cleanup and processJsTree are duplicated in processNewick.js
async function cleanup(tree) {
  tree.node.forEach((node, i) => {
    node.node_id = i;
  });

  tree.node = tree.node.map((node, i) => {
    const cleaned = {
      name: node.name.replace(/'/g, ""),
      parent_id: node.parent ? node.parent.node_id : node.node_id,
      mutations: node.mutations ? node.mutations : emptyList,
      y: node.y,
      num_tips: node.num_tips,
      is_tip: node.child.length === 0,
      node_id: node.node_id,
    };

    Object.keys(node).forEach((key) => {
      if (key.startsWith("meta_")) {
        cleaned[key] = node[key];
      }
    });

    if (node.x_dist !== undefined) {
      cleaned.x_dist = node.x_dist;
    }
    if (node.x_time !== undefined) {
      cleaned.x_time = node.x_time;
    }
    return cleaned;
  });
  const scale_y = 2000;

  const all_xes_dist = tree.node.map((node) => node.x_dist);
  const all_xes_time = tree.node.map((node) => node.x_time);

  all_xes_dist.sort((a, b) => a - b);
  all_xes_time.sort((a, b) => a - b);
  const ref_x_percentile = 0.99;
  const ref_x_dist =
    all_xes_dist[Math.floor(all_xes_dist.length * ref_x_percentile)];
  const ref_x_time =
    all_xes_time[Math.floor(all_xes_time.length * ref_x_percentile)];

  const scale_x_dist = 450 / ref_x_dist;
  const scale_x_time = 450 / ref_x_time;

  tree.node.forEach((node) => {
    if (node.x_dist !== undefined) {
      node.x_dist = node.x_dist * scale_x_dist;
    }
    if (node.x_time !== undefined) {
      node.x_time = node.x_time * scale_x_time;
    }
    node.y = node.y * scale_y;
  });
}

async function processJsTree(tree, data, config, sendStatusMessage) {
  function assignNumTips(node) {
    if (node.child.length === 0) {
      node.num_tips = 1;
    } else {
      node.num_tips = 0;
      node.child.forEach((child) => {
        node.num_tips += assignNumTips(child);
      });
    }

    return node.num_tips;
  }

  function sortWithNumTips(node) {
    node.child.sort((a, b) => {
      return a.num_tips - b.num_tips;
    });
    node.child.forEach((child) => {
      sortWithNumTips(child);
    });
  }
  assignNumTips(tree.root);
  const total_tips = tree.root.num_tips;

  if (data.ladderize) {
    sortWithNumTips(tree.root);
  }

  tree.node = kn_expand_node(tree.root);

  sendStatusMessage({
    message: "Laying out the tree",
  });

  // first set "d" to genetic distance
  if (tree.node[0].pre_x_dist !== undefined) {
    tree.node.forEach((node) => {
      node.d = node.pre_x_dist;
    });

    kn_calxy(tree, true);
    // kn_calxy sets x -> move x to x_dist
    tree.node.forEach((node) => {
      node.x_dist = node.x;
    });
  }
  if (tree.node[0].pre_x_time !== undefined) {
    // rerun kn_calxy to set x again (but for time)
    tree.node.forEach((node) => {
      node.d = node.pre_x_time;
    });
    kn_calxy(tree, true);
    tree.node.forEach((node) => {
      node.x_time = node.x;
    });
  }

  // Now tree.node will have x_dist and/or x_time depending on JSON content

  sendStatusMessage({
    message: "Sorting on Y",
  });

  // sort on y:
  tree.node.sort((a, b) => a.y - b.y);

  sendStatusMessage({
    message: "Re-processing",
  });

  cleanup(tree);

  const overallMaxX = reduceMaxOrMin(tree.node, (x) => x.x_dist, "max");
  const overallMinX = reduceMaxOrMin(tree.node, (x) => x.x_dist, "min");
  const overallMaxY = reduceMaxOrMin(tree.node, (x) => x.y, "max");
  const overallMinY = reduceMaxOrMin(tree.node, (x) => x.y, "min");
  const y_positions = tree.node.map((x) => x.y);

  const output = {
    nodes: tree.node,
    overallMaxX,
    overallMaxY,
    overallMinX,
    overallMinY,
    y_positions,
    mutations: [],
    node_to_mut: {},
    rootMutations: [],
    rootId: 0,
    overwrite_config: { ...config, num_tips: total_tips },
  };

  return output;
}

function json_preorder(root) {
  let n_tips = 0;
  const parents = {};
  parents[root.name] = null;
  const path = [];
  const stack = [root];

  const unique_mutations = [];

  const mutation_lookup = {};
  while (stack.length > 0) {
    const nodeJson = stack.pop();
    let div = null;
    let time = null;
    if (nodeJson.node_attrs.div) {
      div = nodeJson.node_attrs.div;
    }
    if (nodeJson.node_attrs.num_date) {
      time = nodeJson.node_attrs.num_date.value;
    }
    //console.log(nodeJson);
    // this is the node format for downstream processing
    const parsedNode = {
      name: nodeJson.name,
      child: [],
      meta: "",
      hl: false,
      hidden: false,
      mutations:
        nodeJson.branch_attrs && nodeJson.branch_attrs.mutations
          ? nodeMutationsFromNextStrainToTaxonium(
              nodeJson.branch_attrs.mutations,
              unique_mutations,
              mutation_lookup
            )
          : [],
    };

    // assign distance
    div && (parsedNode.div = div);
    time && (parsedNode.time = time);

    // assign metadata
    const notMeta = ["div", "num_date"];
    Object.keys(nodeJson.node_attrs)
      .filter((x) => !notMeta.includes(x))
      .forEach((x) => {
        // sometimes the data is not wrapped in a value tag. e.g. "accession" in mpx
        const attr = nodeJson.node_attrs[x];
        parsedNode[`meta_${x}`] =
          attr.value && typeof attr.value !== "object"
            ? attr.value
            : typeof attr !== "object"
            ? attr
            : "";
      });

    path.push(parsedNode);
    if (nodeJson.children !== undefined) {
      for (const childJson of nodeJson.children) {
        parents[childJson.name] = parsedNode;
        stack.push(childJson);
      }
    } else {
      n_tips += 1;
    }
  }
  return { path, parents, n_tips, unique_mutations };
}

async function json_to_tree(json) {
  const rootJson = json.tree;
  const {
    path: preorder,
    parents,
    n_tips,
    unique_mutations,
  } = json_preorder(rootJson);

  const nodes = [];
  let root;
  for (const node of preorder) {
    const parent = parents[node.name];
    node.parent = parent;
    if (parent) {
      parent.child.push(node);
      if (node.div !== undefined) {
        node.pre_x_dist = node.div - parent.div;
      }
      if (node.time !== undefined) {
        node.pre_x_time = node.time - parent.time;
      }
    } else {
      root = node;
      node.pre_x_time = 0;
      node.pre_x_dist = 0;
    }
    nodes.push(node);
  }

  const jsTree = {
    // tree in jstree.js format
    node: nodes,
    error: 0,
    n_tips: n_tips,
    root: root,
  };

  const config = {};

  console.log("META", json.meta);
  config.title = json.meta.title;
  console.log("META PROV", json.meta.data_provenance);
  config.source = "";
  if (json.meta && json.meta.data_provenance) {
    config.source =
      config.source +
      json.meta.data_provenance.map((source) => source.name).join(" & ");
  }

  if (config.source.includes("GISAID")) {
    config.enabled_by_gisaid = true;
  }

  function markdownToHTML(md) {
    // Regular expression to match Markdown links
    var markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    // Replace Markdown links with HTML <a> tags
    var html = md.replace(
      markdownLinkRegex,
      '<a class="underline" href="$2">$1</a>'
    );

    return html;
  }

  config.overlay = `<p>This is a tree extracted from a <a class='underline' href='//nextstrain.org'>Nextstrain</a> JSON file, being visualised in Taxonium.</p>.`;
  if (json.meta.description) {
    config.overlay =
      config.overlay + "<p>" + markdownToHTML(json.meta.description) + "</p>";
  }

  if (json.meta && json.meta.updated) {
    config.source = config.source + " in a tree built on " + json.meta.updated;
  }
  if (json.meta && json.meta.maintainers) {
    config.source =
      config.source +
      " in a build maintained by " +
      json.meta.maintainers.map((source) => source.name).join(" & ");

    const maintainerLinks = json.meta.maintainers
      .map(
        (source) =>
          `<a class='underline' href='${source.url}'>${source.name}</a>`
      )
      .join(" & ");
    config.overlay += `<p>The Nextstrain build is maintained by ${maintainerLinks}.</p>`;
  }

  if (json.meta.build_url) {
    config.overlay += `<p>The Nextstrain build is available <a class='underline' href='${json.meta.build_url}'>here</a>.</p>`;
  }

  return { jsTree, config, unique_mutations };
}

export async function processNextstrain(data, sendStatusMessage) {
  const the_data = await fetch_or_extract(data, sendStatusMessage, "tree");

  sendStatusMessage({
    message: "Parsing Nextstrain format",
  });

  const { jsTree, config, unique_mutations } = await json_to_tree(
    JSON.parse(the_data)
  );

  const output = await processJsTree(jsTree, data, config, sendStatusMessage);
  const node_to_mut = output.nodes.map((x) => x.mutations);

  return { ...output, mutations: unique_mutations, node_to_mut: node_to_mut };
}
