import crypto from "crypto";

let revertant_mutations_set = null;
let cachedChildrenArray = null;

const getNumericFilterFunction = (number_method, number_value) => {
  if (number_method === "==") {
    return (x) => x === number_value;
  }
  if (number_method === ">") {
    return (x) => x > number_value;
  }
  if (number_method === "<") {
    return (x) => x < number_value;
  }
  if (number_method === ">=") {
    return (x) => x >= number_value;
  }
  if (number_method === "<=") {
    return (x) => x <= number_value;
  }
  throw new Error("Invalid number_method: " + number_method);
};

const getRevertantMutationsSet = (
  all_data,
  node_to_mut,
  mutations,
  rootSequences
) => {
  // Initialize gene_sequence - preferably from rootSequences, fallback to rootMutations
  let gene_sequence;

  if (rootSequences && rootSequences.aa) {
    // Use rootSequences if available
    gene_sequence = rootSequences.aa;
  } else {
    const root = all_data.find((node) => node.node_id === node.parent_id);
    // Fall back to the old method using root mutations
    const root_mutations = node_to_mut[root.node_id];
    const all_genes = [...new Set(mutations.map((m) => m.gene))];
    gene_sequence = Object.fromEntries(all_genes.map((g) => [g, {}]));

    root_mutations.forEach((mut) => {
      const m = mutations[mut];
      gene_sequence[m.gene][m.residue_pos] = m.new_residue;
    });
  }

  const revertant_mutations = mutations.filter(
    (m) =>
      m.gene in gene_sequence &&
      gene_sequence[m.gene] &&
      gene_sequence[m.gene][m.residue_pos] === m.new_residue &&
      m.new_residue !== m.previous_residue
  );
  return new Set(revertant_mutations.map((m) => m.mutation_id));
};

const count_per_hash = {};
const reduceOverPlotting = (input, precisionX, precisionY, xType) => {
  const included_points = {};
  precisionX = precisionX / 5;
  console.log(
    "REDUCING20",
    "precisionX:",
    precisionX,
    "precisionY:",
    precisionY
  );

  const filtered = input.filter((node) => {
    const rounded_x = Math.round(node[xType] * precisionX) / precisionX;
    const rounded_y = Math.round(node.y * precisionY) / precisionY;
    if (included_points[rounded_x]) {
      if (included_points[rounded_x][rounded_y]) {
        return false;
      } else {
        included_points[rounded_x][rounded_y] = 1;
        return true;
      }
    } else {
      included_points[rounded_x] = { [rounded_y]: 1 };
      return true;
    }
  });

  return filtered;
};

function binary_search_for_insertion_point(values, search) {
  // Returns where in values to insert search to maintain sorted order.

  let low = 0;
  let high = values.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] < search) {
      low = mid + 1;
    } else if (values[mid] > search) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return low;
}

function filter(input, y_positions, min_y, max_y) {
  // do binary search for min_y and max_y
  const min_y_index = binary_search_for_insertion_point(y_positions, min_y);
  const max_y_index = binary_search_for_insertion_point(y_positions, max_y);

  console.log("min_y_index:", min_y_index);
  console.log("max_y_index:", max_y_index);
  // Return sliced input array
  return input.slice(min_y_index, max_y_index + 1);
}

function search(input, search_spec) {}

const addParents = (data, filtered) => {
  const start_time = Date.now();
  const selected_node_ids = filtered.map((node) => node.node_id);
  // creat a set to keep track of selected_node_ids
  const selected_node_ids_set = new Set(selected_node_ids);
  const starting_size = filtered.length;
  for (let i = 0; i < selected_node_ids.length; i++) {
    const node_id = selected_node_ids[i];
    const parent_id = data[node_id].parent_id;
    //console.log(i);

    // if parent_id is not in selected_node_ids, then add it
    if (!selected_node_ids_set.has(parent_id)) {
      selected_node_ids_set.add(parent_id);
      selected_node_ids.push(parent_id);
      //console.log("adding parent:", parent_id);
      //console.log("New length is", selected_node_ids.length);
    }
  }
  const with_parents = data.filter((node) =>
    selected_node_ids_set.has(node.node_id)
  );
  const final_size = with_parents.length;
  console.log("Adding parents took " + (Date.now() - start_time) + "ms.");
  console.log("Went from " + starting_size + " to " + final_size + " nodes.");

  return with_parents;
};

function getPrecision(min_y, max_y) {
  const precision = 2000.0 / (max_y - min_y);
  return precision;
}

function getNodes(
  data,
  y_positions,
  min_y,
  max_y,
  min_x,
  max_x,
  xType,
  useHydratedMutations = false,
  mutations = null
) {
  console.log("GETNODES", min_y, max_y, min_x, max_x, xType);
  const start_time = Date.now();
  // get min_x, max_x, min_y, max_y from URL

  const filtered =
    min_y !== undefined ? filter(data, y_positions, min_y, max_y) : data;
  const time2 = Date.now();
  console.log("Filtering took " + (time2 - start_time) + "ms.");
  console.log("Min_y:", min_y, "Max_y:", max_y);
  const reduced_leaves = reduceOverPlotting(
    filtered.filter((node) => node.num_tips == 1),
    getPrecision(min_x, max_x),
    getPrecision(min_y, max_y),
    xType
  );
  const time3 = Date.now();
  console.log("Reducing took " + (time3 - time2) + "ms.");
  let reduced = addParents(data, reduced_leaves);
  if (useHydratedMutations) {
    reduced = reduced.map((node) => {
      const new_node = { ...node };
      new_node.mutations = new_node.mutations.map((x) => mutations[x]);
      return new_node;
    });
  }

  return reduced;
}

function searchFiltering({
  data,
  spec,
  mutations,
  node_to_mut,
  all_data,
  cache_helper,
  rootSequences,
}) {
  const spec_copy = { ...spec };
  spec_copy.key = "cache";
  const hash_spec = crypto
    .createHash("md5")
    .update(JSON.stringify(spec_copy))
    .digest("hex")
    .slice(0, 8);
  if (cache_helper && cache_helper.retrieve_from_cache) {
    const cached_ids = cache_helper.retrieve_from_cache(hash_spec);
    if (cached_ids !== undefined) {
      console.log("Found cached data");
      return cached_ids.map((id) => all_data[id]);
    }
  }
  const result = searchFilteringIfUncached({
    data,
    spec,
    mutations,
    node_to_mut,
    all_data,
    cache_helper,
    rootSequences,
  });

  if (cache_helper && cache_helper.store_in_cache) {
    cache_helper.store_in_cache(
      hash_spec,
      result.map((node) => node.node_id)
    );
  }
  return result;
}

function searchFilteringIfUncached({
  data,
  spec,
  mutations,
  node_to_mut,
  all_data,
  cache_helper,
  rootSequences,
}) {
  if (spec.type == "boolean") {
    if (spec.boolean_method == "and") {
      if (spec.subspecs.length == 0) {
        return [];
      }
      let workingData = data;
      spec.subspecs.forEach((subspec) => {
        const new_results = new Set(
          searchFiltering({
            data: all_data,
            spec: subspec,
            mutations: mutations,
            node_to_mut: node_to_mut,
            all_data: all_data,
            cache_helper: cache_helper,
            rootSequences: rootSequences,
          })
        );
        workingData = workingData.filter((n) => new_results.has(n));
      });
      return workingData;
    }
    if (spec.boolean_method == "or") {
      if (spec.subspecs.length == 0) {
        return [];
      }
      let workingData = new Set();
      spec.subspecs.forEach((subspec) => {
        const results = searchFiltering({
          data: all_data,
          spec: subspec,
          mutations: mutations,
          node_to_mut: node_to_mut,
          all_data: all_data,
          cache_helper: cache_helper,
          rootSequences: rootSequences,
        });
        workingData = new Set([...workingData, ...results]);
      });
      return Array.from(workingData);
    }
    if (spec.boolean_method == "not") {
      let negatives_set = new Set();
      spec.subspecs.forEach((subspec) => {
        const results = searchFiltering({
          data: all_data,
          spec: subspec,
          mutations: mutations,
          node_to_mut: node_to_mut,
          all_data: all_data,
          cache_helper: cache_helper,
          rootSequences: rootSequences,
        });
        negatives_set = new Set([...negatives_set, ...results]);
      });
      return data.filter((node) => !negatives_set.has(node));
    }
  }

  console.log(spec);
  let filtered;
  if (["text_match", "text_exact"].includes(spec.method) && spec.text === "") {
    return [];
  }
  if (spec.position) {
    spec.position = parseInt(spec.position);
  }
  if (spec.method === "text_match") {
    // case insensitive
    spec.text = spec.text.toLowerCase();
    filtered = data.filter(
      (node) =>
        node[spec.type] && node[spec.type].toLowerCase().includes(spec.text)
    );
    return filtered;
  } else if (spec.method === "text_exact") {
    // case insensitive
    spec.text = spec.text.toLowerCase();
    filtered = data.filter(
      (node) => node[spec.type] && node[spec.type].toLowerCase() === spec.text
    );
    return filtered;
  } else if (spec.method === "text_per_line") {
    // case insensitive
    const possible_matches = new Set(
      spec.text
        .toLowerCase()
        .split("\n")
        .map((line) => {
          return line.trim();
        })
        .filter((line) => line !== "")
    );

    filtered = data.filter((node) => {
      if (node[spec.type]) {
        const to_test = node[spec.type].toLowerCase().trim();
        //console.log(to_test);
        // check if node's spec type is in possible_matches
        return possible_matches.has(to_test);
      } else {
        return false;
      }
    });
    return filtered;
  } else if (spec.method === "mutation") {
    const relevant_mutations = mutations
      .filter((mutation) => {
        return (
          mutation &&
          mutation.gene === spec.gene &&
          mutation.residue_pos === spec.position &&
          (spec.new_residue === "any" ||
            mutation.new_residue === spec.new_residue)
        );
      })
      .map((mutation) => mutation.mutation_id);
    console.log("relevant_mutations:", relevant_mutations);
    const relevant_mutations_set = new Set(relevant_mutations);
    //console.log("node_to_mut:", node_to_mut);
    //console.log("NODE", data[0]);

    filtered = data.filter(
      (node) =>
        node_to_mut[node.node_id].some((mutation_id) =>
          relevant_mutations_set.has(mutation_id)
        ) && node.num_tips > spec.min_tips
    );
    //console.log("filtered:", filtered);
    return filtered;
  } else if (spec.method === "revertant") {
    if (!all_data) {
      all_data = data;
    }
    if (revertant_mutations_set === null) {
      revertant_mutations_set = getRevertantMutationsSet(
        all_data,
        node_to_mut,
        mutations,
        rootSequences
      );
    }

    filtered = data.filter(
      (node) =>
        node.num_tips > spec.min_tips &&
        node_to_mut[node.node_id].some((mutation_id) =>
          revertant_mutations_set.has(mutation_id)
        )
    );
    //console.log("filtered:", filtered);
    return filtered;
  } else if (spec.method === "genotype") {
    const genotype = {
      gene: spec.gene,
      position: spec.position,
      new_residue: spec.new_residue,
    };
    return filterByGenotype(
      data,
      genotype,
      mutations,
      node_to_mut,
      all_data,
      rootSequences
    );
  } else if (spec.method === "number") {
    if (spec.number == "") {
      return [];
    }

    const number_value = parseFloat(spec.number);
    const filterFunc = getNumericFilterFunction(
      spec.number_method,
      number_value
    );

    filtered = data.filter((node) => filterFunc(node[spec.type]));
    return filtered;
  }

  return [];
}

function singleSearch({
  data,
  spec,
  min_y,
  max_y,
  y_positions,
  mutations,
  node_to_mut,
  xType,
  min_x,
  max_x,
  cache_helper,
  rootSequences,
}) {
  const text_spec = JSON.stringify(spec);
  const max_to_return = 10000;
  const hash_spec = crypto
    .createHash("md5")
    .update(text_spec)
    .digest("hex")
    .slice(0, 8);
  let filtered = null;
  if (count_per_hash[hash_spec] === undefined) {
    filtered = searchFiltering({
      data,
      spec,
      mutations,
      node_to_mut,
      all_data: data,
      cache_helper,
    });
    count_per_hash[hash_spec] = filtered.length;
  }
  const num_returned = count_per_hash[hash_spec];
  let result;
  if (num_returned > max_to_return) {
    const filtered = searchFiltering({
      data,
      spec,
      mutations,
      node_to_mut,
      all_data: data,
      cache_helper,
    });

    // TODO if we ensured all searches maintained order we could use binary search here
    const filtered_cut = filtered.filter(
      (node) => node.y < max_y && node.y > min_y
    );

    console.log("length of filtered_cut:", filtered_cut.length);

    console.log("min_y:", min_y, "max_y:", max_y);

    // reduce overplotting:
    const reduced = reduceOverPlotting(
      filtered_cut,
      getPrecision(min_x, max_x),
      getPrecision(min_y, max_y),
      xType
    );
    result = {
      type: "filtered",
      data: reduced,
      total_count: num_returned,
    };
  } else {
    if (filtered === null) {
      filtered = searchFiltering({
        data,
        spec,
        mutations,
        node_to_mut,
        all_data: data,
        cache_helper,
      });
    }
    result = {
      type: "complete",
      data: filtered,
      total_count: num_returned,
    };
  }
  return result;
}

function addMutations(input, mutations, node_to_mut) {
  const start_time = new Date();
  const result = input.map((node) => ({
    ...node,
    mutations: node_to_mut[node.node_id],
  }));
  console.log("addMutations:", new Date() - start_time);
  return result;
}

function getChildrenArray(input) {
  if (cachedChildrenArray) {
    return cachedChildrenArray;
  }
  const start_time = new Date();
  const childrenArray = input.map((x) => []);
  input.forEach((node) => {
    if (node.parent_id !== node.node_id) {
      childrenArray[node.parent_id].push(node.node_id);
    }
  });
  console.log("getChildrenArray:", new Date() - start_time);
  cachedChildrenArray = childrenArray;
  return childrenArray;
}

const preOrder = (input, node_id) => {
  const output = [];
  const childrenArray = getChildrenArray(input);
  const stack = [node_id];
  while (stack.length > 0) {
    const node_id = stack.pop();
    output.push(node_id);
    childrenArray[node_id].forEach((child_id) => {
      stack.push(child_id);
    });
  }
  return output;
};

const getTipAtts = (input, node_id, attribute) => {
  const childrenArray = getChildrenArray(input);
  const allChildren = preOrder(input, node_id);
  const allTips = allChildren.filter((x) => childrenArray[x].length === 0);
  const allAtts = allTips.map((x) => input[x][attribute]);
  return allAtts;
};

const filterByGenotype = (
  data,
  genotype,
  mutations,
  node_to_mut,
  all_data,
  rootSequences
) => {
  const genotype_cache = {};
  const { gene, position, new_residue } = genotype;

  const relevant_mutations = mutations.filter((mutation) => {
    return (
      mutation && mutation.gene === gene && mutation.residue_pos === position
    );
  });

  const positive_mutations = new Set(
    relevant_mutations
      .filter((mutation) => mutation.new_residue === new_residue)
      .map((m) => m.mutation_id)
  );

  // if no positive mutations then return empty array
  if (positive_mutations.size === 0) {
    return [];
  }

  const negative_mutations = new Set(
    relevant_mutations
      .filter((mutation) => mutation.new_residue !== new_residue)
      .map((m) => m.mutation_id)
  );
  const output = data.filter((node) => {
    //   console.log("node:",node);
    let cur_node = node;
    const to_label = [];

    while (true) {
      // console.log("cur_node:",cur_node);

      to_label.push(cur_node.node_id);
      const cache_value = genotype_cache[cur_node.node_id];
      const is_positive =
        cache_value === true ||
        node_to_mut[cur_node.node_id].some((mutation_id) =>
          positive_mutations.has(mutation_id)
        );
      if (is_positive) {
        // console.log("positive");
        to_label.forEach((node_id) => {
          genotype_cache[node_id] = true;
        });
        return true;
      }
      const is_negative =
        cache_value === false ||
        node_to_mut[cur_node.node_id].some((mutation_id) =>
          negative_mutations.has(mutation_id)
        );
      if (is_negative) {
        // console.log("negative");
        to_label.forEach((node_id) => {
          genotype_cache[node_id] = false;
        });
        return false;
      }
      if (cur_node.parent_id === cur_node.node_id) {
        // We've reached the root node
        // Check if we have rootSequences data
        if (
          rootSequences &&
          rootSequences.aa &&
          rootSequences.aa[gene] &&
          rootSequences.aa[gene][position] === new_residue
        ) {
          to_label.forEach((node_id) => {
            genotype_cache[node_id] = true;
          });
          return true;
        }
        break;
      }
      cur_node = all_data[cur_node.parent_id];
    }

    // If we get to this point we reached the root node and still didn't find anything, so just return
    return false;
  });
  return output;
};

export default {
  reduceOverPlotting,
  filter,
  search,
  addParents,
  getNodes,
  singleSearch,
  addMutations,
  getTipAtts,
};
